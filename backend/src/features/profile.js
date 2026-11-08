import { z } from 'zod';
import { CATEGORY_SLUGS, BUSINESS_TYPES, BUDGET_BANDS, SOFTWARE, TEAM_SIZES, URGENCY, PRIORITIES, CATEGORY_BY_SLUG, OUTCOME_LIST } from '../data/categories.js';
import { sanitizeText } from '../security/sanitize.js';

export const AnswersSchema = z.object({
  business_type: z.enum(Object.keys(BUSINESS_TYPES)),
  team_size_band: z.enum(TEAM_SIZES),
  needs: z.array(z.enum(CATEGORY_SLUGS)).max(2),
  something_else: z.boolean().default(false),
  hours: z.record(z.string(), z.number().min(0).max(20)).default({}),
  outcomes: z.array(z.enum(OUTCOME_LIST)).max(12).default([]),
  budget: z.enum(Object.keys(BUDGET_BANDS)),
  software: z.array(z.enum(SOFTWARE)).max(10).default([]),
  tech_comfort: z.number().int().min(1).max(5),
  urgency: z.enum(URGENCY),
  priority: z.enum(PRIORITIES),
  free_text: z.string().max(1000).optional().default(''),
  // The owner's own words when they pick "Other" / "Something else".
  business_type_other: z.string().max(80).optional().default(''),
  something_else_text: z.string().max(300).optional().default(''),
  software_other: z.string().max(120).optional().default(''),
  hourly_value: z.number().min(0).max(1000).optional(),
}).refine((a) => a.needs.length >= 1 || a.something_else, { message: 'Choose at least one headache' })
  .refine((a) => a.needs.length + (a.something_else ? 1 : 0) <= 2, { message: 'Choose up to two headaches' });

export const ProfileSchema = z.object({
  business_type: z.string(),
  team_size_band: z.enum(TEAM_SIZES),
  primary_needs: z.array(z.enum(CATEGORY_SLUGS)).min(1).max(2),
  hours_per_week: z.record(z.string(), z.number()),
  outcomes: z.array(z.string()),
  budget_month: z.number(),
  free_only: z.boolean(),
  existing_software: z.array(z.string()),
  tech_comfort: z.number().int().min(1).max(5),
  urgency: z.enum(URGENCY),
  priority: z.enum(PRIORITIES),
  hourly_value: z.number().optional(),
  summary: z.string().optional(),
});

const ownWords = (s) => sanitizeText(s || '', 120).split(/[,;\n]|\band\b/i).map((x) => x.trim()).filter((x) => x.length >= 2).slice(0, 6);

// The owner's own words, kept separately so prompts can treat them as data, never as instructions.
function ownerContext(a) {
  const c = {};
  if (a.business_type === 'other' && a.business_type_other?.trim()) c.business = sanitizeText(a.business_type_other, 80);
  if (a.something_else && a.something_else_text?.trim()) c.other_need = sanitizeText(a.something_else_text, 300);
  if (a.software.includes('Other') && a.software_other?.trim()) c.other_software = sanitizeText(a.software_other, 120);
  return Object.keys(c).length ? { context: c } : {};
}

// Everything the owner typed, as one block of text for need matching and the AI.
export function ownerText(answers, profile) {
  const c = profile?.context || {};
  return [c.business && `Business: ${c.business}`, c.other_need && `Other problem: ${c.other_need}`, c.other_software && `Other software: ${c.other_software}`, answers?.free_text && `Notes: ${answers.free_text}`].filter(Boolean).join('\n');
}

// Plain code mapping (no LLM), system design §4 stage 1.
export function mapAnswers(raw) {
  const a = AnswersSchema.parse(raw);
  const needs = a.needs.filter((n, i, arr) => arr.indexOf(n) === i).slice(0, 2);
  const allowedOutcomes = needs.flatMap((n) => CATEGORY_BY_SLUG[n].outcomes.map(([k]) => k));
  const hours = Object.fromEntries(needs.map((n) => [n, Number(a.hours[n] ?? 0)]));
  return {
    answers: {
      ...a,
      free_text: sanitizeText(a.free_text, 1000),
      business_type_other: a.business_type === 'other' ? sanitizeText(a.business_type_other, 80) : '',
      something_else_text: a.something_else ? sanitizeText(a.something_else_text, 300) : '',
      software_other: a.software.includes('Other') ? sanitizeText(a.software_other, 120) : '',
    },
    profile: {
      business_type: a.business_type,
      team_size_band: a.team_size_band,
      primary_needs: needs,
      hours_per_week: hours,
      outcomes: a.outcomes.filter((o) => allowedOutcomes.includes(o)),
      budget_month: BUDGET_BANDS[a.budget],
      free_only: a.budget === 'free_only',
      // Software they typed in under "Other" also counts when we check what a tool connects to.
      existing_software: [...a.software, ...(a.software.includes('Other') ? ownWords(a.software_other) : [])],
      tech_comfort: a.tech_comfort,
      urgency: a.urgency,
      priority: a.priority,
      ...(a.hourly_value ? { hourly_value: a.hourly_value } : {}),
      ...ownerContext(a),
    },
  };
}

const URGENCY_WORDS = { this_week: 'this week', this_month: 'this month', no_rush: 'when it suits' };
export function templateSummary(p) {
  const type = BUSINESS_TYPES[p.business_type]?.label.toLowerCase() || 'business';
  const size = { just_me: 'a one-person', '2-9': 'a small', '10-49': 'a growing' }[p.team_size_band];
  const needs = p.primary_needs.map((n) => CATEGORY_BY_SLUG[n].label.toLowerCase()).join(' and ');
  const budget = p.free_only ? 'free tools only' : `up to about $${p.budget_month} a month`;
  return `${size[0].toUpperCase()}${size.slice(1)} ${type} that wants help with ${needs}. Tech comfort ${p.tech_comfort} of 5, budget ${budget}, and wants it running ${URGENCY_WORDS[p.urgency]}.`;
}

// Plain keyword matching of the owner's own words ("Something else" + question 10) to the 10 areas.
// Used before/alongside the AI so a free-text answer is never rejected just because the AI is off or unsure.
const NEED_KEYWORDS = {
  ai_receptionist: ['call', 'calls', 'phone', 'voicemail', 'receptionist', 'answer the phone', 'missed call', 'ringing', 'after hours', 'after-hours'],
  customer_chatbot: ['chat', 'chatbot', 'website question', 'same question', 'faq', 'questions all day', 'live chat', 'messages', 'dm', 'inquir', 'enquir', 'lead'],
  scheduling: ['book', 'booking', 'appointment', 'schedule appointments', 'calendar', 'no-show', 'no show', 'cancel', 'reschedul', 'reminder', 'reservation'],
  reviews_reputation: ['review', 'reviews', 'yelp', 'google rating', 'rating', 'reputation', 'feedback', 'testimonial'],
  social_content: ['social', 'instagram', 'facebook', 'tiktok', 'post', 'posts', 'content', 'linkedin', 'marketing'],
  email_marketing: ['email', 'newsletter', 'promo', 'promotion', 'campaign', 'coupon', 'loyalty', 'repeat customer', 'mailing'],
  bookkeeping: ['bookkeep', 'invoice', 'invoicing', 'accounting', 'tax', 'taxes', 'receipt', 'expense', 'quickbooks', 'books', 'bill', 'billing', 'payment', 'paid', 'cash flow'],
  field_service: ['job', 'jobs', 'crew', 'dispatch', 'technician', 'quote', 'estimate', 'field', 'route', 'work order'],
  restaurant_inventory: ['inventory', 'stock', 'order supplies', 'supplier', 'waste', 'over-order', 'run out', 'ingredients', 'menu cost'],
  workforce: ['shift', 'shifts', 'staff', 'employee', 'hiring', 'hire', 'payroll', 'timesheet', 'roster', 'team schedule', 'turnover'],
};

export function inferNeeds(text, max = 2) {
  const t = ` ${String(text || '').toLowerCase()} `;
  if (t.trim().length < 2) return [];
  const scores = Object.entries(NEED_KEYWORDS).map(([slug, words]) => [slug, words.reduce((n, w) => n + (t.includes(w) ? (w.length > 5 ? 2 : 1) : 0), 0)]);
  return scores.filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, max).map(([s]) => s);
}

// Last resort: find which area's tools best match the owner's words in the catalog.
export function inferNeedsFromCatalog(text, tools, max = 1) {
  const words = String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  if (!words.length) return [];
  const score = {};
  for (const tool of tools) {
    const hay = [tool.name, tool.best_for, tool.summary, ...(tool.ai_features || []), ...(tool.typical_use_cases || [])].join(' ').toLowerCase();
    const n = words.filter((w) => hay.includes(w)).length;
    if (n && CATEGORY_SLUGS.includes(tool.category)) score[tool.category] = (score[tool.category] || 0) + n;
  }
  return Object.entries(score).sort((a, b) => b[1] - a[1]).slice(0, max).map(([s]) => s);
}
