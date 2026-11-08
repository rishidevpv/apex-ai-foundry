import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, BookmarkCheck, Columns3, Wrench, ChevronDown, Check, HelpCircle } from 'lucide-react';
import { ApexBadge, WhyRating } from '@/components/rating/ApexRating';

// One recommendation, built to be scanned in seconds:
// name → one line on what it does → three key facts → one clear next step. Everything else is one tap away.
const RANK_LABEL = ['Top pick', 'Second pick', 'Third pick'];
const fitTone = { top_pick: 'bg-success-soft text-success border-success-line', thin_evidence: 'bg-warning-soft text-warning border-warning-line' };

const Fact = ({ label, children, testid, muted }) => (
  <div className="rounded-xl bg-[var(--surface-warm)] px-3 py-2.5" data-testid={testid}>
    <p className="text-xs text-[var(--ink-3)]">{label}</p>
    <p className={`mt-0.5 text-[0.95rem] font-semibold leading-snug ${muted ? 'font-normal italic text-[var(--ink-3)]' : 'text-[var(--ink)]'}`}>{children}</p>
  </div>
);

const Detail = ({ label, children }) => (
  <div>
    <p className="text-sm font-semibold text-[var(--ink)]">{label}</p>
    <p className="mt-0.5 text-[0.95rem] leading-relaxed text-[var(--ink-2)]">{children}</p>
  </div>
);

export function RecCard({ pick, onSave, saved, compareHref, guideHref, readOnly, idx = 0 }) {
  const [more, setMore] = useState(false);
  const t = pick.tool; const e = pick.explanation || {}; const eta = pick.eta;
  const free = t.has_free_plan === true ? 'Free plan' : t.has_free_trial === true ? 'Free trial' : null;
  const priceKnown = t.price_text && t.price_text !== 'Not listed';
  return (
    <article className={`if-card if-rise if-d${idx + 1} flex flex-col p-5 transition-shadow duration-300 hover:shadow-[var(--shadow-pop)] sm:p-6 ${idx === 0 ? 'ring-1 ring-[var(--brand)]' : ''}`} data-testid={`rec-card-${pick.rank}`}>
      <div className="flex items-center justify-between gap-3">
        <span className={`text-sm font-medium ${idx === 0 ? 'text-[var(--brand)]' : 'text-[var(--ink-3)]'}`}>{RANK_LABEL[idx] || `Pick ${pick.rank}`}</span>
        <span className={`if-chip ${fitTone[pick.quadrant] || 'bg-surface-warm text-ink-2 border-line'}`} data-testid={`rec-fit-label-${pick.rank}`}>{pick.fit_label}</span>
      </div>

      <h3 className="mt-3 font-display text-2xl font-semibold leading-tight"><Link to={`/tools/${t.slug}`} className="hover:underline" data-testid={`rec-tool-link-${pick.rank}`}>{t.name}</Link></h3>
      <p className="mt-2 text-[1rem] leading-relaxed text-[var(--ink-2)]" data-testid={`rec-one-line-${pick.rank}`}>{e.one_line}</p>
      {pick.apex && <div className="mt-4"><ApexBadge apex={pick.apex} /></div>}

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Fact label="Price" testid={`rec-price-${pick.rank}`} muted={!priceKnown}>{priceKnown ? t.price_text : 'Not listed'}</Fact>
        <Fact label="Time saved" testid={`rec-eta-${pick.rank}`} muted={!eta?.high}>{eta?.high ? `${eta.low}–${eta.high} hrs / week` : 'Not sure yet'}</Fact>
        <Fact label="Try before you buy" muted={!free}>{free || 'No free option listed'}</Fact>
        <Fact label="Public reviews" muted={!pick.apex?.reviews?.rating}>{pick.apex?.reviews?.rating ? `${pick.apex.reviews.rating.toFixed(1)} / 5` : 'No reviews yet'}</Fact>
      </div>

      {e.why_it_fits && (
        <p className="mt-5 flex gap-2 text-[0.95rem] leading-relaxed text-[var(--ink)]" data-testid={`rec-why-${pick.rank}`}>
          <Check className="mt-1 h-4 w-4 shrink-0 text-success" aria-hidden="true" /><span>{e.why_it_fits}</span>
        </p>
      )}

      <div className="mt-3"><WhyRating apex={pick.apex} testid={`rec-why-rating-${pick.rank}`} /></div>

      <button type="button" onClick={() => setMore(!more)} aria-expanded={more} className="-ml-1 inline-flex min-h-10 items-center gap-1 self-start rounded-lg px-1 text-sm font-medium text-[var(--brand)] hover:underline" data-testid={`rec-more-${pick.rank}`}>
        {more ? 'Hide details' : 'More details'}<ChevronDown className={`h-4 w-4 transition-transform ${more ? 'rotate-180' : ''}`} />
      </button>
      {more && (
        <div className="if-fade-up mt-3 space-y-4 border-t border-[var(--line)] pt-4">
          {e.check_first && <Detail label="Ask them first">{e.check_first}</Detail>}
          {e.not_for && <Detail label="Not a good fit if">{e.not_for}</Detail>}
          <Detail label="Works with">{t.integrations?.length ? t.integrations.slice(0, 6).join(', ') : 'Not listed'}</Detail>
          {eta?.first_month && eta?.high && <Detail label="First month">Expect {eta.first_month.low}–{eta.first_month.high} hours a week saved while you get set up.</Detail>}
          <div className="rounded-xl border border-warning-line bg-warning-soft p-3" data-testid={`rec-unknowns-${pick.rank}`}>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-warning"><HelpCircle className="h-4 w-4" />We couldn’t confirm</p>
            <p className="mt-1 text-sm text-warning">{pick.unknowns?.length ? pick.unknowns.join(' · ') : 'Nothing major. Still check the price before paying.'}</p>
          </div>
        </div>
      )}

      <div className="mt-auto pt-6">
        <Link to={guideHref} className="if-btn-primary min-h-12 w-full text-base" data-testid={`rec-guide-${pick.rank}`}><Wrench className="h-4 w-4" />Show me how to set it up</Link>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {!readOnly && <button type="button" className="if-btn-ghost min-h-11 px-3" onClick={() => onSave?.(t.slug)} data-testid={`rec-save-${pick.rank}`}>{saved ? <BookmarkCheck className="h-4 w-4 text-[var(--brand)]" /> : <Bookmark className="h-4 w-4" />}{saved ? 'Saved' : 'Save'}</button>}
          <Link to={compareHref} className={`if-btn-ghost min-h-11 px-3 ${readOnly ? 'col-span-2' : ''}`} data-testid={`rec-compare-${pick.rank}`}><Columns3 className="h-4 w-4" />Compare</Link>
        </div>
      </div>
    </article>
  );
}
