// APEX personal rating — a BANT-style rubric, scored per owner, blended with public review ratings.
//
//   B  Budget        — does the price fit what this owner said they can spend?
//   A  Availability  — can they start now? (free plan / trial) and does it plug into software they already use?
//   N  Need          — does it solve the problems they picked and the outcomes they want?
//   T  Time          — is it ready as soon as they need it (setup time vs. their urgency)?
//   S  Skill         — can they set it up at their comfort level with technology?
//
// BANT score (0–1) = weighted mix of the five checks; the owner's top priority gets extra weight.
// APEX score (0–1) = 70% BANT + 30% review rating (reviews pulled toward the category average when there are few).
// Shown to owners as a rating from 1.0 to 5.0 (an average match ≈ 3.0, a strong match ≈ 4.5) —
// so the same tool rates differently for different businesses.
import { budgetScore, needScore, timelineScore, easeScore, integrationScore } from './features.js';
import { adjustedRating } from './trust.js';

export const APEX_WEIGHTS = { N: 0.30, B: 0.25, A: 0.15, T: 0.15, S: 0.15 };
export const APEX_PRIORITY = { cost: 'B', ease: 'S', speed: 'T', results: 'N' };
export const BANT_SHARE = 0.70;
export const APEX_LABELS = { B: 'Budget', A: 'Availability', N: 'Need', T: 'Time to set up', S: 'Your skill level' };
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
// 0–1 score → 1.0–5.0 stars, centred on 3.0 so differences between tools are easy to see.
export const toStars = (x) => Math.round(Math.max(1, Math.min(5, 3 + 6 * (x - 0.5))) * 10) / 10;

export function apexWeights(priority) {
  const w = { ...APEX_WEIGHTS };
  const dim = APEX_PRIORITY[priority];
  if (!dim) return w;
  const others = Object.keys(w).filter((k) => k !== dim);
  w[dim] += 0.10;
  others.forEach((k) => { w[k] -= 0.10 / others.length; });
  return w;
}

export function availabilityScore(tool, profile) {
  let tryNow; let note;
  if (tool.has_free_plan === true) { tryNow = 1; note = 'Free plan — start today'; }
  else if (tool.has_free_trial === true) { tryNow = 0.85; note = 'Free trial available'; }
  else if (tool.has_free_plan === false && tool.has_free_trial === false) { tryNow = 0.35; note = 'Paid from day one'; }
  else { tryNow = 0.5; note = 'Free option not listed'; }
  const integ = integrationScore(tool, profile);
  return { score: clamp01(0.5 * tryNow + 0.5 * integ.score), unknown: tryNow === 0.5 && integ.unknown, note: integ.matched?.length ? `${note} · works with ${integ.matched.join(', ')}` : note };
}

export const levelOf = (d) => (d.unknown ? 'Not listed' : d.score >= 0.75 ? 'Strong' : d.score >= 0.5 ? 'Okay' : 'Weak');
const SOURCE_NAMES = { g2: 'G2', capterra: 'Capterra', trustpilot: 'Trustpilot', editorial: 'Editorial', toolradar: 'Toolradar' };

export function apexScore(tool, profile, categoryMean) {
  const need = needScore(tool, profile);
  // If the tool is in an area the owner picked, the need is known even when detailed outcomes aren't listed.
  if (need.unknown && (profile.primary_needs || []).includes(tool.category)) { need.unknown = false; need.note = 'Solves a problem you picked'; }
  const dims = { B: budgetScore(tool, profile), A: availabilityScore(tool, profile), N: need, T: timelineScore(tool, profile), S: easeScore(tool, profile) };
  const weights = apexWeights(profile.priority);
  const bant = Object.keys(weights).reduce((s, k) => s + weights[k] * dims[k].score, 0);
  const rv = adjustedRating(tool.reviews, categoryMean);
  const reviewNorm = clamp01((rv.adj - 3) / 2); // 3★ → 0, 5★ → 1
  const score = BANT_SHARE * bant + (1 - BANT_SHARE) * reviewNorm;
  const rated = (tool.reviews || []).filter((r) => r.rating !== null && r.rating !== undefined);
  return {
    rating: toStars(score),
    score: round(score, 4),
    bant: round(bant, 4),
    bant_rating: toStars(bant),
    dims: Object.keys(APEX_LABELS).map((k) => ({ key: k, label: APEX_LABELS[k], score: round(dims[k].score), level: levelOf(dims[k]), note: dims[k].note || null, weight: Math.round(weights[k] * 100) })),
    reviews: { rating: rv.known ? round(rv.raw, 1) : null, adjusted: round(rv.adj, 2), sources: [...new Set(rated.map((r) => SOURCE_NAMES[r.source] || r.source))], weight: Math.round((1 - BANT_SHARE) * 100) },
  };
}
