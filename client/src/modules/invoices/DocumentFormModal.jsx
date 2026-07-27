import { useEffect, useState } from 'react';
import { getDocument, createDocument, updateDocument, nextNumber, listProjectsLite } from './api';
import { listClients } from '../clients/api';
import { generateDocumentPdf } from './pdf';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { errorMessage } from '../../lib/api';
import { formatMoney, toAmount } from '../../lib/format';
import Modal from '../../components/Modal';
import { Spinner, Alert } from '../../components/ui';

const STATUS_OPTIONS = {
  QUOTATION: ['draft', 'sent', 'accepted', 'rejected'],
  INVOICE: ['unpaid', 'partial', 'paid'],
};

const emptyItem = () => ({ description: '', hsnCode: '', quantity: 1, unitPrice: '', gstRate: 18 });
const today = () => new Date().toISOString().slice(0, 10);

export default function DocumentFormModal({ open, onClose, type, docId, config, onSaved }) {
  const { bootstrap } = useAuth();
  const toast = useToast();
  const currency = bootstrap?.company?.currency || 'INR';
  const gstRates = bootstrap?.settings?.invoices?.gst_rates || [0, 5, 12, 18, 28];

  const [form, setForm] = useState(null);
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(null);
    listProjectsLite().then(setProjects);
    listClients({ limit: 200 }).then((r) => setClients(r.items)).catch(() => setClients([]));

    if (docId) {
      getDocument(docId)
        .then((d) =>
          setForm({
            template: d.template || 'standard',
            number: d.number,
            projectId: d.projectId || '',
            clientName: d.clientName || '',
            clientPhone: d.clientPhone || '',
            clientEmail: d.clientEmail || '',
            clientAddress: d.clientAddress || '',
            issueDate: d.issueDate ? d.issueDate.slice(0, 10) : today(),
            dueDate: d.dueDate ? d.dueDate.slice(0, 10) : '',
            items: (d.items || []).map((it) => ({
              description: it.description, hsnCode: it.hsnCode || '', quantity: it.quantity, unitPrice: it.unitPrice, gstRate: it.gstRate ?? 18,
            })),
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
            template: 'standard',
            number: r.number,
            projectId: '',
            clientName: '', clientPhone: '', clientEmail: '', clientAddress: '',
            issueDate: today(), dueDate: '',
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

  const prefillClient = (patch) => setForm((f) => ({ ...f, ...patch }));
  const pickProject = (id) => {
    const p = projects.find((x) => String(x.id) === String(id));
    prefillClient({ projectId: id, ...(p ? { clientName: p.clientName || '', clientPhone: p.clientPhone || '', clientEmail: p.clientEmail || '', clientAddress: p.clientAddress || '' } : {}) });
  };
  const pickClient = (name) => {
    const c = clients.find((x) => x.name === name);
    if (c) prefillClient({ clientName: c.name || '', clientPhone: c.phone || '', clientEmail: c.email || '', clientAddress: c.address || '' });
  };

  const isGst = form?.template === 'gst';

  // Client-side totals (summary + PDF-only), matching the server formula.
  const calc = () => {
    if (isGst) {
      let subtotal = 0;
      let tax = 0;
      const items = form.items.map((it) => {
        const line = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);
        const t = (line * (Number(it.gstRate) || 0)) / 100;
        subtotal += line;
        tax += t;
        return { ...it, taxAmount: t.toFixed(2), total: (line + t).toFixed(2) };
      });
      return { items, subtotal: subtotal.toFixed(2), taxAmount: tax.toFixed(2), total: (subtotal + tax).toFixed(2) };
    }
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
    template: form.template,
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
      .map((it) => ({
        description: it.description,
        quantity: Number(it.quantity) || 0,
        unitPrice: toAmount(it.unitPrice),
        ...(isGst ? { hsnCode: it.hsnCode || undefined, gstRate: Number(it.gstRate) || 0 } : {}),
      })),
    taxRate: isGst ? 0 : Number(form.taxRate) || 0,
    status: form.status,
    notes: form.notes || undefined,
    terms: form.terms || undefined,
  });

  const validItems = () => form.items.some((it) => it.description.trim());

  const save = async () => {
    if (!validItems()) return setError('Add at least one item.');
    setSaving(true);
    setError('');
    try {
      if (docId) await updateDocument(docId, buildBody());
      else await createDocument(buildBody());
      toast.success('Saved successfully');
      onSaved?.();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const generateOnly = () => {
    if (!validItems()) return setError('Add at least one item.');
    const t = calc();
    generateDocumentPdf(
      { type, template: form.template, ...buildBody(), issueDate: form.issueDate, dueDate: form.dueDate, items: t.items, subtotal: t.subtotal, taxRate: isGst ? 0 : Number(form.taxRate) || 0, taxAmount: t.taxAmount, total: t.total },
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
          {/* Template selector */}
          <div>
            <label className="label">Template</label>
            <div className="flex overflow-hidden rounded-lg border border-cream-300 text-sm dark:border-slate-700">
              {[{ v: 'standard', l: 'Standard' }, { v: 'gst', l: 'GST (India)' }].map((t) => (
                <button key={t.v} type="button" className={`px-4 py-1.5 ${form.template === t.v ? 'bg-brand-500 text-white' : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`} onClick={() => set('template', t.v)}>
                  {t.l}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div><label className="label">{label} No.</label><input className="input" value={form.number} onChange={(e) => set('number', e.target.value)} /></div>
            <div><label className="label">Issue Date</label><input type="date" className="input" value={form.issueDate} onChange={(e) => set('issueDate', e.target.value)} /></div>
            <div><label className="label">{type === 'INVOICE' ? 'Due Date' : 'Valid Until'}</label><input type="date" className="input" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} /></div>
          </div>

          {/* Existing project / client autofill */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {projects.length > 0 && (
              <div>
                <label className="label">Existing Project (autofill)</label>
                <select className="input" value={form.projectId} onChange={(e) => pickProject(e.target.value)}>
                  <option value="">None</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.referenceNumber} — {p.name}</option>)}
                </select>
              </div>
            )}
            {clients.length > 0 && (
              <div>
                <label className="label">Existing Client (autofill)</label>
                <select className="input" value="" onChange={(e) => pickClient(e.target.value)}>
                  <option value="">Select…</option>
                  {clients.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className="label">Client Name</label><input className="input" placeholder="e.g., Mintu Sharma" value={form.clientName} onChange={(e) => set('clientName', e.target.value)} /></div>
            <div><label className="label">Phone</label><input className="input" placeholder="e.g., +91 98765 43210" value={form.clientPhone} onChange={(e) => set('clientPhone', e.target.value)} /></div>
            <div><label className="label">Email</label><input className="input" placeholder="e.g., client@example.com" value={form.clientEmail} onChange={(e) => set('clientEmail', e.target.value)} /></div>
            <div><label className="label">Address</label><input className="input" placeholder="e.g., 123 MG Road, Siwan" value={form.clientAddress} onChange={(e) => set('clientAddress', e.target.value)} /></div>
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
                  <input className="input flex-1 min-w-[160px]" placeholder="e.g., Cement (50kg bag)" value={it.description} onChange={(e) => setItem(i, 'description', e.target.value)} />
                  {isGst && <input className="input w-24" placeholder="e.g., 3214" value={it.hsnCode} onChange={(e) => setItem(i, 'hsnCode', e.target.value)} />}
                  <input type="number" min="0" className="input w-16" placeholder="e.g., 100" value={it.quantity} onChange={(e) => setItem(i, 'quantity', e.target.value)} />
                  <input type="number" min="0" step="0.01" className="input w-24" placeholder="e.g., 350" value={it.unitPrice} onChange={(e) => setItem(i, 'unitPrice', e.target.value)} />
                  {isGst && (
                    <select className="input w-20" value={it.gstRate} onChange={(e) => setItem(i, 'gstRate', e.target.value)}>
                      {gstRates.map((r) => <option key={r} value={r}>{r}%</option>)}
                    </select>
                  )}
                  <span className="w-24 text-right text-sm text-slate-600 dark:text-slate-300">
                    {formatMoney(isGst
                      ? (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0) * (1 + (Number(it.gstRate) || 0) / 100)
                      : (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), currency)}
                  </span>
                  <button type="button" className="btn-ghost text-red-500" onClick={() => removeItem(i)}>&times;</button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {!isGst && (
              <div>
                <label className="label">Tax Rate (%)</label>
                <input type="number" min="0" max="100" step="0.01" className="input" value={form.taxRate} onChange={(e) => set('taxRate', e.target.value)} />
              </div>
            )}
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>
                {STATUS_OPTIONS[type].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex items-end justify-end sm:col-span-1">
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
