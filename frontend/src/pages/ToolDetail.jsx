import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ExternalLink, AlertTriangle, HelpCircle, ShieldCheck, Check, X, Sparkles, Bookmark, Columns3, Wrench, MessageSquare, Star } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useApi, useMeta, usePageTitle } from '@/lib/hooks';
import { useAuth, startLogin } from '@/lib/auth';
import { Loading, ErrorState, NotListed } from '@/components/feedback/States';

const CHECK_LABELS = { price: 'Price', rating: 'Customer rating', features: 'Features', integrations: 'Connections', free_plan_flag: 'Free plan known', trial_flag: 'Free trial known', best_for: 'Who it’s for', two_sources: 'Two or more sources' };
import { ApexBadge, ApexBreakdown, RatingPill, PersonalRatingNudge } from '@/components/rating/ApexRating';

const SRC = { g2: 'G2', capterra: 'Capterra', trustpilot: 'Trustpilot', editorial: 'Editorial review', toolradar: 'Toolradar' };
const KIND = { review_site: 'Review site', vendor: 'Company website', editorial: 'Article', directory: 'Directory' };
const yn = (v) => (v === true ? 'Yes' : v === false ? 'No' : null);

const Section = ({ title, children, testid }) => (
  <section className="if-card p-6" data-testid={testid}><h2 className="font-display text-lg font-bold">{title}</h2><div className="mt-3">{children}</div></section>
);

function Comments({ slug, comments, onAdded }) {
  const { user } = useAuth();
  const [body, setBody] = useState(''); const [rating, setRating] = useState(null); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); if (!body.trim()) return;
    setBusy(true);
    try { await api('/comments', { method: 'POST', body: { slug, body, rating } }); setBody(''); setRating(null); toast.success('Thanks for sharing'); onAdded(); } catch (x) { toast.error(x.message); } finally { setBusy(false); }
  };
  return (
    <Section title="What owners say" testid="tool-comments">
      {comments.length === 0 && <p className="text-[var(--ink-2)]">No comments yet.</p>}
      <ul className="space-y-4">
        {comments.map((c) => (
          <li key={c.id} className="rounded-xl bg-[var(--surface-warm)] p-4" data-testid="tool-comment-item">
            <p className="text-sm font-semibold">{c.display_name || 'An owner'}{c.business_type && <span className="font-normal text-[var(--ink-2)]"> · {c.business_type.replace(/_/g, ' ')}</span>}{c.rating && <span className="ml-2 text-warning">{'★'.repeat(c.rating)}</span>}</p>
            <p className="mt-1">{c.body}</p>
            {c.topics?.length > 0 && <p className="mt-2 flex flex-wrap gap-1">{c.topics.map((t) => <span key={t} className="if-chip border-[var(--line)] bg-surface text-xs">{t}</span>)}</p>}
          </li>
        ))}
      </ul>
      {user ? (
        <form onSubmit={submit} className="mt-5 space-y-3">
          <label className="block text-sm font-semibold" htmlFor="comment-body">Add your experience</label>
          <textarea id="comment-body" className="if-input min-h-24 py-3" maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} data-testid="comment-body-input" />
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Rating (optional)">
            {[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} onClick={() => setRating(rating === n ? null : n)} aria-label={`${n} stars`} className="p-1" data-testid={`comment-rating-${n}`}><Star className={`h-6 w-6 ${rating >= n ? 'fill-warning text-warning' : 'text-ink-3'}`} /></button>)}
            <button type="submit" className="if-btn-primary ml-auto min-h-11" disabled={busy || !body.trim()} data-testid="comment-submit-button">Post</button>
          </div>
          <p className="text-xs text-[var(--ink-3)]">Only your first name and business type are shown.</p>
        </form>
      ) : <button type="button" className="if-btn-ghost mt-4" onClick={() => startLogin(`/tools/${slug}`)} data-testid="comment-signin-button"><MessageSquare className="h-4 w-4" />Sign in to comment</button>}
    </Section>
  );
}

export default function ToolDetail() {
  const { slug } = useParams();
  const { user } = useAuth();
  const meta = useMeta();
  const { data, error, loading, reload } = useApi(`/tools/${slug}`);
  usePageTitle(data?.tool?.name);
  if (loading && !data) return <div className="if-container"><Loading /></div>;
  if (error) return <div className="if-container py-12"><ErrorState error={error} onRetry={reload} /></div>;
  const t = data.tool; const tr = data.trust;
  const cat = meta?.categories.find((c) => c.slug === t.category);
  const est = t.enrichment ? <span className="if-chip ml-2 border-[var(--brand-ring)] bg-brand-soft text-xs text-brand"><Sparkles className="h-3 w-3" />Estimated</span> : null;
  const save = async () => {
    if (!user) return startLogin(`/tools/${slug}`);
    try { await api('/user-tools', { method: 'POST', body: { slug, status: 'considering' } }); toast.success('Saved to My tools'); } catch (e) { toast.error(e.message); }
  };
  return (
    <div className="if-container py-10 sm:py-14">
      <Link to="/tools" className="-ml-1 inline-flex min-h-11 items-center rounded-lg px-1 text-sm text-[var(--ink-2)] hover:underline">← Marketplace</Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-2xl">
          <p className="if-eyebrow">{cat?.label}</p>
          <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl" data-testid="tool-detail-name">{t.name}</h1>
          <p className="mt-3 text-lg text-[var(--ink-2)]">{t.summary || <NotListed />}</p>
          {t.best_for && <p className="mt-2"><span className="font-semibold">Best for:</span> {t.best_for}</p>}
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <span className="if-chip border-[var(--line)] bg-surface"><RatingPill reviewRating={data.review_rating} /></span>
            <span className="if-chip border-[var(--line)] bg-surface"><ShieldCheck className="h-4 w-4 text-[var(--teal)]" />{tr.label}</span>
            {t.last_checked_at && <span className="if-chip border-[var(--line)] bg-surface text-[var(--ink-2)]">Last checked {t.last_checked_at}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="if-btn-ghost" onClick={save} data-testid="tool-save-button"><Bookmark className="h-4 w-4" />Save</button>
          <Link to={`/compare?tools=${t.slug}`} className="if-btn-ghost" data-testid="tool-compare-button"><Columns3 className="h-4 w-4" />Compare</Link>
          <Link to={`/guide/${t.slug}`} className="if-btn-primary" data-testid="tool-guide-button"><Wrench className="h-4 w-4" />Set it up</Link>
        </div>
      </div>
      {data.apex ? (
        <section className="if-card mt-6 grid gap-6 p-5 sm:p-6 md:grid-cols-[minmax(0,15rem)_1fr]" data-testid="tool-apex-section">
          <div>
            <p className="text-sm font-semibold text-[var(--ink-2)]">Your APEX rating</p>
            <div className="mt-2"><ApexBadge apex={data.apex} compact /></div>
            <p className="mt-3 text-xs text-[var(--ink-3)]">Based on your latest answers. Change your answers and this rating changes too.</p>
          </div>
          <ApexBreakdown apex={data.apex} />
        </section>
      ) : <PersonalRatingNudge next={`/tools/${slug}`} className="mt-6 max-w-2xl" />}
      {t.smb_fit_flag !== 'good' && (
        <div className="mt-6 flex gap-3 rounded-xl border border-warning-line bg-warning-soft p-4 text-warning" role="note" data-testid="tool-smb-warning"><AlertTriangle className="h-5 w-5 shrink-0" /><p><span className="font-semibold">Built for bigger businesses.</span> {t.smb_fit_flag === 'too_costly' ? 'It is likely to cost more than a small team needs.' : 'It is likely more complex than a small team needs.'} We keep it out of the top three for teams under 10.</p></div>
      )}
      <div className="mt-8 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <Section title="Price" testid="tool-price-section">
            <p className="text-lg font-semibold" data-testid="tool-price-text">{t.price_text === 'Not listed' ? <NotListed /> : t.price_text}</p>
            {t.pricing_notes && <p className="mt-1 text-[var(--ink-2)]">From our sources: “{t.pricing_notes}”</p>}
            {t.price_conflict && <p className="mt-2 text-sm font-medium text-warning">Prices vary by source. Confirm with the company before paying.</p>}
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-[var(--ink-3)]">Free plan</dt><dd className="font-semibold">{yn(t.has_free_plan) || <NotListed />}</dd></div>
              <div><dt className="text-[var(--ink-3)]">Free trial</dt><dd className="font-semibold">{yn(t.has_free_trial) || <NotListed />}</dd></div>
            </dl>
          </Section>
          <Section title="What it does">
            {t.ai_features?.length ? <ul className="list-disc space-y-1 pl-5">{t.ai_features.map((f) => <li key={f}>{f}</li>)}</ul> : <p><NotListed /></p>}
            {t.typical_use_cases?.length > 0 && <div className="mt-4"><p className="text-sm font-semibold">Typical uses {est}</p><ul className="mt-1 list-disc space-y-1 pl-5 text-[var(--ink-2)]">{t.typical_use_cases.map((u) => <li key={u}>{u}</li>)}</ul></div>}
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-[var(--ink-3)]">Setup effort {est}</dt><dd className="font-semibold">{t.setup_complexity ? ['', 'Sign up and start', 'Easy', 'Some setup', 'Takes effort', 'Needs expert help'][t.setup_complexity] : <NotListed />}</dd></div>
              <div><dt className="text-[var(--ink-3)]">Time to get running {est}</dt><dd className="font-semibold">{{ same_day: 'Same day', few_days: 'A few days', needs_onboarding: 'Needs onboarding' }[t.setup_time_class] || <NotListed />}</dd></div>
            </dl>
          </Section>
          <Section title="Works with" testid="tool-integrations">{t.integrations?.length ? <div className="flex flex-wrap gap-2">{t.integrations.map((i) => <span key={i} className="if-chip border-[var(--line)] bg-[var(--surface-warm)]">{i}</span>)}</div> : <NotListed />}</Section>
          <Comments slug={t.slug} comments={data.comments} onAdded={reload} />
        </div>
        <div className="space-y-5">
          <section className="rounded-2xl border-2 border-dashed border-warning-line bg-warning-soft p-6" data-testid="tool-unknowns">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-warning"><HelpCircle className="h-5 w-5" />What we don’t know</h2>
            {t.unknowns?.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-warning">{t.unknowns.map((u) => <li key={u}>{u}</li>)}</ul> : <p className="mt-2 text-warning">Nothing specific listed. Always confirm price and features before paying.</p>}
          </section>
          <Section title="How we checked this tool" testid="tool-how-checked">
            <p className="text-sm text-[var(--ink-2)]">We look at customer reviews (fewer reviews count for less), how complete the information is, and how many independent sources mention it. Sources written by the company or a competitor count half. “Estimated” details were guessed by AI from the description.</p>
            <ul className="mt-3 grid grid-cols-2 gap-1.5 text-sm">{Object.entries(tr.checks).map(([k, v]) => <li key={k} className="flex items-center gap-1.5">{v ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-ink-3" />}{CHECK_LABELS[k]}</li>)}</ul>
          </Section>
          <Section title="Reviews" testid="tool-reviews">
            {t.reviews?.length ? <ul className="space-y-2">{t.reviews.map((r, i) => <li key={i} className="flex justify-between text-sm"><span>{SRC[r.source] || r.source}{!r.is_customer && <span className="text-[var(--ink-3)]"> (not customers)</span>}</span><span className="font-semibold">{r.rating}/5 · {r.count ? `${r.count.toLocaleString()}${r.count >= 1000 ? '+' : ''} reviews` : 'count not listed'}</span></li>)}</ul> : <p className="text-sm"><NotListed /> — no numeric ratings in our sources.</p>}
            {data.community.comment_count > 0 && <p className="mt-3 text-sm text-[var(--ink-2)]">{Object.entries(data.community_by_type).map(([k, n]) => `${n} ${k.replace(/_/g, ' ')} owner${n === 1 ? '' : 's'}`).join(', ')} commented here.</p>}
          </Section>
          <Section title="Sources" testid="tool-sources">
            <ul className="space-y-3">
              {t.sources.map((s) => (
                <li key={s.url} className="text-sm">
                  <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-h-10 items-center gap-1 break-all font-medium text-[var(--brand)] hover:underline">{new URL(s.url.replace(/\s/g, '%20')).hostname.replace('www.', '')}<ExternalLink className="h-3.5 w-3.5 shrink-0" /></a>
                  <span className="block text-[var(--ink-3)]">{KIND[s.kind] || s.kind}{s.biased && <span className="ml-2 font-semibold text-warning" data-testid="source-biased-marker">Written by the company or a competitor</span>}</span>
                </li>
              ))}
              {!t.sources.length && <NotListed />}
            </ul>
            {(t.website_url || t.help_url) && <div className="mt-4 flex flex-wrap gap-3 text-sm">{t.website_url && <a className="font-semibold text-[var(--brand)] hover:underline" href={t.website_url} target="_blank" rel="noopener noreferrer">Website</a>}{t.help_url && <a className="font-semibold text-[var(--brand)] hover:underline" href={t.help_url} target="_blank" rel="noopener noreferrer">Provider help</a>}</div>}
          </Section>
        </div>
      </div>
    </div>
  );
}
