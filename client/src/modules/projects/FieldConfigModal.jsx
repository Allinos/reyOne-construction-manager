import { useEffect, useState } from 'react';
import Modal from '../../components/Modal';
import { Spinner, Alert } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { getFieldDefs, createFieldDef, updateFieldDef, deleteFieldDef } from './api';

const FIELD_TYPES = ['text', 'number', 'date', 'select', 'textarea', 'checkbox'];
const slugify = (s) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

// The ⚙️ dialog: decide which custom fields appear on the project form, whether
// they are required, and add/remove client-specific fields — all persisted to
// field_definitions via the settings API.
export default function FieldConfigModal({ open, onClose, onChanged }) {
  const [defs, setDefs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState({ label: '', fieldType: 'text' });

  const load = async () => {
    setLoading(true);
    try {
      setDefs(await getFieldDefs());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setError('');
      load();
    }
  }, [open]);

  const toggle = async (def, patch) => {
    try {
      await updateFieldDef(def.id, patch);
      load();
      onChanged?.();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const remove = async (def) => {
    try {
      await deleteFieldDef(def.id);
      load();
      onChanged?.();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const add = async () => {
    if (!draft.label.trim()) return;
    try {
      await createFieldDef({
        entityType: 'project',
        key: slugify(draft.label),
        label: draft.label.trim(),
        fieldType: draft.fieldType,
        isCustom: true,
      });
      setDraft({ label: '', fieldType: 'text' });
      load();
      onChanged?.();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Configure Project Form" wide>
      {error && <Alert>{error}</Alert>}
      {loading ? (
        <div className="flex justify-center p-6">
          <Spinner />
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-500">
            Add client-specific fields and control which appear and which are required.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-400">
                <tr>
                  <th className="py-2 font-medium">Field</th>
                  <th className="py-2 font-medium">Type</th>
                  <th className="py-2 text-center font-medium">Visible</th>
                  <th className="py-2 text-center font-medium">Required</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {defs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-slate-400">
                      No custom fields yet.
                    </td>
                  </tr>
                )}
                {defs.map((d) => (
                  <tr key={d.id}>
                    <td className="py-2 text-slate-700">{d.label}</td>
                    <td className="py-2 text-slate-500">{d.fieldType}</td>
                    <td className="py-2 text-center">
                      <input type="checkbox" checked={d.visible} onChange={(e) => toggle(d, { visible: e.target.checked })} />
                    </td>
                    <td className="py-2 text-center">
                      <input type="checkbox" checked={d.required} onChange={(e) => toggle(d, { required: e.target.checked })} />
                    </td>
                    <td className="py-2 text-right">
                      {d.isCustom && (
                        <button className="text-xs text-red-500 hover:underline" onClick={() => remove(d)}>
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-cream-200 pt-4">
            <div className="flex-1 min-w-[160px]">
              <label className="label">New field label</label>
              <input
                className="input"
                value={draft.label}
                onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                placeholder="e.g. Plot Number"
              />
            </div>
            <div>
              <label className="label">Type</label>
              <select
                className="input w-auto"
                value={draft.fieldType}
                onChange={(e) => setDraft((d) => ({ ...d, fieldType: e.target.value }))}
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn-primary" onClick={add}>
              Add Field
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
