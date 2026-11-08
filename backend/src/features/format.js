import { TOOL_WEBSITES } from '../data/websites.js';
const money = (n) => `$${Number(n) % 1 ? Number(n).toFixed(2) : Number(n)}`;

// Plain-language price, never inferring a monthly price that the record does not state.
export function priceText(t) {
  if (t.has_free_plan === true && (t.price_min_month === null || t.price_min_month === undefined)) return 'Free plan available';
  if (t.price_min_month === null || t.price_min_month === undefined) return t.price_known ? 'See pricing notes' : 'Not listed';
  const lo = Number(t.price_min_month); const hi = Number(t.price_max_month);
  let s = hi && hi !== lo ? `From ${money(lo)} to ${money(hi)} a month` : `From ${money(lo)} a month`;
  if (t.is_per_seat) s += ' per person';
  if (t.price_conflict) s += ' (prices vary by source)';
  return s;
}

export function publicTool(t) {
  if (!t) return null;
  const { embedding, provider_id, contact_email, ...rest } = t;
  return { ...rest, website_url: rest.website_url || TOOL_WEBSITES[rest.slug] || null, price_text: priceText(t) };
}
