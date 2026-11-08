import { TOOL_WEBSITES } from '../data/websites.js';
import { BIASED_DOMAINS, REVIEW_SITES, SMB_FLAGS } from '../data/biasedDomains.js';

export const LAST_CHECKED = '2026-11-07';

export const clean = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

export const parseBool = (v) => {
  const s = clean(v);
  if (s === null) return null;
  if (/^true$/i.test(s)) return true;
  if (/^false$/i.test(s)) return false;
  return null;
};

export const splitList = (v) => (clean(v) ? clean(v).split(';').map((x) => x.trim()).filter(Boolean) : []);

export function parsePrice(notesRaw) {
  const notes = clean(notesRaw);
  const out = { price_min_month: null, price_max_month: null, price_known: false, price_conflict: false, is_usage_based: null, is_per_seat: null };
  if (!notes) return out;
  const re = /(?:\$\s?(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s?(?:EUR|€)|(?:EUR|€)\s?(\d[\d,]*(?:\.\d+)?))/gi;
  const all = [];
  const monthly = [];
  let m;
  while ((m = re.exec(notes))) {
    const n = Number((m[1] || m[2] || m[3]).replace(/,/g, ''));
    if (!Number.isFinite(n)) continue;
    all.push(n);
    const after = notes.slice(m.index + m[0].length, m.index + m[0].length + 40).toLowerCase();
    if (!/(resolution|year|per tech)/.test(after)) monthly.push(n);
  }
  const lower = notes.toLowerCase();
  out.price_known = all.length > 0;
  if (monthly.length) {
    out.price_min_month = Math.min(...monthly);
    out.price_max_month = Math.max(...monthly);
  }
  out.price_conflict = notes.includes(' | ');
  out.is_usage_based = /(per resolution|per minute|minutes)/.test(lower);
  out.is_per_seat = /(per user|per seat|per agent|per operator)/.test(lower);
  return out;
}

const sourceKey = (name) => {
  const s = name.toLowerCase();
  if (s.includes('g2')) return 'g2';
  if (s.includes('capterra')) return 'capterra';
  if (s.includes('trustpilot')) return 'trustpilot';
  if (s.includes('toolradar')) return 'toolradar';
  return 'editorial';
};

export function parseReviews(raw) {
  const s = clean(raw);
  if (!s) return [];
  return s.split('|').map((part) => {
    const m = part.trim().match(/^(.+?)\s+([\d.]+|None)\s*\/\s*5\s*(?:\(([^)]*)\))?/i);
    if (!m || /none/i.test(m[2])) return null;
    const rating = Number(m[2]);
    if (!Number.isFinite(rating)) return null;
    const source = sourceKey(m[1]);
    const cm = m[3] && m[3].match(/(\d[\d,]*)/);
    const count = cm && !/^none$/i.test(m[3].trim()) ? Number(cm[1].replace(/,/g, '')) : null;
    return { source, rating, count, is_customer: !['editorial', 'toolradar'].includes(source) };
  }).filter(Boolean);
}

export const hostOf = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return null; }
};

const domainMatches = (host, d) => host === d || host.endsWith('.' + d);

export function toolDomains(slug, name) {
  const base = [slug.replace(/-/g, ''), name.toLowerCase().replace(/[^a-z0-9]/g, '')];
  return base.filter((b) => b.length >= 3);
}

export function parseSources(raw, slug, name, websiteUrl) {
  const s = clean(raw);
  if (!s) return [];
  const urls = s.split(/\s+(?=https?:\/\/)/).map((u) => u.trim()).filter(Boolean);
  const own = toolDomains(slug, name);
  const siteHost = websiteUrl ? hostOf(websiteUrl) : null;
  return urls.map((url) => {
    const host = hostOf(url.replace(/\s/g, '%20')) || '';
    const label = host.split('.').slice(0, -1).join('').replace(/[^a-z0-9]/g, '');
    const isOwn = (siteHost && domainMatches(host, siteHost)) || own.some((o) => label === o || label.endsWith(o));
    const kind = REVIEW_SITES.some((d) => domainMatches(host, d)) ? 'review_site' : isOwn ? 'vendor' : 'editorial';
    const biased = isOwn || BIASED_DOMAINS.some((d) => domainMatches(host, d));
    return { url, kind, biased };
  });
}

export function parseRow(row) {
  const slug = clean(row.slug);
  const name = clean(row.name);
  return {
    slug,
    name,
    category: clean(row.category),
    best_for: clean(row.best_for),
    summary: clean(row.summary),
    has_free_plan: parseBool(row.has_free_plan),
    has_free_trial: parseBool(row.has_free_trial),
    pricing_notes: clean(row.pricing_notes),
    ...parsePrice(row.pricing_notes),
    reviews: parseReviews(row.review_signals),
    // Seeding fills the official site from data/websites.js (the CSV has no website column).
    website_url: clean(row.website_url || '') || TOOL_WEBSITES[slug] || null,
    sources: parseSources(row.sources, slug, name, null),
    ai_features: splitList(row.ai_features),
    integrations: splitList(row.integrations).filter((i) => !/reported/i.test(i)),
    unknowns: splitList(row.unknowns),
    smb_fit_flag: SMB_FLAGS[slug] || 'good',
    origin: 'seed',
    status: 'live',
    last_checked_at: LAST_CHECKED,
  };
}

export function seedReport(tools) {
  return {
    tools: tools.length,
    parsed_prices: tools.filter((t) => t.price_known).length,
    numeric_ratings: tools.filter((t) => t.reviews.length > 0).length,
    price_conflicts: tools.filter((t) => t.price_conflict).length,
    biased_only_sources: tools.filter((t) => t.sources.length > 0 && t.sources.every((s) => s.biased)).map((t) => t.slug),
  };
}
