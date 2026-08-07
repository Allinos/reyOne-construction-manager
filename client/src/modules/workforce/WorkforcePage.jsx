import { useEffect, useState, useCallback } from 'react';
import { listWorkforce, createWorkforce, updateWorkforce, deleteWorkforce } from './api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { errorMessage } from '../../lib/api';
import { PageHeader, Card, Spinner, EmptyState, Pagination, Alert } from '../../components/ui';
import Modal from '../../components/Modal';

const blank = { name: '', category: '', phone: '', address: '', notes: '', status: 'ACTIVE' };
const SORTS = [
  { v: 'name:asc', l: 'Name (A–Z)' },
  { v: 'name:desc', l: 'Name (Z–A)' },
  { v: 'category:asc', l: 'Category' },
  { v: 'createdAt:desc', l: 'Recently added' },
];

export default function WorkforcePage() {
  const { bootstrap, can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  // Categories may be stored as legacy strings or as { name, color } objects.
  const categories = (bootstrap?.settings?.workforce?.categories || []).map((c) =>
    typeof c === 'string' ? { name: c, color: '#f97316' } : { name: c.name || '', color: c.color || '#f97316' },
  );
  const colorFor = (name) => categories.find((c) => c.name === name)?.color || '#64748b';

  const [filters, setFilters] = useState({ search: '', category: '', status: '', sort: 'name:asc', page: 1 });
  const [result, setResult] = useState({ items: [], meta: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sortBy, order] = filters.sort.split(':');
      const params = { page: filters.page, sortBy, order };
      if (filters.search) params.search = filters.search;
      if (filters.category) params.category = filters.category;
      if (filters.status) params.status = filters.status;
      setResult(await listWorkforce(params));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const update = (patch) => setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  const openNew = () => setModal({ editingId: null, form: { ...blank } });
  const openEdit = (m) => setModal({ editingId: m.id, form: { ...blank, ...m } });
  const setField = (k, v) => setModal((m) => ({ ...m, form: { ...m.form, [k]: v } }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...modal.form };
      if (modal.editingId) await updateWorkforce(modal.editingId, body);
      else await createWorkforce(body);
      toast.success(`Workforce member ${modal.editingId ? 'updated' : 'added'}`);
      setModal(null);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (m) => {
    const ok = await confirm({ title: 'Delete member?', message: `Remove ${m.name}.`, confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      await deleteWorkforce(m.id);
      toast.success('Member deleted');
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="Workforce"
        subtitle="Contractors, labour & technicians"
        actions={can('workforce.create') && <button className="btn-primary" onClick={openNew}>+ Add Member</button>}
      />

      <Card className="mb-4">
        <div className="flex flex-wrap gap-3">
          <input className="input flex-1 min-w-[180px]" placeholder="Search name or phone…" value={filters.search} onChange={(e) => update({ search: e.target.value })} />
          <select className="input w-auto" value={filters.category} onChange={(e) => update({ category: e.target.value })}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
          <select className="input w-auto" value={filters.status} onChange={(e) => update({ status: e.target.value })}>
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <select className="input w-auto" value={filters.sort} onChange={(e) => update({ sort: e.target.value })}>
            {SORTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
        </div>
      </Card>

      {error && <Alert>{error}</Alert>}

      <Card className="!p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-10"><Spinner /></div>
        ) : result.items.length === 0 ? (
          <div className="p-6"><EmptyState title="No workforce members yet" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream-100 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {result.items.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{m.name}</td>
                    <td className="px-4 py-3">
                      <span className="badge" style={{ backgroundColor: `${colorFor(m.category)}22`, color: colorFor(m.category) }}>{m.category}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{m.phone || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${m.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>{m.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {can('workforce.update') && <button className="pill-edit" onClick={() => openEdit(m)}>Edit</button>}
                      {can('workforce.delete') && <button className="pill-delete ml-2" onClick={() => remove(m)}>Delete</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Pagination meta={result.meta} onPage={(page) => update({ page })} />

      <Modal
        open={Boolean(modal)}
        onClose={() => setModal(null)}
        title={modal?.editingId ? 'Edit Member' : 'Add Member'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-primary" form="wf-form" disabled={saving}>{saving ? <Spinner className="h-4 w-4" /> : 'Save'}</button>
          </>
        }
      >
        {modal && (
          <form id="wf-form" onSubmit={save} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Name <span className="text-red-500">*</span></label>
              <input className="input" placeholder="e.g., Ramesh Kumar" value={modal.form.name} onChange={(e) => setField('name', e.target.value)} required />
            </div>
            <div>
              <label className="label">Category <span className="text-red-500">*</span></label>
              <input className="input" list="wf-categories" placeholder="e.g., Electrician" value={modal.form.category} onChange={(e) => setField('category', e.target.value)} required />
              <datalist id="wf-categories">{categories.map((c) => <option key={c.name} value={c.name} />)}</datalist>
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" placeholder="e.g., +91 98765 43210" value={modal.form.phone || ''} onChange={(e) => setField('phone', e.target.value)} />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={modal.form.status} onChange={(e) => setField('status', e.target.value)}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Address</label>
              <input className="input" placeholder="e.g., Ward 4, Siwan" value={modal.form.address || ''} onChange={(e) => setField('address', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Notes</label>
              <textarea className="input" rows={2} placeholder="e.g., Available weekdays, specializes in wiring" value={modal.form.notes || ''} onChange={(e) => setField('notes', e.target.value)} />
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
