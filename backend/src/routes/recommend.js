import { Router } from 'express';
import { db, q, liveTools } from '../db.js';
import { requireAuth } from '../security/auth.js';
import { limit } from '../security/rateLimit.js';
import { mapAnswers, inferNeeds, inferNeedsFromCatalog } from '../features/profile.js';
import { profileSummary } from '../llm/tasks.js';
import { buildResults, shapePick, shapeOther } from '../features/recommendations.js';
import { rank, whyNotPicked } from '../scoring/rank.js';
import { SCORING_VERSION } from '../scoring/config.js';

const r = Router();

r.post('/profile', requireAuth, limit('write'), async (req, res) => {
  let mapped;
  try { mapped = mapAnswers(req.body?.answers); } catch (e) { return res.status(400).json({ error: e.issues?.[0]?.message || 'Please check your answers.' }); }
  const { answers, profile } = mapped;
  const s = await profileSummary(answers, profile, req.user.id);
  if (answers.something_else) {
    // AI suggestion first, then plain keyword matching, then a catalog search on the owner's own words.
    let extra = [...(s.extra_needs || []), ...inferNeeds(answers.free_text)];
    if (!extra.length && !profile.primary_needs.length) extra = inferNeedsFromCatalog(answers.free_text, await liveTools());
    for (const n of extra) if (profile.primary_needs.length < 2 && !profile.primary_needs.includes(n)) { profile.primary_needs.push(n); profile.hours_per_week[n] = 3; }
  }
  if (!profile.primary_needs.length) return res.status(400).json({ error: 'We could not match what you wrote to a type of tool. Add a few more words in the last question (for example “answering calls” or “sending invoices”), or tick one of the listed headaches.', field: 'needs' });
  profile.summary = s.summary;
  const cur = await q(db().from('profiles').select('id,version').eq('user_id', req.user.id).eq('is_current', true).maybeSingle());
  if (cur) await q(db().from('profiles').update({ is_current: false }).eq('id', cur.id));
  const row = await q(db().from('profiles').insert({ user_id: req.user.id, answers, structured: profile, summary: s.summary, version: (cur?.version || 0) + 1, is_current: true }).select('id,version').single());
  res.json({ profile_id: row.id, version: row.version, profile, summary: s.summary });
});

r.get('/profile/current', requireAuth, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const p = await q(db().from('profiles').select('id,answers,structured,summary,version').eq('user_id', req.user.id).eq('is_current', true).maybeSingle());
  res.json({ profile: p });
});

async function currentProfile(userId) {
  return q(db().from('profiles').select('id,structured,summary').eq('user_id', userId).eq('is_current', true).maybeSingle());
}

r.post('/recommend', requireAuth, limit('recommend'), async (req, res) => {
  const p = await currentProfile(req.user.id);
  if (!p) return res.status(404).json({ error: 'Answer the questions first.' });
  const tools = await liveTools();
  const results = await buildResults(tools, p.structured, p.summary, req.user.id);
  const existing = await q(db().from('recommendations').select('tool_id,breakdown,scoring_version').eq('profile_id', p.id));
  const sig = (rows) => rows.map((x) => `${x.tool_id}:${x.v}`).sort().join(',');
  const same = existing.length === results.picks.length && existing.every((e) => e.scoring_version === SCORING_VERSION)
    && sig(existing.map((e) => ({ tool_id: e.tool_id, v: e.breakdown?.tool_version }))) === sig(results.picks.map((x) => ({ tool_id: x.tool.id, v: x.tool.version })));
  if (!same) {
    await q(db().from('recommendations').delete().eq('profile_id', p.id));
    if (results.picks.length) {
      await q(db().from('recommendations').insert(results.picks.map((x) => ({
        profile_id: p.id, tool_id: x.tool.id, rank: x.rank, fit: x.fit, trust: x.trust, final: x.final, quadrant: x.quadrant,
        breakdown: { dimensions: x.dimensions, proof: x.proof, apex: x.apex, tool_version: x.tool.version }, explanation: x.explanation, eta: x.eta, scoring_version: SCORING_VERSION,
      }))));
    }
  }
  res.json({ results, reused: same });
});

// Read-only: saved explanations + deterministic re-rank for the chart (no LLM call).
r.get('/recommend/latest', requireAuth, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const p = await currentProfile(req.user.id);
  if (!p) return res.json({ results: null });
  const recs = await q(db().from('recommendations').select('tool_id,explanation,rank,scoring_version').eq('profile_id', p.id).order('rank'));
  if (!recs.length) return res.json({ results: null, needs_refresh: true });
  const tools = await liveTools();
  const ranked = rank(tools, p.structured);
  const byId = Object.fromEntries(ranked.picks.map((x) => [x.tool.id, x]));
  // Always show saved picks in the order of the owner's current APEX rating (highest first).
  const picks = recs.map((rc) => byId[rc.tool_id] && shapePick(byId[rc.tool_id], rc.explanation)).filter(Boolean)
    .sort((a, b) => (b.apex?.rating ?? 0) - (a.apex?.rating ?? 0));
  const pickedIds = new Set(picks.map((x) => x.tool.id));
  res.json({
    // Results saved under an older scoring method are rebuilt automatically.
    needs_refresh: picks.length !== recs.length || picks.length !== ranked.picks.length || recs.some((rc) => rc.scoring_version !== SCORING_VERSION),
    results: {
      scoring_version: SCORING_VERSION, profile: p.structured, summary: p.summary,
      picks: picks.map((x, i) => ({ ...x, rank: i + 1 })),
      chart: ranked.all.map((s) => ({ slug: s.tool.slug, name: s.tool.name, rating: s.apex?.rating, fit: s.fit, trust: s.trust, quadrant: s.quadrant, picked: pickedIds.has(s.tool.id), gated: !!s.reasons })),
      shortfall: ranked.shortfall, considered: ranked.all.length,
      // Reasons are worked out against the picks the owner actually sees.
      others: ranked.all.filter((x) => !pickedIds.has(x.tool.id)).sort((a, b) => (!!a.reasons - !!b.reasons) || (b.apex?.rating ?? 0) - (a.apex?.rating ?? 0))
        .map((x) => shapeOther({ s: x, reason: whyNotPicked(x, picks.map((pk) => ({ tool: { category: pk.tool.category }, rating: pk.apex?.rating })), p.structured) })),
    },
  });
});

export default r;
