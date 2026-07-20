import { useEffect, useState, useCallback } from 'react';
import { listPayments, createPayment, updatePayment, deletePayment, projectOptions } from './api';
import { useAuth } from '../../context/AuthContext';
import { errorMessage } from '../../lib/api';
import { formatMoney, formatDate } from '../../lib/format';
import { PageHeader, Card, Spinner, EmptyState, Pagination, Alert } from '../../components/ui';
import Modal from '../../components/Modal';

const blank = { projectId: '', amount: '', date: '', method: '', account: '', notes: '' };

export default function PaymentsPage() {
  const { bootstrap, can } = useAuth();
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

  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setResult(await listPayments({ page }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    projectOptions().then(setProjects).catch(() => {});
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
        amount: Number(f.amount),
        date: f.date,
        method: f.method,
        account: f.account,
        notes: f.notes || undefined,
      };
      if (modal.editingId) {
        await updatePayment(modal.editingId, body);
      } else {
        await createPayment({ ...body, projectId: Number(f.projectId) });
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
    await deletePayment(id);
    load();
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
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {result.items.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 text-slate-700">
                      {projectMap[p.projectId]?.name || `#${p.projectId}`}
                    </td>
                    <td className="px-4 py-3 font-medium text-green-700">{formatMoney(p.amount, currency)}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(p.date)}</td>
                    <td className="px-4 py-3 text-slate-600">{p.method}</td>
                    <td className="px-4 py-3 text-slate-600">{p.account}</td>
                    <td className="px-4 py-3 text-right">
                      {can('finance.update') && (
                        <button className="text-xs text-brand-600 hover:underline" onClick={() => openEdit(p)}>
                          Edit
                        </button>
                      )}
                      {can('finance.delete') && (
                        <button className="ml-3 text-xs text-red-500 hover:underline" onClick={() => remove(p.id)}>
                          Delete
                        </button>
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
                <label className="label">Project</label>
                <select className="input" value={modal.form.projectId} onChange={(e) => setField('projectId', e.target.value)} required>
                  <option value="">Select project…</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.referenceNumber} — {p.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
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
            </div>
            <div>
              <label className="label">Notes</label>
              <input className="input" value={modal.form.notes} onChange={(e) => setField('notes', e.target.value)} />
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
