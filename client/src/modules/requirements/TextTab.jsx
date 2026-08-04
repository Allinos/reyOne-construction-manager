import { useEffect, useState, useCallback } from 'react';
import { listRequirements, createRequirement, updateRequirement, deleteRequirement } from './api';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { errorMessage } from '../../lib/api';
import { Spinner } from '../../components/ui';

// Tab 1 — Text Requirements: multiple free-form, multiline entries, each with an
// optional title. Every entry is an independent TEXT requirement row.
export default function TextTab({ projectId, canEdit }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState(null);
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(() => {
    listRequirements(projectId, 'TEXT').then(setItems).catch((e) => toast.error(errorMessage(e)));
  }, [projectId, toast]);

  useEffect(() => { load(); }, [load]);

  const patch = (id, key, value) =>
    setItems((list) => list.map((it) => (it.id === id ? { ...it, [key]: value } : it)));

  const add = async () => {
    try {
      const item = await createRequirement({ projectId, kind: 'TEXT', title: '', content: { text: '' } });
      setItems((list) => [...list, item]);
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const save = async (it) => {
    setSavingId(it.id);
    try {
      await updateRequirement(it.id, { title: it.title || '', content: { text: it.content?.text || '' } });
      toast.success('Saved');
    } catch (e) { toast.error(errorMessage(e)); } finally { setSavingId(null); }
  };

  const remove = async (it) => {
    const ok = await confirm({ title: 'Delete entry?', message: 'This text requirement will be removed.', confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      await deleteRequirement(it.id);
      setItems((list) => list.filter((x) => x.id !== it.id));
    } catch (e) { toast.error(errorMessage(e)); }
  };

  if (items === null) return <div className="flex justify-center p-8"><Spinner /></div>;

  return (
    <div className="space-y-4">
      {canEdit && (
        <button className="btn-secondary" onClick={add}>+ Add Requirement</button>
      )}
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">No text requirements yet.</p>
      ) : (
        items.map((it) => (
          <div key={it.id} className="rounded-lg border border-cream-300 p-4 dark:border-slate-700">
            <input
              className="input mb-2 font-medium"
              placeholder="Title (optional)"
              value={it.title || ''}
              disabled={!canEdit}
              onChange={(e) => patch(it.id, 'title', e.target.value)}
            />
            <textarea
              className="input min-h-[120px]"
              placeholder="Describe the requirement in detail…"
              value={it.content?.text || ''}
              disabled={!canEdit}
              onChange={(e) => patch(it.id, 'content', { text: e.target.value })}
            />
            {canEdit && (
              <div className="mt-2 flex justify-end gap-2">
                <button className="pill-delete" onClick={() => remove(it)}>Delete</button>
                <button className="btn-primary py-1.5" onClick={() => save(it)} disabled={savingId === it.id}>
                  {savingId === it.id ? <Spinner className="h-4 w-4" /> : 'Save'}
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
