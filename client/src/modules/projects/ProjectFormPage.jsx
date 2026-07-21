import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProject, createProject, updateProject, getFieldDefs, listClients, lastReference } from './api';
import FieldConfigModal from './FieldConfigModal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { errorMessage } from '../../lib/api';
import { PageHeader, Card, Spinner, Alert } from '../../components/ui';
import Icon from '../../components/Icon';

function Field({ label, required, children }) {
  return (
    <div>
      <label className="label">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

const emptyForm = {
  referenceNumber: '',
  name: '',
  clientName: '',
  clientPhone: '',
  clientEmail: '',
  clientAddress: '',
  category: '',
  status: 'pending',
  agreementDate: '',
  projectAmount: '',
  advanceAmount: '',
};

export default function ProjectFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { bootstrap } = useAuth();
  const toast = useToast();
  const settings = bootstrap?.settings?.projects || {};
  const categories = settings.categories || [];
  const statuses = settings.statuses || [];
  const phaseTemplates = settings.phase_templates || [];
  const masterTasks = settings.task_templates || [];

  const [form, setForm] = useState(emptyForm);
  const [customFields, setCustomFields] = useState({});
  const [defs, setDefs] = useState([]);
  const [clients, setClients] = useState([]);
  const [clientMode, setClientMode] = useState('new'); // 'new' | 'existing'
  const [lastRef, setLastRef] = useState(null);
  const [selectedStages, setSelectedStages] = useState([]);
  const [taskChips, setTaskChips] = useState([]);
  const [taskDraft, setTaskDraft] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showConfig, setShowConfig] = useState(false);

  const loadDefs = () => getFieldDefs().then((d) => setDefs(d.filter((x) => x.visible))).catch(() => {});

  useEffect(() => {
    loadDefs();
    if (isEdit) {
      getProject(id)
        .then((p) => {
          setForm({
            referenceNumber: p.referenceNumber || '',
            name: p.name || '',
            clientName: p.clientName || '',
            clientPhone: p.clientPhone || '',
            clientEmail: p.clientEmail || '',
            clientAddress: p.clientAddress || '',
            category: p.category || '',
            status: p.status || 'pending',
            agreementDate: p.agreementDate ? p.agreementDate.slice(0, 10) : '',
            projectAmount: p.projectAmount ?? '',
            advanceAmount: p.advanceAmount ?? '',
          });
          setCustomFields(p.customFields || {});
        })
        .catch((err) => setError(errorMessage(err)))
        .finally(() => setLoading(false));
    } else {
      // Create mode: load existing clients and the last generated reference.
      listClients().then(setClients).catch(() => {});
      lastReference().then(setLastRef).catch(() => {});
      setSelectedStages([...phaseTemplates]); // all predefined stages selected by default
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setCustom = (k, v) => setCustomFields((c) => ({ ...c, [k]: v }));

  // Prefill client fields when an existing client is chosen.
  const pickClient = (name) => {
    const c = clients.find((x) => x.name === name);
    if (!c) return;
    setForm((f) => ({
      ...f,
      clientName: c.name || '',
      clientPhone: c.phone || '',
      clientEmail: c.email || '',
      clientAddress: c.address || '',
    }));
  };

  const switchClientMode = (mode) => {
    setClientMode(mode);
    if (mode === 'new') {
      setForm((f) => ({ ...f, clientName: '', clientPhone: '', clientEmail: '', clientAddress: '' }));
    }
  };

  const toggleStage = (name) =>
    setSelectedStages((s) => (s.includes(name) ? s.filter((x) => x !== name) : [...s, name]));
  const addTaskChip = () => {
    const v = taskDraft.trim();
    if (v && !taskChips.includes(v)) setTaskChips([...taskChips, v]);
    setTaskDraft('');
  };
  const removeTaskChip = (t) => setTaskChips(taskChips.filter((x) => x !== t));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const body = {
        ...form,
        projectAmount: form.projectAmount === '' ? 0 : Number(form.projectAmount),
        advanceAmount: form.advanceAmount === '' ? 0 : Number(form.advanceAmount),
        customFields,
      };
      if (!body.referenceNumber) delete body.referenceNumber;
      if (!body.agreementDate) delete body.agreementDate;

      if (isEdit) {
        await updateProject(id, body);
        toast.success('Project updated successfully');
        navigate(`/projects/${id}`);
      } else {
        // Build the selected stages, each seeded with the chosen tasks (master
        // + temporary). If no stage is selected, the backend falls back to the
        // configured template.
        body.phases = selectedStages.map((name, i) => ({
          name,
          sortOrder: i,
          tasks: taskChips.map((title) => ({ title })),
        }));
        const created = await createProject(body);
        toast.success('Project created successfully');
        navigate(`/projects/${created.id}`);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center p-10"><Spinner /></div>;

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Edit Project' : 'Add Project'}
        actions={
          <button type="button" className="btn-secondary" onClick={() => setShowConfig(true)} title="Configure form fields">
            <Icon name="settings" className="h-4 w-4" /> Configure
          </button>
        }
      />

      {error && <Alert>{error}</Alert>}

      <form onSubmit={onSubmit} className="space-y-6">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-700">Client Details</h2>
            {!isEdit && (
              <div className="flex overflow-hidden rounded-lg border border-cream-300 text-sm">
                <button
                  type="button"
                  className={`px-3 py-1.5 ${clientMode === 'new' ? 'bg-brand-500 text-white' : 'bg-white text-slate-600'}`}
                  onClick={() => switchClientMode('new')}
                >
                  New Client
                </button>
                <button
                  type="button"
                  className={`px-3 py-1.5 ${clientMode === 'existing' ? 'bg-brand-500 text-white' : 'bg-white text-slate-600'}`}
                  onClick={() => switchClientMode('existing')}
                >
                  Existing Client
                </button>
              </div>
            )}
          </div>

          {!isEdit && clientMode === 'existing' && (
            <div className="mb-4">
              <label className="label">Select Client</label>
              <select className="input md:w-1/2" value={form.clientName} onChange={(e) => pickClient(e.target.value)}>
                <option value="">Choose an existing client…</option>
                {clients.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                    {c.phone ? ` · ${c.phone}` : ''}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-400">Their stored details fill in below — complete the project details and create.</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Client Name" required>
              <input className="input" value={form.clientName} onChange={(e) => set('clientName', e.target.value)} required />
            </Field>
            <Field label="Phone">
              <input className="input" value={form.clientPhone} onChange={(e) => set('clientPhone', e.target.value)} />
            </Field>
            <Field label="Email">
              <input type="email" className="input" value={form.clientEmail} onChange={(e) => set('clientEmail', e.target.value)} />
            </Field>
            <Field label="Address">
              <input className="input" value={form.clientAddress} onChange={(e) => set('clientAddress', e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-700">Project Details</h2>
            {!isEdit && (
              <span className="text-xs text-slate-500">
                Last Reference Number:{' '}
                <span className="font-semibold text-brand-600">{lastRef?.last || '—'}</span>
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Reference Number">
              <input className="input" placeholder="Auto-generated if blank" value={form.referenceNumber} onChange={(e) => set('referenceNumber', e.target.value)} />
            </Field>
            <Field label="Project Name" required>
              <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} required />
            </Field>
            <Field label="Category">
              <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
                <option value="">Select…</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>
                {statuses.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Agreement Date">
              <input type="date" className="input" value={form.agreementDate} onChange={(e) => set('agreementDate', e.target.value)} />
            </Field>
            <Field label="Project Amount">
              <input type="number" step="0.01" min="0" className="input" value={form.projectAmount} onChange={(e) => set('projectAmount', e.target.value)} />
            </Field>
            <Field label="Advance Amount">
              <input type="number" step="0.01" min="0" className="input" value={form.advanceAmount} onChange={(e) => set('advanceAmount', e.target.value)} />
            </Field>
          </div>

          {defs.length > 0 && (
            <div className="mt-4 grid grid-cols-1 gap-4 border-t border-cream-200 pt-4 md:grid-cols-2">
              {defs.map((d) => (
                <Field key={d.key} label={d.label} required={d.required}>
                  {d.fieldType === 'textarea' ? (
                    <textarea className="input" value={customFields[d.key] || ''} onChange={(e) => setCustom(d.key, e.target.value)} required={d.required} />
                  ) : d.fieldType === 'select' ? (
                    <select className="input" value={customFields[d.key] || ''} onChange={(e) => setCustom(d.key, e.target.value)} required={d.required}>
                      <option value="">Select…</option>
                      {(d.options || []).map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : d.fieldType === 'checkbox' ? (
                    <input type="checkbox" checked={Boolean(customFields[d.key])} onChange={(e) => setCustom(d.key, e.target.checked)} />
                  ) : (
                    <input type={d.fieldType === 'number' ? 'number' : d.fieldType === 'date' ? 'date' : 'text'} className="input" value={customFields[d.key] || ''} onChange={(e) => setCustom(d.key, e.target.value)} required={d.required} />
                  )}
                </Field>
              ))}
            </div>
          )}
        </Card>

        {!isEdit && (
          <Card>
            <h2 className="mb-4 font-semibold text-slate-700 dark:text-slate-200">Project Stages</h2>
            <p className="mb-3 text-xs text-slate-400">Select one or more predefined stages for this project.</p>
            <div className="flex flex-wrap gap-2">
              {phaseTemplates.map((name) => {
                const on = selectedStages.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleStage(name)}
                    className={`rounded-lg border px-3 py-1.5 text-sm ${
                      on ? 'border-brand-400 bg-brand-50 text-brand-700 dark:bg-slate-700' : 'border-cream-300 text-slate-600 dark:border-slate-600'
                    }`}
                  >
                    {on ? '✓ ' : ''}{name}
                  </button>
                );
              })}
              {phaseTemplates.length === 0 && <span className="text-sm text-slate-400">No stages configured in Settings.</span>}
            </div>

            <div className="mt-5 border-t border-cream-200 pt-4 dark:border-slate-700">
              <h3 className="mb-1 font-medium text-slate-700 dark:text-slate-200">Tasks</h3>
              <p className="mb-2 text-xs text-slate-400">Added to each selected stage. Pick from the master list or type a temporary task.</p>
              <div className="mb-2 flex flex-wrap gap-2">
                {taskChips.map((t) => (
                  <span key={t} className="badge bg-cream-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                    {t}
                    <button type="button" className="ml-1 text-slate-400 hover:text-red-500" onClick={() => removeTaskChip(t)}>&times;</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  list="master-task-list"
                  placeholder="Add a task and press Enter"
                  value={taskDraft}
                  onChange={(e) => setTaskDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTaskChip())}
                />
                <datalist id="master-task-list">
                  {masterTasks.map((t) => <option key={t} value={t} />)}
                </datalist>
                <button type="button" className="btn-secondary" onClick={addTaskChip}>Add</button>
              </div>
            </div>
          </Card>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => navigate('/projects')}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? <Spinner className="h-4 w-4" /> : isEdit ? 'Save Changes' : 'Create Project'}
          </button>
        </div>
      </form>

      <FieldConfigModal open={showConfig} onClose={() => setShowConfig(false)} onChanged={loadDefs} />
    </div>
  );
}
