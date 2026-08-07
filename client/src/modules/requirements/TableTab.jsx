import { useEffect, useState, useCallback } from 'react';
import { listRequirements, createRequirement, updateRequirement, deleteRequirement } from './api';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { errorMessage } from '../../lib/api';
import { Spinner } from '../../components/ui';
import { useLocalStorage } from './useLocalStorage';
import CardGrid from './CardGrid';
import ItemModal from './ItemModal';

const DEFAULT_COLS = 5;
const DEFAULT_ROWS = 10;
const DEFAULT_W = 128;
const DEFAULT_H = 34;
const makeGrid = () => ({
  columns: Array.from({ length: DEFAULT_COLS }, (_, i) => `Column ${i + 1}`),
  rows: Array.from({ length: DEFAULT_ROWS }, () => Array.from({ length: DEFAULT_COLS }, () => '')),
});

function TableEditor({ item, canEdit, onClose, onSaved }) {
  const toast = useToast();
  const [title, setTitle] = useState(item.title || '');
  const [columns, setColumns] = useState(item.content?.columns?.length ? item.content.columns : makeGrid().columns);
  const [rows, setRows] = useState(item.content?.rows?.length ? item.content.rows : makeGrid().rows);
  // Sizing is a per-device preference — stored client-side, never sent to the API.
  const [widths, setWidths] = useLocalStorage(`req:table:${item.id}:w`, {});
  const [heights, setHeights] = useLocalStorage(`req:table:${item.id}:h`, {});
  const [saving, setSaving] = useState(false);

  const widthOf = (ci) => widths[ci] || DEFAULT_W;
  const heightOf = (ri) => heights[ri] || DEFAULT_H;

  const setHeader = (ci, val) => setColumns((cs) => cs.map((c, i) => (i === ci ? val : c)));
  const setCell = (ri, ci, val) => setRows((rs) => rs.map((r, i) => (i === ri ? r.map((c, j) => (j === ci ? val : c)) : r)));

  const addColumn = () => { setColumns((cs) => [...cs, `Column ${cs.length + 1}`]); setRows((rs) => rs.map((r) => [...r, ''])); };
  const removeColumn = (ci) => {
    if (columns.length <= 1) return;
    setColumns((cs) => cs.filter((_, i) => i !== ci));
    setRows((rs) => rs.map((r) => r.filter((_, j) => j !== ci)));
  };
  const addRow = () => setRows((rs) => [...rs, columns.map(() => '')]);
  const removeRow = (ri) => setRows((rs) => rs.filter((_, i) => i !== ri));

  // Drag-to-resize a column width / row height, persisting the result.
  const startColResize = (ci, e) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX; const startW = widthOf(ci);
    const move = (ev) => setWidths((w) => ({ ...w, [ci]: Math.max(48, startW + ev.clientX - startX) }));
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  const startRowResize = (ri, e) => {
    e.preventDefault(); e.stopPropagation();
    const startY = e.clientY; const startH = heightOf(ri);
    const move = (ev) => setHeights((h) => ({ ...h, [ri]: Math.max(26, startH + ev.clientY - startY) }));
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };

  const save = async () => {
    setSaving(true);
    try {
      const updated = await updateRequirement(item.id, { title: title || '', content: { columns, rows } });
      toast.success('Table saved');
      onSaved(updated);
      onClose();
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };

  return (
    <ItemModal
      title={title || 'Table'}
      onClose={onClose}
      footer={canEdit && (
        <>
          <button className="btn-secondary" onClick={onClose}>Close</button>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? <Spinner className="h-4 w-4" /> : 'Save'}</button>
        </>
      )}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className="input font-medium sm:w-64" placeholder="Table name" value={title} disabled={!canEdit} onChange={(e) => setTitle(e.target.value)} />
        {canEdit && (
          <>
            <button className="btn-secondary py-1.5" onClick={addRow}>+ Row</button>
            <button className="btn-secondary py-1.5" onClick={addColumn}>+ Column</button>
            <span className="text-xs text-slate-400">Drag column/row edges to resize</span>
          </>
        )}
      </div>

      <div className="overflow-auto rounded-lg border border-cream-200 dark:border-slate-700">
        <table className="border-collapse text-sm" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 40 }} />
            {columns.map((_, ci) => <col key={ci} style={{ width: widthOf(ci) }} />)}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-cream-100 dark:bg-slate-800">
            <tr>
              <th className="border border-cream-300 px-1 py-1 text-xs text-slate-400 dark:border-slate-600">#</th>
              {columns.map((c, ci) => (
                <th key={ci} className="relative border border-cream-300 p-0 dark:border-slate-600">
                  <div className="flex items-center">
                    <input
                      className="w-full bg-transparent px-2 py-1.5 font-medium text-slate-700 outline-none dark:text-slate-100"
                      value={c}
                      disabled={!canEdit}
                      onChange={(e) => setHeader(ci, e.target.value)}
                    />
                    {canEdit && columns.length > 1 && (
                      <button className="px-1 text-slate-300 hover:text-red-500" title="Delete column" onClick={() => removeColumn(ci)}>&times;</button>
                    )}
                  </div>
                  {canEdit && (
                    <div
                      onPointerDown={(e) => startColResize(ci, e)}
                      className="absolute -right-0.5 top-0 z-20 h-full w-1.5 cursor-col-resize hover:bg-brand-400/60"
                      title="Resize column"
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} style={{ height: heightOf(ri) }}>
                <td className="relative border border-cream-300 px-1 text-center text-xs text-slate-400 dark:border-slate-600">
                  {canEdit ? (
                    <button className="hover:text-red-500" title="Delete row" onClick={() => removeRow(ri)}>{ri + 1}</button>
                  ) : ri + 1}
                  {canEdit && (
                    <div
                      onPointerDown={(e) => startRowResize(ri, e)}
                      className="absolute bottom-0 left-0 z-20 h-1.5 w-full cursor-row-resize hover:bg-brand-400/60"
                      title="Resize row"
                    />
                  )}
                </td>
                {columns.map((_, ci) => (
                  <td key={ci} className="border border-cream-300 p-0 align-top dark:border-slate-600">
                    <input
                      className="h-full w-full bg-transparent px-2 py-1.5 outline-none focus:bg-brand-50 dark:text-slate-100 dark:focus:bg-slate-700"
                      value={row[ci] ?? ''}
                      disabled={!canEdit}
                      onChange={(e) => setCell(ri, ci, e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ItemModal>
  );
}

// Tab 3 — Excel-style tables as saved cards.
export default function TableTab({ projectId, canEdit }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(null);

  const load = useCallback(() => {
    listRequirements(projectId, 'TABLE').then(setItems).catch((e) => toast.error(errorMessage(e)));
  }, [projectId, toast]);
  useEffect(() => { load(); }, [load]);

  const add = async (title) => {
    try {
      const item = await createRequirement({ projectId, kind: 'TABLE', title, content: makeGrid() });
      setItems((list) => [...list, item]);
      setOpen(item);
    } catch (e) { toast.error(errorMessage(e)); }
  };
  const onSaved = (updated) => setItems((list) => list.map((x) => (x.id === updated.id ? updated : x)));
  const remove = async (it) => {
    const ok = await confirm({ title: 'Delete table?', message: 'This spreadsheet will be removed.', confirmLabel: 'Delete' });
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
        icon="table"
        canEdit={canEdit}
        addLabel="Add Table"
        emptyLabel="No tables yet."
        titleOf={(it) => it.title}
        onAdd={add}
        onOpen={setOpen}
        onDelete={remove}
      />
      {open && <TableEditor item={open} canEdit={canEdit} onClose={() => setOpen(null)} onSaved={onSaved} />}
    </>
  );
}
