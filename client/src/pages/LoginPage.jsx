import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../lib/api';
import { Spinner } from '../components/ui';
import BrandLogo from '../components/BrandLogo';

const APP_NAME = 'reyOne Construction Manager';
const YEAR = new Date().getFullYear();

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!loading && user) return <Navigate to="/" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(errorMessage(err, 'Login failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-full">
      {/* Brand panel (large screens) */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-500 to-brand-700 p-12 text-white lg:flex">
        {/* soft decorative glow */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-black/10 blur-2xl" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/95 shadow-sm">
            <BrandLogo className="h-9 w-9" />
          </div>
          <span className="text-xl font-bold tracking-tight">reyOne</span>
        </div>

        <div className="relative">
          <h2 className="text-4xl font-bold leading-tight">{APP_NAME}</h2>
          <p className="mt-4 max-w-md text-white/85">
            Plan projects, track finances, manage your workforce and keep every
            document in one organised, professional workspace.
          </p>
          <ul className="mt-8 space-y-2 text-sm text-white/80">
            <li className="flex items-center gap-2"><Dot /> Projects, phases &amp; requirements</li>
            <li className="flex items-center gap-2"><Dot /> Expenses, invoices &amp; vendor ledgers</li>
            <li className="flex items-center gap-2"><Dot /> Workforce &amp; role-based access</li>
          </ul>
        </div>

        <p className="relative text-xs text-white/60">© {YEAR} reynrel · All rights reserved</p>
      </div>

      {/* Form panel */}
      <div className="flex w-full items-center justify-center bg-cream px-4 py-10 dark:bg-slate-900 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center gap-3 text-center lg:hidden">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-slate-800">
              <BrandLogo className="h-12 w-12" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{APP_NAME}</h1>
          </div>

          <div className="mb-6 hidden lg:block">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Welcome back</h1>
            <p className="mt-1 text-sm text-slate-500">Sign in to your account to continue</p>
          </div>

          <form onSubmit={onSubmit} className="card space-y-4 p-6 shadow-sm">
            {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@company.com"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={submitting}>
              {submitting ? <Spinner className="h-4 w-4" /> : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400 lg:hidden">© {YEAR} reynrel</p>
        </div>
      </div>
    </div>
  );
}

function Dot() {
  return <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/80" />;
}
