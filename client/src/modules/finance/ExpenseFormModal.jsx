import { useEffect, useState } from 'react';
import { createExpense, updateExpense, projectOptions } from './api';
import { vendorOptions } from '../vendors/api';
import { workforceOptions } from '../workforce/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { errorMessage } from '../../lib/api';
import { formatMoney, toAmount } from '../../lib/format';
import Modal from '../../components/Modal';
import { Spinner } from '../../components/ui';

// Searchable project selector — shows the latest 10 projects by default and
// filters across name / client / reference as the user types, so long project
// lists stay easy to use without heavy scrolling.
function ProjectPicker({ projects, value, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const selected = projects.find((p) => String(p.id) === String(value));

  const label = (p) => `${p.name}${p.clientName ? ` · ${p.clientName}` : ''}`;
  const q = query.trim().toLowerCase();
  const list = (q
    ? projects.filter((p) => `${p.name} ${p.clientName || ''} ${p.referenceNumber || ''}`.toLowerCase().includes(q))
    : [...projects].sort((a, b) => b.id - a.id).slice(0, 10));

  if (selected && !open) {
    return (
      <button type="button" className="input flex w-full items-center justify-between text-left" onClick={() => setOpen(true)}>
        <span className="truncate">
          <span className="font-medium">{selected.name}</span>
          {selected.clientName && <span className="text-slate-500"> · {selected.clientName}</span>}
        </span>
        <span className="ml-2 shrink-0 text-xs font-medium text-brand-600">Change</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <input
        className="input"
        autoFocus
        placeholder="Search project or client…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
      />
      {open && (
        <div className="scroll-thin absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-cream-300 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {list.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-400">No matching projects</p>
          ) : (
            list.map((p) => (
              <button
                key={p.id}
                type="button"
                className="block w-full border-b border-cream-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-cream-100 dark:border-slate-700 dark:hover:bg-slate-700"
                onClick={() => { onChange(String(p.id)); setOpen(false); setQuery(''); }}
              >
                <span className="font-medium text-slate-800 dark:text-slate-100">{label(p)}</span>
                <span className="block text-xs text-slate-400">{p.referenceNumber}</span>
              </button>
            ))
          )}
          {!q && <p className="px-3 py-1.5 text-[11px] text-slate-400">Showing latest 10 — type to search all</p>}
        </div>
      )}
    </div>
  );
}

const PAY_OPTIONS = [
  { v: 'PAID', l: 'Paid' },
  { v: 'PARTIAL', l: 'Partial Payment' },
  { v: 'CREDIT', l: 'Credit / Unpaid' },
];

const blank = (scope, presetProjectId = '') => ({
  scope,
  projectId: presetProjectId ? String(presetProjectId) : '',
  vendorId: '',
  category: '',
  amount: '',
  date: new Date().toISOString().slice(0, 10),
  notes: '',
  account: '',
  paymentStatus: 'PAID',
  amountPaid: '',
  expenseBy: '', // Company: "Paid By"
  paidTo: '', // Company: "Paid To" / manual project payee
  workforceId: '',
});

export default function ExpenseFormModal({ open, onClose, scope, editing, onSaved, presetProjectId }) {
  const { bootstrap } = useAuth();
  const toast = useToast();
  const currency = bootstrap?.company?.currency || 'INR';
  const finance = bootstrap?.settings?.finance || {};
  const accounts = finance.accounts || [];
  // Scope-specific categories, with the legacy list as fallback.
  const categories =
    (scope === 'PROJECT' ? finance.project_expense_categories : finance.company_expense_categories) ||
    finance.expense_categories || [];

  const workforceEnabled = (bootstrap?.modules || []).some((m) => m.key === 'workforce');

  const [form, setForm] = useState(null);
  const [projects, setProjects] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [workforce, setWorkforce] = useState([]);
  const [payeeMode, setPayeeMode] = useState('vendor'); // vendor | workforce | manual
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (scope === 'PROJECT') projectOptions().then(setProjects);
    vendorOptions().then(setVendors);
    if (workforceEnabled) workforceOptions().then(setWorkforce);
    if (editing) {
      setPayeeMode(editing.vendorId ? 'vendor' : editing.workforceId ? 'workforce' : editing.paidTo ? 'manual' : 'vendor');
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
        workforceId: editing.workforceId || '',
      });
    } else {
      setPayeeMode('vendor');
      setForm(blank(scope, presetProjectId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scope, editing, presetProjectId]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const remaining = form ? (Number(form.amount) || 0) - (Number(form.amountPaid) || 0) : 0;

  const save = async () => {
    if (form.scope === 'PROJECT' && !form.projectId) {
      setError('Please select a project');
      return;
    }
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
        // Payee: exactly one of vendor / workforce / manual name. On edit we send
        // explicit nulls for the unused options so switching payee clears the rest.
        const clearing = editing ? null : undefined;
        if (payeeMode === 'vendor') {
          body.vendorId = form.vendorId ? Number(form.vendorId) : clearing;
          body.workforceId = clearing;
          body.paidTo = clearing;
        } else if (payeeMode === 'workforce') {
          body.workforceId = form.workforceId ? Number(form.workforceId) : clearing;
          body.vendorId = clearing;
          body.paidTo = clearing;
        } else {
          body.paidTo = form.paidTo || clearing;
          body.vendorId = clearing;
          body.workforceId = clearing;
        }
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
              <ProjectPicker projects={projects} value={form.projectId} onChange={(id) => set('projectId', id)} />
            </div>
          )}
          {isProject ? (
            <div className="sm:col-span-2">
              <label className="label">Expense Payee <span className="text-xs font-normal text-slate-400">(optional)</span></label>
              <div className="mb-2 flex flex-wrap gap-2">
                <button type="button" className={`rounded-lg border px-3 py-1.5 text-sm ${payeeMode === 'vendor' ? 'border-brand-400 bg-brand-50 text-brand-700 dark:bg-slate-700' : 'border-cream-300 text-slate-600 dark:border-slate-600'}`} onClick={() => setPayeeMode('vendor')}>
                  Select Vendor
                </button>
                {workforceEnabled && (
                  <button type="button" className={`rounded-lg border px-3 py-1.5 text-sm ${payeeMode === 'workforce' ? 'border-brand-400 bg-brand-50 text-brand-700 dark:bg-slate-700' : 'border-cream-300 text-slate-600 dark:border-slate-600'}`} onClick={() => setPayeeMode('workforce')}>
                    Workforce
                  </button>
                )}
                <button type="button" className={`rounded-lg border px-3 py-1.5 text-sm ${payeeMode === 'manual' ? 'border-brand-400 bg-brand-50 text-brand-700 dark:bg-slate-700' : 'border-cream-300 text-slate-600 dark:border-slate-600'}`} onClick={() => setPayeeMode('manual')}>
                  Enter Manually
                </button>
              </div>
              {payeeMode === 'vendor' && (
                <select className="input" value={form.vendorId} onChange={(e) => set('vendorId', e.target.value)}>
                  <option value="">Select vendor…</option>
                  {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              )}
              {payeeMode === 'workforce' && (
                <select className="input" value={form.workforceId} onChange={(e) => set('workforceId', e.target.value)}>
                  <option value="">Select workforce member…</option>
                  {workforce.map((w) => <option key={w.id} value={w.id}>{w.name} — {w.category}</option>)}
                </select>
              )}
              {payeeMode === 'manual' && (
                <input className="input" placeholder="e.g., Local hardware shop" value={form.paidTo} onChange={(e) => set('paidTo', e.target.value)} />
              )}
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
