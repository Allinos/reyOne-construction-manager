import { useState } from 'react';
import { createPayment } from './api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { errorMessage } from '../../lib/api';
import { toAmount } from '../../lib/format';
import Modal from '../../components/Modal';
import { Spinner } from '../../components/ui';

// Lightweight "record payment" form for a known project (used from the Project
// Finance page where the project/client is already selected).
export default function PaymentFormModal({ open, projectId, projectLabel, onClose, onSaved }) {
  const { bootstrap } = useAuth();
  const toast = useToast();
  const finance = bootstrap?.settings?.finance || {};
  const methods = finance.payment_methods || [];
  const accounts = finance.accounts || [];

  const [form, setForm] = useState({ amount: '', date: new Date().toISOString().slice(0, 10), method: '', account: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await createPayment({
        projectId: Number(projectId),
        amount: toAmount(form.amount),
        date: form.date,
        method: form.method,
        account: form.account,
        notes: form.notes || undefined,
      });
      toast.success('Payment recorded');
      onSaved?.();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record Payment"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" form="pf-form" disabled={saving}>{saving ? <Spinner className="h-4 w-4" /> : 'Save'}</button>
        </>
      }
    >
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      {projectLabel && (
        <div className="mb-3 rounded-lg bg-cream-100 px-3 py-2 text-sm dark:bg-slate-700">
          <span className="text-slate-500">Project: </span>
          <span className="font-medium text-slate-800 dark:text-slate-100">{projectLabel}</span>
        </div>
      )}
      <form id="pf-form" onSubmit={save} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Amount</label>
          <input type="number" step="0.01" min="0.01" className="input" placeholder="e.g., 50000" value={form.amount} onChange={(e) => set('amount', e.target.value)} required />
        </div>
        <div>
          <label className="label">Date</label>
          <input type="date" className="input" value={form.date} onChange={(e) => set('date', e.target.value)} required />
        </div>
        <div>
          <label className="label">Method</label>
          <select className="input" value={form.method} onChange={(e) => set('method', e.target.value)} required>
            <option value="">Select…</option>
            {methods.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Account</label>
          <select className="input" value={form.account} onChange={(e) => set('account', e.target.value)} required>
            <option value="">Select…</option>
            {accounts.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <input className="input" placeholder="e.g., Phase 1 advance payment" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>
      </form>
    </Modal>
  );
}
