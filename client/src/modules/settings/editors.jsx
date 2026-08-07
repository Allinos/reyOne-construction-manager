import { useState } from 'react';
import { Card, Spinner, Alert } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { updateSetting } from './api';

// Editor for a setting whose value is a list of strings (categories, phases…).
export function StringListEditor({ title, group, settingKey, initial }) {
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
      <h3 className="mb-3 font-semibold text-slate-700">{title}</h3>
      {state.error && <Alert>{state.error}</Alert>}
      <div className="mb-3 flex flex-wrap gap-2">
        {items.map((it, i) => (
          <span key={i} className="badge bg-cream-200 text-slate-600">
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

// Editor for a list of objects with a fixed set of text columns.
export function ObjectListEditor({ title, group, settingKey, initial, columns }) {
  const toast = useToast();
  const [rows, setRows] = useState(initial || []);
  const [state, setState] = useState({ saving: false, error: '', saved: false });

  const setCell = (i, key, value) => setRows(rows.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  const addRow = () => setRows([...rows, Object.fromEntries(columns.map((c) => [c.key, c.type === 'color' ? '#f97316' : '']))]);
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
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-slate-700">{title}</h3>
        <button className="btn-ghost text-brand-600" onClick={addRow} type="button">+ Add row</button>
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
                  className="h-10 w-14 shrink-0 cursor-pointer rounded-lg border border-cream-300 bg-white p-1 dark:border-slate-600"
                  title={c.label}
                  value={row[c.key] || '#f97316'}
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
            <button className="btn-ghost text-red-500" onClick={() => removeRow(i)} type="button">Remove</button>
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
