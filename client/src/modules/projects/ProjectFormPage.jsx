import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProject, createProject, updateProject, getFieldDefs } from './api';
import FieldConfigModal from './FieldConfigModal';
import { useAuth } from '../../context/AuthContext';
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
  const settings = bootstrap?.settings?.projects || {};
  const categories = settings.categories || [];
  const statuses = settings.statuses || [];
  const phaseTemplate = settings.phase_templates || [];

  const [form, setForm] = useState(emptyForm);
  const [customFields, setCustomFields] = useState({});
  const [phases, setPhases] = useState([]);
  const [defs, setDefs] = useState([]);
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
      setPhases(phaseTemplate.map((name) => ({ name, deadline: '' })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setCustom = (k, v) => setCustomFields((c) => ({ ...c, [k]: v }));

  const updatePhase = (i, patch) => setPhases((ps) => ps.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const addPhaseRow = () => setPhases((ps) => [...ps, { name: '', deadline: '' }]);
  const removePhaseRow = (i) => setPhases((ps) => ps.filter((_, idx) => idx !== i));

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
        navigate(`/projects/${id}`);
      } else {
        body.phases = phases
          .filter((p) => p.name.trim())
          .map((p, i) => ({ name: p.name.trim(), sortOrder: i, ...(p.deadline ? { deadline: p.deadline } : {}) }));
        const created = await createProject(body);
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
          <h2 className="mb-4 font-semibold text-slate-700">Client Details</h2>
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
          <h2 className="mb-4 font-semibold text-slate-700">Project Details</h2>
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
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-slate-700">Project Phases</h2>
              <button type="button" className="btn-ghost text-brand-600" onClick={addPhaseRow}>
                + Add Phase
              </button>
            </div>
            <p className="mb-3 text-xs text-slate-400">Prefilled from your configured template. Adjust as needed.</p>
            <div className="space-y-2">
              {phases.map((p, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <input className="input flex-1 min-w-[180px]" placeholder="Phase name" value={p.name} onChange={(e) => updatePhase(i, { name: e.target.value })} />
                  <input type="date" className="input w-auto" value={p.deadline} onChange={(e) => updatePhase(i, { deadline: e.target.value })} />
                  <button type="button" className="btn-ghost text-red-500" onClick={() => removePhaseRow(i)}>
                    Remove
                  </button>
                </div>
              ))}
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
