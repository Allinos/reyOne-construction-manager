import { useEffect, useState, useCallback } from 'react';
import { listRecords, createRecord, updateRecord, deleteRecord, getConfig, setConfig, getAnalytics } from './api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { errorMessage } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { PageHeader, Card, Spinner, EmptyState, Pagination, Alert } from '../../components/ui';
import Modal from '../../components/Modal';

const FIELD_TYPES = [
  { v: 'text', l: 'Text' },
  { v: 'number', l: 'Number' },
  { v: 'date', l: 'Date' },
  { v: 'dropdown', l: 'Dropdown' },
  { v: 'textarea', l: 'Text Area' },
  { v: 'checkbox', l: 'Checkbox (Yes/No)' },
];
const uid = () => `f${Date.now()}${Math.floor(Math.random() * 1000)}`;
const newField = () => ({ id: uid(), label: '', type: 'text', required: false, options: [] });

// Renders the correct input for a field type.
function FieldInput({ field, value, onChange }) {
  switch (field.type) {
    case 'number':
      return <input type="number" className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
    case 'date':
      return <input type="date" className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
    case 'textarea':
      return <textarea className="input" rows={2} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
    case 'checkbox':
      return <input type="checkbox" className="h-5 w-5" checked={!!value} onChange={(e) => onChange(e.target.checked)} />;
    case 'dropdown':
      return (
        <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>
          {(field.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    default:
      return <input type="text" className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
  }
}

function displayValue(field, v) {
  if (field.type === 'checkbox') return v ? 'Yes' : 'No';
  if (v == null || v === '') return '—';
  if (field.type === 'date') return formatDate(v);
  return String(v);
}

export default function CustomModulePage() {
  const { bootstrap, can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [config, setCfg] = useState(null); // { name, fields, listFields }
  const [result, setResult] = useState({ items: [], meta: null });
  const [analytics, setAnalytics] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [configModal, setConfigModal] = useState(null); // { fields, listFields }
  const [recordModal, setRecordModal] = useState(null); // { id, values }
  const [saving, setSaving] = useState(false);

  const loadConfig = useCallback(() => getConfig().then(setCfg).catch((e) => setError(errorMessage(e))), []);
  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      setResult(await listRecords({ page, limit: 50 }));
    } catch (e) { setError(errorMessage(e)); } finally { setLoading(false); }
  }, [page]);
  const loadAnalytics = useCallback(() => getAnalytics().then(setAnalytics).catch(() => {}), []);

  useEffect(() => { loadConfig(); }, [loadConfig]);
  useEffect(() => { loadRecords(); }, [loadRecords]);
  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);

  const fields = config?.fields || [];
  const listFieldIds = config?.listFields?.length ? config.listFields : fields.map((f) => f.id);
  const listColumns = fields.filter((f) => listFieldIds.includes(f.id));

  // --- Configuration (form builder) ---
  const openConfig = () => setConfigModal({ fields: fields.map((f) => ({ ...f })), listFields: [...(config?.listFields || [])] });
  const cfgSetField = (id, key, val) => setConfigModal((m) => ({ ...m, fields: m.fields.map((f) => (f.id === id ? { ...f, [key]: val } : f)) }));
  const cfgAddField = () => setConfigModal((m) => ({ ...m, fields: [...m.fields, newField()] }));
  const cfgRemoveField = (id) => setConfigModal((m) => ({
    ...m,
    fields: m.fields.filter((f) => f.id !== id),
    listFields: m.listFields.filter((x) => x !== id),
  }));
  const cfgToggleList = (id) => setConfigModal((m) => ({
    ...m,
    listFields: m.listFields.includes(id) ? m.listFields.filter((x) => x !== id) : [...m.listFields, id],
  }));

  const saveConfig = async () => {
    // Validate labels present.
    if (configModal.fields.some((f) => !f.label.trim())) { toast.error('Every field needs a label'); return; }
    setSaving(true);
    try {
      const clean = configModal.fields.map((f) => ({
        id: f.id,
        label: f.label.trim(),
        type: f.type,
        required: !!f.required,
        options: f.type === 'dropdown' ? (f.options || []).filter(Boolean) : undefined,
      }));
      await setConfig({ fields: clean, listFields: configModal.listFields });
      toast.success('Form configuration saved');
      setConfigModal(null);
      await loadConfig();
      loadAnalytics();
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };

  // --- Add / edit record ---
  const openNew = () => {
    const values = {};
    fields.forEach((f) => { values[f.id] = f.type === 'checkbox' ? false : ''; });
    setRecordModal({ id: null, values });
  };
  const openEdit = (rec) => setRecordModal({ id: rec.id, values: { ...rec.values } });
  const recSet = (fid, val) => setRecordModal((m) => ({ ...m, values: { ...m.values, [fid]: val } }));

  const saveRecord = async () => {
    for (const f of fields) {
      if (f.required && (recordModal.values[f.id] === '' || recordModal.values[f.id] == null || (f.type === 'checkbox' && !recordModal.values[f.id]))) {
        toast.error(`${f.label} is required`);
        return;
      }
    }
    setSaving(true);
    try {
      if (recordModal.id) await updateRecord(recordModal.id, recordModal.values);
      else await createRecord(recordModal.values);
      toast.success(`Entry ${recordModal.id ? 'updated' : 'added'}`);
      setRecordModal(null);
      loadRecords();
      loadAnalytics();
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };

  const remove = async (rec) => {
    const ok = await confirm({ title: 'Delete entry?', message: 'This record will be removed.', confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      await deleteRecord(rec.id);
      toast.success('Entry deleted');
      loadRecords();
      loadAnalytics();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  if (error && !config) return <Alert>{error}</Alert>;
  if (!config) return <div className="flex justify-center p-10"><Spinner /></div>;

  return (
    <div>
      <PageHeader
        title={config.name || 'Custom Module'}
        subtitle="Build your own form, capture data and analyse it"
        actions={
          <div className="flex flex-wrap gap-2">
            {can('custom_module.configure') && <button className="btn-secondary" onClick={openConfig}>Configuration</button>}
            {can('custom_module.create') && <button className="btn-primary" onClick={openNew} disabled={fields.length === 0}>+ Add</button>}
          </div>
        }
      />

      {fields.length === 0 && (
        <Card className="mb-4">
          <EmptyState title="No form yet" hint={can('custom_module.configure') ? 'Click Configuration to build your form.' : 'Ask an admin to configure this module.'} />
        </Card>
      )}

      {/* Analytics for number fields */}
      {analytics?.metrics?.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold text-slate-700 dark:text-slate-200">Analytics</h2>
            <span className="text-xs text-slate-400">{analytics.totalRecords} record(s)</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {analytics.metrics.map((m) => (
              <Card key={m.id}>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{m.label}</p>
                <p className="mt-1 text-2xl font-semibold text-brand-600">{m.sum.toLocaleString()}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                  <span>Total: <b className="text-slate-600 dark:text-slate-300">{m.sum.toLocaleString()}</b></span>
                  <span>Avg: <b className="text-slate-600 dark:text-slate-300">{m.avg.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b></span>
                  <span>Min: <b className="text-slate-600 dark:text-slate-300">{m.min.toLocaleString()}</b></span>
                  <span>Max: <b className="text-slate-600 dark:text-slate-300">{m.max.toLocaleString()}</b></span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Data list */}
      {fields.length > 0 && (
        <Card className="!p-0 overflow-hidden">
          {loading ? (
            <div className="flex justify-center p-10"><Spinner /></div>
          ) : result.items.length === 0 ? (
            <div className="p-6"><EmptyState title="No data yet" hint="Click + Add to create your first entry." /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-cream-100 text-left text-slate-500">
                  <tr>
                    {listColumns.map((f) => <th key={f.id} className="px-4 py-3 font-medium">{f.label}</th>)}
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-200">
                  {result.items.map((rec) => (
                    <tr key={rec.id}>
                      {listColumns.map((f) => (
                        <td key={f.id} className="px-4 py-3 text-slate-700 dark:text-slate-200">{displayValue(f, rec.values?.[f.id])}</td>
                      ))}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {can('custom_module.update') && <button className="pill-edit" onClick={() => openEdit(rec)}>Edit</button>}
                        {can('custom_module.delete') && <button className="pill-delete ml-2" onClick={() => remove(rec)}>Delete</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
      <Pagination meta={result.meta} onPage={setPage} />

      {/* Configuration modal — form builder + list visibility */}
      <Modal
        open={Boolean(configModal)}
        onClose={() => setConfigModal(null)}
        title="Configure Form"
        wide
        footer={
          <>
            <button className="btn-secondary" onClick={() => setConfigModal(null)}>Cancel</button>
            <button className="btn-primary" onClick={saveConfig} disabled={saving}>{saving ? <Spinner className="h-4 w-4" /> : 'Save'}</button>
          </>
        }
      >
        {configModal && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">
              Add fields, pick their type, mark required ones, and tick “In list” to show a field in the data table. Rename the page in Settings → Configuration → Custom Module.
            </p>
            {configModal.fields.length === 0 && <p className="text-sm text-slate-400">No fields yet.</p>}
            {configModal.fields.map((f) => (
              <div key={f.id} className="rounded-lg border border-cream-300 p-3 dark:border-slate-700">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <label className="label">Field label</label>
                    <input className="input" placeholder="e.g., Item name" value={f.label} onChange={(e) => cfgSetField(f.id, 'label', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Type</label>
                    <select className="input" value={f.type} onChange={(e) => cfgSetField(f.id, 'type', e.target.value)}>
                      {FIELD_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                    </select>
                  </div>
                  {f.type === 'dropdown' && (
                    <div className="sm:col-span-2">
                      <label className="label">Options (comma separated)</label>
                      <input
                        className="input"
                        placeholder="e.g., Low, Medium, High"
                        value={(f.options || []).join(', ')}
                        onChange={(e) => cfgSetField(f.id, 'options', e.target.value.split(',').map((o) => o.trim()).filter(Boolean))}
                      />
                    </div>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <input type="checkbox" checked={!!f.required} onChange={(e) => cfgSetField(f.id, 'required', e.target.checked)} /> Required
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <input type="checkbox" checked={configModal.listFields.includes(f.id)} onChange={() => cfgToggleList(f.id)} /> Show in list
                  </label>
                  <button className="pill-delete ml-auto" onClick={() => cfgRemoveField(f.id)}>Delete field</button>
                </div>
              </div>
            ))}
            <button className="btn-secondary" onClick={cfgAddField}>+ Add Field</button>
          </div>
        )}
      </Modal>

      {/* Add / edit record modal */}
      <Modal
        open={Boolean(recordModal)}
        onClose={() => setRecordModal(null)}
        title={recordModal?.id ? 'Edit Entry' : 'Add Entry'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setRecordModal(null)}>Cancel</button>
            <button className="btn-primary" onClick={saveRecord} disabled={saving}>{saving ? <Spinner className="h-4 w-4" /> : 'Save'}</button>
          </>
        }
      >
        {recordModal && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.id} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
                <label className="label">{f.label} {f.required && <span className="text-red-500">*</span>}</label>
                <FieldInput field={f} value={recordModal.values[f.id]} onChange={(v) => recSet(f.id, v)} />
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
