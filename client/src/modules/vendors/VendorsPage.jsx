import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listVendors, createVendor, updateVendor, deleteVendor, getPayables } from './api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { errorMessage } from '../../lib/api';
import { PageHeader, Spinner, EmptyState, Pagination, Alert, Stat } from '../../components/ui';
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

export default function VendorsPage() {
  const { can, bootstrap } = useAuth();
  const money = (v) => formatMoney(v, bootstrap?.company?.currency || 'INR');
  const navigate = useNavigate();
  const [dues, setDues] = useState(null);
  useEffect(() => { getPayables().then(setDues).catch(() => setDues(null)); }, []);
  const dueOf = (id) => dues?.rows.find((r) => r.id === id);
  const toast = useToast();
  const confirm = useConfirm();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ items: [], meta: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setResult(await listVendors({ page, search: search || undefined }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => setModal({ editingId: null, form: { ...blank } });
  const openEdit = (v) => setModal({ editingId: v.id, form: { ...blank, ...v } });
  const setField = (k, val) => setModal((m) => ({ ...m, form: { ...m.form, [k]: val } }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { rating, ratingNote, ...rest } = modal.form;
      const body = { ...rest };
      if (modal.editingId) { body.rating = rating || null; body.ratingNote = ratingNote || null; }
      else { if (rating) body.rating = rating; if (ratingNote) body.ratingNote = ratingNote; }
      if (modal.editingId) await updateVendor(modal.editingId, body);
      else await createVendor(body);
      toast.success(`Vendor ${modal.editingId ? 'updated' : 'added'}`);
      setModal(null);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (v) => {
    const ok = await confirm({ title: 'Delete vendor?', message: `Remove ${v.name}.`, confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      await deleteVendor(v.id);
      toast.success('Vendor deleted');
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="Vendors"
        subtitle="Suppliers, bills, payments and outstanding dues"
        actions={can('vendors.create') && <button className="btn-primary" onClick={openNew}><Icon name="add" className="h-4 w-4" /> Add vendor</button>}
      />

      {dues && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Payable to vendors" value={money(dues.totals.outstanding)} tone={dues.totals.outstanding > 0 ? 'warning' : 'neutral'} hint={`${dues.totals.vendorsWithDues} vendor(s) with dues`} />
          <Stat label="Overdue" value={money(dues.totals.overdue)} tone={dues.totals.overdue > 0 ? 'danger' : 'neutral'} hint="Past bill due date" />
          <Stat label="Advances paid" value={money(dues.totals.advance)} tone="info" hint="Not yet adjusted against bills" />
          <Stat label="Vendors" value={dues.rows.length} />
        </div>
      )}

      <div className="relative mb-3">
        <Icon name="search" className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input className="input pl-9" placeholder="Search vendors…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-10"><Spinner /></div>
        ) : result.items.length === 0 ? (
          <div className="p-6"><EmptyState title="No vendors yet" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Contact</th>
                  <th>Rating</th>
                  <th className="text-right">Outstanding</th>
                  <th className="text-right">Overdue</th>
                  <th>Next due</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {result.items.map((v) => {
                  const d = dueOf(v.id);
                  return (
                    <tr key={v.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60" onClick={() => navigate(`/vendors/${v.id}`)}>
                      <td>
                        <p className="font-medium text-slate-800 dark:text-slate-100">{v.name}</p>
                        <p className="text-xs text-slate-400">{[v.category, v.gstNumber && `GST ${v.gstNumber}`, v.creditDays ? `${v.creditDays}-day credit` : null].filter(Boolean).join(' · ') || '—'}</p>
                      </td>
                      <td className="text-slate-600 dark:text-slate-300">{[v.contactPerson, v.phone].filter(Boolean).join(' · ') || '—'}</td>
                      <td title={v.ratingNote || ''}>{v.rating ? <StarRating value={v.rating} size="text-sm" /> : <span className="text-xs text-slate-400">—</span>}</td>
                      <td className={`text-right tabular-nums ${d?.outstanding > 0 ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-400'}`}>{d?.outstanding > 0 ? money(d.outstanding) : '—'}{d?.advance > 0 && <span className="block text-[11px] font-normal text-blue-600">Advance {money(d.advance)}</span>}</td>
                      <td className={`text-right tabular-nums ${d?.overdue > 0 ? 'font-semibold text-red-600' : 'text-slate-400'}`}>{d?.overdue > 0 ? money(d.overdue) : '—'}</td>
                      <td className="text-slate-500">{d?.nextDue ? formatDate(d.nextDue) : '—'}</td>
                      <td className="whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                        {can('vendors.update') && <button className="btn-ghost btn-sm" onClick={() => openEdit(v)} title="Edit"><Icon name="edit" className="h-4 w-4" /></button>}
                        {can('vendors.delete') && <button className="btn-ghost btn-sm text-red-600 hover:bg-red-50" onClick={() => remove(v)} title="Delete"><Icon name="trash" className="h-4 w-4" /></button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Pagination meta={result.meta} onPage={setPage} />

      <Modal
        open={Boolean(modal)}
        onClose={() => setModal(null)}
        title={modal?.editingId ? 'Edit Vendor' : 'Add Vendor'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-primary" form="vendor-form" disabled={saving}>{saving ? <Spinner className="h-4 w-4" /> : 'Save'}</button>
          </>
        }
      >
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
                <StarRating value={modal.form.rating || 0} onChange={(v) => setField('rating', v)} size="text-2xl" />
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
