import { ALPHA, FIT_THRESHOLD, TRUST_THRESHOLD, TIE_EPS, SCORING_VERSION } from './config.js';
import { fitBreakdown } from './features.js';
import { trustBreakdown, priorMeans } from './trust.js';
import { eta } from './eta.js';
import { apexScore } from './apex.js';

export const finalScore = (fit, trust, alpha = ALPHA) => Math.pow(fit, alpha) * Math.pow(trust, 1 - alpha);

export function quadrant(fit, trust, ft = FIT_THRESHOLD, tt = TRUST_THRESHOLD) {
  if (fit >= ft && trust >= tt) return 'top_pick';
  if (fit >= ft) return 'thin_evidence';
  if (trust >= tt) return 'proven_weak_fit';
  return 'skip';
}

export function gates(tool, profile) {
  const reasons = [];
  if (tool.price_min_month !== null && tool.price_min_month !== undefined && tool.has_free_plan !== true
    && Number(tool.price_min_month) > 1.5 * profile.budget_month) reasons.push('over_budget');
  if (profile.free_only && tool.has_free_plan !== true && tool.has_free_trial !== true) reasons.push('no_free_option');
  if (['too_heavy', 'too_costly'].includes(tool.smb_fit_flag) && profile.team_size_band !== '10-49') reasons.push('too_big');
  return reasons;
}

const priceOrInf = (t) => (t.price_min_month === null || t.price_min_month === undefined ? Infinity : Number(t.price_min_month));

export function compareRanked(a, b) {
  if (Math.abs(a.final - b.final) > TIE_EPS) return b.final - a.final;
  if (a.trust !== b.trust) return b.trust - a.trust;
  return priceOrInf(a.tool) - priceOrInf(b.tool);
}

export function scoreTool(tool, profile, means, opts = {}) {
  const { fit, dims, weights } = fitBreakdown(tool, profile);
  const tb = trustBreakdown(tool, means.of(tool.category));
  // Ranking follows the owner's personal APEX score (BANT + skill + reviews), so the order matches the ratings they see.
  const apex = apexScore(tool, profile, means.of(tool.category));
  const final = opts.legacyFinal ? finalScore(fit, tb.trust, opts.alpha) : apex.score;
  return {
    tool, fit, trust: tb.trust, final, apex,
    quadrant: quadrant(fit, tb.trust, opts.fitThreshold, opts.trustThreshold),
    breakdown: { ...Object.fromEntries(Object.entries(dims).map(([k, v]) => [k, v])), weights, R: tb.R, E: tb.E, S: tb.S },
  };
}

function pickTop(ordered, needs) {
  const picks = [];
  const count = (c) => picks.filter((p) => p.tool.category === c).length;
  if (ordered[0]) picks.push(ordered[0]);
  if (needs.length > 1) {
    const missing = needs.find((n) => !picks.some((p) => p.tool.category === n));
    const best = ordered.find((s) => s.tool.category === missing);
    if (best) picks.push(best);
  }
  for (const s of ordered) {
    if (picks.length >= 3) break;
    if (picks.includes(s) || count(s.tool.category) >= 2) continue;
    picks.push(s);
  }
  return picks.sort(compareRanked);
}

export function shortfallReasons(scored, gated, picks, profile) {
  if (picks.length >= 3) return [];
  const reasons = [];
  const n = (r) => gated.filter((g) => g.reasons.includes(r)).length;
  if (profile.free_only && n('no_free_option')) reasons.push(`Only ${picks.length} tool${picks.length === 1 ? '' : 's'} fit a free-only budget. ${n('no_free_option')} others have no known free plan or free trial.`);
  if (!profile.free_only && n('over_budget')) reasons.push(`${n('over_budget')} tool${n('over_budget') === 1 ? '' : 's'} cost much more than your budget.`);
  if (n('too_big')) reasons.push(`${n('too_big')} tool${n('too_big') === 1 ? ' is' : 's are'} built for bigger businesses, so we left ${n('too_big') === 1 ? 'it' : 'them'} out for a team your size.`);
  const weak = scored.filter((s) => s.quadrant === 'proven_weak_fit' || s.quadrant === 'skip').length;
  if (weak) reasons.push(`${weak} other tool${weak === 1 ? '' : 's'} did not match your answers well enough to recommend.`);
  if (!reasons.length) reasons.push('Not enough tools in your chosen areas matched well, so we are not filling the list with poor matches.');
  return reasons;
}

const money = (n) => `$${Number(n) % 1 ? Number(n).toFixed(2) : Number(n)}`;
const joinWords = (a) => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);

// Plain-English reason a considered tool did not make the top picks.
export function whyNotPicked(s, picks, profile) {
  if (s.reasons?.includes('over_budget')) return { code: 'over_budget', text: `Costs more than your budget (from ${money(s.tool.price_min_month)} a month)` };
  if (s.reasons?.includes('no_free_option')) return { code: 'no_free_option', text: 'No free plan or free trial, and you asked for free tools only' };
  if (s.reasons?.includes('too_big')) return { code: 'too_big', text: 'Built for bigger businesses than a team your size' };
  const weak = (s.apex?.dims || []).filter((d) => d.level === 'Weak').map((d) => d.label.toLowerCase());
  if (s.quadrant === 'proven_weak_fit' || s.quadrant === 'skip') {
    return { code: 'weak_match', text: weak.length ? `Weaker match on ${joinWords(weak)}` : 'Did not match your answers as closely as your picks' };
  }
  const rating = s.apex?.rating ?? 0;
  const lowestPick = Math.min(...picks.map((p) => p.apex?.rating ?? p.rating ?? 5));
  if (picks.length && rating > lowestPick) return { code: 'coverage', text: 'Good option — we made room for a tool for each problem you picked' };
  if (picks.filter((p) => p.tool.category === s.tool.category).length >= 2) return { code: 'category_full', text: 'Good option — we show up to two tools per problem, and your picks rated higher' };
  if (weak.length) return { code: 'rated_lower', text: `Rated lower than your picks — weaker on ${joinWords(weak)}` };
  return { code: 'rated_lower', text: 'Good option, but rated a little lower than your picks' };
}

export function rank(tools, profile, opts = {}) {
  const means = opts.means || priorMeans(tools);
  const live = tools.filter((t) => t.status === 'live' && profile.primary_needs.includes(t.category));
  const gated = []; const scored = [];
  for (const t of live) {
    const reasons = gates(t, profile);
    const s = scoreTool(t, profile, means, opts);
    if (reasons.length) gated.push({ ...s, reasons }); else scored.push(s);
  }
  scored.sort(compareRanked);
  const top = scored.filter((s) => s.quadrant === 'top_pick');
  const thin = scored.filter((s) => s.quadrant === 'thin_evidence');
  // Every good match competes on the owner's APEX rating (which already includes review strength),
  // so a higher-rated tool is never passed over for a lower-rated one.
  const byRatingPool = (a, b) => (b.apex?.rating ?? 0) - (a.apex?.rating ?? 0) || compareRanked(a, b);
  const pool = [...top, ...thin].sort(byRatingPool);
  // Show picks in the order of the rating the owner sees (ties keep the usual trust/price tie-break).
  const byRating = (a, b) => (b.apex?.rating ?? 0) - (a.apex?.rating ?? 0) || compareRanked(a, b);
  const picks = pickTop(pool, profile.primary_needs).sort(byRating).map((s, i) => ({ ...s, rank: i + 1, eta: eta(s.tool, profile, s.fit) }));
  return {
    scoring_version: SCORING_VERSION,
    picks,
    all: [...scored, ...gated].sort(compareRanked),
    shortfall: shortfallReasons(scored, gated, picks, profile),
    // Everything else we looked at, best-rated first (left-out tools last), each with the reason it wasn't picked.
    others: [...scored, ...gated].filter((s) => !picks.some((p) => p.tool.id === s.tool.id))
      .sort((a, b) => (!!a.reasons - !!b.reasons) || (b.apex?.rating ?? 0) - (a.apex?.rating ?? 0))
      .map((s) => ({ s, reason: whyNotPicked(s, picks, profile) })),
  };
}

// Baselines for evaluation: stars-only and fit-only orderings on the same candidates.
export function baselineRank(tools, profile, mode) {
  const means = priorMeans(tools);
  const live = tools.filter((t) => t.status === 'live' && profile.primary_needs.includes(t.category) && !gates(t, profile).length);
  const s = live.map((t) => scoreTool(t, profile, means));
  if (mode === 'stars') s.sort((a, b) => b.breakdown.R - a.breakdown.R);
  else s.sort((a, b) => b.fit - a.fit);
  return s.slice(0, 3);
}
