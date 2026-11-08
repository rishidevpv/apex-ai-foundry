import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, Bookmark, Settings, Shield, MoonStar, SunMedium, ChevronDown, LayoutGrid } from 'lucide-react';
import { useAuth, startLogin } from '@/lib/auth';

export const Logo = () => (
  <Link to="/" className="flex items-center gap-2.5" data-testid="header-logo-link">
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--brand)] text-[var(--on-brand)]">
      <svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden="true"><path d="M9 23V9h14" stroke="currentColor" strokeWidth="3.2" fill="none" strokeLinecap="round" /><circle cx="21.5" cy="21.5" r="3.2" fill="var(--gold)" /></svg>
    </span>
    <span className="font-display text-[1.25rem] font-extrabold tracking-[-0.01em] text-[var(--ink)]">APEX</span>
  </Link>
);

// Light / dark switch: a real on/off control (role="switch"), with the sun or moon riding in the thumb.
function ThemeSwitch({ isDark, onToggle, testid }) {
  return (
    <button type="button" role="switch" aria-checked={isDark} aria-label="Dark mode" title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={onToggle} className="if-switch" data-testid={testid}>
      <span className="if-switch-thumb">{isDark ? <MoonStar className="h-3.5 w-3.5" /> : <SunMedium className="h-3.5 w-3.5" />}</span>
    </button>
  );
}

// Signed-in extras live in one account menu, so the header keeps the same shape whether or not you're signed in.
function AccountMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  const first = (user.name || user.email || '').split(/[\s@]/)[0] || 'Account';
  const item = 'flex min-h-11 items-center gap-3 rounded-xl px-3 text-[0.95rem] text-[var(--ink)] hover:bg-[var(--surface-hover)]';
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} data-testid="nav-account-button"
        className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full border border-[var(--line)] bg-[var(--surface)] py-1 pl-1 pr-3 text-[0.92rem] font-semibold hover:bg-[var(--surface-hover)]">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--brand)] text-sm font-bold text-[var(--on-brand)]">{first[0]?.toUpperCase()}</span>
        <span className="max-w-[8rem] truncate">{first}</span>
        <ChevronDown className={`h-4 w-4 text-[var(--ink-3)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div role="menu" className="if-fade-up absolute right-0 top-full z-50 mt-2 w-60 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2 shadow-[var(--shadow-pop)]" onClick={() => setOpen(false)} data-testid="nav-account-menu">
          <p className="truncate px-3 pb-2 pt-1 text-xs text-[var(--ink-3)]">{user.email}</p>
          <Link role="menuitem" to="/dashboard" className={item} data-testid="nav-dashboard"><LayoutGrid className="h-4 w-4 text-[var(--ink-3)]" />My results</Link>
          <Link role="menuitem" to="/me" className={item} data-testid="nav-my-tools"><Bookmark className="h-4 w-4 text-[var(--ink-3)]" />My tools</Link>
          <Link role="menuitem" to="/me/settings" className={item} data-testid="nav-settings"><Settings className="h-4 w-4 text-[var(--ink-3)]" />Settings</Link>
          {user.is_admin && <Link role="menuitem" to="/admin" className={item} data-testid="nav-admin"><Shield className="h-4 w-4 text-[var(--ink-3)]" />Admin</Link>}
          <div className="my-1 border-t border-[var(--line)]" />
          <button role="menuitem" type="button" onClick={onLogout} className={`${item} w-full`} data-testid="nav-logout-button"><LogOut className="h-4 w-4 text-[var(--ink-3)]" />Sign out</button>
        </div>
      )}
    </div>
  );
}

const NAV = [
  { to: '/tools', label: 'Marketplace', id: 'nav-marketplace' },
  { to: '/demo', label: 'Sample businesses', id: 'nav-demo' },
  { to: '/compare', label: 'Compare', id: 'nav-compare' },
];

export function Header() {
  const { user, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const isDark = resolvedTheme === 'dark';
  const linkCls = ({ isActive }) => `whitespace-nowrap rounded-full px-3 py-2 text-[0.92rem] font-medium transition-all ${isActive ? 'bg-[var(--brand-soft)] text-[var(--brand)]' : 'text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--surface-warm)]'}`;
  const doLogout = async () => { await logout(); setOpen(false); nav('/'); };
  return (
    <header className="sticky top-0 z-40 bg-[color:var(--header-bg)] backdrop-blur-xl">
      <div className="if-container flex h-20 items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] p-1 lg:flex" aria-label="Main">
          {NAV.map((n) => <NavLink key={n.to} to={n.to} className={linkCls} data-testid={n.id}>{n.label}</NavLink>)}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <ThemeSwitch isDark={isDark} onToggle={() => setTheme(isDark ? 'light' : 'dark')} testid="theme-toggle" />
          {user ? (
            <AccountMenu user={user} onLogout={doLogout} />
          ) : (
            <>
              <button type="button" onClick={() => startLogin('/dashboard')} className="if-btn-quiet whitespace-nowrap" data-testid="nav-signin-button">Sign in</button>
              <Link to="/start" className="if-btn-primary min-h-11 whitespace-nowrap" data-testid="nav-start-button">Get started</Link>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 lg:hidden">
          <ThemeSwitch isDark={isDark} onToggle={() => setTheme(isDark ? 'light' : 'dark')} testid="theme-toggle-mobile" />
          <button type="button" className="if-btn-quiet" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu" data-testid="nav-mobile-toggle">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-[var(--line)] bg-[var(--canvas)] lg:hidden" data-testid="nav-mobile-menu">
          <div className="if-container flex flex-col gap-1 py-3" onClick={() => setOpen(false)}>
            {NAV.map((n) => <NavLink key={n.to} to={n.to} className={linkCls}>{n.label}</NavLink>)}
            {user ? (
              <>
                <NavLink to="/dashboard" className={linkCls}>My results</NavLink>
                <NavLink to="/me" className={linkCls}>My tools</NavLink>
                <NavLink to="/me/settings" className={linkCls}>Settings</NavLink>
                {user.is_admin && <NavLink to="/admin" className={linkCls}>Admin</NavLink>}
                <button type="button" onClick={doLogout} className="if-btn-ghost mt-2">Sign out</button>
              </>
            ) : (
              <>
                <Link to="/start" className="if-btn-primary mt-2">Get started</Link>
                <button type="button" onClick={() => startLogin('/dashboard')} className="if-btn-ghost">Sign in</button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-24 border-t border-[var(--line)] bg-[var(--surface-warm)] pb-[env(safe-area-inset-bottom)]">
      <div className="if-container grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-sm text-sm text-[var(--ink-2)]">Recommendations come from a transparent scoring method, not from payments. Nothing here is an endorsement or a guarantee. No sponsored placements.</p>
        </div>
        <div className="space-y-2 text-sm">
          <p className="if-eyebrow">Explore</p>
          <Link to="/tools" className="block text-[var(--ink-2)] hover:text-[var(--ink)]" data-testid="footer-marketplace-link">Marketplace</Link>
          <Link to="/demo" className="block text-[var(--ink-2)] hover:text-[var(--ink)]">Sample businesses</Link>
          <Link to="/providers/new" className="block text-[var(--ink-2)] hover:text-[var(--ink)]" data-testid="footer-provider-link">List your tool</Link>
        </div>
        <div className="space-y-2 text-sm">
          <p className="if-eyebrow">About</p>
          <Link to="/privacy" className="block text-[var(--ink-2)] hover:text-[var(--ink)]" data-testid="footer-privacy-link">Privacy</Link>
          <Link to="/terms" className="block text-[var(--ink-2)] hover:text-[var(--ink)]" data-testid="footer-terms-link">Terms</Link>
          <Link to="/contact" className="block text-[var(--ink-2)] hover:text-[var(--ink)]" data-testid="footer-contact-link">Contact</Link>
        </div>
      </div>
    </footer>
  );
}
