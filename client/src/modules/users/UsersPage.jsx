import { useEffect, useState, useCallback } from 'react';
import { listUsers, createUser, updateUser, deleteUser, resetPassword, rolesForSelect } from './api';
import { useAuth } from '../../context/AuthContext';
import { errorMessage } from '../../lib/api';
import { PageHeader, Card, Spinner, EmptyState, Pagination, Alert } from '../../components/ui';
import Modal from '../../components/Modal';

const STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
const blank = { name: '', email: '', password: '', phone: '', designation: '', roleId: '', salary: '', status: 'ACTIVE' };

export default function UsersPage() {
  const { bootstrap, can } = useAuth();
  const designations = bootstrap?.settings?.users?.designations || [];

  const [roles, setRoles] = useState([]);
  const [filters, setFilters] = useState({ search: '', roleId: '', status: '', page: 1 });
  const [result, setResult] = useState({ items: [], meta: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [pwModal, setPwModal] = useState(null); // { id, name, password }
  const [saving, setSaving] = useState(false);

  const roleMap = Object.fromEntries(roles.map((r) => [r.id, r.name]));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v != null));
      setResult(await listUsers(clean));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    rolesForSelect().then(setRoles);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const update = (patch) => setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  const setField = (k, v) => setModal((m) => ({ ...m, form: { ...m.form, [k]: v } }));

  const openNew = () => setModal({ editingId: null, form: { ...blank } });
  const openEdit = (u) =>
    setModal({
      editingId: u.id,
      form: {
        name: u.name, email: u.email, phone: u.phone || '', designation: u.designation || '',
        roleId: u.roleId, salary: u.salary ?? '', status: u.status, password: '',
      },
    });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const f = modal.form;
      const body = {
        name: f.name, phone: f.phone || undefined, designation: f.designation || undefined,
        roleId: Number(f.roleId), status: f.status,
        salary: f.salary === '' ? undefined : Number(f.salary),
      };
      if (modal.editingId) {
        body.email = f.email;
        await updateUser(modal.editingId, body);
      } else {
        await createUser({ ...body, email: f.email, password: f.password });
      }
      setModal(null);
      load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const doReset = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await resetPassword(pwModal.id, pwModal.password);
      setPwModal(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    await deleteUser(id);
    load();
  };

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Team members"
        actions={can('users.create') && <button className="btn-primary" onClick={openNew}>+ Add User</button>}
      />

      <Card className="mb-4">
        <div className="flex flex-wrap gap-3">
          <input className="input flex-1 min-w-[200px]" placeholder="Search name, email, phone…" value={filters.search} onChange={(e) => update({ search: e.target.value })} />
          <select className="input w-auto" value={filters.roleId} onChange={(e) => update({ roleId: e.target.value })}>
            <option value="">All roles</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select className="input w-auto" value={filters.status} onChange={(e) => update({ status: e.target.value })}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </Card>

      {error && <Alert>{error}</Alert>}

      <Card className="!p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-10"><Spinner /></div>
        ) : result.items.length === 0 ? (
          <div className="p-6"><EmptyState title="No users found" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream-100 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Designation</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {result.items.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3 font-medium text-slate-800">{u.name}</td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3 text-slate-600">{u.designation || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{roleMap[u.roleId] || u.role?.name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${u.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {can('users.update') && (
                        <>
                          <button className="text-xs text-brand-600 hover:underline" onClick={() => openEdit(u)}>Edit</button>
                          <button className="ml-3 text-xs text-slate-500 hover:underline" onClick={() => setPwModal({ id: u.id, name: u.name, password: '' })}>Reset PW</button>
                        </>
                      )}
                      {can('users.delete') && (
                        <button className="ml-3 text-xs text-red-500 hover:underline" onClick={() => remove(u.id)}>Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Pagination meta={result.meta} onPage={(page) => update({ page })} />

      {/* Create / edit */}
      <Modal
        open={Boolean(modal)}
        onClose={() => setModal(null)}
        title={modal?.editingId ? 'Edit User' : 'Add User'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-primary" form="user-form" disabled={saving}>{saving ? <Spinner className="h-4 w-4" /> : 'Save'}</button>
          </>
        }
      >
        {modal && (
          <form id="user-form" onSubmit={save} className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Name</label>
              <input className="input" value={modal.form.name} onChange={(e) => setField('name', e.target.value)} required />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={modal.form.email} onChange={(e) => setField('email', e.target.value)} required />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={modal.form.phone} onChange={(e) => setField('phone', e.target.value)} />
            </div>
            {!modal.editingId && (
              <div>
                <label className="label">Password</label>
                <input type="password" className="input" value={modal.form.password} onChange={(e) => setField('password', e.target.value)} required minLength={8} />
              </div>
            )}
            <div>
              <label className="label">Designation</label>
              <input className="input" list="designations" value={modal.form.designation} onChange={(e) => setField('designation', e.target.value)} />
              <datalist id="designations">
                {designations.map((d) => <option key={d} value={d} />)}
              </datalist>
            </div>
            <div>
              <label className="label">Role</label>
              <select className="input" value={modal.form.roleId} onChange={(e) => setField('roleId', e.target.value)} required>
                <option value="">Select…</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Salary</label>
              <input type="number" step="0.01" min="0" className="input" value={modal.form.salary} onChange={(e) => setField('salary', e.target.value)} />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={modal.form.status} onChange={(e) => setField('status', e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </form>
        )}
      </Modal>

      {/* Reset password */}
      <Modal
        open={Boolean(pwModal)}
        onClose={() => setPwModal(null)}
        title={`Reset password — ${pwModal?.name || ''}`}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setPwModal(null)}>Cancel</button>
            <button className="btn-primary" form="pw-form" disabled={saving}>{saving ? <Spinner className="h-4 w-4" /> : 'Reset'}</button>
          </>
        }
      >
        {pwModal && (
          <form id="pw-form" onSubmit={doReset}>
            <label className="label">New password</label>
            <input type="password" className="input" value={pwModal.password} onChange={(e) => setPwModal((m) => ({ ...m, password: e.target.value }))} required minLength={8} />
            <p className="mt-2 text-xs text-slate-400">The user's other sessions will be signed out.</p>
          </form>
        )}
      </Modal>
    </div>
  );
}
