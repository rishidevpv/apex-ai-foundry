import { describe, it, expect } from 'vitest';
import { apexScore, apexWeights, availabilityScore } from '../src/scoring/apex.js';
import { rank } from '../src/scoring/rank.js';
import { loadCsvTools } from '../scripts/seed-dry.js';
import { mapAnswers } from '../src/features/profile.js';
import { PERSONAS } from '../src/data/personas.js';
import { priorMeans } from '../src/scoring/trust.js';

const profile = { business_type: 'salon', team_size_band: '2-9', primary_needs: ['scheduling'], hours_per_week: { scheduling: 5 }, outcomes: ['fewer_no_shows'], budget_month: 150, free_only: false, existing_software: ['Google Calendar'], tech_comfort: 2, urgency: 'this_week', priority: 'ease' };
const tool = (o = {}) => ({ slug: 'x', name: 'X', category: 'scheduling', status: 'live', has_free_plan: null, has_free_trial: null, price_min_month: null, reviews: [], integrations: [], outcomes: [], setup_complexity: null, setup_time_class: null, ...o });

describe('APEX personal rating', () => {
  it('weights always add up to 1 and favour the owner priority', () => {
    for (const p of ['cost', 'ease', 'speed', 'results', undefined]) expect(Object.values(apexWeights(p)).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(apexWeights('cost').B).toBeCloseTo(0.35); expect(apexWeights('ease').S).toBeCloseTo(0.25);
  });
  it('is a 1.0–5.0 rating with all five BANT + skill checks and the review share', () => {
    const a = apexScore(tool({ has_free_plan: true, reviews: [{ source: 'g2', rating: 4.7, count: 300 }] }), profile, 4.4);
    expect(a.rating).toBeGreaterThanOrEqual(1); expect(a.rating).toBeLessThanOrEqual(5);
    expect(a.dims.map((d) => d.key)).toEqual(['B', 'A', 'N', 'T', 'S']);
    expect(a.reviews.rating).toBe(4.7); expect(a.reviews.weight).toBe(30);
  });
  it('the same tool rates differently for different owners', () => {
    const t = tool({ price_min_month: 120, setup_complexity: 4, setup_time_class: 'needs_onboarding', integrations: ['Square'], reviews: [{ source: 'g2', rating: 4.5, count: 200 }] });
    const beginner = apexScore(t, { ...profile, budget_month: 50, tech_comfort: 1, urgency: 'this_week', existing_software: ['Google Calendar'] }, 4.4);
    const expert = apexScore(t, { ...profile, budget_month: 500, tech_comfort: 5, urgency: 'no_rush', existing_software: ['Square'] }, 4.4);
    expect(expert.rating).toBeGreaterThan(beginner.rating + 0.8);
  });
  it('better reviews raise the rating, everything else equal', () => {
    const lo = apexScore(tool({ reviews: [{ source: 'g2', rating: 3.6, count: 400 }] }), profile, 4.4);
    const hi = apexScore(tool({ reviews: [{ source: 'g2', rating: 4.9, count: 400 }] }), profile, 4.4);
    expect(hi.rating).toBeGreaterThan(lo.rating);
  });
  it('no reviews falls back to the category average, not zero', () => {
    const a = apexScore(tool(), profile, 4.4);
    expect(a.reviews.rating).toBeNull(); expect(a.reviews.adjusted).toBeCloseTo(4.4);
  });
  it('availability rewards free options and software the owner already uses', () => {
    expect(availabilityScore(tool({ has_free_plan: true, integrations: ['Google Calendar'] }), profile).score).toBeGreaterThan(availabilityScore(tool({ has_free_plan: false, has_free_trial: false, integrations: ['Square'] }), profile).score);
  });
  it('real catalog: picks come back in rating order and each persona sees its own ratings', () => {
    const tools = loadCsvTools().map((t, i) => ({ ...t, id: String(i), version: 1 }));
    const means = priorMeans(tools);
    const jobber = tools.find((t) => t.slug === 'jobber');
    const ratings = PERSONAS.map((p) => {
      const { profile: pr } = mapAnswers(p.answers);
      const r = rank(tools, pr);
      for (let i = 1; i < r.picks.length; i += 1) expect(r.picks[i - 1].apex.rating).toBeGreaterThanOrEqual(r.picks[i].apex.rating);
      return apexScore(jobber, pr, means.of(jobber.category)).rating;
    });
    expect(new Set(ratings).size).toBeGreaterThan(1);
  });
});
