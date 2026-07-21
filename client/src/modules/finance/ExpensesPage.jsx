import { useEffect, useState, useCallback } from 'react';
import { listExpenses, createExpense, updateExpense, deleteExpense, projectOptions } from './api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { errorMessage } from '../../lib/api';
import { formatMoney, formatDate } from '../../lib/format';
import { PageHeader, Card, Spinner, EmptyState, Pagination, Alert } from '../../components/ui';
import Modal from '../../components/Modal';
import AnalyticsModal, { AnalyticsButton } from '../../components/AnalyticsModal';
import { ExpenseAnalytics } from './analytics';

const blank = { scope: 'COMPANY', projectId: '', category: '', amount: '', date: '', method: '', account: '', expenseBy: '', paidTo: '', notes: '' };

export default function ExpensesPage() {
  const { bootstrap, can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const currency = bootstrap?.company?.currency || 'INR';
  const finance = bootstrap?.settings?.finance || {};
  const methods = finance.payment_methods || [];
  const accounts = finance.accounts || [];
  const categories = finance.expense_categories || [];

  const [projects, setProjects] = useState([]);
  const [scopeFilter, setScopeFilter] = useState('');
  const [result, setResult] = useState({ items: [], meta: null });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page };
      if (scopeFilter) params.scope = scopeFilter;
      setResult(await listExpenses(params));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, scopeFilter]);

  useEffect(() => {
    projectOptions().then(setProjects).catch(() => {});
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => setModal({ form: { ...blank }, editingId: null });
  const openEdit = (x) =>
    setModal({
      editingId: x.id,
      form: {
        scope: x.scope,
        projectId: x.projectId || '',
        category: x.category,
        amount: x.amount,
        date: x.date?.slice(0, 10) || '',
        method: x.method,
        account: x.account,
        expenseBy: x.expenseBy || '',
        paidTo: x.paidTo || '',
        notes: x.notes || '',
      },
    });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const f = modal.form;
      const common = {
        category: f.category,
        amount: Number(f.amount),
        date: f.date,
        method: f.method,
        account: f.account,
        expenseBy: f.expenseBy || undefined,
        paidTo: f.paidTo || undefined,
        notes: f.notes || undefined,
      };
      if (modal.editingId) {
        await updateExpense(modal.editingId, common);
        toast.success('Expense updated successfully');
      } else {
        await createExpense({
          ...common,
          scope: f.scope,
          projectId: f.scope === 'PROJECT' ? Number(f.projectId) : undefined,
        });
        toast.success('Expense added successfully');
      }
      setModal(null);
      load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    const okToDelete = await confirm({ title: 'Delete expense?', message: 'This expense record will be removed.', confirmLabel: 'Delete' });
    if (!okToDelete) return;
    try {
      await deleteExpense(id);
      toast.success('Expense deleted');
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const setField = (k, v) => setModal((m) => ({ ...m, form: { ...m.form, [k]: v } }));

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle="Project and company expenses"
        actions={
          <div className="flex gap-2">
            <AnalyticsButton onClick={() => setAnalytics(true)} />
            {can('finance.create') && <button className="btn-primary" onClick={openNew}>+ Add Expense</button>}
          </div>
        }
      />

      <Card className="mb-4">
        <select className="input w-auto" value={scopeFilter} onChange={(e) => { setScopeFilter(e.target.value); setPage(1); }}>
          <option value="">All expenses</option>
          <option value="COMPANY">Company</option>
          <option value="PROJECT">Project</option>
        </select>
      </Card>

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
                  <th className="px-4 py-3 font-medium">Scope</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Account</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {result.items.map((x) => (
                  <tr key={x.id}>
                    <td className="px-4 py-3 text-slate-700">{x.category}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {x.scope === 'PROJECT' ? projectMap[x.projectId]?.name || 'Project' : 'Company'}
                    </td>
                    <td className="px-4 py-3 font-medium text-red-600">{formatMoney(x.amount, currency)}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(x.date)}</td>
                    <td className="px-4 py-3 text-slate-600">{x.account}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {can('finance.update') && (
                        <button className="pill-edit" onClick={() => openEdit(x)}>Edit</button>
                      )}
                      {can('finance.delete') && (
                        <button className="pill-delete ml-2" onClick={() => remove(x.id)}>Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Pagination meta={result.meta} onPage={setPage} />

      <Modal
        open={Boolean(modal)}
        onClose={() => setModal(null)}
        title={modal?.editingId ? 'Edit Expense' : 'Add Expense'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-primary" form="expense-form" disabled={saving}>
              {saving ? <Spinner className="h-4 w-4" /> : 'Save'}
            </button>
          </>
        }
      >
        {modal && (
          <form id="expense-form" onSubmit={save} className="space-y-4">
            {!modal.editingId && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Scope</label>
                  <select className="input" value={modal.form.scope} onChange={(e) => setField('scope', e.target.value)}>
                    <option value="COMPANY">Company</option>
                    <option value="PROJECT">Project</option>
                  </select>
                </div>
                {modal.form.scope === 'PROJECT' && (
                  <div>
                    <label className="label">Project</label>
                    <select className="input" value={modal.form.projectId} onChange={(e) => setField('projectId', e.target.value)} required>
                      <option value="">Select…</option>
                      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Category</label>
                <select className="input" value={modal.form.category} onChange={(e) => setField('category', e.target.value)} required>
                  <option value="">Select…</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Amount</label>
                <input type="number" step="0.01" min="0.01" className="input" value={modal.form.amount} onChange={(e) => setField('amount', e.target.value)} required />
              </div>
              <div>
                <label className="label">Date</label>
                <input type="date" className="input" value={modal.form.date} onChange={(e) => setField('date', e.target.value)} required />
              </div>
              <div>
                <label className="label">Method</label>
                <select className="input" value={modal.form.method} onChange={(e) => setField('method', e.target.value)} required>
                  <option value="">Select…</option>
                  {methods.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Account</label>
                <select className="input" value={modal.form.account} onChange={(e) => setField('account', e.target.value)} required>
                  <option value="">Select…</option>
                  {accounts.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Expense By</label>
                <input className="input" value={modal.form.expenseBy} onChange={(e) => setField('expenseBy', e.target.value)} />
              </div>
              <div>
                <label className="label">Paid To (person / vendor)</label>
                <input className="input" value={modal.form.paidTo} onChange={(e) => setField('paidTo', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <input className="input" value={modal.form.notes} onChange={(e) => setField('notes', e.target.value)} />
            </div>
          </form>
        )}
      </Modal>

      <AnalyticsModal open={analytics} onClose={() => setAnalytics(false)} title="Expense Analytics">
        <ExpenseAnalytics open={analytics} />
      </AnalyticsModal>
    </div>
  );
}
