import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { usePageTitle } from '@/lib/hooks';

export default function Login() {
  // Opens on “Create account” when the visitor came from a “create a free account” button.
  const [mode, setMode] = useState(() => { try { const m = sessionStorage.getItem('if_login_mode'); sessionStorage.removeItem('if_login_mode'); return m === 'register' ? 'register' : 'signin'; } catch { return 'signin'; } });
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const { setUser } = useAuth();
  const nav = useNavigate();
  const isNew = mode === 'register';
  usePageTitle(isNew ? 'Create account' : 'Sign in');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const body = isNew ? form : { email: form.email, password: form.password };
      const d = await api(isNew ? '/auth/register' : '/auth/login', { method: 'POST', body });
      setUser(d.user);
      nav('/auth/continue', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="if-container max-w-md py-16">
      <div className="if-card p-8">
        <h1 className="text-3xl font-extrabold">{isNew ? 'Create your account' : 'Sign in'}</h1>
        <p className="mt-2 text-[var(--ink-2)]">Save your results, keep a list of tools, and get setup guides made for you.</p>
        <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
          {isNew && (
            <label className="block"><span className="text-sm font-semibold">Your name</span>
              <input className="if-input mt-1 w-full" autoComplete="name" value={form.name} onChange={set('name')} required data-testid="login-name-input" />
            </label>
          )}
          <label className="block"><span className="text-sm font-semibold">Email</span>
            <input className="if-input mt-1 w-full" type="email" autoComplete="email" value={form.email} onChange={set('email')} required data-testid="login-email-input" />
          </label>
          <label className="block"><span className="text-sm font-semibold">Password</span>
            <input className="if-input mt-1 w-full" type="password" autoComplete={isNew ? 'new-password' : 'current-password'} minLength={isNew ? 8 : undefined} value={form.password} onChange={set('password')} required data-testid="login-password-input" />
            {isNew && <span className="mt-1 block text-xs text-[var(--ink-3)]">At least 8 characters.</span>}
          </label>
          {error && <p role="alert" className="text-sm font-semibold text-danger" data-testid="login-error">{error}</p>}
          <button type="submit" disabled={busy} className="if-btn-primary w-full min-h-12 text-base" data-testid="login-submit-button">
            {busy ? 'Please wait…' : isNew ? 'Create account' : 'Sign in'}
          </button>
        </form>
        <p className="mt-4 text-sm">
          {isNew ? 'Already have an account? ' : 'New here? '}
          <button type="button" className="font-semibold text-[var(--brand)] hover:underline" onClick={() => { setMode(isNew ? 'signin' : 'register'); setError(null); }} data-testid="login-toggle-mode">
            {isNew ? 'Sign in' : 'Create an account'}
          </button>
        </p>
        <p className="mt-6 flex gap-2 text-sm text-[var(--ink-3)]"><ShieldCheck className="h-4 w-4 shrink-0" />We only use your name and email. We never post anything or contact you unless you say so.</p>
        <p className="mt-4 text-sm">Just looking? <Link to="/demo" className="font-semibold text-[var(--brand)] hover:underline">Try a sample business</Link></p>
      </div>
    </div>
  );
}
