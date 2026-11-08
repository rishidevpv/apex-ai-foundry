import { ownerText } from '../features/profile.js';
import { callLLM, hashKey, modelFor } from './call.js';
import { prompts, PROMPT_VERSION } from './prompts.js';
import { ToolEnrichment, ProfileOut, Explanation, CommentTags, CompareOut } from './schemas.js';
import { OUTCOME_LIST, CATEGORY_SLUGS, CATEGORY_BY_SLUG } from '../data/categories.js';
import { templateSummary } from '../features/profile.js';
import { priceText } from '../features/format.js';

const COMMON = new Set('I It It’s Its You Your The This That These Those A An And But Or If When What Who How Why Not Price Still Yes No Check Confirm Ask Look Before After Great Good Use Use Free Starts Works Make Get Set Try Start For With Without Our We They Their Most Many Some Each Every Only Also Then Plus Since While Because'.split(' '));

// Faithfulness: every $ amount and capitalised name must appear in the tool record or profile.
export function faithfulnessError(text, haystackObj) {
  const hay = JSON.stringify(haystackObj).toLowerCase();
  for (const m of text.matchAll(/\$\s?(\d[\d,]*(?:\.\d+)?)/g)) {
    if (!hay.includes(m[1].replace(/,/g, '')) && !hay.includes(m[1])) return `Price $${m[1]} is not in the record`;
  }
  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const s of sentences) {
    const words = s.split(/\s+/).slice(1);
    for (const raw of words) {
      const w = raw.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9+]+$/g, '');
      if (!/^[A-Z][A-Za-z0-9+]{1,}$/.test(w) || COMMON.has(w)) continue;
      if (!hay.includes(w.toLowerCase())) return `Name "${w}" is not in the record`;
    }
  }
  return null;
}

export async function enrichTool(tool) {
  const record = { name: tool.name, category: tool.category, best_for: tool.best_for, summary: tool.summary, pricing_notes: tool.pricing_notes, ai_features: tool.ai_features, integrations: tool.integrations };
  const r = await callLLM({ task: 'enrich', messages: prompts.enrich(OUTCOME_LIST, record), schema: ToolEnrichment, cacheKey: hashKey('enrich', tool.id, tool.version, PROMPT_VERSION) });
  if (!r.ok) return null;
  return { ...r.result, enrichment: { model: modelFor('cheap'), prompt_version: PROMPT_VERSION, date: new Date().toISOString().slice(0, 10), confidence: r.result.confidence } };
}

export async function profileSummary(answers, profile, userId) {
  const r = await callLLM({
    task: 'profile', userId,
    messages: prompts.profile({ ...answers, free_text: undefined, business_type_other: undefined, something_else_text: undefined, software_other: undefined }, ownerText(answers, profile), CATEGORY_SLUGS),
    schema: ProfileOut, cacheKey: hashKey('profile', answers, PROMPT_VERSION),
  });
  if (!r.ok) return { summary: templateSummary(profile), extra_needs: [], fallback: true };
  return { ...r.result, fallback: false };
}

export function templateExplanation(pick, profile) {
  const t = pick.tool;
  const need = CATEGORY_BY_SLUG[t.category].label.toLowerCase();
  const unknowns = t.unknowns?.length ? t.unknowns.join(', ') : 'nothing major listed';
  return {
    one_line: `${t.best_for || t.summary || t.name}`.slice(0, 120),
    why_it_fits: `${t.name} is built for ${t.best_for || 'businesses like yours (not listed in detail)'}. It matches your need for ${need}.`,
    not_for: t.smb_fit_flag !== 'good' ? 'It may be more than a small team needs.' : `It only covers ${need}, not other parts of your business.`,
    check_first: `Price: ${t.pricing_notes || 'not listed'}. Still unknown: ${unknowns}.`,
    fallback: true,
  };
}

const recordFor = (p) => ({
  slug: p.tool.slug, name: p.tool.name, best_for: p.tool.best_for, summary: p.tool.summary, pricing_notes: p.tool.pricing_notes,
  price: priceText(p.tool), has_free_plan: p.tool.has_free_plan, has_free_trial: p.tool.has_free_trial, ai_features: p.tool.ai_features,
  integrations: p.tool.integrations, unknowns: p.tool.unknowns, smb_fit_flag: p.tool.smb_fit_flag,
  fit: Math.round(p.fit * 100) / 100, trust: Math.round(p.trust * 100) / 100,
});

export async function explainPicks(picks, profile, userId) {
  if (!picks.length) return [];
  const top = picks.map(recordFor);
  const validate = (out) => {
    if (out.tools.length !== picks.length) return 'Return exactly one entry per tool';
    for (let i = 0; i < picks.length; i += 1) {
      const e = out.tools[i];
      const err = faithfulnessError(`${e.one_line} ${e.why_it_fits} ${e.not_for} ${e.check_first}`, { tool: top[i], profile, words: ['APEX'] });
      if (err) return `${top[i].name}: ${err}`;
    }
    return null;
  };
  const r = await callLLM({
    task: 'explain', userId, messages: prompts.explain(profile, top), schema: Explanation, validate,
    cacheKey: hashKey('explain', profile, picks.map((p) => [p.tool.id, p.tool.version]), PROMPT_VERSION),
  });
  if (!r.ok) return picks.map((p) => templateExplanation(p, profile));
  return r.result.tools.map((e) => ({ one_line: e.one_line, why_it_fits: e.why_it_fits, not_for: e.not_for, check_first: e.check_first, fallback: false }));
}

export async function tagComment(id, body, userId) {
  const r = await callLLM({ task: 'tag_comment', userId, messages: prompts.tagComment(body), schema: CommentTags, cacheKey: hashKey('tag', id, PROMPT_VERSION) });
  return r.ok ? r.result : null;
}

export function templateCompare(tools) {
  const out = [];
  for (let i = 0; i < tools.length; i += 1) {
    for (let j = i + 1; j < tools.length; j += 1) {
      const a = tools[i]; const b = tools[j];
      out.push(`${a.name}: ${priceText(a)}. ${b.name}: ${priceText(b)}.`);
    }
  }
  tools.forEach((t) => out.push(`${t.name} suits ${t.best_for || 'owners whose needs are not listed'}.`));
  return out;
}

export async function compareText(tools) {
  const records = tools.map((t) => ({ name: t.name, best_for: t.best_for, price: priceText(t), pricing_notes: t.pricing_notes, has_free_plan: t.has_free_plan, has_free_trial: t.has_free_trial, integrations: t.integrations, ai_features: t.ai_features, setup_complexity_estimated: t.setup_complexity, unknowns: t.unknowns }));
  const validate = (o) => faithfulnessError(o.sentences.join(' '), records);
  const r = await callLLM({ task: 'compare', messages: prompts.compare(records), schema: CompareOut, validate, cacheKey: hashKey('compare', tools.map((t) => [t.id, t.version]).sort(), PROMPT_VERSION) });
  return r.ok ? { sentences: r.result.sentences, fallback: false } : { sentences: templateCompare(tools), fallback: true };
}

export const GUIDE_HEADINGS = ['What you will have at the end', 'What you need before you start', 'Steps', 'Check that it works', 'If something goes wrong', 'Get help from the provider'];
export const GUIDE_DISCLAIMER = "This guide was written by AI. Check it against the provider's own instructions.";

export function guideError(md) {
  let pos = -1;
  for (const h of GUIDE_HEADINGS) {
    const i = md.indexOf(`## ${h}`);
    if (i < 0 || i < pos) return `Missing or out-of-order heading "## ${h}"`;
    pos = i;
  }
  return null;
}

export function fallbackGuide(tool) {
  const links = [tool.help_url, tool.website_url, ...(tool.sources || []).map((s) => s.url)].filter(Boolean);
  const linkMd = links.length ? links.map((l) => `- ${l}`).join('\n') : '- Provider links are not listed. Search for the provider by name.';
  return `## What you will have at the end
${tool.name} set up for ${CATEGORY_BY_SLUG[tool.category].label.toLowerCase()}.

## What you need before you start
- An email address you check often
- A way to pay, if you choose a paid plan (price: ${priceText(tool)})

## Steps
1. Open the provider's website and create an account. Check the provider's own instructions here: ${links[0] || 'not listed'}
2. Pick the plan that fits your budget. Confirm the price before paying.
3. Follow the provider's setup steps for ${CATEGORY_BY_SLUG[tool.category].label.toLowerCase()}.
4. Try it once yourself before you tell customers about it.

## Check that it works
- Do one real test, for example as if you were a customer.

## If something goes wrong
- Write down what you tried and contact the provider using the links below.

## Get help from the provider
${linkMd}

${GUIDE_DISCLAIMER}`;
}

export async function generateGuide(tool, techLevel, profile, userId) {
  const record = { name: tool.name, best_for: tool.best_for, summary: tool.summary, pricing_notes: tool.pricing_notes, ai_features: tool.ai_features, integrations: tool.integrations, typical_use_cases: tool.typical_use_cases, help_url: tool.help_url, website_url: tool.website_url, sources: (tool.sources || []).map((s) => s.url), unknowns: tool.unknowns };
  const r = await callLLM({ task: 'guide', userId, json: false, messages: prompts.guide(techLevel, record, profile ? { business_type: profile.business_type, existing_software: profile.existing_software } : null), validate: (o) => guideError(o) });
  if (!r.ok) return { body_md: fallbackGuide(tool), is_fallback: true, model: null };
  let md = r.result.text;
  if (!md.includes(GUIDE_DISCLAIMER)) md = `${md.trim()}\n\n${GUIDE_DISCLAIMER}`;
  return { body_md: md, is_fallback: false, model: modelFor('mid') };
}
