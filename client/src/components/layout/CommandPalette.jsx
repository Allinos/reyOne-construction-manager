import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { buildNav } from '../../app/modules';
import api from '../../lib/api';
import Icon from '../Icon';

const TONE = {
  y: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
  r: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  b: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  g: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
};

// Things you can start from anywhere. `module` hides an action when that module is off.
export function quickActions(can, enabled) {
  return [
    { id: 'new-project', title: 'New project', sub: 'Projects', icon: 'projects', to: '/projects/new', perm: 'projects.create', module: 'projects', keys: 'create add site' },
    { id: 'new-inspection', title: 'New site inspection', sub: 'Inspections', icon: 'inspection', to: '/inspections?new=1', perm: 'inspections.manage', module: 'inspections', keys: 'checklist quality safety' },
    { id: 'raise-query', title: 'Raise a query / RFI', sub: 'Queries', icon: 'queries', to: '/queries?new=1', perm: 'queries.create', module: 'queries', keys: 'question rfi clarification' },
    { id: 'new-document', title: 'New document', sub: 'Invoice, quotation, work order, DPR…', icon: 'documents', to: '/documents?tab=templates', perm: 'documents.create', module: 'documents', keys: 'invoice quotation bill letter agreement' },
    { id: 'add-expense', title: 'Record an expense', sub: 'Expenses', icon: 'expenses', to: '/expenses?new=1', perm: 'finance.create', module: 'finance', keys: 'spend payment bill' },
    { id: 'add-vendor', title: 'Add vendor', sub: 'Vendors', icon: 'vendors', to: '/vendors?new=1', perm: 'vendors.create', module: 'vendors', keys: 'supplier contractor' },
    { id: 'materials', title: 'Request / order materials', sub: 'Materials', icon: 'materials', to: '/materials', perm: 'materials.read', module: 'materials', keys: 'cement steel stock purchase order' },
  ].filter((a) => (!a.perm || can(a.perm)) && (!a.module || enabled.has(a.module)));
}

export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const { bootstrap, can } = useAuth();
  const { theme, toggle } = useTheme();
  const [q, setQ] = useState('');
  const [found, setFound] = useState({ projects: [], vendors: [], clients: [] });
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const enabled = useMemo(() => new Set((bootstrap?.modules || []).map((m) => m.key)), [bootstrap]);

  useEffect(() => {
    if (open) { setQ(''); setActive(0); }
  }, [open]);

  // Live search of records (debounced), only in modules the user can see.
  useEffect(() => {
    if (!open) return undefined;
    const term = q.trim();
    if (term.length < 2) { setFound({ projects: [], vendors: [], clients: [] }); return undefined; }
    const t = setTimeout(async () => {
      const get = (url, ok, s = term) => (ok && s ? api.get(url, { params: { search: s, limit: 5 } }).then((r) => r.data.data || []).catch(() => []) : Promise.resolve([]));
      const bare = term.replace(/^(pay|bill)\b\s*/i, '');
      const [projects, vendors, clients] = await Promise.all([
        get('/projects', can('projects.read') && enabled.has('projects')),
        get('/vendors', can('vendors.read') && enabled.has('vendors'), bare),
        get('/clients', can('clients.read') && enabled.has('clients')),
      ]);
      setFound({ projects, vendors, clients });
    }, 180);
    return () => clearTimeout(t);
  }, [q, open, can, enabled]);

  const items = useMemo(() => {
    const term = q.trim().toLowerCase();
    const match = (s) => !term || s.toLowerCase().includes(term) || term.split(/\s+/).every((w) => s.toLowerCase().includes(w));
    const out = [];
    // Vendor-specific actions ("pay build" → Pay BuildMart).
    const payWord = /^(pay|bill)\b/.test(term);
    const vTerm = term.replace(/^(pay|bill)\s*/, '');
    if (payWord && can('vendors.pay')) {
      for (const v of found.vendors.filter((x) => !vTerm || x.name.toLowerCase().includes(vTerm)).slice(0, 2)) {
        out.push({ group: 'Actions', id: `pay-${v.id}`, title: `Pay ${v.name}`, sub: 'Record a payment against their bills', icon: 'finance', tone: 'r', to: `/vendors?v=${v.id}&pay=1` });
      }
    }
    for (const a of quickActions(can, enabled)) if (match(`${a.title} ${a.sub} ${a.keys}`)) out.push({ ...a, group: 'Actions', tone: 'y' });
    if (match('dark mode light mode theme')) out.push({ group: 'Actions', id: 'theme', title: theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode', sub: 'Appearance', icon: theme === 'dark' ? 'sun' : 'moon', tone: 'y', run: toggle });
    const labels = { custom_module: bootstrap?.settings?.custom_module?.name };
    for (const g of buildNav([...enabled], can, labels)) for (const m of g.items) if (term && match(m.label)) out.push({ group: 'Go to', id: `nav-${m.key}`, title: m.label, sub: 'Page', icon: m.icon, tone: 'b', to: m.path });
    for (const p of found.projects) out.push({ group: 'Projects', id: `p-${p.id}`, title: p.name, sub: [p.referenceNumber, p.clientName].filter(Boolean).join(' · '), icon: 'projects', tone: 'b', to: `/projects/${p.id}` });
    for (const v of found.vendors) out.push({ group: 'Vendors', id: `v-${v.id}`, title: v.name, sub: ['Vendor', v.category].filter(Boolean).join(' · '), icon: 'vendors', tone: 'b', to: `/vendors?v=${v.id}` });
    for (const c of found.clients) out.push({ group: 'Clients', id: `c-${c.id}`, title: c.name, sub: ['Client', c.phone].filter(Boolean).join(' · '), icon: 'clients', tone: 'g', to: `/clients/${c.id}` });
    return out;
  }, [q, found, can, enabled, theme, toggle, bootstrap]);

  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => { listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' }); }, [active]);

  const run = (it) => {
    if (!it) return;
    onClose();
    if (it.run) it.run();
    else navigate(it.to);
  };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(items[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  if (!open) return null;
  let lastGroup = null;
  return (
    <div className="fixed inset-0 z-[150] flex items-start justify-center bg-slate-900/40 p-4 pt-[12vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div className="w-full max-w-[640px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-pop dark:border-slate-700 dark:bg-slate-800" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Search and commands">
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3.5 dark:border-slate-700">
          <Icon name="search" className="h-5 w-5 text-slate-400" />
          <input ref={inputRef} autoFocus className="flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400 dark:text-white" placeholder="Search projects, vendors, clients — or type an action like “pay”, “new invoice”…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} />
          <kbd className="rounded-md border border-slate-300 px-1.5 text-[11px] font-semibold text-slate-400 dark:border-slate-600">Esc</kbd>
        </div>
        <div ref={listRef} className="scroll-thin max-h-[56vh] overflow-y-auto p-2">
          {!items.length && <p className="px-3 py-6 text-center text-sm text-slate-400">{q.trim().length < 2 ? 'Type to search' : 'No matches'}</p>}
          {items.map((it, i) => {
            const header = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            return (
              <div key={it.id}>
                {header && <p className="px-2.5 pb-1 pt-2.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-400">{header}</p>}
                <button data-idx={i} type="button" className={`flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left ${i === active ? 'bg-brand-50 dark:bg-brand-500/15' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`} onMouseEnter={() => setActive(i)} onClick={() => run(it)}>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONE[it.tone] || TONE.b}`}><Icon name={it.icon} className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-slate-800 dark:text-slate-100">{it.title}</span>
                    {it.sub && <span className="block truncate text-xs text-slate-400">{it.sub}</span>}
                  </span>
                  {i === active && <span className="text-xs text-slate-400">↵</span>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="hidden items-center justify-between border-t border-slate-200 px-4 py-2.5 text-xs text-slate-400 sm:flex dark:border-slate-700">
          <span>Tip: type “pay” and a vendor name, “new inspection”, or a project name</span>
          <span>↑↓ to move · ↵ to open</span>
        </div>
      </div>
    </div>
  );
}
