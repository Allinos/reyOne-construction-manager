import { useState } from 'react';
import { Card, Spinner, Alert } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { updateSetting } from './api';

// Editor for a setting whose value is a list of strings (categories, phases…).
export function StringListEditor({ title, group, settingKey, initial, description }) {
  const toast = useToast();
  const [items, setItems] = useState(initial || []);
  const [draft, setDraft] = useState('');
  const [state, setState] = useState({ saving: false, error: '', saved: false });

  const add = () => {
    const v = draft.trim();
    if (v && !items.includes(v)) setItems([...items, v]);
    setDraft('');
  };
  const remove = (i) => setItems(items.filter((_, idx) => idx !== i));

  const save = async () => {
    setState({ saving: true, error: '', saved: false });
    try {
      await updateSetting(group, settingKey, items);
      setState({ saving: false, error: '', saved: true });
      toast.success(`${title} saved`);
    } catch (err) {
      setState({ saving: false, error: errorMessage(err), saved: false });
    }
  };

  return (
    <Card>
      <h3 className="font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
      {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      {state.error && <Alert>{state.error}</Alert>}
      <div className="mb-3 mt-3 flex flex-wrap gap-2">
        {items.map((it, i) => (
          <span key={i} className="badge bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
            {it}
            <button className="ml-1 text-slate-400 hover:text-red-500" onClick={() => remove(i)}>&times;</button>
          </span>
        ))}
        {items.length === 0 && <span className="text-sm text-slate-400">No items.</span>}
      </div>
      <div className="flex gap-2">
        <input
          className="input flex-1"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="Add item and press Enter"
        />
        <button className="btn-secondary" onClick={add} type="button">Add</button>
        <button className="btn-primary" onClick={save} disabled={state.saving}>
          {state.saving ? <Spinner className="h-4 w-4" /> : state.saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </Card>
  );
}

// Editor for a single string setting (e.g. a page/module name).
export function TextSettingEditor({ title, group, settingKey, initial, hint, placeholder }) {
  const toast = useToast();
  const [value, setValue] = useState(initial || '');
  const [state, setState] = useState({ saving: false, error: '', saved: false });

  const save = async () => {
    setState({ saving: true, error: '', saved: false });
    try {
      await updateSetting(group, settingKey, value.trim());
      setState({ saving: false, error: '', saved: true });
      toast.success(`${title} saved`);
    } catch (err) {
      setState({ saving: false, error: errorMessage(err), saved: false });
    }
  };

  return (
    <Card>
      <h3 className="mb-1 font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
      {hint && <p className="mb-3 text-xs text-slate-400">{hint}</p>}
      {state.error && <Alert>{state.error}</Alert>}
      <div className="flex gap-2">
        <input className="input flex-1" value={value} placeholder={placeholder} onChange={(e) => setValue(e.target.value)} />
        <button className="btn-primary" onClick={save} disabled={state.saving}>
          {state.saving ? <Spinner className="h-4 w-4" /> : state.saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </Card>
  );
}

// Editor for a list of objects with a fixed set of text columns.
export function ObjectListEditor({ title, group, settingKey, initial, columns, description }) {
  const toast = useToast();
  const [rows, setRows] = useState(initial || []);
  const [state, setState] = useState({ saving: false, error: '', saved: false });

  const setCell = (i, key, value) => setRows(rows.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  const addRow = () => setRows([...rows, Object.fromEntries(columns.map((c) => [c.key, c.type === 'color' ? '#cc6e02' : '']))]);
  const removeRow = (i) => setRows(rows.filter((_, idx) => idx !== i));

  const save = async () => {
    setState({ saving: true, error: '', saved: false });
    try {
      await updateSetting(group, settingKey, rows);
      setState({ saving: false, error: '', saved: true });
      toast.success(`${title} saved`);
    } catch (err) {
      setState({ saving: false, error: errorMessage(err), saved: false });
    }
  };

  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
        </div>
        <button className="btn-secondary btn-sm" onClick={addRow} type="button">+ Add row</button>
      </div>
      {state.error && <Alert>{state.error}</Alert>}
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            {columns.map((c) =>
              c.type === 'color' ? (
                <input
                  key={c.key}
                  type="color"
                  className="h-10 w-14 shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-600"
                  title={c.label}
                  value={row[c.key] || '#cc6e02'}
                  onChange={(e) => setCell(i, c.key, e.target.value)}
                />
              ) : (
                <input
                  key={c.key}
                  className="input flex-1 min-w-[120px]"
                  placeholder={c.label}
                  value={row[c.key] ?? ''}
                  onChange={(e) => setCell(i, c.key, e.target.value)}
                />
              ),
            )}
            <button className="btn-ghost px-2 text-red-600 hover:bg-red-50" onClick={() => removeRow(i)} type="button" aria-label="Remove row">×</button>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-slate-400">No rows.</p>}
      </div>
      <div className="mt-3 flex justify-end">
        <button className="btn-primary" onClick={save} disabled={state.saving}>
          {state.saving ? <Spinner className="h-4 w-4" /> : state.saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </Card>
  );
}

// On/off switches stored together as one object setting, e.g.
// projects.detail_sections = { approvals: true, timeline: false }.
export function ToggleGroupEditor({ title, description, group, settingKey, initial, options }) {
  const toast = useToast();
  const [value, setValue] = useState({ ...(initial || {}) });
  const [saving, setSaving] = useState(false);
  const isOn = (k) => value[k] !== false;
  const flip = async (k) => {
    const next = { ...value, [k]: !isOn(k) };
    setValue(next);
    setSaving(true);
    try {
      await updateSetting(group, settingKey, next);
      toast.success('Saved');
    } catch (err) {
      toast.error(errorMessage(err));
      setValue(value);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card>
      <h3 className="font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
      {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-700">
        {options.map((o) => (
          <li key={o.key} className="flex items-center justify-between gap-4 py-2.5">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{o.label}</p>
              {o.hint && <p className="text-xs text-slate-500">{o.hint}</p>}
            </div>
            <Switch checked={isOn(o.key)} disabled={saving} onChange={() => flip(o.key)} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function Switch({ checked, disabled, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-600'} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

