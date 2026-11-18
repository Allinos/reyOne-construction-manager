import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../../modules/notifications/NotificationBell';
import HelpModal from '../HelpModal';
import Icon from '../Icon';

function initialsOf(name) {
  return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

function UserMenu() {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const go = (to) => { setOpen(false); navigate(to); };

  return (
    <div className="relative" ref={ref}>
      <button
        className="ml-1 flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-slate-100 dark:hover:bg-slate-700"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-brand-900">{initialsOf(user?.name)}</span>
        <span className="hidden text-left sm:block">
          <span className="block max-w-[10rem] truncate text-sm font-medium leading-tight text-slate-800 dark:text-slate-100">{user?.name}</span>
          <span className="block max-w-[10rem] truncate text-[11px] leading-tight text-slate-500">{user?.role?.name}</span>
        </span>
        <svg className="hidden h-4 w-4 text-slate-400 sm:block" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.06l3.71-3.83a.75.75 0 1 1 1.08 1.04l-4.25 4.39a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06z" clipRule="evenodd" /></svg>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-[95] mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
          <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-700">
            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{user?.name}</p>
            <p className="truncate text-xs text-slate-500">{user?.email}</p>
            <p className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">{user?.role?.name}</p>
          </div>
          <div className="py-1">
            {can('settings.read') && (
              <button role="menuitem" className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700" onClick={() => go('/settings')}>
                <Icon name="settings" className="h-4 w-4 text-slate-400" /> Settings
              </button>
            )}
            <button role="menuitem" className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20" onClick={logout}>
              <Icon name="logout" className="h-4 w-4" /> Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TopNav({ onMenu }) {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-800">
      <button className="btn-ghost px-2 md:invisible" onClick={onMenu} aria-label="Open menu">
        <Icon name="menu" />
      </button>
      <div className="flex items-center gap-1">
        <button
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          onClick={() => setHelpOpen(true)}
          aria-label="Help"
          title="Help"
        >
          <Icon name="help" className="h-5 w-5" />
        </button>
        <NotificationBell />
        <UserMenu />
      </div>
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </header>
  );
}
