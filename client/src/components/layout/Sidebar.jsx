import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { buildNav } from '../../app/modules';
import api, { unwrap } from '../../lib/api';
import Icon from '../Icon';
import ProfileModal from './ProfileModal';

const initialsOf = (name) => (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

const linkClass = ({ isActive }) =>
  `relative flex items-center gap-[11px] rounded-[10px] px-2.5 py-2 text-[13.5px] transition-colors ${
    isActive
      ? 'bg-brand-50 font-semibold text-brand-900 before:absolute before:-left-3 before:bottom-2 before:top-2 before:w-[3px] before:rounded-full before:bg-brand-500 dark:bg-brand-500/15 dark:text-brand-200'
      : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700/60 dark:hover:text-white'
  }`;

// Sidebar badge counts (refreshed every minute).
function useNavCounts() {
  const [counts, setCounts] = useState({});
  useEffect(() => {
    let alive = true;
    const load = () => unwrap(api.get('/dashboard/nav-counts')).then((c) => alive && setCounts(c || {})).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  return counts;
}

function CountPill({ value, hot }) {
  if (!value) return null;
  return (
    <span className={`ml-auto rounded-full px-[7px] text-[11px] font-semibold leading-[18px] ${hot ? 'bg-red-600 text-white' : 'border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-300'}`}>
      {value > 99 ? '99+' : value}
    </span>
  );
}

function MeMenu({ onNavigate }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const dark = theme === 'dark';
  return (
    <div ref={ref} className="relative mt-2 border-t border-slate-200 pt-2 dark:border-slate-700">
      {open && (
        <div role="menu" className="absolute bottom-full left-0 right-0 z-[95] mb-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-pop dark:border-slate-700 dark:bg-slate-800">
          <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-700">
            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{user?.name}</p>
            <p className="truncate text-xs text-slate-500">{user?.email}</p>
          </div>
          <div className="py-1">
            <button role="menuitem" className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700" onClick={() => { setOpen(false); setProfile(true); }}>
              <Icon name="users" className="h-4 w-4 text-slate-400" /> My profile &amp; password
            </button>
            <button role="menuitem" className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700" onClick={toggle}>
              <Icon name={dark ? 'sun' : 'moon'} className="h-4 w-4 text-slate-400" /> {dark ? 'Light mode' : 'Dark mode'}
            </button>
            <button role="menuitem" className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20" onClick={logout}>
              <Icon name="logout" className="h-4 w-4" /> Log out
            </button>
          </div>
        </div>
      )}
      <div className="flex items-center gap-1">
        <button className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[10px] p-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700/60" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
          <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-brand-200 text-xs font-bold text-brand-900">{initialsOf(user?.name)}</span>
          <span className="min-w-0">
            <span className="block truncate text-[12.5px] font-semibold text-slate-800 dark:text-slate-100">{user?.name}</span>
            <span className="block truncate text-[11px] text-slate-400">{user?.role?.name}</span>
          </span>
        </button>
        <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-white" onClick={toggle} title={dark ? 'Light mode' : 'Dark mode'} aria-label="Toggle dark mode">
          <Icon name={dark ? 'sun' : 'moon'} className="h-4 w-4" />
        </button>
      </div>
      {profile && <ProfileModal onClose={() => { setProfile(false); onNavigate?.(); }} />}
    </div>
  );
}

export default function Sidebar({ onNavigate }) {
  const { bootstrap, can } = useAuth();
  const enabledKeys = (bootstrap?.modules || []).map((m) => m.key);
  const labels = { custom_module: bootstrap?.settings?.custom_module?.name, inspections: 'Inspections', payroll: 'Payroll' };
  const groups = buildNav(enabledKeys, can, labels);
  const company = bootstrap?.company;
  const main = groups.filter((g) => g.key !== 'bottom');
  const bottom = groups.find((g) => g.key === 'bottom')?.items || [];
  const counts = useNavCounts();
  const countFor = (key) => ({ projects: [counts.projects], materials: [counts.materials], inspections: [counts.inspections], queries: [counts.queries, counts.queriesUrgent] }[key] || []);

  return (
    <aside className="flex h-full w-[236px] flex-col border-r border-slate-200 bg-white px-3.5 py-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center gap-2.5 px-2 pb-4">
        <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-gradient-to-br from-brand-500 to-brand-600 shadow-[0_4px_12px_rgba(204,110,2,.35)]">
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] text-white" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20V9l8-5 8 5v11M9 20v-6h6v6" /></svg>
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-bold leading-tight text-slate-900 dark:text-white">reyOne</p>
          <p className="text-[11px] font-medium text-slate-400">Construction OS</p>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 dark:border-slate-700 dark:bg-slate-900/40">
        <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg bg-brand-900 text-[11px] font-bold text-brand-200">{initialsOf(company?.name || 'Company')}</span>
        <span className="min-w-0">
          <span className="block truncate text-[12.5px] font-semibold text-slate-800 dark:text-slate-100">{company?.name || 'Your company'}</span>
          <span className="block truncate text-[11px] text-slate-400">{company?.currency || 'INR'} · {company?.timezone?.split('/').pop()?.replace('_', ' ') || 'India'}</span>
        </span>
      </div>

      <nav className="scroll-thin -mx-1 flex-1 overflow-y-auto px-1">
        {main.map((group) => (
          <div key={group.key}>
            {group.label && <p className="px-2.5 pb-1.5 pt-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-400">{group.label}</p>}
            <div className="space-y-0.5">
              {group.items.map((m) => {
                const [n, hot] = countFor(m.key);
                return (
                  <NavLink key={m.key} to={m.path} end={m.path === '/'} onClick={onNavigate} className={linkClass}>
                    {({ isActive }) => (
                      <>
                        <Icon name={m.icon} className={`h-[17px] w-[17px] ${isActive ? 'text-brand-600 dark:text-brand-300' : 'text-slate-400'}`} />
                        <span className="truncate">{m.label}</span>
                        <CountPill value={n} hot={hot} />
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-2 space-y-0.5">
        {bottom.map((m) => (
          <NavLink key={m.key} to={m.path} onClick={onNavigate} className={linkClass}>
            {({ isActive }) => (
              <>
                <Icon name={m.icon} className={`h-[17px] w-[17px] ${isActive ? 'text-brand-600 dark:text-brand-300' : 'text-slate-400'}`} />
                <span className="truncate">{m.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
      <MeMenu onNavigate={onNavigate} />
    </aside>
  );
}
