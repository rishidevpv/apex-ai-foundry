import { describe, it, expect } from 'vitest';
import { mapAnswers, ownerText } from '../src/features/profile.js';
import { prompts } from '../src/llm/prompts.js';
import { integrationScore } from '../src/scoring/features.js';

const base = { business_type: 'other', team_size_band: 'just_me', needs: [], something_else: true, hours: {}, outcomes: [], budget: 'under_50', software: ['Gmail', 'Other'], tech_comfort: 3, urgency: 'this_month', priority: 'ease', free_text: '' };

describe('Owner’s own words for Other / Something else', () => {
  const { answers, profile } = mapAnswers({ ...base, business_type_other: 'Dog grooming van', something_else_text: 'chasing unpaid invoices', software_other: 'Xero, Calendly' });
  it('keeps them as separate context, cleaned', () => {
    expect(profile.context).toEqual({ business: 'Dog grooming van', other_need: 'chasing unpaid invoices', other_software: 'Xero, Calendly' });
    expect(answers.something_else_text).toBe('chasing unpaid invoices');
  });
  it('typed-in software counts when matching what a tool connects to', () => {
    expect(profile.existing_software).toEqual(expect.arrayContaining(['Xero', 'Calendly']));
    expect(integrationScore({ integrations: ['Xero'] }, profile).matched).toContain('Xero');
  });
  it('drops text for choices that were not picked', () => {
    const r = mapAnswers({ ...base, business_type: 'salon', software: ['Gmail'], something_else: false, needs: ['scheduling'], business_type_other: 'x', something_else_text: 'y', software_other: 'z' });
    expect(r.profile.context).toBeUndefined();
  });
  it('goes to the AI only inside <untrusted> tags, never in the trusted profile JSON', () => {
    const msgs = prompts.explain(profile, []);
    const user = msgs[1].content;
    expect(user).toMatch(/<untrusted>[^<]*Dog grooming van/);
    expect(user.split('Owner\'s own words')[0]).not.toContain('Dog grooming van');
    expect(prompts.chatSystem(profile, [])).toMatch(/OWNER'S OWN WORDS <untrusted>/);
    expect(ownerText(answers, profile)).toContain('Other problem: chasing unpaid invoices');
  });
});

describe('Tool websites', () => {
  it('every seed tool has an official https website', async () => {
    const { loadCsvTools } = await import('../scripts/seed-dry.js');
    const { TOOL_WEBSITES } = await import('../src/data/websites.js');
    const tools = loadCsvTools();
    for (const t of tools) { expect(t.website_url, t.slug).toMatch(/^https:\/\//); expect(TOOL_WEBSITES[t.slug], t.slug).toBeTruthy(); }
  });
  it('tools already in the database without a website still get one when shown', async () => {
    const { publicTool } = await import('../src/features/format.js');
    expect(publicTool({ slug: 'jobber', name: 'Jobber', website_url: null }).website_url).toBe('https://www.getjobber.com');
    expect(publicTool({ slug: 'my-tool', name: 'Mine', website_url: 'https://mine.example' }).website_url).toBe('https://mine.example');
  });
});
