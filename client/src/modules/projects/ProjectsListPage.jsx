import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { listProjects } from './api';
import { useAuth } from '../../context/AuthContext';
import { errorMessage } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { PageHeader, Card, Spinner, EmptyState, Pagination, Alert, Progress } from '../../components/ui';
import AnalyticsModal, { AnalyticsButton } from '../../components/AnalyticsModal';
import { ProjectAnalytics } from './analytics';
import Select from '../../components/Select';
import Icon from '../../components/Icon';

const COVERS = ['#d9c3a0,#8a6a42', '#c9d3d8,#6e7f88', '#e3d5b8,#a0835a', '#d6e2d3,#6f8a6a', '#e8d9c4,#9b7b52', '#d8d4e6,#76709a', '#e6cfc3,#9a6650'];
const initials = (n) => (n || '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();
const AV = ['bg-brand-200 text-brand-900', 'bg-blue-100 text-blue-800', 'bg-emerald-100 text-emerald-800', 'bg-purple-100 text-purple-800'];
const short = (v) => {
  const n = Number(v) || 0;
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2).replace(/\.?0+$/, '')}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1).replace(/\.0$/, '')}L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
};
const monthYear = (d) => (d ? new Date(d).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '—');

// Health tag shown on each card.
function health(p) {
  if (p.status === 'completed') return { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' };
  if (p.spent != null && Number(p.projectAmount) > 0 && p.spent / Number(p.projectAmount) >= 0.9) return { label: `Budget ${Math.round((p.spent / Number(p.projectAmount)) * 100)}%`, cls: 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300', key: 'budget' };
  if (p.endDate && new Date(p.endDate) < new Date()) {
    const days = Math.ceil((Date.now() - new Date(p.endDate)) / 86400000);
    return { label: `${days} day${days === 1 ? '' : 's'} late`, cls: 'bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300', key: 'late' };
  }
  if ((p.progress || 0) === 0) return { label: 'Not started', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' };
  return { label: 'On track', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' };
}

function ProjectCard({ p, statusLabel }) {
  const h = health(p);
  const pct = p.progress ?? 0;
  return (
    <Link to={`/projects/${p.id}`} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-pop">
      <div className="relative h-24 shrink-0" style={{ background: `linear-gradient(135deg,${COVERS[p.id % COVERS.length]})` }}>
        <span className={`badge absolute left-3 top-3 bg-white shadow-sm dark:bg-slate-800 ${h.cls.split(' ').filter((c) => c.startsWith('text-') || c.startsWith('dark:text-')).join(' ')}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{h.label}</span>
        <span className="absolute bottom-2.5 left-3.5 text-[11px] font-semibold text-white/90">{p.referenceNumber}{p.category ? ` · ${p.category}` : ''}</span>
      </div>
      <div className="flex flex-1 flex-col px-4 py-3.5">
        <p className="truncate text-[14.5px] font-semibold tracking-tight text-slate-900 group-hover:text-brand-700 dark:text-white">{p.name}</p>
        <p className="mt-0.5 truncate text-xs text-slate-400">{p.clientName}{p.stage ? ` · Stage: ${p.stage}` : ` · ${statusLabel(p.status)}`}</p>
        <div className="mt-3.5 flex justify-between text-xs"><span className="text-slate-400">Progress</span><span className="font-semibold tabular-nums">{pct}%</span></div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className={`h-full rounded-full ${pct >= 80 ? 'bg-emerald-600' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} /></div>
        <div className="mt-3.5 grid grid-cols-3 gap-2 text-xs">
          <div><p className="text-slate-400">Contract</p><p className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">{p.projectAmount != null ? short(p.projectAmount) : '—'}</p></div>
          <div><p className="text-slate-400">Spent</p><p className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">{p.spent != null ? short(p.spent) : '—'}</p></div>
          <div><p className="text-slate-400">Handover</p><p className="font-semibold text-slate-800 dark:text-slate-100">{monthYear(p.endDate)}</p></div>
        </div>
        <div className="mt-auto flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-700" style={{ marginTop: '14px' }}>
          <div className="flex">
            {(p.team || []).map((n, i) => <span key={n + i} title={n} className={`-ml-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[9px] font-bold first:ml-0 dark:border-slate-800 ${AV[i % AV.length]}`}>{initials(n)}</span>)}
            {p.teamCount > 4 && <span className="-ml-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[9px] font-bold text-slate-600 dark:border-slate-800">+{p.teamCount - 4}</span>}
            {!p.teamCount && <span className="text-xs text-slate-400">No team yet</span>}
          </div>
          <span className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1" title="Open queries"><Icon name="queries" className="h-3.5 w-3.5" />{p.openQueries || 0}</span>
            <span className="flex items-center gap-1" title="Stages"><Icon name="inspection" className="h-3.5 w-3.5" />{p.stageCount || 0}</span>
            <span className="flex items-center gap-1" title="Photos"><Icon name="photo" className="h-3.5 w-3.5" />{p.photoCount || 0}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

const readView = () => { try { return localStorage.getItem('projects_view') || 'grid'; } catch { return 'grid'; } };

export default function ProjectsListPage() {
  const { bootstrap, can } = useAuth();
  const navigate = useNavigate();
  const categories = bootstrap?.settings?.projects?.categories || [];
  const statuses = bootstrap?.settings?.projects?.statuses || [];
  const statusLabel = (key) => statuses.find((s) => s.key === key)?.label || key;

  const [filters, setFilters] = useState({ search: '', category: '', status: '', page: 1, limit: 60 });
  const [quick, setQuick] = useState('all');
  const [view, setViewState] = useState(readView);
  const [result, setResult] = useState({ items: [], meta: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [analytics, setAnalytics] = useState(false);
  const setView = (v) => { setViewState(v); try { localStorage.setItem('projects_view', v); } catch { /* private mode */ } };

  const load = useCallback(async (params) => {
    setLoading(true);
    setError('');
    try {
      const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null));
      setResult(await listProjects(clean));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(filters); }, [filters, load]);
  const update = (patch) => setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));

  const items = result.items;
  const groups = {
    all: items,
    active: items.filter((p) => p.status !== 'completed'),
    late: items.filter((p) => health(p).key === 'late'),
    budget: items.filter((p) => health(p).key === 'budget'),
    completed: items.filter((p) => p.status === 'completed'),
  };
  const shown = groups[quick] || items;
  const total = items.reduce((s, p) => s + Number(p.projectAmount || 0), 0);
  const chips = [['all', 'All'], ['active', 'Active'], ['late', 'Delayed'], ['budget', 'Over budget'], ['completed', 'Completed']];

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle={`${result.meta?.total ?? items.length} projects${total ? ` · ${short(total)} contract value` : ''} · ${groups.active.length} active`}
        actions={
          <>
            <AnalyticsButton onClick={() => setAnalytics(true)} />
            {can('projects.create') && (
              <Link to="/projects/new" className="btn-primary"><Icon name="add" className="h-4 w-4" /> New project</Link>
            )}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="scroll-thin flex gap-1.5 overflow-x-auto">
          {chips.map(([k, l]) => (
            <button key={k} className={`chip ${quick === k ? 'chip-on' : ''}`} onClick={() => setQuick(k)}>
              {l}<span className="text-[11px] opacity-60">{groups[k].length}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input className="input w-56 pl-9" placeholder="Search name, client, ref…" value={filters.search} onChange={(e) => update({ search: e.target.value })} />
          </div>
          <Select className="input w-auto" value={filters.category} onChange={(e) => update({ category: e.target.value })}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Select className="input w-auto" value={filters.status} onChange={(e) => update({ status: e.target.value })}>
            <option value="">All statuses</option>
            {statuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </Select>
          <div className="flex rounded-[10px] border border-slate-200 bg-slate-50 p-[3px] dark:border-slate-700 dark:bg-slate-900/40">
            {[['grid', 'modules', 'Card view'], ['list', 'text', 'List view']].map(([k, ic, t]) => (
              <button key={k} title={t} aria-label={t} onClick={() => setView(k)} className={`rounded-[7px] px-2.5 py-1.5 ${view === k ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-400'}`}><Icon name={ic} className="h-4 w-4" /></button>
            ))}
          </div>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      {loading ? (
        <div className="flex justify-center p-10"><Spinner /></div>
      ) : shown.length === 0 ? (
        <EmptyState title="No projects here" hint={can('projects.create') && !items.length ? 'Add your first project to get started.' : 'Try another filter.'} />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((p) => <ProjectCard key={p.id} p={p} statusLabel={statusLabel} />)}
        </div>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Project</th><th>Client</th><th>Stage</th><th>Progress</th><th>Contract</th><th>Handover</th><th>Status</th></tr></thead>
              <tbody>
                {shown.map((p) => {
                  const h = health(p);
                  return (
                    <tr key={p.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40" onClick={() => navigate(`/projects/${p.id}`)}>
                      <td><p className="font-semibold text-slate-800 dark:text-slate-100">{p.name}</p><p className="text-xs text-slate-400">{p.referenceNumber}{p.category ? ` · ${p.category}` : ''}</p></td>
                      <td className="text-slate-600 dark:text-slate-300">{p.clientName}</td>
                      <td className="text-slate-600 dark:text-slate-300">{p.stage || '—'}</td>
                      <td><Progress value={p.progress ?? 0} className="w-28" /></td>
                      <td className="whitespace-nowrap tabular-nums">{p.projectAmount != null ? short(p.projectAmount) : '—'}</td>
                      <td className="whitespace-nowrap text-slate-500">{formatDate(p.endDate)}</td>
                      <td><span className={`badge ${h.cls}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{h.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Pagination meta={result.meta} onPage={(page) => update({ page })} />

      <AnalyticsModal open={analytics} onClose={() => setAnalytics(false)} title="Project Analytics">
        <ProjectAnalytics open={analytics} />
      </AnalyticsModal>
    </div>
  );
}
