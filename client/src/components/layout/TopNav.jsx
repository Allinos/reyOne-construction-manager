import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../../modules/notifications/NotificationBell';
import HelpModal from '../HelpModal';
import Icon from '../Icon';
import { MODULE_DEFS } from '../../app/modules';
import CommandPalette, { quickActions } from './CommandPalette';

// Page name for the breadcrumb, from the module registry.
function useCrumbs() {
  const { pathname } = useLocation();
  const { bootstrap } = useAuth();
  return useMemo(() => {
    const def = [...MODULE_DEFS].filter((m) => m.path !== '/' && pathname.startsWith(m.path)).sort((a, b) => b.path.length - a.path.length)[0];
    if (!def) return pathname === '/' ? [{ label: 'Dashboard' }] : [];
    const label = def.key === 'custom_module' ? bootstrap?.settings?.custom_module?.name || def.label : def.label;
    const rest = pathname.slice(def.path.length).split('/').filter(Boolean);
    return rest.length ? [{ label, to: def.path }, { label: rest[0] === 'new' ? 'New' : rest.includes('edit') ? 'Edit' : 'Details' }] : [{ label }];
  }, [pathname, bootstrap]);
}

export function QuickAdd({ variant = 'icon' }) {
  const { bootstrap, can } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const actions = quickActions(can, new Set((bootstrap?.modules || []).map((m) => m.key)));
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  if (!actions.length) return null;
  return (
    <div className="relative" ref={ref}>
      {variant === 'primary' ? (
        <button className="btn-primary" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}><Icon name="add" className="h-4 w-4" /> New</button>
      ) : (
        <button className="flex h-[38px] w-[38px] items-center justify-center rounded-[11px] border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300" onClick={() => setOpen((o) => !o)} aria-label="Create new" title="Create new" aria-haspopup="menu" aria-expanded={open}>
          <Icon name="add" className="h-[18px] w-[18px]" />
        </button>
      )}
      {open && (
        <div role="menu" className="absolute right-0 z-[95] mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-pop dark:border-slate-700 dark:bg-slate-800">
          <p className="px-2.5 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-400">Create</p>
          {actions.map((a) => (
            <button key={a.id} role="menuitem" className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-brand-50 dark:text-slate-200 dark:hover:bg-slate-700" onClick={() => { setOpen(false); navigate(a.to); }}>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"><Icon name={a.icon} className="h-4 w-4" /></span>
              {a.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TopNav({ onMenu }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const crumbs = useCrumbs();

  // Ctrl/⌘ + K opens the command palette from anywhere.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((o) => !o); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className="flex h-[62px] shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 md:px-7 dark:border-slate-700 dark:bg-slate-800">
      <button className="btn-ghost -ml-1 px-2 md:hidden" onClick={onMenu} aria-label="Open menu">
        <Icon name="menu" />
      </button>
      <nav className="hidden min-w-0 items-center gap-1.5 text-[13px] text-slate-400 sm:flex" aria-label="Breadcrumb">
        {crumbs.map((c, i) => (
          <span key={i} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg>}
            {c.to ? <Link to={c.to} className="truncate hover:text-slate-700 dark:hover:text-slate-200">{c.label}</Link> : <span className={`truncate ${i === crumbs.length - 1 && crumbs.length > 1 ? 'font-semibold text-slate-800 dark:text-slate-100' : ''}`}>{c.label}</span>}
          </span>
        ))}
      </nav>
      <button
        className="ml-auto flex h-[38px] min-w-0 flex-1 items-center gap-2 rounded-[11px] border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-400 hover:border-slate-300 sm:max-w-[380px] dark:border-slate-700 dark:bg-slate-900/40"
        onClick={() => setPalette(true)}
        aria-label="Search (Ctrl K)"
      >
        <Icon name="search" className="h-4 w-4 shrink-0" />
        <span className="truncate">Search projects, bills, people…</span>
        <kbd className="ml-auto hidden rounded-md border border-slate-300 bg-white px-1.5 text-[11px] font-semibold text-slate-500 sm:block dark:border-slate-600 dark:bg-slate-800">Ctrl K</kbd>
      </button>
      <QuickAdd />
      <button className="hidden h-[38px] w-[38px] items-center justify-center rounded-[11px] border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 sm:flex dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300" onClick={() => setHelpOpen(true)} aria-label="Help" title="Help">
        <Icon name="help" className="h-[18px] w-[18px]" />
      </button>
      <NotificationBell />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </header>
  );
}
