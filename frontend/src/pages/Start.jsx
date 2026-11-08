import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Check, Scissors, UtensilsCrossed, Wrench, Trees, SprayCan, Store, ShoppingCart, Ellipsis,
  User, Users, Building2, PhoneCall, MessagesSquare, CalendarCheck, Star, Megaphone, Mail, Receipt, Truck, Package, HelpCircle,
} from 'lucide-react';
import { useMeta, usePageTitle } from '@/lib/hooks';
import { loadAnswers, saveAnswers, emptyAnswers } from '@/lib/answers';
import { useAuth, startLogin } from '@/lib/auth';
import { Loading } from '@/components/feedback/States';

// Short, plain answer labels. Each question shows one idea at a time.
const BIZ_ICON = { salon: Scissors, restaurant_cafe: UtensilsCrossed, plumber_hvac: Wrench, landscaping: Trees, cleaning: SprayCan, retail: Store, online_store: ShoppingCart, other: Ellipsis };
const NEED_ICON = { ai_receptionist: PhoneCall, customer_chatbot: MessagesSquare, scheduling: CalendarCheck, reviews_reputation: Star, social_content: Megaphone, email_marketing: Mail, bookkeeping: Receipt, field_service: Truck, restaurant_inventory: Package, workforce: Users };
const TEAM = [['just_me', 'Just me', User], ['2-9', '2 to 9', Users], ['10-49', '10 to 49', Building2]];
const BUDGET = [['free_only', 'Free only', 'I don’t want to pay yet'], ['under_50', 'Up to $50', 'a month'], ['50_150', '$50 – $150', 'a month'], ['150_500', '$150 – $500', 'a month'], ['500_plus', 'More than $500', 'a month']];
const TECH = [[1, 'Not at all', 'I mostly use email and texts'], [2, 'A little', 'I use a few apps'], [3, 'Okay', 'I can learn a new app'], [4, 'Good', 'I set up apps sometimes'], [5, 'Very', 'I set up apps myself']];
const URG = [['this_week', 'This week'], ['this_month', 'This month'], ['no_rush', 'No rush']];
const PRI = [['cost', 'Low cost'], ['ease', 'Easy to use'], ['speed', 'Quick to set up'], ['results', 'Best results']];

function Choice({ selected, onClick, children, sub, icon: Icon, testid, multi, compact }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} data-testid={testid}
      className={`if-press group flex w-full items-center gap-3 rounded-2xl border text-left transition-[background-color,border-color,box-shadow] duration-150 ${compact ? 'min-h-14 px-4 py-3' : 'min-h-[4.25rem] px-4 py-3.5'} ${selected ? 'border-[var(--brand)] bg-[var(--brand-soft)] shadow-[0_0_0_1px_var(--brand)]' : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--line-strong)] hover:bg-[var(--surface-hover)]'}`}>
      {Icon && <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${selected ? 'bg-[var(--brand)] text-[var(--on-brand)]' : 'bg-[var(--surface-warm)] text-[var(--ink-2)]'}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>}
      <span className="min-w-0 flex-1">
        <span className="block text-[1rem] font-medium leading-snug text-[var(--ink)] [overflow-wrap:break-word]">{typeof children === 'string' ? children.replace(/\//g, '/\u200b') : children}</span>
        {sub && <span className="block text-sm text-[var(--ink-3)]">{sub}</span>}
      </span>
      <span className={`grid h-6 w-6 shrink-0 place-items-center ${multi ? 'rounded-md' : 'rounded-full'} border ${selected ? 'border-[var(--brand)] bg-[var(--brand)] text-[var(--on-brand)]' : 'border-[var(--line-strong)]'}`}>{selected && <Check className="if-pop h-4 w-4" />}</span>
    </button>
  );
}

// Text box that appears under an "Other" / "Something else" choice. What's typed here goes to the AI as context.
function OtherField({ id, label, hint, value, onChange, max, required, testid, multiline }) {
  const Field = multiline ? 'textarea' : 'input';
  return (
    <div className="if-fade-up rounded-2xl border border-[var(--brand-ring)] bg-[var(--brand-soft)] p-4">
      <label htmlFor={id} className="block">
        <span className="text-[0.95rem] font-semibold text-[var(--ink)]">{label}{required && <span className="text-[var(--ink-3)]"> (needed)</span>}</span>
        {hint && <span className="mt-0.5 block text-sm text-[var(--ink-2)]">{hint}</span>}
      </label>
      <Field id={id} autoFocus value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} rows={multiline ? 2 : undefined}
        className={`if-input mt-3 ${multiline ? 'min-h-20 resize-none py-3' : ''}`} data-testid={testid} />
      <p className="mt-1 text-right text-xs text-[var(--ink-3)]">{value.length}/{max}</p>
    </div>
  );
}

export default function Start() {
  usePageTitle('Find AI for my business');
  const meta = useMeta();
  const nav = useNavigate();
  const { user } = useAuth();
  const location = useLocation();
  const back = location.state;
  const [a, setA] = useState(() => (back?.step != null ? { ...loadAnswers(), step: back.step, completed: false } : loadAnswers()));
  const [error, setError] = useState(back?.error || '');
  const advanceTimer = useRef(null);
  const [dir, setDir] = useState(1);
  useEffect(() => { saveAnswers(a); }, [a]);
  useEffect(() => () => clearTimeout(advanceTimer.current), []);
  const set = (patch) => { setError(''); setA((x) => ({ ...x, ...patch })); };
  const toggle = (key, v, max) => {
    const cur = a[key];
    if (cur.includes(v)) return set({ [key]: cur.filter((x) => x !== v) });
    if (max && cur.length >= max) return setError(`You can pick up to ${max}.`);
    set({ [key]: [...cur, v] });
  };
  const cats = meta?.categories || [];
  const outcomeOptions = useMemo(() => cats.filter((c) => a.needs.includes(c.slug)).flatMap((c) => c.outcomes), [cats, a.needs]);

  if (!meta) return <div className="if-container"><Loading /></div>;
  const needCount = a.needs.length + (a.something_else ? 1 : 0);

  // Picking an answer on a one-choice question moves on by itself.
  const pickAndGo = (patch) => {
    set(patch);
    clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => { setDir(1); setA((x) => ({ ...x, step: Math.min(x.step + 1, 9) })); }, 320);
  };

  const steps = [
    { q: 'What kind of business do you run?', valid: a.business_type && a.team_size_band, body: (
      <div className="space-y-8">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {Object.entries(meta.business_types).map(([k, v]) => {
            const Icon = BIZ_ICON[k] || Ellipsis; const sel = a.business_type === k;
            return (
              <button key={k} type="button" onClick={() => set({ business_type: k })} aria-pressed={sel} data-testid={`q1-type-${k}`}
                className={`if-press flex min-h-[6.5rem] flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-center transition-[background-color,border-color,box-shadow] ${sel ? 'border-[var(--brand)] bg-[var(--brand-soft)] shadow-[0_0_0_1px_var(--brand)]' : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--line-strong)] hover:bg-[var(--surface-hover)]'}`}>
                <Icon className={`h-6 w-6 transition-transform duration-200 ${sel ? 'scale-110 text-[var(--brand)]' : 'text-[var(--ink-2)]'}`} aria-hidden="true" />
                <span className="text-[0.95rem] font-medium leading-tight text-[var(--ink)]">{v.label}</span>
              </button>
            );
          })}
        </div>
        {a.business_type === 'other' && (
          <OtherField id="q1-other" label="What kind of business is it?" hint="For example: dog grooming, bakery, dental clinic, tutoring." value={a.business_type_other || ''} max={80}
            onChange={(v) => set({ business_type_other: v })} testid="q1-type-other-input" />
        )}
        <div>
          <p className="mb-3 text-lg font-semibold">How many people work there?</p>
          <div className="grid gap-2.5 sm:grid-cols-3">{TEAM.map(([k, l, Icon]) => <Choice key={k} compact icon={Icon} selected={a.team_size_band === k} onClick={() => set({ team_size_band: k })} testid={`q1-team-${k}`}>{l}</Choice>)}</div>
        </div>
      </div>) },
    { q: 'What takes up too much of your time?', hint: 'Pick one or two.', valid: needCount >= 1 && needCount <= 2 && (!a.something_else || a.needs.length > 0 || (a.something_else_text || '').trim().length >= 3), body: (
      <div className="grid gap-2.5 sm:grid-cols-2">
        {cats.map((c) => <Choice key={c.slug} multi icon={NEED_ICON[c.slug]} selected={a.needs.includes(c.slug)} onClick={() => (a.needs.includes(c.slug) || needCount < 2 ? toggle('needs', c.slug) : setError('You can pick up to two.'))} testid={`q2-need-${c.slug}`}>{c.pain}</Choice>)}
        <Choice multi icon={HelpCircle} selected={a.something_else} onClick={() => (a.something_else || needCount < 2 ? set({ something_else: !a.something_else }) : setError('You can pick up to two.'))} testid="q2-need-something-else">Something else</Choice>
        {a.something_else && (
          <div className="sm:col-span-2">
            <OtherField id="q2-other" label="What else takes up your time?" required={a.needs.length === 0}
              hint="A few words is enough — for example “chasing unpaid invoices” or “answering the same emails”." value={a.something_else_text || ''} max={300} multiline
              onChange={(v) => set({ something_else_text: v })} testid="q2-something-else-input" />
          </div>
        )}
      </div>) },
    { q: 'About how many hours a week does this cost you?', hint: 'A rough guess is fine.', valid: true, skip: a.needs.length === 0, body: (
      <div className="space-y-5">{a.needs.map((n) => { const c = cats.find((x) => x.slug === n); const v = a.hours[n] ?? 3; return (
        <label key={n} className="block rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
          <span className="flex items-center justify-between gap-3"><span className="font-medium">{c.label}</span><span className="font-display text-2xl font-semibold text-[var(--brand)]">{v === 20 ? '20+' : v} <span className="text-base font-normal text-[var(--ink-3)]">hours</span></span></span>
          <input type="range" min="0" max="20" value={v} onChange={(e) => set({ hours: { ...a.hours, [n]: Number(e.target.value) } })} className="mt-4 h-2 w-full cursor-pointer accent-[var(--brand)]" data-testid={`q3-hours-${n}`} aria-valuetext={`${v} hours a week`} />
          <span className="mt-1 flex justify-between text-xs text-[var(--ink-3)]"><span>None</span><span>10</span><span>20+</span></span>
        </label>); })}</div>) },
    { q: 'What would you like to change?', hint: 'Pick any that matter to you.', valid: true, skip: a.needs.length === 0, body: (
      <div className="grid gap-2.5 sm:grid-cols-2">{outcomeOptions.map(([k, l]) => <Choice key={k} compact multi selected={a.outcomes.includes(k)} onClick={() => toggle('outcomes', k)} testid={`q4-outcome-${k}`}>{l}</Choice>)}</div>) },
    { q: 'How much could you spend each month?', valid: !!a.budget, auto: true, body: (
      <div className="grid gap-2.5">{BUDGET.map(([k, l, sub]) => <Choice key={k} compact sub={sub} selected={a.budget === k} onClick={() => pickAndGo({ budget: k })} testid={`q5-budget-${k}`}>{l}</Choice>)}</div>) },
    { q: 'Which of these do you already use?', hint: 'Pick any, or skip.', valid: true, body: (
      <div className="space-y-4"><div className="grid grid-cols-1 gap-2.5 min-[400px]:grid-cols-2 sm:grid-cols-3">{meta.software.map((s) => <Choice key={s} compact multi selected={a.software.includes(s)} onClick={() => toggle('software', s)} testid={`q6-software-${s.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>{s}</Choice>)}</div>
        {a.software.includes('Other') && (
          <OtherField id="q6-other" label="Which other software do you use?" hint="Separate with commas — for example: Wix, Calendly, Xero." value={a.software_other || ''} max={120}
            onChange={(v) => set({ software_other: v })} testid="q6-software-other-input" />
        )}
      </div>) },
    { q: 'How comfortable are you with apps?', valid: !!a.tech_comfort, auto: true, body: (
      <div className="grid gap-2.5">{TECH.map(([k, l, sub]) => <Choice key={k} compact sub={sub} selected={a.tech_comfort === k} onClick={() => pickAndGo({ tech_comfort: k })} testid={`q7-tech-${k}`}>{l}</Choice>)}</div>) },
    { q: 'When do you need it working?', valid: !!a.urgency, auto: true, body: (
      <div className="grid gap-2.5 sm:grid-cols-3">{URG.map(([k, l]) => <Choice key={k} compact selected={a.urgency === k} onClick={() => pickAndGo({ urgency: k })} testid={`q8-urgency-${k}`}>{l}</Choice>)}</div>) },
    { q: 'What matters most to you?', valid: !!a.priority, auto: true, body: (
      <div className="grid gap-2.5 sm:grid-cols-2">{PRI.map(([k, l]) => <Choice key={k} compact selected={a.priority === k} onClick={() => pickAndGo({ priority: k })} testid={`q9-priority-${k}`}>{l}</Choice>)}</div>) },
    { q: 'Anything else we should know?', hint: 'Optional — you can skip this.', valid: true, body: (
      <div><textarea className="if-input min-h-32 py-3" maxLength={1000} value={a.free_text} onChange={(e) => set({ free_text: e.target.value })} placeholder="For example: customers call after we close at 6pm." data-testid="q10-free-text" aria-label="Anything else we should know" /><p className="mt-1 text-right text-xs text-[var(--ink-3)]">{a.free_text.length}/1000</p></div>) },
  ];

  const i = Math.min(a.step, steps.length - 1);
  const step = steps[i];
  const isLast = i === steps.length - 1;
  const move = (dir) => {
    clearTimeout(advanceTimer.current);
    setDir(dir);
    let n = i + dir;
    while (steps[n]?.skip) n += dir;
    if (n < 0) return;
    if (n >= steps.length) { set({ completed: true }); return finish(); }
    set({ step: n });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const next = () => (step.valid ? move(1) : setError(i === 1 ? (a.something_else && !a.needs.length ? 'Please tell us in a few words what else takes up your time.' : 'Please pick at least one.') : 'Please choose an answer.'));
  const finish = () => {
    saveAnswers({ ...a, completed: true });
    sessionStorage.setItem('if_submit_answers', '1');
    if (user) nav(user.onboarding_complete ? '/auth/continue' : '/onboarding');
    else startLogin('/auth/continue');
  };
  // Count only the questions this owner will actually see.
  // Steps 3 and 4 only drop out once the owner has chosen just "Something else", so the total never jumps around.
  const dropped = a.needs.length === 0 && a.something_else && i > 1 ? 2 : 0;
  const total = steps.length - dropped;
  const pos = i + 1 - (dropped && i > 3 ? 2 : 0);
  const pct = Math.round((pos / total) * 100);

  return (
    <div className="if-container max-w-2xl pb-6 pt-6 sm:pt-12" onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') next(); }}>
      <div className="mb-8">
        <div className="flex items-center justify-between gap-3">
          <button type="button" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm text-[var(--ink-2)] hover:bg-[var(--surface-hover)] disabled:invisible" onClick={() => move(-1)} disabled={i === 0} data-testid="questionnaire-back-button"><ArrowLeft className="h-4 w-4" />Back</button>
          <span className="text-sm text-[var(--ink-3)]" data-testid="questionnaire-progress-label">Question {pos} of {total}</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-hover)]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-[var(--brand)] transition-[width] duration-300" style={{ width: `${pct}%` }} /></div>
      </div>
      <section key={i} className={dir < 0 ? 'if-slide-back' : 'if-slide-in'} aria-live="polite">
        <h1 className="text-[1.65rem] font-semibold leading-tight sm:text-[2rem]" data-testid="questionnaire-question">{step.q}</h1>
        {step.hint && <p className="mt-2 text-[var(--ink-3)]">{step.hint}</p>}
        <div className="mt-7">{step.body}</div>
        {isLast && !user && <p className="mt-6 text-sm text-[var(--ink-3)]">Next, create a free account so we can save your results.</p>}
        {error && <p className="mt-4 rounded-xl border border-danger-line bg-danger-soft px-4 py-3 text-sm font-medium text-danger" role="alert" data-testid="questionnaire-error">{error}</p>}
      </section>

      {/* Action bar sits right under the question. On long questions it sticks to the bottom of the screen
          (thumb reach on phones) but never goes past the end of the questionnaire, so it never covers the footer. */}
      <div className="pb-safe sticky bottom-0 z-30 -mx-4 mt-8 border-t border-[var(--line)] bg-[var(--header-bg)] px-4 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between gap-3 pt-3">
          <button type="button" className="-ml-2 min-h-11 rounded-lg px-2 text-sm text-[var(--ink-3)] underline-offset-2 hover:underline" onClick={() => { if (window.confirm('Clear your answers and start again?')) setA(emptyAnswers()); }} data-testid="questionnaire-reset-button">Start over</button>
          <button type="button" className="if-btn-primary if-press min-h-12 min-w-36 text-base sm:min-w-44" onClick={next} data-testid="questionnaire-continue-button">
            {isLast ? 'See my results' : step.auto && !step.valid ? 'Choose one' : (step.hint?.includes('skip') && !a.software.length && i === 5) ? 'Skip' : 'Next'}<ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
