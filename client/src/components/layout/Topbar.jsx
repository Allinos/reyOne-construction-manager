import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Icon from '../Icon';

export default function Topbar({ onMenu }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const initials = (user?.name || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="flex items-center justify-between border-b border-cream-300 bg-white px-4 py-3">
      <button className="btn-ghost md:hidden" onClick={onMenu} aria-label="Open menu">
        <Icon name="menu" />
      </button>
      <div className="hidden md:block" />

      <div className="relative" ref={ref}>
        <button className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-cream-200" onClick={() => setOpen((v) => !v)}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
            {initials}
          </span>
          <span className="hidden text-sm font-medium text-slate-700 sm:block">{user?.name}</span>
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-48 rounded-lg border border-cream-300 bg-white py-1 shadow-lg">
            <div className="border-b border-cream-200 px-4 py-2">
              <p className="truncate text-sm font-medium text-slate-700">{user?.name}</p>
              <p className="truncate text-xs text-slate-400">{user?.role?.name}</p>
            </div>
            <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-cream-200" onClick={logout}>
              <Icon name="logout" className="h-4 w-4" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
