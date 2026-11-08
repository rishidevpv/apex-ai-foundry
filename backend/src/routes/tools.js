import { Router } from 'express';
import { z } from 'zod';
import { db, q, liveTools } from '../db.js';
import { publicTool } from '../features/format.js';
import { CATEGORIES, OUTCOME_LABELS, BUSINESS_TYPES, SOFTWARE } from '../data/categories.js';
import { trustBreakdown, priorMeans, evidenceChecks } from '../scoring/trust.js';
import { softwareMatches } from '../scoring/features.js';
import { trustLabel } from '../features/recommendations.js';
import { compareText } from '../llm/tasks.js';
import { optionalAuth } from '../security/auth.js';
import { apexScore } from '../scoring/apex.js';
import { mergedRating } from '../scoring/trust.js';

// The signed-in owner's current answers, used to give every tool a personal APEX rating.
async function viewerProfile(req) {
  if (!req.user) return null;
  const p = await q(db().from('profiles').select('structured').eq('user_id', req.user.id).eq('is_current', true).maybeSingle());
  return p?.structured || null;
}
const publicReviewRating = (t) => { const m = mergedRating(t.reviews); return m ? Math.round(m.r * 10) / 10 : null; };

const r = Router();

r.get('/meta', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ categories: CATEGORIES, outcome_labels: OUTCOME_LABELS, business_types: BUSINESS_TYPES, software: SOFTWARE });
});

const ListQ = z.object({
  q: z.string().max(100).optional(),
  category: z.string().max(40).optional(),
  price: z.enum(['free', '50', '150', 'any']).optional().default('any'),
  trial: z.enum(['1', '0']).optional(),
  works: z.string().max(40).optional(),
  sort: z.enum(['relevance', 'name', 'price', 'evidence', 'for_you']).optional().default('relevance'),
  offset: z.coerce.number().int().min(0).max(1000).optional().default(0),
  limit: z.coerce.number().int().min(1).max(48).optional().default(12),
});

const card = (t, means, profile) => {
  const tb = trustBreakdown(t, means.of(t.category));
  const p = publicTool(t);
  return { website_url: p.website_url || null, review_rating: publicReviewRating(t), apex: profile ? apexScore(t, profile, means.of(t.category)) : null, slug: p.slug, name: p.name, category: p.category, best_for: p.best_for, summary: p.summary, price_text: p.price_text, has_free_plan: p.has_free_plan, has_free_trial: p.has_free_trial, integrations: p.integrations, smb_fit_flag: p.smb_fit_flag, evidence_label: trustLabel(tb.trust), trust: tb.trust };
};

r.get('/tools', optionalAuth, async (req, res) => {
  const p = ListQ.safeParse(req.query);
  if (!p.success) return res.status(400).json({ error: 'Invalid filters' });
  const f = p.data;
  const tools = await liveTools();
  const means = priorMeans(tools);
  let list = tools;
  const term = f.q?.trim().toLowerCase();
  const scoreText = (t) => {
    if (!term) return 1;
    const hay = [t.name, t.category, t.best_for, t.summary, ...(t.ai_features || []), ...(t.typical_use_cases || [])].join(' ').toLowerCase();
    if (t.name.toLowerCase().includes(term)) return 3;
    return hay.includes(term) ? 1 : term.split(/\s+/).filter((w) => w.length > 2 && hay.includes(w)).length / 3;
  };
  if (term) list = list.filter((t) => scoreText(t) > 0);
  if (f.category) list = list.filter((t) => t.category === f.category);
  if (f.price === 'free') list = list.filter((t) => t.has_free_plan === true);
  if (f.price === '50' || f.price === '150') list = list.filter((t) => t.has_free_plan === true || (t.price_min_month !== null && Number(t.price_min_month) < Number(f.price)));
  if (f.trial === '1') list = list.filter((t) => t.has_free_trial === true);
  if (f.works) list = list.filter((t) => (t.integrations || []).some((i) => softwareMatches(f.works, i)));
  const profile = await viewerProfile(req);
  const cards = list.map((t) => ({ ...card(t, means, profile), _rel: scoreText(t), _price: t.price_min_month === null ? Infinity : Number(t.price_min_month) }));
  const sorters = {
    relevance: (a, b) => b._rel - a._rel || b.trust - a.trust,
    name: (a, b) => a.name.localeCompare(b.name),
    price: (a, b) => a._price - b._price || a.name.localeCompare(b.name),
    evidence: (a, b) => b.trust - a.trust,
    for_you: (a, b) => (b.apex?.score ?? 0) - (a.apex?.score ?? 0) || b.trust - a.trust,
  };
  cards.sort(sorters[f.sort]);
  const page = cards.slice(f.offset, f.offset + f.limit).map(({ _rel, _price, trust, ...c }) => c);
  // Personal ratings must never be cached for other people.
  res.set('Cache-Control', profile ? 'private, no-store' : 'public, max-age=60');
  res.json({ total: cards.length, offset: f.offset, items: page, personalized: !!profile });
});

r.get('/tools/:slug', optionalAuth, async (req, res) => {
  const slug = z.string().max(80).regex(/^[a-z0-9-]+$/).safeParse(req.params.slug);
  if (!slug.success) return res.status(404).json({ error: 'Tool not found' });
  const tools = await liveTools();
  const t = tools.find((x) => x.slug === slug.data);
  if (!t) return res.status(404).json({ error: 'Tool not found' });
  const means = priorMeans(tools);
  const tb = trustBreakdown(t, means.of(t.category));
  const [comments, community] = await Promise.all([
    q(db().from('comments').select('id,body,rating,display_name,business_type,sentiment,topics,created_at').eq('tool_id', t.id).order('created_at', { ascending: false }).limit(50)),
    q(db().from('tool_community').select('comment_count,avg_rating,sentiment_score').eq('tool_id', t.id).maybeSingle()),
  ]);
  const byType = {};
  comments.forEach((c) => { if (c.business_type) byType[c.business_type] = (byType[c.business_type] || 0) + 1; });
  const profile = await viewerProfile(req);
  if (profile) res.set('Cache-Control', 'private, no-store');
  res.json({
    tool: publicTool(t),
    review_rating: publicReviewRating(t),
    apex: profile ? apexScore(t, profile, means.of(t.category)) : null,
    trust: { label: trustLabel(tb.trust), reviews: tb.R, evidence: tb.E, sources: tb.S, checks: evidenceChecks(t) },
    comments, community: community || { comment_count: 0, avg_rating: null }, community_by_type: byType,
  });
});

r.post('/compare', optionalAuth, async (req, res) => {
  const p = z.object({ slugs: z.array(z.string().max(80)).min(2).max(3) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Pick two or three tools to compare.' });
  const tools = await liveTools();
  const means = priorMeans(tools);
  const chosen = p.data.slugs.map((s) => tools.find((t) => t.slug === s)).filter(Boolean);
  if (chosen.length < 2) return res.status(404).json({ error: 'Some of those tools were not found.' });
  const text = await compareText(chosen);
  const profile = await viewerProfile(req);
  res.json({
    personalized: !!profile,
    tools: chosen.map((t) => ({ ...publicTool(t), trust_label: trustLabel(trustBreakdown(t, means.of(t.category)).trust), review_rating: publicReviewRating(t), apex: profile ? apexScore(t, profile, means.of(t.category)) : null })),
    tradeoffs: text,
  });
});

export default r;
