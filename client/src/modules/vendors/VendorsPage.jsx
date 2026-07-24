import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listVendors, createVendor, updateVendor, deleteVendor } from './api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { errorMessage } from '../../lib/api';
import { PageHeader, Card, Spinner, EmptyState, Pagination, Alert } from '../../components/ui';
import Modal from '../../components/Modal';

const blank = { name: '', contactPerson: '', phone: '', email: '', gstNumber: '', address: '', notes: '' };
const FIELDS = [
  ['name', 'Vendor Name', true],
  ['contactPerson', 'Contact Person'],
  ['phone', 'Phone'],
  ['email', 'Email'],
  ['gstNumber', 'GST Number'],
  ['address', 'Address'],
];

export default function VendorsPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
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
      const body = { ...modal.form };
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
        subtitle="Suppliers & service providers"
        actions={can('vendors.create') && <button className="btn-primary" onClick={openNew}>+ Add Vendor</button>}
      />

      <Card className="mb-4">
        <input className="input" placeholder="Search vendors…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </Card>

      {error && <Alert>{error}</Alert>}

      <Card className="!p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-10"><Spinner /></div>
        ) : result.items.length === 0 ? (
          <div className="p-6"><EmptyState title="No vendors yet" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream-100 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Vendor</th>
                  <th className="px-4 py-3 font-medium">Contact Person</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">GST</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {result.items.map((v) => (
                  <tr key={v.id} className="cursor-pointer hover:bg-cream-100" onClick={() => navigate(`/vendors/${v.id}`)}>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{v.name}</td>
                    <td className="px-4 py-3 text-slate-600">{v.contactPerson || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{v.phone || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{v.gstNumber || '—'}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button className="pill bg-cream-200 text-slate-600 hover:bg-cream-300" onClick={() => navigate(`/vendors/${v.id}`)}>Ledger</button>
                      {can('vendors.update') && <button className="pill-edit ml-2" onClick={() => openEdit(v)}>Edit</button>}
                      {can('vendors.delete') && <button className="pill-delete ml-2" onClick={() => remove(v)}>Delete</button>}
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
            {FIELDS.map(([key, label, required]) => (
              <div key={key} className={key === 'address' ? 'sm:col-span-2' : ''}>
                <label className="label">{label}{required && <span className="text-red-500"> *</span>}</label>
                <input className="input" value={modal.form[key] || ''} onChange={(e) => setField(key, e.target.value)} required={required} />
              </div>
            ))}
            <div className="sm:col-span-2">
              <label className="label">Notes</label>
              <textarea className="input" rows={2} value={modal.form.notes || ''} onChange={(e) => setField('notes', e.target.value)} />
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
