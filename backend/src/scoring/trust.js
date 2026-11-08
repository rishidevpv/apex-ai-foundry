import { SRC_W, SRC_DEF, BAYES_C } from './config.js';

export function mergedRating(reviews) {
  let v = 0; let sum = 0;
  for (const e of reviews || []) {
    if (e.rating === null || e.rating === undefined) continue;
    const n = (e.count || SRC_DEF[e.source] || 5) * (SRC_W[e.source] ?? 0.5);
    v += n; sum += n * e.rating;
  }
  return v ? { r: sum / v, v } : null;
}

// Prior mean per category: category mean if ≥3 rated tools, else the global mean.
export function priorMeans(tools) {
  const rated = tools.map((t) => ({ c: t.category, m: mergedRating(t.reviews) })).filter((x) => x.m);
  const global = rated.length ? rated.reduce((s, x) => s + x.m.r, 0) / rated.length : 4.3;
  const byCat = {};
  for (const x of rated) (byCat[x.c] ||= []).push(x.m.r);
  const means = {};
  for (const [c, arr] of Object.entries(byCat)) if (arr.length >= 3) means[c] = arr.reduce((a, b) => a + b, 0) / arr.length;
  return { global, means, of: (cat) => means[cat] ?? global };
}

// Review rating pulled toward the category average when there are few reviews (Bayesian average).
export function adjustedRating(reviews, m, C = BAYES_C) {
  const merged = mergedRating(reviews);
  const v = merged ? merged.v : 0;
  const r = merged ? merged.r : m;
  return { adj: (v * r + C * m) / (v + C), raw: merged ? merged.r : null, known: !!merged };
}

export function reviewScore(reviews, m, C = BAYES_C) {
  const merged = mergedRating(reviews);
  const v = merged ? merged.v : 0;
  const r = merged ? merged.r : m;
  const adj = (v * r + C * m) / (v + C);
  return Math.min(1, Math.max(0, (adj - 3.5) / 1.5));
}

export function evidenceChecks(tool) {
  return {
    price: !!tool.price_known,
    rating: (tool.reviews || []).length > 0,
    features: (tool.ai_features || []).length > 0,
    integrations: (tool.integrations || []).length > 0,
    free_plan_flag: tool.has_free_plan !== null && tool.has_free_plan !== undefined,
    trial_flag: tool.has_free_trial !== null && tool.has_free_trial !== undefined,
    best_for: !!tool.best_for,
    two_sources: (tool.sources || []).length >= 2,
  };
}

export const evidenceScore = (tool) => Object.values(evidenceChecks(tool)).filter(Boolean).length / 8;
export const sourceScore = (sources) => Math.min((sources || []).reduce((s, x) => s + (x.biased ? 0.5 : 1), 0), 4) / 4;

export function trustBreakdown(tool, m) {
  const R = reviewScore(tool.reviews, m);
  const E = evidenceScore(tool);
  const S = sourceScore(tool.sources);
  return { trust: 0.55 * R + 0.30 * E + 0.15 * S, R, E, S };
}
