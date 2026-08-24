import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listExpenses, deleteExpense, projectOptions, getExpenseStats } from './api';
import { vendorOptions } from '../vendors/api';
import { workforceOptions } from '../workforce/api';
import ExpenseFormModal from './ExpenseFormModal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { errorMessage } from '../../lib/api';
import { formatMoney, formatDate } from '../../lib/format';
import { PageHeader, Card, Spinner, EmptyState, Pagination, Alert } from '../../components/ui';
import Modal from '../../components/Modal';
import AnalyticsModal, { AnalyticsButton } from '../../components/AnalyticsModal';
import { ExpenseAnalytics } from './analytics';

const PAY_BADGE = {
  PAID: 'bg-green-100 text-green-700',
  PARTIAL: 'bg-amber-100 text-amber-700',
  CREDIT: 'bg-red-100 text-red-600',
};

export default function ExpensesPage() {
  const { bootstrap, can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const currency = bootstrap?.company?.currency || 'INR';

  const [projects, setProjects] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [workforce, setWorkforce] = useState([]);
  const [scopeFilter, setScopeFilter] = useState('');
  const [result, setResult] = useState({ items: [], meta: null });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [analytics, setAnalytics] = useState(false);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // drives analytics + list
  const [stats, setStats] = useState(null);

  // Human label for the selected month, e.g. "August 2026".
  const monthLabel = (() => {
    if (!/^\d{4}-\d{2}$/.test(month)) return '';
    const [y, m] = month.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
  })();
  const [chooser, setChooser] = useState(false); // scope selection dialog
  const [form, setForm] = useState(null); // { scope, editing }

  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]));
  const vendorMap = Object.fromEntries(vendors.map((v) => [v.id, v.name]));
  const workforceMap = Object.fromEntries(workforce.map((w) => [w.id, w]));

  const refreshStats = useCallback(() => {
    getExpenseStats(month).then(setStats).catch(() => {});
  }, [month]);

  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get('projectId') || '';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 50 };
      if (scopeFilter) params.scope = scopeFilter;
      // Project filter (from "See all Expenses") shows every month for that
      // project; otherwise the selected month applies.
      if (projectId) params.projectId = Number(projectId);
      else if (month) params.month = month;
      setResult(await listExpenses(params));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, scopeFilter, month, projectId]);

  useEffect(() => {
    projectOptions().then(setProjects).catch(() => {});
    vendorOptions().then(setVendors).catch(() => {});
    workforceOptions().then(setWorkforce).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { refreshStats(); }, [refreshStats]);

  const onSaved = () => { load(); refreshStats(); };

  const remove = async (id) => {
    const ok = await confirm({ title: 'Delete expense?', message: 'This expense record will be removed.', confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      await deleteExpense(id);
      toast.success('Expense deleted');
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const chooseScope = (scope) => { setChooser(false); setForm({ scope, editing: null }); };

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle="Project and company expenses"
        actions={
          <div className="flex gap-2">
            <AnalyticsButton onClick={() => setAnalytics(true)} />
            {can('finance.create') && <button className="btn-primary" onClick={() => setChooser(true)}>+ Add Expense</button>}
          </div>
        }
      />

      {/* Analytics header — reflects the selected month */}
      <Card className="mb-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            {monthLabel ? `${monthLabel} Analytics` : 'Analytics'}
          </h2>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Month</label>
            <input type="month" className="input w-auto py-1.5" value={month} onChange={(e) => { setMonth(e.target.value); setPage(1); }} />
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <div><p className="text-xs text-slate-500">Project Expenses</p><p className="text-lg font-semibold text-red-600">{stats ? formatMoney(stats.project, currency) : '—'}</p></div>
          <div><p className="text-xs text-slate-500">Company Expenses</p><p className="text-lg font-semibold text-red-600">{stats ? formatMoney(stats.company, currency) : '—'}</p></div>
          <div><p className="text-xs text-slate-500">Total Expenses</p><p className="text-lg font-semibold text-slate-800 dark:text-slate-100">{stats ? formatMoney(stats.total, currency) : '—'}</p></div>
        </div>
      </Card>

      {projectId && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:border-slate-600 dark:bg-slate-800 dark:text-brand-300">
          <span>Showing expenses for <b>{projectMap[projectId]?.name || `project #${projectId}`}</b></span>
          <button className="ml-auto text-xs font-medium hover:underline" onClick={() => { setSearchParams({}); setPage(1); }}>Clear filter</button>
        </div>
      )}

      {/* List header: "Last 50 Entries" + scope tabs */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {projectId ? 'Project Expenses' : `Last 50 Entries${monthLabel ? ` · ${monthLabel}` : ''}`}
        </h3>
        <div className="flex overflow-hidden rounded-lg border border-cream-300 text-sm dark:border-slate-700">
          {[{ v: '', l: 'All' }, { v: 'PROJECT', l: 'Project Expenses' }, { v: 'COMPANY', l: 'Company Expenses' }].map((t) => (
            <button key={t.v} className={`px-3 py-1.5 ${scopeFilter === t.v ? 'bg-brand-500 text-white' : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`} onClick={() => { setScopeFilter(t.v); setPage(1); }}>
              {t.l}
            </button>
          ))}
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      <Card className="!p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-10"><Spinner /></div>
        ) : result.items.length === 0 ? (
          <div className="p-6"><EmptyState title="No expenses yet" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream-100 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Project</th>
                  <th className="px-4 py-3 font-medium">Vendor / Paid To</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Paid</th>
                  <th className="px-4 py-3 font-medium">Balance</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {result.items.map((x) => {
                  const balance = (Number(x.amount) || 0) - (Number(x.amountPaid) || 0);
                  return (
                    <tr key={x.id}>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{x.category}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {x.scope === 'PROJECT' && x.projectId ? (
                          <Link to={`/projects/${x.projectId}`} className="block hover:underline">
                            <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
                              {projectMap[x.projectId]?.clientName || 'Client'}
                            </span>
                            <span className="block text-xs text-slate-400">
                              {projectMap[x.projectId]?.name || 'Project'} <span className="text-brand-500">#{x.projectId}</span>
                            </span>
                          </Link>
                        ) : 'Company'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {x.vendorId
                          ? (vendorMap[x.vendorId] || 'Vendor')
                          : x.workforceId
                          ? (workforceMap[x.workforceId]
                              ? `${workforceMap[x.workforceId].name} · ${workforceMap[x.workforceId].category}`
                              : 'Workforce')
                          : (x.paidTo || '—')}
                      </td>
                      <td className="px-4 py-3 font-medium text-red-600">{formatMoney(x.amount, currency)}</td>
                      <td className="px-4 py-3 text-green-700">{formatMoney(x.amountPaid, currency)}</td>
                      <td className="px-4 py-3 text-slate-600">{formatMoney(balance > 0 ? balance : 0, currency)}</td>
                      <td className="px-4 py-3"><span className={`badge ${PAY_BADGE[x.paymentStatus] || 'bg-cream-200 text-slate-600'}`}>{x.paymentStatus}</span></td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(x.date)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {can('finance.update') && <button className="pill-edit" onClick={() => setForm({ scope: x.scope, editing: x })}>Edit</button>}
                        {can('finance.delete') && <button className="pill-delete ml-2" onClick={() => remove(x.id)}>Delete</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Pagination meta={result.meta} onPage={setPage} />

      {/* Scope chooser */}
      <Modal open={chooser} onClose={() => setChooser(false)} title="Add Expense">
        <p className="mb-4 text-sm text-slate-500">What type of expense are you adding?</p>
        <div className="grid grid-cols-2 gap-3">
          <button className="rounded-lg border border-cream-300 p-5 text-center hover:border-brand-400 hover:bg-brand-50 dark:border-slate-700" onClick={() => chooseScope('PROJECT')}>
            <p className="font-semibold text-slate-800 dark:text-slate-100">Project Expense</p>
            <p className="mt-1 text-xs text-slate-500">Tied to a specific project</p>
          </button>
          <button className="rounded-lg border border-cream-300 p-5 text-center hover:border-brand-400 hover:bg-brand-50 dark:border-slate-700" onClick={() => chooseScope('COMPANY')}>
            <p className="font-semibold text-slate-800 dark:text-slate-100">Company Expense</p>
            <p className="mt-1 text-xs text-slate-500">General business expense</p>
          </button>
        </div>
      </Modal>

      {form && (
        <ExpenseFormModal open scope={form.scope} editing={form.editing} onClose={() => setForm(null)} onSaved={onSaved} />
      )}

      <AnalyticsModal open={analytics} onClose={() => setAnalytics(false)} title="Expense Analytics">
        <ExpenseAnalytics open={analytics} />
      </AnalyticsModal>
    </div>
  );
}
