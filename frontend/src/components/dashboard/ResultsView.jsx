import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Info, Star, CircleSlash } from 'lucide-react';
import { RecCard } from './RecCard';
import { QuadrantChart } from './QuadrantChart';

const lvl = { Strong: 'text-success', Okay: 'text-warning', Weak: 'text-danger', 'Not listed': 'text-[var(--ink-3)] italic' };

// Every other tool we checked for this owner, with its personal rating and why it wasn't picked.
const REASON_TONE = { over_budget: 'text-warning', no_free_option: 'text-warning', too_big: 'text-warning', weak_match: 'text-[var(--ink-2)]', category_full: 'text-[var(--ink-2)]', rated_lower: 'text-[var(--ink-2)]' };
function OthersConsidered({ others }) {
  const [all, setAll] = useState(false);
  if (!others.length) return null;
  const shown = all ? others : others.slice(0, 6);
  return (
    <section data-testid="others-considered">
      <h2 className="text-xl font-semibold sm:text-2xl">Other tools we looked at</h2>
      <p className="mt-1 text-[var(--ink-2)]">We checked {others.length} more tool{others.length === 1 ? '' : 's'} for you. Here’s why each one didn’t make your top picks.</p>
      <ul className="mt-5 divide-y divide-[var(--line)] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
        {shown.map((o) => (
          <li key={o.slug} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5" data-testid={`other-${o.slug}`}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Link to={`/tools/${o.slug}`} className="font-semibold hover:underline">{o.name}</Link>
                {o.category_label && <span className="if-tag">{o.category_label}</span>}
              </div>
              <p className={`mt-1 flex items-start gap-1.5 text-sm ${REASON_TONE[o.reason_code] || 'text-[var(--ink-2)]'}`}>
                {o.left_out ? <CircleSlash className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />}{o.reason}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3 sm:justify-end">
              <span className="text-sm text-[var(--ink-3)]">{o.price_text === 'Not listed' ? 'Price not listed' : o.price_text}</span>
              {o.rating != null && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-warm)] px-2.5 py-1 text-xs font-semibold text-[var(--ink-2)]" title="Your APEX rating"><Star className="h-3.5 w-3.5 fill-[var(--gold)] text-[var(--gold)]" />{o.rating.toFixed(1)}</span>}
            </div>
          </li>
        ))}
      </ul>
      {others.length > 6 && (
        <button type="button" onClick={() => setAll(!all)} className="-ml-1 mt-3 inline-flex min-h-11 items-center gap-1 rounded-lg px-1 text-sm font-medium text-[var(--brand)] hover:underline" data-testid="others-toggle">
          {all ? 'Show fewer' : `Show all ${others.length}`}<ChevronDown className={`h-4 w-4 transition-transform ${all ? 'rotate-180' : ''}`} />
        </button>
      )}
    </section>
  );
}

function WhyThese({ picks }) {
  return (
    <div data-testid="why-these-three">
      <p className="text-[0.95rem] text-[var(--ink-2)]">Every tool gets the same checks. A computer does the ranking — AI only writes the short descriptions.</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[460px] text-sm">
          <thead><tr className="text-left text-[var(--ink-3)]"><th className="py-2 pr-3 font-medium">Check</th>{picks.map((p) => <th key={p.tool.slug} className="py-2 pr-3 font-medium text-[var(--ink)]">{p.tool.name}</th>)}</tr></thead>
          <tbody>
            {(picks[0].dimensions || []).map((d, i) => (
              <tr key={d.key} className="border-t border-[var(--line)]">
                <td className="py-2 pr-3">{d.label}</td>
                {picks.map((p) => <td key={p.tool.slug} className={`py-2 pr-3 font-medium ${lvl[p.dimensions[i].level]}`}>{p.dimensions[i].level}</td>)}
              </tr>
            ))}
            <tr className="border-t border-[var(--line)]"><td className="py-2 pr-3">Reviews</td>{picks.map((p) => <td key={p.tool.slug} className="py-2 pr-3 font-medium">{p.trust_label}</td>)}</tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ResultsView({ results, savedSlugs = [], onSave, readOnly, guideQuery = '' }) {
  const { picks, chart } = results;
  const slugs = picks.map((p) => p.tool.slug);
  const [how, setHow] = useState(false);
  return (
    <div className="space-y-8">
      {picks.length === 0 && (
        <div className="flex gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5" role="status" data-testid="no-picks-notice">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-[var(--ink-3)]" />
          <p className="text-[var(--ink-2)]">No tool matched your answers well enough to recommend. You can see every tool we checked, and why, below — or change your answers.</p>
        </div>
      )}
      <div className="grid items-start gap-5 lg:grid-cols-3">
        {picks.map((p, i) => (
          <RecCard key={p.tool.slug} pick={p} idx={i} saved={savedSlugs.includes(p.tool.slug)} onSave={onSave} readOnly={readOnly}
            compareHref={`/compare?tools=${[p.tool.slug, ...slugs.filter((s) => s !== p.tool.slug)].slice(0, 3).join(',')}`}
            guideHref={`/guide/${p.tool.slug}${guideQuery}`} />
        ))}
      </div>
      <OthersConsidered others={results.others || []} />
      {picks.length > 0 && (
        <section className="if-card" data-testid="how-we-picked">
          <button type="button" className="flex w-full items-center justify-between gap-3 p-5 text-left" onClick={() => setHow(!how)} aria-expanded={how} data-testid="why-these-toggle">
            <span><span className="font-semibold">How we picked these</span><span className="block text-sm text-[var(--ink-3)]">We compared {results.considered} tools against your answers.</span></span>
            <ChevronDown className={`h-5 w-5 shrink-0 text-[var(--ink-3)] transition-transform ${how ? 'rotate-180' : ''}`} />
          </button>
          {how && (
            <div className="if-fade-up grid gap-6 border-t border-[var(--line)] p-5 lg:grid-cols-[1fr_1.3fr]">
              <QuadrantChart points={chart || []} />
              <div className="space-y-4">
                <WhyThese picks={picks} />
                <p className="text-sm text-[var(--ink-3)]">Time saved is a rough estimate, not a promise. We don’t take money to rank tools.</p>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
