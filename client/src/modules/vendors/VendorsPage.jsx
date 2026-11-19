import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { listVendors, createVendor, updateVendor, deleteVendor, getPayables, getStatement } from './api';
import { PayModal, BillModal } from './VendorLedgerPage';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { errorMessage } from '../../lib/api';
import { PageHeader, Spinner, EmptyState, Alert } from '../../components/ui';
import Icon from '../../components/Icon';
import { formatMoney, formatDate } from '../../lib/format';
import Modal from '../../components/Modal';
import StarRating from '../../components/StarRating';

const blank = { name: '', category: '', contactPerson: '', phone: '', email: '', gstNumber: '', address: '', creditDays: 0, notes: '', rating: null, ratingNote: '' };
const FIELDS = [
  ['name', 'Vendor Name', true, 'e.g., ABC Building Materials'],
  ['category', 'Supplies', false, 'e.g., Cement & steel, Hardware, Transport'],
  ['contactPerson', 'Contact Person', false, 'e.g., Ramesh Kumar'],
  ['phone', 'Phone', false, 'e.g., +91 98765 43210'],
  ['email', 'Email', false, 'e.g., sales@abcmaterials.com'],
  ['gstNumber', 'GST Number', false, 'e.g., 22AAAAA0000A1Z5'],
  ['address', 'Address', false, 'e.g., 45 Industrial Area, Patna'],
];
const BILL_BADGE = {
  paid: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  partial: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  unpaid: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  overdue: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

// Right-hand panel: what we owe this vendor, unpaid bills, payment history, contact.
function VendorPanel({ vendorId, onEdit, onDelete, onChanged }) {
  const { bootstrap, can } = useAuth();
  const money = (v) => formatMoney(v, bootstrap?.company?.currency || 'INR');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const load = useCallback(() => { setError(''); getStatement(vendorId).then(setData).catch((e) => setError(errorMessage(e))); }, [vendorId]);
  useEffect(() => { setData(null); load(); }, [load]);

  if (error) return <div className="card p-4"><Alert>{error}</Alert></div>;
  if (!data) return <div className="card flex justify-center p-10"><Spinner /></div>;
  const v = data.vendor;
  const t = data.totals;
  const canPay = can('vendors.pay');
  const unpaid = data.bills.filter((b) => b.balance > 0).sort((a, b) => String(a.dueDate || '9').localeCompare(String(b.dueDate || '9')));
  const done = () => { setModal(null); load(); onChanged?.(); };

  return (
    <div className="card overflow-hidden">
      {/* Who */}
      <div className="flex items-start justify-between gap-3 border-b border-cream-200 p-4 dark:border-slate-700">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{v.name}</h2>
            {v.rating ? <span title={v.ratingNote || ''}><StarRating value={v.rating} size="text-sm" /></span> : null}
          </div>
          <p className="text-sm text-slate-500">{v.category || 'Supplier'} · {v.creditDays ? `${v.creditDays}-day credit` : 'Pay on delivery'}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          {can('vendors.update') && <button className="btn-ghost btn-sm" onClick={() => onEdit(v)} title="Edit vendor" aria-label="Edit vendor"><Icon name="edit" className="h-4 w-4" /></button>}
          {can('vendors.delete') && <button className="btn-ghost btn-sm text-red-600 hover:bg-red-50" onClick={() => onDelete(v)} title="Delete vendor" aria-label="Delete vendor"><Icon name="trash" className="h-4 w-4" /></button>}
        </div>
      </div>

      {/* Money in one line */}
      <div className="grid grid-cols-3 divide-x divide-cream-200 border-b border-cream-200 dark:divide-slate-700 dark:border-slate-700">
        <div className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">You owe</p>
          <p className={`text-xl font-semibold tabular-nums ${t.outstanding > 0 ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>{money(t.outstanding)}</p>
          {t.overdue > 0 && <p className="text-xs font-medium text-red-600">{money(t.overdue)} overdue</p>}
        </div>
        <div className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Paid so far</p>
          <p className="text-xl font-semibold tabular-nums text-emerald-700">{money(t.paid)}</p>
          <p className="text-xs text-slate-400">of {money(t.billed)} billed</p>
        </div>
        <div className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Advance</p>
          <p className={`text-xl font-semibold tabular-nums ${t.advance > 0 ? 'text-blue-700' : 'text-slate-400'}`}>{money(t.advance)}</p>
          <p className="text-xs text-slate-400">paid ahead of bills</p>
        </div>
      </div>

      {canPay && (
        <div className="flex flex-wrap gap-2 border-b border-cream-200 p-4 dark:border-slate-700">
          <button className="btn-primary" onClick={() => setModal('pay')}>Pay vendor</button>
          <button className="btn-secondary" onClick={() => setModal('bill')}><Icon name="add" className="h-4 w-4" /> Add bill</button>
          <Link className="btn-ghost ml-auto text-brand-700" to={`/vendors/${v.id}`}>Full account →</Link>
        </div>
      )}

      <div className="grid gap-0 md:grid-cols-2 md:divide-x md:divide-cream-200 dark:md:divide-slate-700">
        {/* Unpaid bills */}
        <div className="p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Unpaid bills ({unpaid.length})</p>
          {!unpaid.length ? <p className="text-sm text-slate-400">Nothing pending.</p> : (
            <ul className="space-y-2">
              {unpaid.slice(0, 6).map((b) => (
                <li key={b.id} className="flex items-start justify-between gap-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-800 dark:text-slate-100">{b.billNumber || `Bill #${b.id}`}</span>
                    <span className="block truncate text-xs text-slate-400">{b.projectName || 'Company'} · {b.dueDate ? `due ${formatDate(b.dueDate)}` : formatDate(b.date)}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-semibold tabular-nums">{money(b.balance)}</span>
                    <span className={`badge capitalize ${BILL_BADGE[b.status]}`}>{b.status}</span>
                  </span>
                </li>
              ))}
              {unpaid.length > 6 && <li><Link className="text-xs font-medium text-brand-700 hover:underline" to={`/vendors/${v.id}`}>+{unpaid.length - 6} more</Link></li>}
            </ul>
          )}
        </div>
        {/* Payments */}
        <div className="border-t border-cream-200 p-4 md:border-t-0 dark:border-slate-700">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Payment history</p>
          {(() => {
            const viaPayments = data.payments.reduce((x, p) => x + Number(p.amount || 0) - Number(p.advance || 0), 0);
            const direct = Math.round((Number(t.paid) - viaPayments) * 100) / 100;
            return direct > 0.5 ? <p className="mb-2 text-xs text-slate-500">{money(direct)} was paid directly when bills were recorded.</p> : null;
          })()}
          {!data.payments.length ? <p className="text-sm text-slate-400">No separate payments yet.</p> : (
            <ul className="space-y-2">
              {data.payments.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-2 text-sm">
                  <span className="min-w-0">
                    <span className="block text-slate-700 dark:text-slate-200">{formatDate(p.date)}</span>
                    <span className="block truncate text-xs text-slate-400">{p.method}{p.reference ? ` · ${p.reference}` : ''}{p.allocations.length ? ` · ${p.allocations.map((a) => a.bill).join(', ')}` : p.advance > 0 ? ' · advance' : ''}</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-emerald-700">{money(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Contact */}
      <div className="grid gap-x-6 gap-y-1.5 border-t border-cream-200 p-4 text-sm sm:grid-cols-2 dark:border-slate-700">
        <p><span className="text-slate-500">Contact:</span> {v.contactPerson || '—'}</p>
        <p><span className="text-slate-500">Phone:</span> {v.phone ? <a className="text-brand-700 hover:underline" href={`tel:${v.phone}`}>{v.phone}</a> : '—'}</p>
        <p><span className="text-slate-500">Email:</span> {v.email ? <a className="text-brand-700 hover:underline" href={`mailto:${v.email}`}>{v.email}</a> : '—'}</p>
        <p><span className="text-slate-500">GSTIN:</span> {v.gstNumber || '—'}</p>
        <p className="sm:col-span-2"><span className="text-slate-500">Address:</span> {v.address || '—'}</p>
        {v.notes && <p className="sm:col-span-2 text-slate-600 dark:text-slate-300"><span className="text-slate-500">Notes:</span> {v.notes}</p>}
        {!canPay && <Link className="mt-1 text-sm font-medium text-brand-700 hover:underline" to={`/vendors/${v.id}`}>Open full account →</Link>}
      </div>

      {modal === 'pay' && <PayModal vendor={v} bills={data.bills} onClose={() => setModal(null)} onDone={done} />}
      {modal === 'bill' && <BillModal vendor={v} onClose={() => setModal(null)} onDone={done} />}
    </div>
  );
}

export default function VendorsPage() {
  const { can, bootstrap } = useAuth();
  const money = (v) => formatMoney(v, bootstrap?.company?.currency || 'INR');
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const confirm = useConfirm();
  const [dues, setDues] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const selected = Number(params.get('v')) || null;

  const loadDues = useCallback(() => getPayables().then(setDues).catch(() => setDues(null)), []);
  const load = useCallback(async () => {
    try {
      const r = await listVendors({ limit: 200, search: search || undefined });
      setItems(r.items);
    } catch (err) { setError(errorMessage(err)); setItems([]); }
  }, [search]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadDues(); }, [loadDues]);

  const dueOf = (id) => dues?.rows.find((r) => r.id === id);
  const pick = (v) => {
    // On small screens the panel would sit below a long list — open the account page instead.
    if (window.innerWidth < 1024) { navigate(`/vendors/${v.id}`); return; }
    setParams({ v: String(v.id) }, { replace: true });
  };

  const openNew = () => setModal({ editingId: null, form: { ...blank } });
  const openEdit = (v) => setModal({ editingId: v.id, form: { ...blank, ...v } });
  const setField = (k, val) => setModal((m) => ({ ...m, form: { ...m.form, [k]: val } }));
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { rating, ratingNote, ...rest } = modal.form;
      const body = { ...rest };
      if (modal.editingId) { body.rating = rating || null; body.ratingNote = ratingNote || null; } else { if (rating) body.rating = rating; if (ratingNote) body.ratingNote = ratingNote; }
      const row = modal.editingId ? await updateVendor(modal.editingId, body) : await createVendor(body);
      toast.success(`Vendor ${modal.editingId ? 'updated' : 'added'}`);
      setModal(null);
      await load();
      if (row?.id) setParams({ v: String(row.id) }, { replace: true });
    } catch (err) { toast.error(errorMessage(err)); } finally { setSaving(false); }
  };
  const remove = async (v) => {
    if (!(await confirm({ title: 'Delete vendor?', message: `Remove ${v.name}.`, confirmLabel: 'Delete' }))) return;
    try { await deleteVendor(v.id); toast.success('Vendor deleted'); setParams({}, { replace: true }); load(); loadDues(); } catch (err) { toast.error(errorMessage(err)); }
  };

  const shown = (items || []).filter((v) => {
    const d = dueOf(v.id);
    if (filter === 'due') return d?.outstanding > 0;
    if (filter === 'overdue') return d?.overdue > 0;
    return true;
  });
  const current = selected && (items || []).some((v) => v.id === selected) ? selected : shown[0]?.id;

  return (
    <div>
      <PageHeader
        title="Vendors"
        subtitle={dues ? `You owe ${money(dues.totals.outstanding)} to ${dues.totals.vendorsWithDues} vendor(s)${dues.totals.overdue > 0 ? ` · ${money(dues.totals.overdue)} overdue` : ''}` : 'Suppliers, bills and payments'}
        actions={can('vendors.create') && <button className="btn-primary" onClick={openNew}><Icon name="add" className="h-4 w-4" /> Add vendor</button>}
      />
      {error && <Alert>{error}</Alert>}

      <div className="grid gap-4 lg:grid-cols-5">
        {/* List */}
        <div className="lg:col-span-2">
          <div className="relative mb-2">
            <Icon name="search" className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input className="input pl-9" placeholder="Search vendors…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="mb-2 flex gap-1.5">
            {[['all', 'All'], ['due', 'To pay'], ['overdue', 'Overdue']].map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} className={`rounded-full px-3 py-1 text-xs font-medium ${filter === k ? 'bg-brand-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600'}`}>{l}</button>
            ))}
          </div>
          <div className="card overflow-hidden">
            {!items ? <div className="flex justify-center p-10"><Spinner /></div> : !shown.length ? (
              <div className="p-6"><EmptyState title={items.length ? 'No vendors match' : 'No vendors yet'} hint={!items.length && can('vendors.create') ? 'Add your suppliers, contractors and transporters.' : undefined} /></div>
            ) : (
              <ul className="scroll-thin max-h-[70vh] divide-y divide-cream-200 overflow-y-auto dark:divide-slate-700">
                {shown.map((v) => {
                  const d = dueOf(v.id);
                  const active = v.id === current;
                  return (
                    <li key={v.id}>
                      <button className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${active ? 'bg-brand-50 dark:bg-slate-700/70' : 'hover:bg-cream-50 dark:hover:bg-slate-800/60'}`} onClick={() => pick(v)}>
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">{v.name.slice(0, 1).toUpperCase()}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-slate-800 dark:text-slate-100">{v.name}</span>
                          <span className="block truncate text-xs text-slate-400">{[v.category, v.phone].filter(Boolean).join(' · ') || '—'}</span>
                        </span>
                        <span className="shrink-0 text-right">
                          {d?.outstanding > 0 ? (
                            <>
                              <span className="block text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{money(d.outstanding)}</span>
                              <span className={`block text-[11px] ${d.overdue > 0 ? 'font-medium text-red-600' : 'text-slate-400'}`}>{d.overdue > 0 ? 'overdue' : d.nextDue ? `due ${formatDate(d.nextDue)}` : 'to pay'}</span>
                            </>
                          ) : <span className="text-xs text-slate-400">No dues</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Selected vendor */}
        <div className="hidden lg:col-span-3 lg:block">
          {current ? <VendorPanel key={current} vendorId={current} onEdit={openEdit} onDelete={remove} onChanged={loadDues} /> : <div className="card p-8"><EmptyState title="Select a vendor" hint="Their dues, bills and payments appear here." /></div>}
        </div>
      </div>

      <Modal open={Boolean(modal)} onClose={() => setModal(null)} title={modal?.editingId ? 'Edit Vendor' : 'Add Vendor'}
        footer={<><button className="btn-secondary" onClick={() => setModal(null)}>Cancel</button><button className="btn-primary" form="vendor-form" disabled={saving}>{saving ? <Spinner className="h-4 w-4" /> : 'Save'}</button></>}>
        {modal && (
          <form id="vendor-form" onSubmit={save} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FIELDS.map(([key, label, required, placeholder]) => (
              <div key={key} className={key === 'address' ? 'sm:col-span-2' : ''}>
                <label className="label">{label}{required && <span className="text-red-500"> *</span>}</label>
                <input className="input" placeholder={placeholder} value={modal.form[key] || ''} onChange={(e) => setField(key, e.target.value)} required={required} />
              </div>
            ))}
            <div>
              <label className="label">Payment terms (credit days)</label>
              <input type="number" min="0" max="365" className="input" value={modal.form.creditDays ?? 0} onChange={(e) => setField('creditDays', e.target.value)} />
              <p className="mt-1 text-[11px] text-slate-400">Due date for new bills = bill date + these days.</p>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Vendor rating</label>
              <div className="flex flex-wrap items-center gap-3">
                <StarRating value={modal.form.rating || 0} onChange={(val) => setField('rating', val)} size="text-2xl" />
                <input className="input flex-1" placeholder="Quality, timeliness, pricing…" value={modal.form.ratingNote || ''} onChange={(e) => setField('ratingNote', e.target.value)} />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Notes</label>
              <textarea className="input" rows={2} placeholder="e.g., Preferred supplier for cement & steel" value={modal.form.notes || ''} onChange={(e) => setField('notes', e.target.value)} />
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
