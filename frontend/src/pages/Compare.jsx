import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { X, Plus, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { usePageTitle, useMeta } from '@/lib/hooks';
import { PersonalRatingNudge } from '@/components/rating/ApexRating';
import { Loading, ErrorState, Empty } from '@/components/feedback/States';

const val = (v) => (v === true ? 'Yes' : v === false ? 'No' : 'Not listed');
const ROWS = [
  ['Price', (t) => t.price_text],
  ['Free plan', (t) => val(t.has_free_plan)],
  ['Free trial', (t) => val(t.has_free_trial)],
  ['Setup effort (estimated)', (t) => (t.setup_complexity ? ['', 'Sign up and start', 'Easy', 'Some setup', 'Takes effort', 'Needs expert help'][t.setup_complexity] : 'Not listed')],
  ['Who it suits', (t) => t.best_for || 'Not listed'],
  ['Works with', (t) => (t.integrations?.length ? t.integrations.join(', ') : 'Not listed')],
  ['How well proven', (t) => t.trust_label],
  ['Reviews', (t) => (t.reviews?.length ? t.reviews.map((r) => `${r.source.toUpperCase()} ${r.rating}/5`).join(', ') : 'Not listed')],
  ['Size fit', (t) => (t.smb_fit_flag === 'good' ? 'Fine for small teams' : 'Built for bigger businesses')],
  ['Unknowns', (t) => (t.unknowns?.length ? t.unknowns.join(', ') : 'None listed')],
];

// Browsable tool list right on the Compare page: search, filter by type, and add with one click.
function ToolBrowser({ onAdd, selected, full }) {
  const meta = useMeta();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [state, setState] = useState({ items: [], total: 0, loading: true });
  const [offset, setOffset] = useState(0);
  const PAGE = 24;
  useEffect(() => {
    let live = true;
    const h = setTimeout(() => {
      setState((s) => ({ ...s, loading: true }));
      const params = new URLSearchParams({ limit: String(PAGE), offset: String(offset), sort: q.trim() ? 'relevance' : 'evidence' });
      if (q.trim().length >= 2) params.set('q', q.trim());
      if (category) params.set('category', category);
      api(`/tools?${params}`).then((d) => { if (live) setState((s) => ({ items: offset ? [...s.items, ...d.items] : d.items, total: d.total, loading: false })); })
        .catch((e) => { if (live) setState((s) => ({ ...s, loading: false, error: e })); });
    }, 200);
    return () => { live = false; clearTimeout(h); };
  }, [q, category, offset]);
  useEffect(() => { setOffset(0); }, [q, category]);
  const catLabel = (slug) => meta?.categories?.find((c) => c.slug === slug)?.label || slug;
  return (
    <section id="compare-browse" className="if-card p-5 sm:p-6" data-testid="compare-browser">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">All tools</h2>
          <p className="if-caption text-sm text-[var(--ink-2)]">{full ? 'You have 3 tools selected. Remove one to add another.' : 'Search or filter, then press Add.'}</p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <input className="if-input min-w-0 flex-1 sm:w-64" placeholder="Search tools…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search tools to compare" data-testid="compare-add-input" />
          <select className="if-input w-auto" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by type" data-testid="compare-category-filter">
            <option value="">All types</option>
            {(meta?.categories || []).map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
          </select>
        </div>
      </div>
      {state.error && <div className="mt-4"><ErrorState error={state.error} /></div>}
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="compare-browser-list">
        {state.items.map((t) => {
          const isSel = selected.includes(t.slug);
          return (
            <li key={t.slug} className={`flex items-start justify-between gap-3 rounded-xl border p-3 ${isSel ? 'border-[var(--brand)] bg-[var(--brand-soft)]' : 'border-[var(--line)] bg-surface'}`}>
              <div className="min-w-0">
                <p className="truncate font-semibold">{t.name}</p>
                <p className="mt-1 flex flex-wrap gap-1"><span className="if-tag">{catLabel(t.category)}</span>{t.has_free_plan && <span className="if-tag">Free plan</span>}</p>
                <p className="if-caption mt-1 text-xs text-[var(--ink-3)]">{t.price_text}</p>
              </div>
              <button type="button" disabled={isSel || full} onClick={() => onAdd(t.slug, t.name)} className="if-btn-ghost min-h-9 shrink-0 px-3 text-sm disabled:opacity-50" data-testid={`compare-add-option-${t.slug}`}>
                {isSel ? <><Check className="h-4 w-4" />Added</> : <><Plus className="h-4 w-4" />Add</>}
              </button>
            </li>
          );
        })}
      </ul>
      {state.loading && <Loading />}
      {!state.loading && !state.items.length && !state.error && <p className="mt-4 text-[var(--ink-2)]">No tools match. Try a different word or type.</p>}
      {!state.loading && state.items.length < state.total && (
        <button type="button" className="if-btn-quiet mt-4" onClick={() => setOffset(state.items.length)} data-testid="compare-browser-more">Show more ({state.total - state.items.length} left)</button>
      )}
    </section>
  );
}

export default function Compare() {
  usePageTitle('Compare tools');
  const [sp, setSp] = useSearchParams();
  const slugs = (sp.get('tools') || '').split(',').filter(Boolean).slice(0, 3);
  const [state, setState] = useState({ loading: false });
  const key = slugs.join(',');
  const names = useRef({});
  useEffect(() => {
    if (slugs.length < 2) { setState({ loading: false }); return; }
    setState({ loading: true });
    api('/compare', { method: 'POST', body: { slugs } }).then((d) => setState({ loading: false, data: d })).catch((e) => setState({ loading: false, error: e }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const setSlugs = (s) => setSp(s.length ? { tools: s.join(',') } : {});
  const tools = [...(state.data?.tools || [])].sort((a, b) => slugs.indexOf(a.slug) - slugs.indexOf(b.slug)); // same order as the numbered chips
  const differs = (fn) => new Set(tools.map(fn)).size > 1;
  // Personal APEX rating first (when signed in with answers), then public reviews, then the facts.
  const verdict = (r) => (r >= 4.3 ? 'Excellent fit' : r >= 3.8 ? 'Good fit' : r >= 3.2 ? 'Fair fit' : 'Weak fit');
  const rows = [
    ...(tools.some((t) => t.apex) ? [['Your APEX rating', (t) => (t.apex ? `${t.apex.rating.toFixed(1)} / 5 · ${verdict(t.apex.rating)}` : 'Not listed')]] : []),
    ['Public review rating', (t) => (t.review_rating ? `${t.review_rating.toFixed(1)} / 5` : 'Not listed')],
    ...ROWS,
  ];
  return (
    <div className="if-container py-10 sm:py-14">
      <p className="if-eyebrow">Compare</p>
      <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Side by side</h1>
      <p className="mt-2 text-[var(--ink-2)]">Pick two or three tools. Rows where they differ are highlighted. There is no “winner” — it depends on you.</p>
      <div className="mt-6 flex flex-wrap items-center gap-2" data-testid="compare-selected">
        {slugs.map((s, i) => <span key={s} className="if-chip min-h-10 border-[var(--line)] bg-surface pl-1.5 pr-3">{slugs.length > 1 && <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--brand)] text-xs font-semibold text-[var(--on-brand)]">{i + 1}</span>}{tools.find((t) => t.slug === s)?.name || names.current[s] || s}<button type="button" onClick={() => setSlugs(slugs.filter((x) => x !== s))} aria-label={`Remove ${s}`} className="-mr-2 grid h-9 w-9 place-items-center rounded-full hover:bg-[var(--surface-hover)]" data-testid={`compare-remove-${s}`}><X className="h-4 w-4" /></button></span>)}
      </div>
      <div className="mt-8">
        {slugs.length < 2 && <Empty title={slugs.length ? 'Add one more tool' : 'Add at least two tools'}>Pick from the list below, or use the Compare button on any recommendation or tool page. <button type="button" className="font-semibold text-[var(--brand)] hover:underline" onClick={() => document.getElementById('compare-browse')?.scrollIntoView({ behavior: 'smooth' })}>Browse tools</button></Empty>}
        {state.loading && <Loading />}
        {state.error && <ErrorState error={state.error} />}
        {tools.length >= 2 && (
          <>
            {/* Phones: one card per row, every tool listed underneath — no sideways scrolling */}
            <div className="space-y-3 md:hidden" data-testid="compare-mobile">
              {rows.map(([label, fn]) => (
                <div key={label} className={`rounded-2xl border p-4 ${differs(fn) ? 'border-[var(--brand-ring)] bg-[var(--brand-soft)]' : 'border-[var(--line)] bg-[var(--surface)]'}`}>
                  <p className="flex items-center justify-between gap-2 text-sm font-semibold text-[var(--ink-2)]">{label}{differs(fn) && <span className="text-xs font-normal text-[var(--brand)]">Differs</span>}</p>
                  <dl className="mt-2 space-y-2">
                    {tools.map((t, i) => (
                      <div key={t.slug} className="flex gap-3">
                        <dt className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--surface-warm)] text-[0.7rem] font-semibold text-[var(--ink-2)]" title={t.name}>{i + 1}</dt>
                        <dd className={`text-[0.95rem] ${fn(t) === 'Not listed' ? 'italic text-[var(--ink-3)]' : ''}`}><span className="sr-only">{t.name}: </span>{fn(t)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
            <div className="if-card hidden overflow-x-auto md:block" data-testid="compare-table">
              <table className="w-full min-w-[640px] text-left text-[0.95rem]">
                <thead><tr className="border-b border-[var(--line)]"><th className="w-48 p-4" />{tools.map((t) => <th key={t.slug} className="p-4 font-display text-lg font-bold"><Link to={`/tools/${t.slug}`} className="hover:underline">{t.name}</Link></th>)}</tr></thead>
                <tbody>
                  {rows.map(([label, fn]) => (
                    <tr key={label} className={`border-b border-[var(--line)] last:border-0 ${differs(fn) ? 'bg-[var(--brand-soft)]' : ''}`}>
                      <th scope="row" className="p-4 align-top text-sm font-semibold text-[var(--ink-2)]">{label}{differs(fn) && <span className="block text-xs font-normal text-[var(--brand)]">Differs</span>}</th>
                      {tools.map((t) => <td key={t.slug} className={`p-4 align-top ${fn(t) === 'Not listed' ? 'italic text-[var(--ink-3)]' : ''}`}>{fn(t)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!state.data?.personalized && <PersonalRatingNudge next={`/compare?tools=${slugs.join(',')}`} className="mt-6" />}
            <section className="if-card mt-6 p-6" data-testid="compare-tradeoffs">
              <h2 className="font-display text-lg font-bold">The main tradeoffs</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5">{state.data.tradeoffs.sentences.map((s) => <li key={s}>{s}</li>)}</ul>
              <p className="mt-3 text-xs text-[var(--ink-3)]">{state.data.tradeoffs.fallback ? 'Built directly from the tool records.' : 'Written by AI from the tool records above. Check the sources on each tool page.'}</p>
            </section>
          </>
        )}
      </div>
      <div className="mt-8"><ToolBrowser selected={slugs} full={slugs.length >= 3} onAdd={(s, name) => { names.current[s] = name; setSlugs([...slugs, s]); }} /></div>
    </div>
  );
}
