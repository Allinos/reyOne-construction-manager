import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Searchable multi-select with chips — the multi-value companion of <Select>.
 * options: [{ value, label, sub? }]; value: array of option values.
 * Keyboard: ↑/↓ to move, Enter/Space to toggle, Backspace removes the last
 * chip, Esc closes. Handles hundreds of options (search filters; list scrolls).
 */
export default function MultiSelect({
  options = [],
  value = [],
  onChange,
  placeholder = 'Select…',
  loading = false,
  disabled = false,
  emptyText = 'Nothing to choose from',
  max,
  className = '',
  'aria-label': ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState(null);
  const boxRef = useRef(null);
  const popRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const selected = new Set(value.map(String));
  const q = query.trim().toLowerCase();
  const list = q ? options.filter((o) => `${o.label} ${o.sub || ''}`.toLowerCase().includes(q)) : options;
  const byValue = new Map(options.map((o) => [String(o.value), o]));

  const place = useCallback(() => {
    const r = boxRef.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom;
    const up = below < 240 && r.top > below;
    setPos({ left: r.left, width: r.width, top: up ? undefined : r.bottom + 4, bottom: up ? window.innerHeight - r.top + 4 : undefined, maxH: Math.max(160, Math.min(300, (up ? r.top : below) - 12)) });
  }, []);
  useLayoutEffect(() => { if (open) place(); }, [open, place, value.length]);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (!boxRef.current?.contains(e.target) && !popRef.current?.contains(e.target)) { setOpen(false); setQuery(''); } };
    const onScroll = (e) => { if (!popRef.current?.contains(e.target)) place(); };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', place);
    return () => { document.removeEventListener('mousedown', onDoc); window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', place); };
  }, [open, place]);
  useEffect(() => { listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' }); }, [active]);

  const toggle = (o) => {
    if (!o) return;
    const v = String(o.value);
    if (selected.has(v)) onChange(value.filter((x) => String(x) !== v));
    else if (!max || value.length < max) onChange([...value, o.value]);
    inputRef.current?.focus();
  };
  const onKey = (e) => {
    if (disabled) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, list.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if ((e.key === 'Enter' || (e.key === ' ' && !query)) && open) { e.preventDefault(); toggle(list[active]); }
    else if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); }
    else if (e.key === 'Backspace' && !query && value.length) onChange(value.slice(0, -1));
  };

  return (
    <>
      <div
        ref={boxRef}
        className={`input flex min-h-[38px] cursor-text flex-wrap items-center gap-1 py-1 ${disabled ? 'cursor-not-allowed opacity-60' : ''} ${className}`}
        onClick={() => { if (!disabled) { setOpen(true); inputRef.current?.focus(); } }}
      >
        {value.map((v) => {
          const o = byValue.get(String(v));
          return (
            <span key={v} className="inline-flex items-center gap-1 rounded-md bg-brand-50 py-0.5 pl-2 pr-1 text-xs font-medium text-brand-800 dark:bg-slate-700 dark:text-slate-100">
              {o?.label || v}
              {!disabled && <button type="button" className="rounded px-0.5 text-brand-700 hover:text-red-600 dark:text-slate-300" aria-label={`Remove ${o?.label || v}`} onClick={(e) => { e.stopPropagation(); toggle(o || { value: v }); }}>×</button>}
            </span>
          );
        })}
        <input
          ref={inputRef}
          disabled={disabled}
          aria-label={ariaLabel || placeholder}
          role="combobox"
          aria-expanded={open}
          className="min-w-[6rem] flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-slate-400"
          placeholder={value.length ? '' : loading ? 'Loading…' : placeholder}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
        />
        {value.length > 0 && !disabled && (
          <button type="button" className="ml-auto px-1 text-slate-400 hover:text-red-600" aria-label="Clear all" onClick={(e) => { e.stopPropagation(); onChange([]); }}>×</button>
        )}
      </div>
      {open && pos && createPortal(
        <div ref={popRef} className="fixed z-[200] flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl ring-1 ring-black/5 dark:border-slate-600 dark:bg-slate-800" style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxH }}>
          <ul ref={listRef} role="listbox" aria-multiselectable="true" className="scroll-thin flex-1 overflow-y-auto py-1">
            {loading && <li className="px-3 py-2 text-sm text-slate-400">Loading…</li>}
            {!loading && list.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">{q ? 'No matches' : emptyText}</li>}
            {list.map((o, i) => {
              const on = selected.has(String(o.value));
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    data-idx={i}
                    role="option"
                    aria-selected={on}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${i === active ? 'bg-brand-50 dark:bg-slate-700' : ''}`}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => toggle(o)}
                  >
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? 'border-brand-600 bg-brand-500 text-brand-900' : 'border-slate-300 dark:border-slate-500'}`}>
                      {on && <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.8 6.8-6.8a1 1 0 0 1 1.4 0z" clipRule="evenodd" /></svg>}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">{o.label}</span>
                    {o.sub && <span className="shrink-0 text-xs text-slate-400">{o.sub}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          {options.length > 0 && (
            <div className="flex justify-between border-t border-slate-100 px-3 py-1.5 text-xs dark:border-slate-700">
              <span className="text-slate-400">{value.length} selected</span>
              <span className="flex gap-3">
                {!max && <button type="button" className="font-medium text-brand-600" onMouseDown={(e) => e.preventDefault()} onClick={() => onChange([...new Set([...value, ...list.map((o) => o.value)])])}>Select {q ? 'matches' : 'all'}</button>}
                <button type="button" className="text-slate-500 hover:text-red-600" onMouseDown={(e) => e.preventDefault()} onClick={() => onChange([])}>Clear</button>
              </span>
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
