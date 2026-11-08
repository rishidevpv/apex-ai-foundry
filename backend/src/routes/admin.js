import { Router } from 'express';
import { apexScore } from '../scoring/apex.js';
import { rank, whyNotPicked } from '../scoring/rank.js';
import { shapeOther } from '../features/recommendations.js';
import { priorMeans } from '../scoring/trust.js';
import { z } from 'zod';
import { db, q, liveTools, invalidateTools, dataBackend } from '../db.js';
import { requireAdmin, userFromRequest, isAdmin } from '../security/auth.js';
import { env } from '../env.js';
import { runRematch } from '../jobs/rematch.js';
import { enrichAll, generateDemos } from '../features/demo.js';
import { budgetStatus } from '../llm/call.js';
import { publicTool } from '../features/format.js';

const r = Router();
const audit = (admin, action, target, details) => q(db().from('admin_audit').insert({ admin_id: admin.id, action, target, details }));

r.get('/admin/pending', requireAdmin, async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  const rows = await q(db().from('tools').select('*').eq('status', 'pending').order('updated_at', { ascending: false }));
  res.json({ tools: rows.map((t) => ({ ...publicTool(t), contact_email: t.contact_email })) });
});

r.post('/admin/approve', requireAdmin, async (req, res) => {
  const p = z.object({ id: z.string().uuid(), decision: z.enum(['approve', 'reject']).default('approve') }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Invalid request' });
  const status = p.data.decision === 'approve' ? 'live' : 'rejected';
  const rows = await q(db().from('tools').update({ status, approved_by: req.user.id, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', p.data.id).eq('status', 'pending').select('id,slug,name,status'));
  if (!rows.length) return res.status(404).json({ error: 'That submission is not pending.' });
  await audit(req.user, p.data.decision, rows[0].slug, null);
  invalidateTools();
  let enrich = null; let rematch = null;
  if (status === 'live') { enrich = await enrichAll({ onlyIds: [p.data.id] }); rematch = await runRematch(); }
  res.json({ tool: rows[0], enrich, rematch });
});

r.get('/admin/llm', requireAdmin, async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  const since = new Date(); since.setUTCHours(0, 0, 0, 0);
  const rows = await q(db().from('llm_usage').select('task,est_cost_usd,cache_hit,fallback_used,created_at').gte('created_at', since.toISOString()).limit(50000));
  const byTask = {};
  rows.forEach((r2) => {
    const t = (byTask[r2.task || 'unknown'] ||= { task: r2.task, calls: 0, cost: 0, cache_hits: 0, fallbacks: 0 });
    t.calls += 1; t.cost += Number(r2.est_cost_usd || 0); if (r2.cache_hit) t.cache_hits += 1; if (r2.fallback_used) t.fallbacks += 1;
  });
  const budget = await budgetStatus();
  res.json({
    budget, calls_today: rows.length,
    cache_hit_rate: rows.length ? rows.filter((x) => x.cache_hit).length / rows.length : 0,
    fallbacks_today: rows.filter((x) => x.fallback_used).length,
    by_task: Object.values(byTask), llm_enabled: !!(env.OPENROUTER_API_KEY && env.LLM_DISABLED !== 'true'),
  });
});

const DEMO_TOOL = {
  slug: 'demo-better-booking', name: 'BookEasy Demo (sample tool)', category: 'scheduling',
  best_for: 'Small salons and service shops that want simple online booking with reminders',
  summary: 'SAMPLE LISTING for the alert demo. Online booking with text reminders.',
  has_free_plan: true, has_free_trial: true, pricing_notes: 'Free plan; paid plans from $15 per month (sample data)',
  price_min_month: 15, price_max_month: 15, price_known: true, price_conflict: false, is_usage_based: false, is_per_seat: false,
  reviews: [{ source: 'g2', rating: 4.8, count: 400, is_customer: true }, { source: 'capterra', rating: 4.7, count: 250, is_customer: true }],
  sources: [{ url: 'https://example.com/sample-review-a', kind: 'editorial', biased: false }, { url: 'https://example.com/sample-review-b', kind: 'editorial', biased: false }, { url: 'https://example.com/sample-review-c', kind: 'editorial', biased: false }, { url: 'https://example.com/sample-review-d', kind: 'editorial', biased: false }],
  ai_features: ['Automatic reminders', 'Online booking'], integrations: ['Square', 'Google Calendar'], unknowns: ['This is a sample listing for demonstration'],
  setup_complexity: 1, setup_time_class: 'same_day', tech_level_needed: 1, outcomes: ['fewer_no_shows', 'online_booking', 'automatic_reminders'],
  business_types: ['salon', 'any'], typical_use_cases: ['Clients book online and get reminders.'], smb_fit_flag: 'good',
  origin: 'discovered', status: 'live', last_checked_at: new Date().toISOString().slice(0, 10),
};

r.post('/admin/demo-better-tool', requireAdmin, async (req, res) => {
  if (env.DEMO_MODE !== 'true') return res.status(403).json({ error: 'Demo actions are turned off.' });
  await q(db().from('tools').upsert({ ...DEMO_TOOL, approved_by: req.user.id, approved_at: new Date().toISOString() }, { onConflict: 'slug' }));
  invalidateTools();
  await audit(req.user, 'demo_better_tool', DEMO_TOOL.slug, null);
  const rematch = await runRematch();
  res.json({ tool: DEMO_TOOL.slug, rematch, note: 'A clearly labelled sample tool was added. No emails or texts were sent.' });
});

r.post('/admin/demo-better-tool/remove', requireAdmin, async (req, res) => {
  await q(db().from('tools').update({ status: 'rejected' }).eq('slug', DEMO_TOOL.slug));
  invalidateTools();
  await audit(req.user, 'demo_better_tool_remove', DEMO_TOOL.slug, null);
  res.json({ ok: true });
});

r.post('/admin/regenerate-demo', requireAdmin, async (req, res) => {
  const out = await generateDemos();
  await audit(req.user, 'regenerate_demo', null, null);
  res.json({ personas: out });
});

r.post('/jobs/rematch', async (req, res) => {
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/, '');
  let ok = !!env.CRON_SECRET && bearer === env.CRON_SECRET;
  if (!ok) { const u = await userFromRequest(req); ok = isAdmin(u); if (ok) await audit(u, 'rematch', null, null); }
  if (!ok) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ stats: await runRematch() });
});

r.get('/demo', async (_req, res) => {
  const rows = await q(db().from('demo_personas').select('slug,label,summary,generated_at'));
  res.set('Cache-Control', 'public, max-age=60');
  res.json({ personas: rows });
});

r.get('/demo/:slug', async (req, res) => {
  const slug = z.string().max(40).regex(/^[a-z0-9-]+$/).safeParse(req.params.slug);
  if (!slug.success) return res.status(404).json({ error: 'Sample not found' });
  const row = await q(db().from('demo_personas').select('slug,label,summary,structured,results,generated_at').eq('slug', slug.data).maybeSingle());
  if (!row) return res.status(404).json({ error: 'Sample not found' });
  // Rate each stored pick for this sample business with the current APEX rubric.
  if (row.results?.picks?.length && row.structured) {
    const tools = await liveTools();
    const means = priorMeans(tools);
    const picks = row.results.picks.map((pk) => {
      const t = tools.find((x) => x.slug === pk.tool.slug);
      return t ? { ...pk, apex: apexScore(t, row.structured, means.of(t.category)) } : pk;
    }).sort((a, b) => (b.apex?.score ?? 0) - (a.apex?.score ?? 0)).map((pk, i) => ({ ...pk, rank: i + 1 }));
    const shown = new Set(picks.map((pk) => pk.tool.slug));
    const ranked = rank(tools, row.structured);
    const others = ranked.all.filter((x) => !shown.has(x.tool.slug)).sort((a, b) => (!!a.reasons - !!b.reasons) || (b.apex?.rating ?? 0) - (a.apex?.rating ?? 0))
      .map((x) => shapeOther({ s: x, reason: whyNotPicked(x, picks.map((pk) => ({ tool: { category: tools.find((t) => t.slug === pk.tool.slug)?.category }, rating: pk.apex?.rating })), row.structured) }));
    row.results = { ...row.results, picks, others };
  }
  res.json({ persona: row });
});

r.get('/healthz', async (_req, res) => {
  let ok = false;
  try { await liveTools(); ok = true; } catch { ok = false; }
  res.json({ status: ok && dataBackend === 'supabase' ? 'ok' : 'degraded', database: ok ? dataBackend : 'error', llm: env.OPENROUTER_API_KEY && env.LLM_MODEL_CHEAP ? (env.LLM_DISABLED === 'true' ? 'disabled' : 'configured') : 'not_configured' });
});

export default r;
