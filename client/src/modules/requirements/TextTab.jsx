import { useEffect, useState, useCallback, useRef } from 'react';
import { listRequirements, createRequirement, updateRequirement, deleteRequirement } from './api';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { errorMessage } from '../../lib/api';
import { Spinner } from '../../components/ui';
import { useLocalStorage } from './useLocalStorage';
import CardGrid from './CardGrid';
import ItemModal from './ItemModal';

// The full editor for one text requirement. The textarea is user-resizable and
// its height is remembered per-item on this device (client-side only).
function TextEditor({ item, canEdit, onClose, onSaved }) {
  const toast = useToast();
  const [title, setTitle] = useState(item.title || '');
  const [text, setText] = useState(item.content?.text || '');
  const [height, setHeight] = useLocalStorage(`req:text:${item.id}:h`, 260);
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);

  const persistHeight = () => { if (ref.current) setHeight(ref.current.offsetHeight); };

  const save = async () => {
    setSaving(true);
    try {
      const updated = await updateRequirement(item.id, { title: title || '', content: { text } });
      toast.success('Saved');
      onSaved(updated);
      onClose();
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };

  return (
    <ItemModal
      title={title || 'Text Requirement'}
      onClose={onClose}
      footer={canEdit && (
        <>
          <button className="btn-secondary" onClick={onClose}>Close</button>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? <Spinner className="h-4 w-4" /> : 'Save'}</button>
        </>
      )}
    >
      <div className="mx-auto max-w-3xl space-y-3">
        <div>
          <label className="label">Title</label>
          <input className="input font-medium" placeholder="Title" value={title} disabled={!canEdit} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="label">Details <span className="text-xs font-normal text-slate-400">(drag the corner to resize)</span></label>
          <textarea
            ref={ref}
            className="input resize-y"
            style={{ height }}
            placeholder="Describe the requirement in detail…"
            value={text}
            disabled={!canEdit}
            onMouseUp={persistHeight}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
      </div>
    </ItemModal>
  );
}

// Tab 1 — Text Requirements as saved cards.
export default function TextTab({ projectId, canEdit }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(null);

  const load = useCallback(() => {
    listRequirements(projectId, 'TEXT').then(setItems).catch((e) => toast.error(errorMessage(e)));
  }, [projectId, toast]);
  useEffect(() => { load(); }, [load]);

  const add = async (title) => {
    try {
      const item = await createRequirement({ projectId, kind: 'TEXT', title, content: { text: '' } });
      setItems((list) => [...list, item]);
      setOpen(item);
    } catch (e) { toast.error(errorMessage(e)); }
  };
  const onSaved = (updated) => setItems((list) => list.map((x) => (x.id === updated.id ? updated : x)));
  const remove = async (it) => {
    const ok = await confirm({ title: 'Delete requirement?', message: 'This text requirement will be removed.', confirmLabel: 'Delete' });
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
        icon="text"
        canEdit={canEdit}
        addLabel="Add Requirement"
        emptyLabel="No text requirements yet."
        titleOf={(it) => it.title}
        onAdd={add}
        onOpen={setOpen}
        onDelete={remove}
      />
      {open && <TextEditor item={open} canEdit={canEdit} onClose={() => setOpen(null)} onSaved={onSaved} />}
    </>
  );
}
