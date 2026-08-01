import { useEffect, useState } from 'react';
import { createExpense, updateExpense, projectOptions } from './api';
import { vendorOptions } from '../vendors/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { errorMessage } from '../../lib/api';
import { formatMoney, toAmount } from '../../lib/format';
import Modal from '../../components/Modal';
import { Spinner } from '../../components/ui';

const PAY_OPTIONS = [
  { v: 'PAID', l: 'Paid' },
  { v: 'PARTIAL', l: 'Partial Payment' },
  { v: 'CREDIT', l: 'Credit / Unpaid' },
];

const blank = (scope) => ({
  scope,
  projectId: '',
  vendorId: '',
  category: '',
  amount: '',
  date: new Date().toISOString().slice(0, 10),
  notes: '',
  account: '',
  paymentStatus: 'PAID',
  amountPaid: '',
  expenseBy: '', // Company: "Paid By"
  paidTo: '', // Company: "Paid To"
});

export default function ExpenseFormModal({ open, onClose, scope, editing, onSaved }) {
  const { bootstrap } = useAuth();
  const toast = useToast();
  const currency = bootstrap?.company?.currency || 'INR';
  const finance = bootstrap?.settings?.finance || {};
  const accounts = finance.accounts || [];
  // Scope-specific categories, with the legacy list as fallback.
  const categories =
    (scope === 'PROJECT' ? finance.project_expense_categories : finance.company_expense_categories) ||
    finance.expense_categories || [];

  const [form, setForm] = useState(null);
  const [projects, setProjects] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (scope === 'PROJECT') projectOptions().then(setProjects);
    vendorOptions().then(setVendors);
    if (editing) {
      setForm({
        scope: editing.scope,
        projectId: editing.projectId || '',
        vendorId: editing.vendorId || '',
        category: editing.category,
        amount: editing.amount,
        date: editing.date?.slice(0, 10) || '',
        notes: editing.notes || '',
        account: editing.account || '',
        paymentStatus: editing.paymentStatus || 'PAID',
        amountPaid: editing.amountPaid ?? '',
        expenseBy: editing.expenseBy || '',
        paidTo: editing.paidTo || '',
      });
    } else {
      setForm(blank(scope));
    }
  }, [open, scope, editing]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const remaining = form ? (Number(form.amount) || 0) - (Number(form.amountPaid) || 0) : 0;

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const body = {
        scope: form.scope,
        category: form.category,
        amount: toAmount(form.amount),
        date: form.date,
        notes: form.notes || undefined,
        account: form.account || undefined,
        paymentStatus: form.paymentStatus,
        amountPaid: form.paymentStatus === 'PARTIAL' ? toAmount(form.amountPaid) : undefined,
      };
      if (form.scope === 'PROJECT') {
        body.projectId = Number(form.projectId);
        body.vendorId = form.vendorId ? Number(form.vendorId) : undefined;
      } else {
        // Company expenses: no vendor; capture who paid and who was paid.
        body.expenseBy = form.expenseBy || undefined;
        body.paidTo = form.paidTo || undefined;
      }
      if (editing) await updateExpense(editing.id, body);
      else await createExpense(body);
      toast.success(`Expense ${editing ? 'updated' : 'added'}`);
      onSaved?.();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const isProject = scope === 'PROJECT';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${editing ? 'Edit' : 'Add'} ${isProject ? 'Project' : 'Company'} Expense`}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving || !form}>{saving ? <Spinner className="h-4 w-4" /> : 'Save'}</button>
        </>
      }
    >
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      {!form ? (
        <div className="flex justify-center p-6"><Spinner /></div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {isProject && (
            <div className="sm:col-span-2">
              <label className="label">Project <span className="text-red-500">*</span></label>
              <select className="input" value={form.projectId} onChange={(e) => set('projectId', e.target.value)} required>
                <option value="">Select project…</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.referenceNumber} — {p.name}</option>)}
              </select>
            </div>
          )}
          {isProject ? (
            <div>
              <label className="label">Vendor <span className="text-xs font-normal text-slate-400">(optional)</span></label>
              <select className="input" value={form.vendorId} onChange={(e) => set('vendorId', e.target.value)}>
                <option value="">e.g., Select Vendor (Optional)</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          ) : (
            <>
              <div>
                <label className="label">Paid By</label>
                <input className="input" placeholder="e.g., Mintu, Admin, Company Card" value={form.expenseBy} onChange={(e) => set('expenseBy', e.target.value)} />
              </div>
              <div>
                <label className="label">Paid To</label>
                <input className="input" placeholder="e.g., Office Owner, Electricity Board" value={form.paidTo} onChange={(e) => set('paidTo', e.target.value)} />
              </div>
            </>
          )}
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)} required>
              <option value="">e.g., Select Category</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Amount</label>
            <input type="number" min="0.01" step="0.01" className="input" placeholder="e.g., 10000" value={form.amount} onChange={(e) => set('amount', e.target.value)} required />
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={form.date} onChange={(e) => set('date', e.target.value)} required />
          </div>
          <div>
            <label className="label">Payment Status</label>
            <select className="input" value={form.paymentStatus} onChange={(e) => set('paymentStatus', e.target.value)}>
              {PAY_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Account (optional)</label>
            <select className="input" value={form.account} onChange={(e) => set('account', e.target.value)}>
              <option value="">Default</option>
              {accounts.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}
            </select>
          </div>

          {form.paymentStatus === 'PARTIAL' && (
            <>
              <div>
                <label className="label">Amount Paid</label>
                <input type="number" min="0" step="0.01" className="input" placeholder="e.g., 5000" value={form.amountPaid} onChange={(e) => set('amountPaid', e.target.value)} />
              </div>
              <div>
                <label className="label">Remaining Balance</label>
                <div className="input bg-cream-100 dark:bg-slate-700">{formatMoney(remaining > 0 ? remaining : 0, currency)}</div>
              </div>
            </>
          )}

          <div className="sm:col-span-2">
            <label className="label">Description</label>
            <textarea className="input" rows={2} placeholder="e.g., Transport charges for cement delivery" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
        </div>
      )}
    </Modal>
  );
}
