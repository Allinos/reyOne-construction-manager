import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listClients, updateClient, deleteClient } from './api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { errorMessage } from '../../lib/api';
import { PageHeader, Card, Spinner, EmptyState, Pagination, Alert } from '../../components/ui';
import Modal from '../../components/Modal';

const blankForm = { contactPerson: '', phone: '', email: '', address: '', gstNumber: '' };

export default function ClientsPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ items: [], meta: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // { id, name, form }
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setResult(await listClients({ page, search: search || undefined }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    load();
  }, [load]);

  const openEdit = (c) => setModal({
    id: c.id,
    name: c.name,
    form: {
      contactPerson: c.contactPerson || '',
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      gstNumber: c.gstNumber || '',
    },
  });
  const setField = (k, v) => setModal((m) => ({ ...m, form: { ...m.form, [k]: v } }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateClient(modal.id, modal.form);
      toast.success('Client updated');
      setModal(null);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c) => {
    const ok = await confirm({ title: 'Delete client?', message: `Remove ${c.name} from the client directory.`, confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      await deleteClient(c.id);
      toast.success('Client deleted');
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader title="Clients" subtitle="All clients across projects" />

      <Card className="mb-4">
        <input className="input" placeholder="Search clients…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </Card>

      {error && <Alert>{error}</Alert>}

      <Card className="!p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-10"><Spinner /></div>
        ) : result.items.length === 0 ? (
          <div className="p-6"><EmptyState title="No clients yet" hint="Clients appear here once projects are created." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream-100 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">GST</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                  <th className="px-4 py-3 text-center font-medium">Projects</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {result.items.map((c) => (
                  <tr key={c.id} className="hover:bg-cream-100">
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                      <button className="text-left hover:underline" onClick={() => navigate(`/clients/${c.id}`)}>{c.name}</button>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.phone || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{c.email || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{c.gstNumber || '—'}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {can('clients.update') && <button className="pill-edit" onClick={() => openEdit(c)}>Edit</button>}
                      {can('clients.delete') && <button className="pill-delete ml-2" onClick={() => remove(c)}>Delete</button>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-3 text-xs">
                        <span className="text-slate-500">Total <b className="text-slate-800 dark:text-slate-100">{c.totalProjects}</b></span>
                        <span className="text-slate-500">Active <b className="text-blue-600">{c.activeProjects}</b></span>
                        <span className="text-slate-500">Done <b className="text-green-600">{c.completedProjects}</b></span>
                      </div>
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
        title={modal ? `Edit ${modal.name}` : 'Edit Client'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-primary" form="client-form" disabled={saving}>{saving ? <Spinner className="h-4 w-4" /> : 'Save'}</button>
          </>
        }
      >
        {modal && (
          <form id="client-form" onSubmit={save} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Contact Person</label>
              <input className="input" value={modal.form.contactPerson} onChange={(e) => setField('contactPerson', e.target.value)} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={modal.form.phone} onChange={(e) => setField('phone', e.target.value)} />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={modal.form.email} onChange={(e) => setField('email', e.target.value)} />
            </div>
            <div>
              <label className="label">GST Number</label>
              <input className="input" value={modal.form.gstNumber} onChange={(e) => setField('gstNumber', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Address</label>
              <textarea className="input" rows={2} value={modal.form.address} onChange={(e) => setField('address', e.target.value)} />
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
