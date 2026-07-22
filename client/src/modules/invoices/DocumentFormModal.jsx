import { useEffect, useState } from 'react';
import { getDocument, createDocument, updateDocument, nextNumber, listProjectsLite } from './api';
import { generateDocumentPdf } from './pdf';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { errorMessage } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import Modal from '../../components/Modal';
import { Spinner, Alert } from '../../components/ui';

const STATUS_OPTIONS = {
  QUOTATION: ['draft', 'sent', 'accepted', 'rejected'],
  INVOICE: ['unpaid', 'partial', 'paid'],
};

const emptyItem = () => ({ description: '', quantity: 1, unitPrice: '' });
const today = () => new Date().toISOString().slice(0, 10);

export default function DocumentFormModal({ open, onClose, type, docId, config, onSaved }) {
  const { bootstrap } = useAuth();
  const toast = useToast();
  const currency = bootstrap?.company?.currency || 'INR';
  const [form, setForm] = useState(null);
  const [projects, setProjects] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(null);
    listProjectsLite().then(setProjects);
    if (docId) {
      getDocument(docId)
        .then((d) =>
          setForm({
            number: d.number,
            projectId: d.projectId || '',
            clientName: d.clientName || '',
            clientPhone: d.clientPhone || '',
            clientEmail: d.clientEmail || '',
            clientAddress: d.clientAddress || '',
            issueDate: d.issueDate ? d.issueDate.slice(0, 10) : today(),
            dueDate: d.dueDate ? d.dueDate.slice(0, 10) : '',
            items: (d.items || []).map((it) => ({ description: it.description, quantity: it.quantity, unitPrice: it.unitPrice })),
            taxRate: d.taxRate ?? 0,
            status: d.status,
            notes: d.notes || '',
            terms: d.terms || '',
          }),
        )
        .catch((err) => setError(errorMessage(err)));
    } else {
      nextNumber(type)
        .then((r) =>
          setForm({
            number: r.number,
            projectId: '',
            clientName: '',
            clientPhone: '',
            clientEmail: '',
            clientAddress: '',
            issueDate: today(),
            dueDate: '',
            items: [emptyItem()],
            taxRate: 0,
            status: STATUS_OPTIONS[type][0],
            notes: config?.defaultNotes || '',
            terms: config?.terms || '',
          }),
        )
        .catch((err) => setError(errorMessage(err)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, docId, type]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setItem = (i, k, v) => setForm((f) => ({ ...f, items: f.items.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)) }));
  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }));
  const removeItem = (i) => setForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const pickProject = (id) => {
    const p = projects.find((x) => String(x.id) === String(id));
    setForm((f) => ({
      ...f,
      projectId: id,
      ...(p ? { clientName: p.clientName || f.clientName, clientPhone: p.clientPhone || f.clientPhone, clientEmail: p.clientEmail || f.clientEmail, clientAddress: p.clientAddress || f.clientAddress } : {}),
    }));
  };

  // Client-side totals (for the summary + PDF-only).
  const calc = () => {
    let subtotal = 0;
    const items = form.items.map((it) => {
      const total = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);
      subtotal += total;
      return { ...it, total: total.toFixed(2) };
    });
    const taxAmount = (subtotal * (Number(form.taxRate) || 0)) / 100;
    return { items, subtotal: subtotal.toFixed(2), taxAmount: taxAmount.toFixed(2), total: (subtotal + taxAmount).toFixed(2) };
  };

  const buildBody = () => ({
    type,
    number: form.number || undefined,
    projectId: form.projectId ? Number(form.projectId) : undefined,
    clientName: form.clientName,
    clientPhone: form.clientPhone || undefined,
    clientEmail: form.clientEmail || undefined,
    clientAddress: form.clientAddress || undefined,
    issueDate: form.issueDate,
    dueDate: form.dueDate || undefined,
    items: form.items
      .filter((it) => it.description.trim())
      .map((it) => ({ description: it.description, quantity: Number(it.quantity) || 0, unitPrice: Number(it.unitPrice) || 0 })),
    taxRate: Number(form.taxRate) || 0,
    status: form.status,
    notes: form.notes || undefined,
    terms: form.terms || undefined,
  });

  const validItems = () => form.items.some((it) => it.description.trim());

  const save = async () => {
    if (!validItems()) {
      setError('Add at least one item.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (docId) {
        await updateDocument(docId, buildBody());
        toast.success('Saved successfully');
      } else {
        await createDocument(buildBody());
        toast.success('Saved successfully');
      }
      onSaved?.();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // Generate PDF without saving anything to the backend.
  const generateOnly = () => {
    if (!validItems()) {
      setError('Add at least one item.');
      return;
    }
    const t = calc();
    generateDocumentPdf(
      { type, ...buildBody(), issueDate: form.issueDate, dueDate: form.dueDate, items: t.items, subtotal: t.subtotal, taxRate: Number(form.taxRate) || 0, taxAmount: t.taxAmount, total: t.total },
      config,
      currency,
    );
  };

  const label = type === 'INVOICE' ? 'Invoice' : 'Quotation';
  const totals = form ? calc() : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${docId ? 'Edit' : 'New'} ${label}`}
      wide
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-secondary" onClick={generateOnly} disabled={!form}>Generate PDF Only</button>
          <button className="btn-primary" onClick={save} disabled={saving || !form}>{saving ? <Spinner className="h-4 w-4" /> : 'Save'}</button>
        </>
      }
    >
      {error && <Alert>{error}</Alert>}
      {!form ? (
        <div className="flex justify-center p-6"><Spinner /></div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="label">{label} No.</label>
              <input className="input" value={form.number} onChange={(e) => set('number', e.target.value)} />
            </div>
            <div>
              <label className="label">Issue Date</label>
              <input type="date" className="input" value={form.issueDate} onChange={(e) => set('issueDate', e.target.value)} />
            </div>
            <div>
              <label className="label">{type === 'INVOICE' ? 'Due Date' : 'Valid Until'}</label>
              <input type="date" className="input" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
            </div>
          </div>

          {projects.length > 0 && (
            <div>
              <label className="label">Project (optional — prefills client)</label>
              <select className="input" value={form.projectId} onChange={(e) => pickProject(e.target.value)}>
                <option value="">None</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.referenceNumber} — {p.name}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className="label">Client Name</label><input className="input" value={form.clientName} onChange={(e) => set('clientName', e.target.value)} /></div>
            <div><label className="label">Phone</label><input className="input" value={form.clientPhone} onChange={(e) => set('clientPhone', e.target.value)} /></div>
            <div><label className="label">Email</label><input className="input" value={form.clientEmail} onChange={(e) => set('clientEmail', e.target.value)} /></div>
            <div><label className="label">Address</label><input className="input" value={form.clientAddress} onChange={(e) => set('clientAddress', e.target.value)} /></div>
          </div>

          {/* Items */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="label mb-0">Items</label>
              <button type="button" className="btn-ghost text-brand-600" onClick={addItem}>+ Add Item</button>
            </div>
            <div className="space-y-2">
              {form.items.map((it, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <input className="input flex-1 min-w-[180px]" placeholder="Description" value={it.description} onChange={(e) => setItem(i, 'description', e.target.value)} />
                  <input type="number" min="0" className="input w-20" placeholder="Qty" value={it.quantity} onChange={(e) => setItem(i, 'quantity', e.target.value)} />
                  <input type="number" min="0" step="0.01" className="input w-28" placeholder="Unit price" value={it.unitPrice} onChange={(e) => setItem(i, 'unitPrice', e.target.value)} />
                  <span className="w-28 text-right text-sm text-slate-600 dark:text-slate-300">
                    {formatMoney((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), currency)}
                  </span>
                  <button type="button" className="btn-ghost text-red-500" onClick={() => removeItem(i)}>&times;</button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="label">Tax Rate (%)</label>
              <input type="number" min="0" max="100" step="0.01" className="input" value={form.taxRate} onChange={(e) => set('taxRate', e.target.value)} />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>
                {STATUS_OPTIONS[type].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex items-end justify-end">
              <div className="text-right">
                <p className="text-xs text-slate-500">Grand Total</p>
                <p className="text-xl font-semibold text-brand-600">{formatMoney(totals.total, currency)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
            <div><label className="label">Terms &amp; Conditions</label><textarea className="input" rows={2} value={form.terms} onChange={(e) => set('terms', e.target.value)} /></div>
          </div>
        </div>
      )}
    </Modal>
  );
}
