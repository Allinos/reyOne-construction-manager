import { useEffect, useState, useCallback } from 'react';
import { listRequirements, createRequirement, updateRequirement, deleteRequirement } from './api';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { errorMessage } from '../../lib/api';
import { Spinner } from '../../components/ui';
import { useLocalStorage } from './useLocalStorage';
import CardGrid from './CardGrid';
import ItemModal from './ItemModal';

const FIELD_TYPES = ['Text', 'Number', 'Dropdown', 'Radio', 'Checkbox', 'Date', 'TextArea'];
const uid = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const newField = () => ({ id: uid(), name: '', placeholder: '', type: 'Text', required: false, defaultValue: '', options: '', validation: '' });

// Per-field width preference (client-side): how many of 6 grid columns to span.
const SPAN = { sm: 'sm:col-span-2', md: 'sm:col-span-3', full: 'sm:col-span-6' };

function FieldInput({ field, value, onChange, disabled }) {
  const opts = (field.options || '').split(',').map((o) => o.trim()).filter(Boolean);
  const common = { className: 'input', disabled, value: value ?? '', onChange: (e) => onChange(e.target.value) };
  switch (field.type) {
    case 'TextArea':
      return <textarea {...common} placeholder={field.placeholder} rows={2} className="input resize-y" />;
    case 'Number':
      return <input {...common} type="number" placeholder={field.placeholder} />;
    case 'Date':
      return <input {...common} type="date" />;
    case 'Dropdown':
      return (
        <select {...common}>
          <option value="">{field.placeholder || 'Select…'}</option>
          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    case 'Radio':
      return (
        <div className="flex flex-wrap gap-3 py-1.5">
          {opts.map((o) => (
            <label key={o} className="flex items-center gap-1 text-sm">
              <input type="radio" disabled={disabled} checked={value === o} onChange={() => onChange(o)} /> {o}
            </label>
          ))}
        </div>
      );
    case 'Checkbox':
      return (
        <div className="flex flex-wrap gap-3 py-1.5">
          {(opts.length ? opts : [field.name || 'Yes']).map((o) => {
            const arr = Array.isArray(value) ? value : [];
            const toggle = () => onChange(arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o]);
            return (
              <label key={o} className="flex items-center gap-1 text-sm">
                <input type="checkbox" disabled={disabled} checked={arr.includes(o)} onChange={toggle} /> {o}
              </label>
            );
          })}
        </div>
      );
    default:
      return <input {...common} type="text" placeholder={field.placeholder} pattern={field.validation || undefined} />;
  }
}

function FormEditor({ item, canEdit, onClose, onSaved }) {
  const toast = useToast();
  const [title, setTitle] = useState(item.title || '');
  const [fields, setFields] = useState(item.content?.fields || []);
  const [rows, setRows] = useState((item.content?.rows || []).map((r) => ({ _rid: r._rid || uid(), ...r })));
  const [config, setConfig] = useState((item.content?.fields || []).length === 0);
  const [widths, setWidths] = useLocalStorage(`req:form:${item.id}:w`, {});
  const [saving, setSaving] = useState(false);

  const spanOf = (fid) => SPAN[widths[fid] || 'md'];
  const setWidth = (fid, v) => setWidths((w) => ({ ...w, [fid]: v }));

  const setField = (id, key, val) => setFields((fs) => fs.map((f) => (f.id === id ? { ...f, [key]: val } : f)));
  const addField = () => setFields((fs) => [...fs, newField()]);
  const removeField = (id) => setFields((fs) => fs.filter((f) => f.id !== id));

  const addRow = () => {
    const row = { _rid: uid() };
    fields.forEach((f) => { row[f.id] = f.defaultValue ?? ''; });
    setRows((rs) => [...rs, row]);
  };
  const setCell = (rid, fid, val) => setRows((rs) => rs.map((r) => (r._rid === rid ? { ...r, [fid]: val } : r)));
  const removeRow = (rid) => setRows((rs) => rs.filter((r) => r._rid !== rid));

  const save = async () => {
    setSaving(true);
    try {
      const updated = await updateRequirement(item.id, { title: title || '', content: { fields, rows } });
      toast.success('Form saved');
      onSaved(updated);
      onClose();
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };

  return (
    <ItemModal
      title={title || 'Form'}
      onClose={onClose}
      footer={canEdit && (
        <>
          <button className="btn-secondary" onClick={onClose}>Close</button>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? <Spinner className="h-4 w-4" /> : 'Save'}</button>
        </>
      )}
    >
      <div className="mx-auto max-w-4xl">
        <div className="mb-3 flex items-center gap-2">
          <input className="input font-medium" placeholder="Form name" value={title} disabled={!canEdit} onChange={(e) => setTitle(e.target.value)} />
          {canEdit && <button className="btn-secondary whitespace-nowrap py-1.5" onClick={() => setConfig((c) => !c)}>{config ? 'Done Configuring' : 'Configure Fields'}</button>}
        </div>

        {/* Field configuration */}
        {config && canEdit && (
          <div className="mb-4 space-y-3 rounded-lg bg-cream-100 p-3 dark:bg-slate-800">
            {fields.length === 0 && <p className="text-sm text-slate-400">No fields yet. Add one to build the form.</p>}
            {fields.map((f) => (
              <div key={f.id} className="grid grid-cols-1 gap-2 rounded-lg border border-cream-300 p-2 dark:border-slate-600 sm:grid-cols-2 lg:grid-cols-3">
                <input className="input" placeholder="Field name" value={f.name} onChange={(e) => setField(f.id, 'name', e.target.value)} />
                <select className="input" value={f.type} onChange={(e) => setField(f.id, 'type', e.target.value)}>
                  {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <input className="input" placeholder="Placeholder" value={f.placeholder} onChange={(e) => setField(f.id, 'placeholder', e.target.value)} />
                {['Dropdown', 'Radio', 'Checkbox'].includes(f.type) && (
                  <input className="input" placeholder="Options (comma separated)" value={f.options} onChange={(e) => setField(f.id, 'options', e.target.value)} />
                )}
                <input className="input" placeholder="Default value" value={f.defaultValue} onChange={(e) => setField(f.id, 'defaultValue', e.target.value)} />
                {['Text', 'TextArea'].includes(f.type) && (
                  <input className="input" placeholder="Validation (regex)" value={f.validation} onChange={(e) => setField(f.id, 'validation', e.target.value)} />
                )}
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <input type="checkbox" checked={f.required} onChange={(e) => setField(f.id, 'required', e.target.checked)} /> Required
                </label>
                <select className="input" value={widths[f.id] || 'md'} onChange={(e) => setWidth(f.id, e.target.value)} title="Field width (this device)">
                  <option value="sm">Width: Small</option>
                  <option value="md">Width: Medium</option>
                  <option value="full">Width: Full</option>
                </select>
                <button className="pill-delete justify-self-start" onClick={() => removeField(f.id)}>Remove field</button>
              </div>
            ))}
            <button className="btn-secondary" onClick={addField}>+ Add Field</button>
          </div>
        )}

        {/* Data rows */}
        {fields.length > 0 && (
          <div className="space-y-3">
            {rows.map((r, idx) => (
              <div key={r._rid} className="rounded-lg border border-cream-200 p-3 dark:border-slate-700">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">Entry #{idx + 1}</span>
                  {canEdit && <button className="pill-delete" onClick={() => removeRow(r._rid)}>Delete</button>}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
                  {fields.map((f) => (
                    <div key={f.id} className={SPAN[widths[f.id] || 'md']}>
                      <label className="label">{f.name || 'Field'} {f.required && <span className="text-red-500">*</span>}</label>
                      <FieldInput field={f} value={r[f.id]} onChange={(v) => setCell(r._rid, f.id, v)} disabled={!canEdit} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {canEdit && <button className="btn-secondary" onClick={addRow}>+ Add Row</button>}
          </div>
        )}
      </div>
    </ItemModal>
  );
}

// Tab 2 — Custom Forms as saved cards.
export default function FormTab({ projectId, canEdit }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(null);

  const load = useCallback(() => {
    listRequirements(projectId, 'FORM').then(setItems).catch((e) => toast.error(errorMessage(e)));
  }, [projectId, toast]);
  useEffect(() => { load(); }, [load]);

  const add = async (title) => {
    try {
      const item = await createRequirement({ projectId, kind: 'FORM', title, content: { fields: [], rows: [] } });
      setItems((list) => [...list, item]);
      setOpen(item);
    } catch (e) { toast.error(errorMessage(e)); }
  };
  const onSaved = (updated) => setItems((list) => list.map((x) => (x.id === updated.id ? updated : x)));
  const remove = async (it) => {
    const ok = await confirm({ title: 'Delete form?', message: 'This form and its entries will be removed.', confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      await deleteRequirement(it.id);
      setItems((list) => list.filter((x) => x.id !== it.id));
    } catch (e) { toast.error(errorMessage(e)); }
  };

  if (items === null) return <div className="flex justify-center p-8"><Spinner /></div>;

  return (
    <>
      <CardGrid
        items={items}
        icon="form"
        canEdit={canEdit}
        addLabel="Add Form"
        emptyLabel="No custom forms yet."
        titleOf={(it) => it.title}
        onAdd={add}
        onOpen={setOpen}
        onDelete={remove}
      />
      {open && <FormEditor item={open} canEdit={canEdit} onClose={() => setOpen(null)} onSaved={onSaved} />}
    </>
  );
}
