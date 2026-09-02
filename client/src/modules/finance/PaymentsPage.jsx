import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listPayments, createPayment, updatePayment, deletePayment, projectOptions, getProjectsFinance } from './api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { errorMessage } from '../../lib/api';
import { formatMoney, formatDate, toAmount } from '../../lib/format';
import { PageHeader, Card, Spinner, EmptyState, Pagination, Alert } from '../../components/ui';
import Modal from '../../components/Modal';
import SearchSelect from '../../components/SearchSelect';

const blank = { projectId: '', amount: '', date: '', method: '', account: '', notes: '' };

export default function PaymentsPage({ search = '' }) {
  const { bootstrap, can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const currency = bootstrap?.company?.currency || 'INR';
  const finance = bootstrap?.settings?.finance || {};
  const methods = finance.payment_methods || [];
  const accounts = finance.accounts || [];

  const [projects, setProjects] = useState([]);
  const [result, setResult] = useState({ items: [], meta: null });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // { form, editingId }
  const [saving, setSaving] = useState(false);
  const [financeMap, setFinanceMap] = useState({});
  const [q, setQ] = useState('');

  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]));

  // Debounce the search coming from the Finance header so we don't fire a
  // request on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => { setQ(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get('projectId') || '';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, search: q || undefined };
      if (projectId) params.projectId = Number(projectId);
      setResult(await listPayments(params));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, q, projectId]);

  useEffect(() => {
    projectOptions().then(setProjects).catch(() => {});
    getProjectsFinance().then((list) => setFinanceMap(Object.fromEntries(list.map((p) => [p.id, p])))).catch(() => {});
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => setModal({ form: { ...blank }, editingId: null });
  const openEdit = (p) =>
    setModal({
      editingId: p.id,
      form: {
        projectId: p.projectId,
        amount: p.amount,
        date: p.date?.slice(0, 10) || '',
        method: p.method,
        account: p.account,
        notes: p.notes || '',
      },
    });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const f = modal.form;
      const body = {
        amount: toAmount(f.amount),
        date: f.date,
        method: f.method,
        account: f.account,
        notes: f.notes || undefined,
      };
      if (modal.editingId) {
        await updatePayment(modal.editingId, body);
        toast.success('Payment updated successfully');
      } else {
        await createPayment({ ...body, projectId: Number(f.projectId) });
        toast.success('Payment recorded successfully');
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
    const okToDelete = await confirm({ title: 'Delete payment?', message: 'This payment record will be removed.', confirmLabel: 'Delete' });
    if (!okToDelete) return;
    try {
      await deletePayment(id);
      toast.success('Payment deleted');
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const setField = (k, v) => setModal((m) => ({ ...m, form: { ...m.form, [k]: v } }));

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Money received against projects"
        actions={can('finance.create') && <button className="btn-primary" onClick={openNew}>+ Record Payment</button>}
      />
      {error && <Alert>{error}</Alert>}

      {projectId && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:border-slate-600 dark:bg-slate-800 dark:text-brand-300">
          <span>Showing payments for <b>{projectMap[projectId]?.name || `project #${projectId}`}</b></span>
          <button className="ml-auto text-xs font-medium hover:underline" onClick={() => { setSearchParams({}); setPage(1); }}>Clear filter</button>
        </div>
      )}

      <Card className="!p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-10"><Spinner /></div>
        ) : result.items.length === 0 ? (
          <div className="p-6"><EmptyState title="No payments yet" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream-100 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Project</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Method</th>
                  <th className="px-4 py-3 font-medium">Account</th>
                  <th className="px-4 py-3 font-medium">Notes</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {result.items.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800 dark:text-slate-100">{projectMap[p.projectId]?.name || `#${p.projectId}`}</div>
                      {projectMap[p.projectId]?.clientName && (
                        <div className="text-xs text-slate-500">{projectMap[p.projectId].clientName}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-green-700">{formatMoney(p.amount, currency)}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(p.date)}</td>
                    <td className="px-4 py-3 text-slate-600">{p.method}</td>
                    <td className="px-4 py-3 text-slate-600">{p.account}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {p.notes ? (
                        <span className="block max-w-[220px] truncate" title={p.notes}>{p.notes}</span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {can('finance.update') && (
                        <button className="pill-edit" onClick={() => openEdit(p)}>Edit</button>
                      )}
                      {can('finance.delete') && (
                        <button className="pill-delete ml-2" onClick={() => remove(p.id)}>Delete</button>
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
        title={modal?.editingId ? 'Edit Payment' : 'Record Payment'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-primary" form="payment-form" disabled={saving}>
              {saving ? <Spinner className="h-4 w-4" /> : 'Save'}
            </button>
          </>
        }
      >
        {modal && (
          <form id="payment-form" onSubmit={save} className="space-y-4">
            {!modal.editingId && (
              <div>
                <label className="label">Project / Client</label>
                <SearchSelect
                  options={projects}
                  value={modal.form.projectId}
                  onChange={(id) => setField('projectId', id)}
                  getKey={(p) => p.id}
                  getLabel={(p) => `${p.name}${p.clientName ? ` · ${p.clientName}` : ''}`}
                  getSub={(p) => `${p.referenceNumber || ''}${p.clientPhone ? ` · ${p.clientPhone}` : ''}`}
                  getSearch={(p) => `${p.name} ${p.clientName || ''} ${p.clientPhone || ''} ${p.referenceNumber || ''} ${p.id}`}
                  placeholder="Search project, client, phone or ref…"
                  recentHint="Showing latest projects — type to search"
                />
                {modal.form.projectId && financeMap[modal.form.projectId] && (
                  <div className="mt-2 grid grid-cols-3 gap-2 rounded-lg bg-cream-100 p-2 text-center text-xs dark:bg-slate-700">
                    <div>
                      <p className="text-slate-500">Total Value</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{formatMoney(financeMap[modal.form.projectId].totalAmount, currency)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Received</p>
                      <p className="font-semibold text-green-600">{formatMoney(financeMap[modal.form.projectId].receivedAmount, currency)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Balance</p>
                      <p className="font-semibold text-red-600">{formatMoney(financeMap[modal.form.projectId].balanceAmount, currency)}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Amount</label>
                <input type="number" step="0.01" min="0.01" className="input" placeholder="e.g., 50000" value={modal.form.amount} onChange={(e) => setField('amount', e.target.value)} required />
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
            </div>
            <div>
              <label className="label">Notes</label>
              <input className="input" placeholder="e.g., Phase 1 advance payment" value={modal.form.notes} onChange={(e) => setField('notes', e.target.value)} />
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
