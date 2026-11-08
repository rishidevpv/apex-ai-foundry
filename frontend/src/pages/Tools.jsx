import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, ShieldCheck, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { useMeta, usePageTitle } from '@/lib/hooks';
import { ErrorState, Empty } from '@/components/feedback/States';

const PRICE = [['any', 'Any price'], ['free', 'Free plan'], ['50', 'Under $50'], ['150', 'Under $150']];
const SORT = [['relevance', 'Best match to filters'], ['evidence', 'Best proven'], ['price', 'Lowest known price'], ['name', 'Name A–Z']];
const WORKS = ['Square', 'QuickBooks', 'Google', 'Shopify', 'Gmail', 'Toast', 'Clover', 'Facebook', 'Microsoft'];

import { RatingPill, PersonalRatingNudge } from '@/components/rating/ApexRating';

export function ToolCard({ t, catLabel }) {
  return (
    <Link to={`/tools/${t.slug}`} className="if-card group flex flex-col p-5 transition-transform duration-200 hover:-translate-y-0.5" data-testid={`tool-card-${t.slug}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-display text-lg font-bold group-hover:text-[var(--brand)]">{t.name}</p>
        <span className="if-chip shrink-0 border-[var(--line)] bg-[var(--surface-warm)] text-xs text-[var(--ink-2)]">{catLabel}</span>
      </div>
      <p className="mt-2 line-clamp-3 flex-1 text-[0.95rem] text-[var(--ink-2)]">{t.best_for || t.summary}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className={`font-semibold ${t.price_text === 'Not listed' ? 'italic text-[var(--ink-3)]' : ''}`}>{t.price_text}</span>
        {t.has_free_plan === true && <span className="if-chip border-success-line bg-success-soft text-success">Free plan</span>}
        {t.has_free_trial === true && <span className="if-chip border-success-line bg-success-soft text-success">Free trial</span>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--ink-2)]">
        <RatingPill apex={t.apex} reviewRating={t.review_rating} />
        <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" />{t.evidence_label}</span>
        {t.smb_fit_flag && t.smb_fit_flag !== 'good' && <span className="inline-flex items-center gap-1 text-warning"><AlertTriangle className="h-3.5 w-3.5" />Built for bigger businesses</span>}
      </div>
    </Link>
  );
}

export default function Tools() {
  usePageTitle('AI tools marketplace');
  const meta = useMeta();
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get('q') || '');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState({ loading: true, error: null });
  const [personal, setPersonal] = useState(false);
  const f = { q: sp.get('q') || '', category: sp.get('category') || '', price: sp.get('price') || 'any', trial: sp.get('trial') || '', works: sp.get('works') || '', sort: sp.get('sort') || 'relevance' };
  const key = JSON.stringify(f);
  const upd = (patch) => { const n = { ...f, ...patch }; setSp(Object.fromEntries(Object.entries(n).filter(([, v]) => v && v !== 'any' && !(v === 'relevance')))); };

  const fetchPage = async (offset) => {
    setState({ loading: true, error: null });
    const qs = new URLSearchParams({ ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)), offset: String(offset), limit: '12' });
    try {
      const d = await api(`/tools?${qs}`);
      setItems((prev) => (offset ? [...prev, ...d.items] : d.items)); setTotal(d.total); setPersonal(!!d.personalized); setState({ loading: false, error: null });
    } catch (e) { setState({ loading: false, error: e }); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchPage(0); }, [key]);
  useEffect(() => { const h = setTimeout(() => { if (q !== f.q) upd({ q }); }, 350); return () => clearTimeout(h); });

  const catLabel = (s) => meta?.categories.find((c) => c.slug === s)?.label || s;
  const sel = 'min-h-11 rounded-xl border border-[var(--line)] bg-surface px-3 text-[0.95rem]';
  return (
    <div className="if-container py-10 sm:py-14">
      <p className="if-eyebrow">Marketplace</p>
      <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Browse AI tools for small businesses</h1>
      <p className="mt-2 max-w-2xl text-[var(--ink-2)]">Every listing shows what we know and what we don’t. No sponsored placements.</p>
      <div className="relative mt-8 max-w-2xl">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--ink-3)]" />
        <input className="if-input pl-12" placeholder="Search by name or what you need, e.g. “reminders”" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search tools" data-testid="marketplace-search-input" />
      </div>
      <div className="mt-5 flex gap-2 overflow-x-auto pb-2" role="group" aria-label="Categories">
        <button type="button" onClick={() => upd({ category: '' })} className={`if-chip min-h-10 shrink-0 px-3 ${!f.category ? 'border-[var(--brand)] bg-[var(--brand)] text-[var(--on-brand)]' : 'border-[var(--line)] bg-surface'}`} data-testid="category-chip-all">All</button>
        {meta?.categories.map((c) => <button type="button" key={c.slug} onClick={() => upd({ category: c.slug })} className={`if-chip min-h-10 shrink-0 px-3 ${f.category === c.slug ? 'border-[var(--brand)] bg-[var(--brand)] text-[var(--on-brand)]' : 'border-[var(--line)] bg-surface hover:bg-[var(--surface-hover)]'}`} data-testid={`category-chip-${c.slug}`}>{c.label}</button>)}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <select className={sel} value={f.price} onChange={(e) => upd({ price: e.target.value })} aria-label="Price" data-testid="filter-price-select">{PRICE.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select className={sel} value={f.works} onChange={(e) => upd({ works: e.target.value })} aria-label="Works with" data-testid="filter-works-select"><option value="">Works with: any</option>{WORKS.map((w) => <option key={w} value={w}>Works with {w}</option>)}</select>
        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--line)] bg-surface px-3"><input type="checkbox" className="h-5 w-5 accent-[var(--brand)]" checked={f.trial === '1'} onChange={(e) => upd({ trial: e.target.checked ? '1' : '' })} data-testid="filter-trial-checkbox" />Free trial</label>
        <select className={`${sel} sm:ml-auto`} value={f.sort} onChange={(e) => upd({ sort: e.target.value })} aria-label="Sort" data-testid="sort-select">{(personal ? [['for_you', 'Best for you'], ...SORT] : SORT).map(([k, l]) => <option key={k} value={k}>Sort: {l}</option>)}</select>
      </div>
      {!state.loading && !personal && <PersonalRatingNudge next="/tools" className="mt-6 max-w-2xl" />}
      {personal && <p className="mt-6 text-sm text-[var(--ink-2)]" data-testid="marketplace-personal-note">Ratings marked “for you” are made from your answers and public reviews. {f.sort !== 'for_you' && <button type="button" className="font-semibold text-[var(--brand)] hover:underline" onClick={() => upd({ sort: 'for_you' })}>Sort by best for you</button>}</p>}
      <p className="mt-6 text-sm text-[var(--ink-2)]" aria-live="polite" data-testid="marketplace-count">{state.loading && !items.length ? 'Loading…' : `${total} tool${total === 1 ? '' : 's'}`}</p>
      <div className="mt-4">
        {state.error && <ErrorState error={state.error} onRetry={() => fetchPage(0)} />}
        {!state.loading && !state.error && !items.length && <Empty title="No tools match">Try removing a filter or searching for something simpler.</Empty>}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{items.map((t) => <ToolCard key={t.slug} t={t} catLabel={catLabel(t.category)} />)}</div>
        {items.length < total && <div className="mt-8 flex justify-center"><button type="button" className="if-btn-ghost" onClick={() => fetchPage(items.length)} disabled={state.loading} data-testid="marketplace-show-more-button">{state.loading ? 'Loading…' : 'Show more'}</button></div>}
      </div>
    </div>
  );
}
