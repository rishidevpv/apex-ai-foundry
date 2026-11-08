import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, ChevronDown, Lock, Wallet, Zap, Target, Clock, GraduationCap, MessageSquareQuote } from 'lucide-react';
import { useAuth, startLogin } from '@/lib/auth';

// APEX personal rating UI.
// Every tool gets a 1.0–5.0 rating made for this owner: 70% from a BANT-style check of their answers
// (Budget, Availability, Need, Time to set up, Skill) and 30% from public review ratings.

const ICON = { B: Wallet, A: Zap, N: Target, T: Clock, S: GraduationCap };
const LEVEL_TONE = { Strong: 'bg-success', Okay: 'bg-warning', Weak: 'bg-danger', 'Not listed': 'bg-[var(--line-strong)]' };
const LEVEL_TEXT = { Strong: 'text-success', Okay: 'text-warning', Weak: 'text-danger', 'Not listed': 'text-[var(--ink-3)]' };

export function Stars({ value, size = 'h-4 w-4' }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <span key={i} className={`relative inline-block ${size}`}>
            <Star className={`absolute inset-0 ${size} text-[var(--line-strong)]`} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}><Star className={`${size} fill-[var(--gold)] text-[var(--gold)]`} /></span>
          </span>
        );
      })}
    </span>
  );
}

const verdict = (r) => (r >= 4.3 ? 'Excellent fit' : r >= 3.8 ? 'Good fit' : r >= 3.2 ? 'Fair fit' : 'Weak fit');

/** Big personal rating used on results cards and tool pages. */
export function ApexBadge({ apex, compact = false }) {
  if (!apex) return null;
  return (
    <div className={`flex items-center gap-3 ${compact ? '' : 'rounded-2xl bg-[var(--surface-warm)] px-4 py-3'}`} data-testid="apex-rating">
      <span className="font-display text-[2rem] font-extrabold leading-none tracking-[-0.03em] text-[var(--ink)]">{apex.rating.toFixed(1)}</span>
      <span className="min-w-0">
        <Stars value={apex.rating} />
        <span className="block text-xs text-[var(--ink-3)]"><span className="font-semibold text-[var(--ink-2)]">{verdict(apex.rating)}</span> · your APEX rating</span>
      </span>
    </div>
  );
}

/** Small inline rating for lists (marketplace cards, compare). Personal if available, else public reviews. */
export function RatingPill({ apex, reviewRating }) {
  if (apex) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--brand)]" title="Your APEX rating — made for your business" data-testid="apex-pill">
        <Star className="h-3.5 w-3.5 fill-current" />{apex.rating.toFixed(1)} for you
      </span>
    );
  }
  return reviewRating
    ? <span className="inline-flex items-center gap-1 text-xs text-[var(--ink-2)]" data-testid="review-pill"><Star className="h-3.5 w-3.5 fill-[var(--gold)] text-[var(--gold)]" />{reviewRating.toFixed(1)} reviews</span>
    : <span className="text-xs italic text-[var(--ink-3)]" data-testid="review-pill">No reviews yet</span>;
}

/** The five checks and the review share that make up the rating. */
export function ApexBreakdown({ apex }) {
  if (!apex) return null;
  return (
    <div className="space-y-3" data-testid="apex-breakdown">
      <p className="text-sm text-[var(--ink-2)]">Made for your business from your answers ({100 - apex.reviews.weight}%) and public reviews ({apex.reviews.weight}%).</p>
      <ul className="space-y-2.5">
        {apex.dims.map((d) => {
          const Icon = ICON[d.key] || Target;
          return (
            <li key={d.key}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 font-medium text-[var(--ink)]"><Icon className="h-4 w-4 text-[var(--ink-3)]" />{d.label}</span>
                <span className={`text-xs font-semibold ${LEVEL_TEXT[d.level]}`}>{d.level}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-hover)]"><div className={`h-full rounded-full ${LEVEL_TONE[d.level]} transition-[width] duration-700`} style={{ width: `${Math.max(6, d.score * 100)}%` }} /></div>
              {d.note && <p className="mt-0.5 text-xs text-[var(--ink-3)]">{d.note}</p>}
            </li>
          );
        })}
        <li>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 font-medium text-[var(--ink)]"><MessageSquareQuote className="h-4 w-4 text-[var(--ink-3)]" />Public reviews</span>
            {apex.reviews.rating
              ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--ink-2)]"><Star className="h-3.5 w-3.5 fill-[var(--gold)] text-[var(--gold)]" />{apex.reviews.rating.toFixed(1)}</span>
              : <span className="text-xs font-semibold text-[var(--ink-3)]">No reviews yet</span>}
          </div>
          <p className="mt-0.5 text-xs text-[var(--ink-3)]">{apex.reviews.rating ? `From ${apex.reviews.sources.join(', ')}. ` : 'We use the average for this kind of tool until reviews are available. '}Few reviews count for less.</p>
        </li>
      </ul>
    </div>
  );
}

/** Collapsible “Why this rating?” used inside cards. */
export function WhyRating({ apex, testid }) {
  const [open, setOpen] = useState(false);
  if (!apex) return null;
  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="-ml-1 inline-flex min-h-10 items-center gap-1 rounded-lg px-1 text-sm font-medium text-[var(--brand)] hover:underline" data-testid={testid}>
        Why this rating?<ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="if-fade-up mt-2"><ApexBreakdown apex={apex} /></div>}
    </div>
  );
}

/** Nudge shown where a personal rating would appear but we don't have one yet. */
export function PersonalRatingNudge({ next = '/dashboard', className = '' }) {
  const { user } = useAuth();
  return (
    <div className={`flex items-start gap-3 rounded-2xl border border-dashed border-[var(--line-strong)] p-4 ${className}`} data-testid="apex-nudge">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">{user ? <Star className="h-4 w-4" /> : <Lock className="h-4 w-4" />}</span>
      <div className="min-w-0 text-sm">
        <p className="font-semibold text-[var(--ink)]">Get a rating made for your business</p>
        <p className="mt-0.5 text-[var(--ink-2)]">{user ? 'Answer 10 quick questions and every tool gets a personal rating based on your budget, needs and skills.' : 'Sign in and answer 10 quick questions — every tool then gets a personal rating based on your budget, needs and skills.'}</p>
        {user
          ? <Link to="/start" className="mt-2 inline-flex min-h-10 items-center font-semibold text-[var(--brand)] hover:underline">Answer the questions →</Link>
          : <button type="button" onClick={() => startLogin(next)} className="mt-2 inline-flex min-h-10 items-center font-semibold text-[var(--brand)] hover:underline" data-testid="apex-nudge-signin">Sign in →</button>}
      </div>
    </div>
  );
}
