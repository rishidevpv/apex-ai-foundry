import { rank } from '../scoring/rank.js';
import { explainPicks } from '../llm/tasks.js';
import { publicTool } from './format.js';
import { CATEGORY_BY_SLUG } from '../data/categories.js';

export const FIT_LABELS = { top_pick: 'Great match', thin_evidence: 'Promising, limited reviews', proven_weak_fit: 'Proven, weaker match', skip: 'Not a match' };
export const trustLabel = (t) => (t >= 0.6 ? 'Well proven' : t >= 0.3 ? 'Some proof' : 'Limited proof');
const dimLabel = (d) => (d.unknown ? 'Not listed' : d.score >= 0.75 ? 'Strong' : d.score >= 0.5 ? 'Okay' : 'Weak');
const DIM_NAMES = { N: 'Solves your problem', B: 'Fits your budget', A: 'Easy for you to set up', T: 'Ready when you need it', I: 'Works with your software' };

export function friendlyBreakdown(b) {
  return Object.entries(DIM_NAMES).map(([k, label]) => ({ key: k, label, level: dimLabel(b[k]), note: b[k].note, weight: Math.round(b.weights[k] * 100) }));
}

export function shapePick(p, explanation) {
  return {
    rank: p.rank,
    tool: publicTool(p.tool),
    fit: p.fit, trust: p.trust, final: p.final, quadrant: p.quadrant,
    apex: p.apex,
    fit_label: FIT_LABELS[p.quadrant], trust_label: trustLabel(p.trust),
    dimensions: friendlyBreakdown(p.breakdown),
    proof: { reviews: p.breakdown.R, evidence: p.breakdown.E, sources: p.breakdown.S },
    explanation, eta: p.eta,
    unknowns: p.tool.unknowns || [],
    category_label: CATEGORY_BY_SLUG[p.tool.category].label,
  };
}

export const shapeOther = ({ s, reason }) => ({
  slug: s.tool.slug, name: s.tool.name, category_label: CATEGORY_BY_SLUG[s.tool.category]?.label,
  price_text: publicTool(s.tool).price_text, website_url: publicTool(s.tool).website_url, rating: s.apex?.rating ?? null, reason: reason.text, reason_code: reason.code, left_out: !!s.reasons,
});

export async function buildResults(tools, profile, summary, userId) {
  const r = rank(tools, profile);
  const explanations = await explainPicks(r.picks, profile, userId);
  const pickedIds = new Set(r.picks.map((p) => p.tool.id));
  return {
    scoring_version: r.scoring_version,
    profile, summary,
    picks: r.picks.map((p, i) => shapePick(p, explanations[i])),
    chart: r.all.map((s) => ({ slug: s.tool.slug, name: s.tool.name, rating: s.apex?.rating, fit: s.fit, trust: s.trust, quadrant: s.quadrant, picked: pickedIds.has(s.tool.id), gated: !!s.reasons })),
    shortfall: r.shortfall,
    others: r.others.map(shapeOther),
    considered: r.all.length,
    generated_at: new Date().toISOString(),
  };
}
