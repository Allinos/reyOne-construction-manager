import { useEffect, useState, useCallback } from 'react';
import { listRequirements, createRequirement, updateRequirement, deleteRequirement } from './api';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { errorMessage } from '../../lib/api';
import { Spinner } from '../../components/ui';

const DEFAULT_COLS = 5;
const DEFAULT_ROWS = 50;
const makeGrid = () => ({
  columns: Array.from({ length: DEFAULT_COLS }, (_, i) => `Column ${i + 1}`),
  rows: Array.from({ length: DEFAULT_ROWS }, () => Array.from({ length: DEFAULT_COLS }, () => '')),
});

function TableCard({ item, canEdit, onDelete }) {
  const toast = useToast();
  const [title, setTitle] = useState(item.title || '');
  const [columns, setColumns] = useState(item.content?.columns?.length ? item.content.columns : makeGrid().columns);
  const [rows, setRows] = useState(item.content?.rows?.length ? item.content.rows : makeGrid().rows);
  const [saving, setSaving] = useState(false);

  const setHeader = (ci, val) => setColumns((cs) => cs.map((c, i) => (i === ci ? val : c)));
  const setCell = (ri, ci, val) => setRows((rs) => rs.map((r, i) => (i === ri ? r.map((c, j) => (j === ci ? val : c)) : r)));

  const addColumn = () => {
    setColumns((cs) => [...cs, `Column ${cs.length + 1}`]);
    setRows((rs) => rs.map((r) => [...r, '']));
  };
  const removeColumn = (ci) => {
    if (columns.length <= 1) return;
    setColumns((cs) => cs.filter((_, i) => i !== ci));
    setRows((rs) => rs.map((r) => r.filter((_, j) => j !== ci)));
  };
  const addRow = () => setRows((rs) => [...rs, columns.map(() => '')]);
  const removeRow = (ri) => setRows((rs) => rs.filter((_, i) => i !== ri));

  const save = async () => {
    setSaving(true);
    try {
      await updateRequirement(item.id, { title, content: { columns, rows } });
      toast.success('Table saved');
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };

  return (
    <div className="rounded-lg border border-cream-300 p-4 dark:border-slate-700">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className="input font-medium sm:w-64" placeholder="Table name" value={title} disabled={!canEdit} onChange={(e) => setTitle(e.target.value)} />
        {canEdit && (
          <>
            <button className="btn-secondary py-1.5" onClick={addRow}>+ Row</button>
            <button className="btn-secondary py-1.5" onClick={addColumn}>+ Column</button>
          </>
        )}
      </div>

      <div className="overflow-auto rounded-lg border border-cream-200 dark:border-slate-700" style={{ maxHeight: '55vh' }}>
        <table className="border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-cream-100 dark:bg-slate-800">
            <tr>
              <th className="w-10 border border-cream-300 px-1 py-1 text-xs text-slate-400 dark:border-slate-600">#</th>
              {columns.map((c, ci) => (
                <th key={ci} className="border border-cream-300 p-0 dark:border-slate-600">
                  <div className="flex items-center">
                    <input
                      className="w-32 bg-transparent px-2 py-1.5 font-medium text-slate-700 outline-none dark:text-slate-100"
                      value={c}
                      disabled={!canEdit}
                      onChange={(e) => setHeader(ci, e.target.value)}
                    />
                    {canEdit && columns.length > 1 && (
                      <button className="px-1 text-slate-300 hover:text-red-500" title="Delete column" onClick={() => removeColumn(ci)}>&times;</button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="group">
                <td className="border border-cream-300 px-1 py-1 text-center text-xs text-slate-400 dark:border-slate-600">
                  {canEdit ? (
                    <button className="hover:text-red-500" title="Delete row" onClick={() => removeRow(ri)}>{ri + 1}</button>
                  ) : ri + 1}
                </td>
                {columns.map((_, ci) => (
                  <td key={ci} className="border border-cream-300 p-0 dark:border-slate-600">
                    <input
                      className="w-32 bg-transparent px-2 py-1.5 outline-none focus:bg-brand-50 dark:text-slate-100 dark:focus:bg-slate-700"
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

      {canEdit && (
        <div className="mt-3 flex justify-end gap-2">
          <button className="pill-delete" onClick={onDelete}>Delete Table</button>
          <button className="btn-primary py-1.5" onClick={save} disabled={saving}>{saving ? <Spinner className="h-4 w-4" /> : 'Save'}</button>
        </div>
      )}
    </div>
  );
}

// Tab 3 — Excel-style editable grid(s). Each grid defaults to 50 rows × 5 columns.
export default function TableTab({ projectId, canEdit }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState(null);

  const load = useCallback(() => {
    listRequirements(projectId, 'TABLE').then(setItems).catch((e) => toast.error(errorMessage(e)));
  }, [projectId, toast]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    try {
      const grid = makeGrid();
      const item = await createRequirement({ projectId, kind: 'TABLE', title: '', content: grid });
      setItems((list) => [...list, item]);
    } catch (e) { toast.error(errorMessage(e)); }
  };
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
    <div className="space-y-4">
      {canEdit && <button className="btn-secondary" onClick={add}>+ Add Table</button>}
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">No tables yet.</p>
      ) : (
        items.map((it) => <TableCard key={it.id} item={it} canEdit={canEdit} onDelete={() => remove(it)} />)
      )}
    </div>
  );
}
