import { Children, isValidElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Drop-in replacement for the native <select>. Accepts the same children
// (<option>, <optgroup>, fragments, arrays) and calls onChange with a
// native-like event ({ target: { value, name } }), so existing handlers that
// read `e.target.value` keep working. Adds a search box (shown automatically
// when there are more than 7 options), keyboard navigation and a popover that
// renders in a portal so it is never clipped by scrolling cards or modals.

function flatten(children, group = null, out = []) {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === 'option') {
      const { value, children: label, disabled } = child.props;
      const text = Children.toArray(label).join('');
      out.push({ value: value === undefined ? text : String(value), label: text, disabled: !!disabled, group });
    } else if (child.type === 'optgroup') {
      flatten(child.props.children, child.props.label, out);
    } else if (child.props?.children) {
      flatten(child.props.children, group, out);
    }
  });
  return out;
}

export default function Select({
  value,
  defaultValue,
  onChange,
  children,
  className = 'input',
  disabled = false,
  name,
  id,
  required,
  searchable,
  placeholder = 'Select…',
  title,
  clearable = false,
  loading = false,
  emptyText = 'No matches',
  'aria-label': ariaLabel,
}) {
  const options = useMemo(() => flatten(children), [children]);
  const [inner, setInner] = useState(defaultValue ?? '');
  const current = String(value !== undefined ? value ?? '' : inner);
  const selected = options.find((o) => o.value === current);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const popRef = useRef(null);
  const listRef = useRef(null);
  const showSearch = searchable ?? options.length > 7;

  const q = query.trim().toLowerCase();
  const list = q ? options.filter((o) => `${o.label} ${o.group || ''}`.toLowerCase().includes(q)) : options;

  const place = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const spaceBelow = window.innerHeight - r.bottom;
    const maxH = 300;
    const up = spaceBelow < 220 && r.top > spaceBelow;
    setPos({
      left: Math.min(r.left, window.innerWidth - Math.max(r.width, 200) - 8),
      width: Math.max(r.width, 200),
      top: up ? undefined : r.bottom + 4,
      bottom: up ? window.innerHeight - r.top + 4 : undefined,
      maxH: Math.min(maxH, (up ? r.top : spaceBelow) - 12),
    });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (btnRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onScroll = (e) => {
      if (popRef.current?.contains(e.target)) return;
      place();
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', place);
    };
  }, [open, place]);

  useEffect(() => {
    if (open) {
      setQuery('');
      const i = options.findIndex((o) => o.value === current);
      setActive(i < 0 ? 0 : i);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const choose = (o) => {
    if (!o || o.disabled) return;
    if (value === undefined) setInner(o.value);
    setOpen(false);
    btnRef.current?.focus();
    if (o.value !== current) onChange?.({ target: { value: o.value, name }, currentTarget: { value: o.value, name } });
  };

  const onKey = (e) => {
    if (disabled) return;
    if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, list.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(list[active]); }
    else if (e.key === 'Tab') setOpen(false);
  };

  // Strip the native-select-only width hacks; keep the caller's sizing/colour classes.
  const btnClass = `${className}${/\bw-auto\b/.test(className) ? ' min-w-[9rem]' : ''} flex items-center justify-between gap-2 text-left ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`;

  let lastGroup = null;
  return (
    <>
      <button
        ref={btnRef}
        id={id}
        type="button"
        title={title}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        className={btnClass}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKey}
      >
        <span className={`min-w-0 truncate ${selected && selected.value !== '' ? '' : selected ? '' : 'text-slate-400'}`}>
          {loading && !selected ? 'Loading…' : selected ? selected.label : placeholder}
        </span>
        {clearable && current !== '' && !disabled && (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Clear selection"
            className="-mr-1 ml-auto rounded px-1 text-slate-400 hover:text-red-600"
            onClick={(e) => { e.stopPropagation(); if (value === undefined) setInner(''); onChange?.({ target: { value: '', name }, currentTarget: { value: '', name } }); }}
          >
            ×
          </span>
        )}
        <svg className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.06l3.71-3.83a.75.75 0 1 1 1.08 1.04l-4.25 4.39a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {name && <input type="hidden" name={name} value={current} required={required} />}
      {open && pos && createPortal(
        <div
          ref={popRef}
          className="fixed z-[200] flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl ring-1 ring-black/5 dark:border-slate-600 dark:bg-slate-800"
          style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: Math.max(pos.maxH, 160) }}
          onKeyDown={onKey}
        >
          {showSearch && (
            <div className="border-b border-slate-100 p-1.5 dark:border-slate-700">
              <input
                autoFocus
                className="w-full rounded-md bg-slate-50 px-2.5 py-1.5 text-sm outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-brand-100 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Search…"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
              />
            </div>
          )}
          <ul ref={listRef} role="listbox" className="scroll-thin flex-1 overflow-y-auto py-1" tabIndex={-1}>
            {loading && <li className="px-3 py-2 text-sm text-slate-400">Loading…</li>}
            {!loading && list.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">{q ? 'No matches' : emptyText}</li>}
            {list.map((o, i) => {
              const header = o.group && o.group !== lastGroup ? o.group : null;
              lastGroup = o.group;
              return (
                <li key={`${o.group || ''}:${o.value}:${i}`}>
                  {header && <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{header}</p>}
                  <button
                    type="button"
                    data-idx={i}
                    role="option"
                    aria-selected={o.value === current}
                    disabled={o.disabled}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm ${
                      i === active ? 'bg-brand-50 text-brand-700 dark:bg-slate-700 dark:text-white' : 'text-slate-700 dark:text-slate-200'
                    } ${o.disabled ? 'cursor-not-allowed opacity-40' : ''} ${o.value === '' ? 'text-slate-400' : ''}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(o)}
                  >
                    <span className="truncate">{o.label}</span>
                    {o.value === current && (
                      <svg className="h-4 w-4 shrink-0 text-brand-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.8 6.8-6.8a1 1 0 0 1 1.4 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>,
        document.body,
      )}
    </>
  );
}
