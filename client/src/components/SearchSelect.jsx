import { useEffect, useMemo, useRef, useState } from 'react';

// A reusable, lightweight searchable selector. Renders a compact "selected"
// summary once a value is chosen and only opens its list when the input is
// clicked/focused. Filters client-side over an already-bounded options list
// (callers fetch a capped set), so it stays fast with hundreds of records.
export default function SearchSelect({
  options = [],
  value,
  onChange,
  getKey = (o) => o.id,
  getLabel = (o) => o.name,
  getSub,
  getSearch,
  placeholder = 'Search…',
  recentLimit = 10,
  recentHint = 'Showing latest 10 — type to search',
  disabled = false,
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const selected = useMemo(
    () => options.find((o) => String(getKey(o)) === String(value ?? '')),
    [options, value, getKey],
  );

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setQuery(''); }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const q = query.trim().toLowerCase();
  const searchText = (o) => (getSearch ? getSearch(o) : `${getLabel(o)} ${getSub ? getSub(o) || '' : ''}`).toLowerCase();

  const recent = useMemo(() => {
    const arr = [...options];
    if (arr[0] && arr[0].id != null) arr.sort((a, b) => (b.id || 0) - (a.id || 0));
    return arr.slice(0, recentLimit);
  }, [options, recentLimit]);

  const list = q ? options.filter((o) => searchText(o).includes(q)).slice(0, 50) : recent;

  if (selected && !open) {
    return (
      <button
        type="button"
        disabled={disabled}
        className="input flex w-full items-center justify-between text-left"
        onClick={() => !disabled && setOpen(true)}
      >
        <span className="min-w-0 truncate">
          <span className="font-medium">{getLabel(selected)}</span>
          {getSub && getSub(selected) ? <span className="text-slate-500"> · {getSub(selected)}</span> : null}
        </span>
        {!disabled && <span className="ml-2 shrink-0 text-xs font-medium text-brand-600">Change</span>}
      </button>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <input
        className="input"
        autoFocus={open}
        placeholder={placeholder}
        value={query}
        disabled={disabled}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
      />
      {open && (
        <div className="scroll-thin absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-cream-300 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {list.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-400">No matches</p>
          ) : (
            list.map((o) => (
              <button
                key={getKey(o)}
                type="button"
                className="block w-full border-b border-cream-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-cream-100 dark:border-slate-700 dark:hover:bg-slate-700"
                onClick={() => { onChange(getKey(o)); setOpen(false); setQuery(''); }}
              >
                <span className="font-medium text-slate-800 dark:text-slate-100">{getLabel(o)}</span>
                {getSub && getSub(o) ? <span className="block text-xs text-slate-400">{getSub(o)}</span> : null}
              </button>
            ))
          )}
          {!q && options.length > recentLimit && <p className="px-3 py-1.5 text-[11px] text-slate-400">{recentHint}</p>}
        </div>
      )}
    </div>
  );
}
