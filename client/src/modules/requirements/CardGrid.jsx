import { useEffect, useRef, useState } from 'react';
import Icon from '../../components/Icon';

// A compact card representing a saved requirement / form / table. Shows an icon,
// the title, and a three-dot menu with a Delete action.
function ItemCard({ item, icon, title, canEdit, onOpen, onDelete }) {
  const [menu, setMenu] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!menu) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setMenu(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menu]);

  return (
    <div className="group relative flex h-28 flex-col justify-between rounded-xl border border-cream-300 bg-white p-3 text-left shadow-sm transition hover:border-brand-400 hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
      <button className="flex h-full w-full flex-col items-start gap-2 text-left" onClick={() => onOpen(item)}>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-slate-700">
          <Icon name={icon} className="h-5 w-5" />
        </span>
        <span className="line-clamp-2 w-full pr-5 text-sm font-medium text-slate-800 dark:text-slate-100">
          {title || 'Untitled'}
        </span>
      </button>
      {canEdit && (
        <div className="absolute right-1 top-1" ref={ref}>
          <button
            className="rounded-full px-2 py-0.5 text-lg leading-none text-slate-400 hover:bg-cream-200 hover:text-slate-600 dark:hover:bg-slate-700"
            onClick={(e) => { e.stopPropagation(); setMenu((m) => !m); }}
            aria-label="Options"
          >
            &#8942;
          </button>
          {menu && (
            <div className="absolute right-0 z-10 mt-1 w-32 overflow-hidden rounded-lg border border-cream-300 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
              <button
                className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-slate-700"
                onClick={() => { setMenu(false); onDelete(item); }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// The grid of saved cards plus the "+ Add" control. `onAdd(title)` is called
// after the user names the new item in a small inline dialog.
export default function CardGrid({ items, icon, canEdit, addLabel, titleOf, onAdd, onOpen, onDelete, emptyLabel }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await onAdd(title.trim());
      setTitle('');
      setAdding(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {canEdit && !adding && (
        <button className="btn-secondary" onClick={() => setAdding(true)}>+ {addLabel}</button>
      )}
      {canEdit && adding && (
        <form onSubmit={submit} className="flex flex-wrap items-center gap-2 rounded-lg border border-cream-300 p-3 dark:border-slate-700">
          <input
            autoFocus
            className="input flex-1 min-w-[180px]"
            placeholder="Enter a title / name…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button type="submit" className="btn-primary" disabled={busy}>Create</button>
          <button type="button" className="btn-secondary" onClick={() => { setAdding(false); setTitle(''); }}>Cancel</button>
        </form>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-slate-400">{emptyLabel}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((it) => (
            <ItemCard
              key={it.id}
              item={it}
              icon={icon}
              title={titleOf(it)}
              canEdit={canEdit}
              onOpen={onOpen}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
