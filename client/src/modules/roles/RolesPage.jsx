import { useEffect, useState, useCallback } from 'react';
import { listRoles, createRole, updateRole, deleteRole, listPermissions } from './api';
import { useAuth } from '../../context/AuthContext';
import { errorMessage } from '../../lib/api';
import { PageHeader, Card, Spinner, Alert } from '../../components/ui';
import Modal from '../../components/Modal';

export default function RolesPage() {
  const { can } = useAuth();
  const [roles, setRoles] = useState([]);
  const [permGroups, setPermGroups] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // { editingId, name, description, isOwner, perms:Set }
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([listRoles(), listPermissions().catch(() => ({}))]);
      setRoles(r);
      setPermGroups(p);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const allKeys = Object.values(permGroups).flat().map((p) => p.key);

  const openNew = () => setModal({ editingId: null, name: '', description: '', isOwner: false, perms: new Set() });
  const openEdit = (role) =>
    setModal({
      editingId: role.id,
      name: role.name,
      description: role.description || '',
      isOwner: role.key === 'owner',
      perms: new Set(role.permissionKeys.includes('*') ? allKeys : role.permissionKeys),
    });

  const togglePerm = (key) =>
    setModal((m) => {
      const perms = new Set(m.perms);
      perms.has(key) ? perms.delete(key) : perms.add(key);
      return { ...m, perms };
    });

  const toggleModule = (moduleKeys, on) =>
    setModal((m) => {
      const perms = new Set(m.perms);
      moduleKeys.forEach((k) => (on ? perms.add(k) : perms.delete(k)));
      return { ...m, perms };
    });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const permissionKeys = modal.isOwner ? ['*'] : [...modal.perms];
      const body = { name: modal.name, description: modal.description || undefined, permissionKeys };
      if (modal.editingId) await updateRole(modal.editingId, body);
      else await createRole(body);
      setModal(null);
      load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      await deleteRole(id);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (loading) return <div className="flex justify-center p-10"><Spinner /></div>;

  return (
    <div>
      <PageHeader
        title="Roles & Permissions"
        subtitle="Access control"
        actions={can('roles.create') && <button className="btn-primary" onClick={openNew}>+ Add Role</button>}
      />
      {error && <Alert>{error}</Alert>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {roles.map((r) => (
          <Card key={r.id}>
            <div className="mb-2 flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-slate-800">{r.name}</h3>
                <p className="text-xs text-slate-400">{r.key}</p>
              </div>
              {r.isSystem && <span className="badge bg-cream-200 text-slate-500">system</span>}
            </div>
            <p className="mb-3 min-h-[2.5rem] text-sm text-slate-500">{r.description || '—'}</p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">
                {r.permissionKeys.includes('*') ? 'All permissions' : `${r.permissionKeys.length} permissions`}
              </span>
              <div>
                {can('roles.update') && (
                  <button className="text-xs text-brand-600 hover:underline" onClick={() => openEdit(r)}>Edit</button>
                )}
                {can('roles.delete') && !r.isSystem && (
                  <button className="ml-3 text-xs text-red-500 hover:underline" onClick={() => remove(r.id)}>Delete</button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={Boolean(modal)}
        onClose={() => setModal(null)}
        title={modal?.editingId ? 'Edit Role' : 'Add Role'}
        wide
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-primary" form="role-form" disabled={saving}>{saving ? <Spinner className="h-4 w-4" /> : 'Save'}</button>
          </>
        }
      >
        {modal && (
          <form id="role-form" onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="label">Name</label>
                <input className="input" value={modal.name} onChange={(e) => setModal((m) => ({ ...m, name: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Description</label>
                <input className="input" value={modal.description} onChange={(e) => setModal((m) => ({ ...m, description: e.target.value }))} />
              </div>
            </div>

            {modal.isOwner ? (
              <Alert type="info">The Owner role always has full access and cannot be restricted.</Alert>
            ) : (
              <div className="space-y-3">
                <p className="label">Permissions</p>
                {Object.entries(permGroups).map(([module, perms]) => {
                  const keys = perms.map((p) => p.key);
                  const allOn = keys.every((k) => modal.perms.has(k));
                  return (
                    <div key={module} className="rounded-lg border border-cream-200 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium capitalize text-slate-700">{module}</span>
                        <label className="flex items-center gap-1 text-xs text-slate-500">
                          <input type="checkbox" checked={allOn} onChange={(e) => toggleModule(keys, e.target.checked)} />
                          Select all
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {perms.map((p) => (
                          <label key={p.key} className="flex items-center gap-2 text-sm text-slate-600">
                            <input type="checkbox" checked={modal.perms.has(p.key)} onChange={() => togglePerm(p.key)} />
                            {p.action}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </form>
        )}
      </Modal>
    </div>
  );
}
