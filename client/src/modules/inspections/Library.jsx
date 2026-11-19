import { useEffect, useMemo, useState } from 'react';
import Modal from '../../components/Modal';
import Icon from '../../components/Icon';
import Select from '../../components/Select';
import { Spinner } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { errorMessage } from '../../lib/api';
import * as api from './api';

export const KINDS = {
  check: { label: 'Check', icon: 'check', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200', hint: 'Pass / Fail / Action / N/A' },
  photo: { label: 'Photo', icon: 'photo', cls: 'bg-sky-50 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300', hint: 'Photo must be uploaded' },
  document: { label: 'Document', icon: 'invoice', cls: 'bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300', hint: 'Record / certificate must be received' },
  measure: { label: 'Reading', icon: 'sliders', cls: 'bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300', hint: 'A value is recorded' },
};
export const CATEGORIES = {
  quality: 'Quality / workmanship',
  safety: 'Safety',
  mep: 'MEP services',
  evidence: 'Photos & evidence',
  handover: 'Handover',
  other: 'Other',
};

export function KindBadge({ kind }) {
  const k = KINDS[kind] || KINDS.check;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${k.cls}`} title={k.hint}>
      <Icon name={k.icon} className="h-3 w-3" />{k.label}
    </span>
  );
}

const blankType = () => ({ key: '', name: 'New inspection type', category: 'quality', description: '', items: [] });

/**
 * Manage the predefined inspection list: inspection types and the requirements
 * inside each (checks, photos, documents, readings). Opened from the gear icon
 * on the Site Inspection page.
 */
export function LibraryManager({ onClose, onSaved }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [types, setTypes] = useState(null);
  const [sel, setSel] = useState(0);
  const [q, setQ] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ text: '', kind: 'check' });

  useEffect(() => { api.getTemplates().then(setTypes).catch((e) => { toast.error(errorMessage(e)); setTypes([]); }); }, [toast]);

  const change = (fn) => { setTypes((t) => fn(t)); setDirty(true); };
  const cur = types?.[sel];
  const patchCur = (patch) => change((t) => t.map((x, i) => (i === sel ? { ...x, ...patch } : x)));

  const addType = () => { change((t) => [...t, blankType()]); setSel(types.length); };
  const delType = async () => {
    if (!(await confirm({ title: 'Delete inspection type?', message: `"${cur.name}" and its ${cur.items.length} requirement(s) will be removed from the list. Existing inspections keep their checklist.`, confirmLabel: 'Delete' }))) return;
    change((t) => t.filter((_, i) => i !== sel));
    setSel(0);
  };
  const addItem = () => {
    if (!draft.text.trim()) return;
    patchCur({ items: [...cur.items, { text: draft.text.trim(), kind: draft.kind }] });
    setDraft({ text: '', kind: draft.kind });
  };
  const restore = async () => {
    try {
      const std = await api.getStandardLibrary();
      const have = new Set(types.map((t) => t.key));
      const missing = std.filter((t) => !have.has(t.key));
      if (!missing.length) { toast.success('All standard inspection types are already in your list'); return; }
      change((t) => [...t, ...missing]);
      toast.success(`${missing.length} standard type(s) added — click Save to keep them`);
    } catch (e) { toast.error(errorMessage(e)); }
  };
  const save = async () => {
    if (types.some((t) => !t.name.trim())) { toast.error('Every inspection type needs a name'); return; }
    setSaving(true);
    try {
      const saved = await api.saveLibrary(types);
      setTypes(saved);
      setDirty(false);
      toast.success('Inspection list saved');
      onSaved?.(saved);
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };
  const close = async () => {
    if (dirty && !(await confirm({ title: 'Discard changes?', message: 'You have unsaved changes to the inspection list.', confirmLabel: 'Discard' }))) return;
    onClose();
  };

  const visible = (types || []).map((t, i) => ({ t, i })).filter(({ t }) => !q || `${t.name} ${t.items.map((x) => x.text).join(' ')}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <Modal
      open
      onClose={close}
      wide
      fullscreenable
      dismissOnBackdrop={false}
      title="Inspection list"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <button className="btn-ghost text-brand-700" onClick={restore} disabled={!types}>Add missing standard types</button>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={close}>Close</button>
            <button className="btn-primary" disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}</button>
          </div>
        </div>
      }
    >
      {!types ? <div className="flex justify-center p-10"><Spinner /></div> : (
        <div className="grid min-h-[26rem] gap-4 md:grid-cols-[16rem_1fr]">
          {/* Types */}
          <div className="flex min-h-0 flex-col rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex gap-1.5 border-b border-slate-100 p-2 dark:border-slate-700">
              <input className="input py-1.5 text-sm" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
              <button className="btn-secondary btn-sm shrink-0" onClick={addType} title="New inspection type"><Icon name="add" className="h-3.5 w-3.5" /></button>
            </div>
            <ul className="scroll-thin max-h-[28rem] flex-1 overflow-y-auto p-1">
              {visible.map(({ t, i }) => (
                <li key={`${t.key}-${i}`}>
                  <button className={`w-full rounded-md px-2.5 py-2 text-left ${i === sel ? 'bg-brand-50 text-brand-800 dark:bg-slate-700 dark:text-white' : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'}`} onClick={() => setSel(i)}>
                    <span className="block truncate text-sm font-medium">{t.name || 'Untitled'}</span>
                    <span className="block text-[11px] text-slate-400">{CATEGORIES[t.category] || 'Other'} · {t.items.length} item{t.items.length === 1 ? '' : 's'}</span>
                  </button>
                </li>
              ))}
              {!visible.length && <li className="p-3 text-sm text-slate-400">No inspection types.</li>}
            </ul>
          </div>

          {/* Selected type */}
          {cur ? (
            <div className="min-w-0">
              <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
                <div><label className="label">Inspection type</label><input className="input" value={cur.name} onChange={(e) => patchCur({ name: e.target.value })} /></div>
                <div><label className="label">Category</label><Select className="input" value={cur.category} onChange={(e) => patchCur({ category: e.target.value })}>{Object.entries(CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></div>
                <div className="sm:col-span-2"><label className="label">When to use (optional)</label><input className="input" placeholder="e.g. Hold point before concreting" value={cur.description} onChange={(e) => patchCur({ description: e.target.value })} /></div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Requirements ({cur.items.length})</p>
                <button className="text-xs font-medium text-red-600 hover:underline" onClick={delType}>Delete this type</button>
              </div>
              <ul className="mt-1.5 divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
                {cur.items.map((it, j) => (
                  <li key={j} className="group flex items-center gap-2 px-3 py-2">
                    <span className="w-5 text-right text-xs text-slate-400">{j + 1}</span>
                    <input className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none focus:rounded focus:ring-2 focus:ring-brand-100 dark:text-slate-200" value={it.text} onChange={(e) => patchCur({ items: cur.items.map((x, k) => (k === j ? { ...x, text: e.target.value } : x)) })} />
                    <select className="rounded border-0 bg-transparent py-0 text-xs text-slate-500 focus:ring-1 focus:ring-brand-200" aria-label="Requirement type" value={it.kind} onChange={(e) => patchCur({ items: cur.items.map((x, k) => (k === j ? { ...x, kind: e.target.value } : x)) })}>
                      {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <KindBadge kind={it.kind} />
                    <button className="rounded p-1 text-slate-400 hover:text-red-600" aria-label="Delete requirement" title="Delete" onClick={() => patchCur({ items: cur.items.filter((_, k) => k !== j) })}><Icon name="trash" className="h-3.5 w-3.5" /></button>
                  </li>
                ))}
                {!cur.items.length && <li className="px-3 py-4 text-sm text-slate-400">No requirements yet — add the first one below.</li>}
              </ul>
              <div className="mt-2 flex flex-wrap gap-2">
                <input className="input min-w-[12rem] flex-1" placeholder="New requirement, e.g. Cover blocks provided" value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && addItem()} />
                <Select className="input w-36" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
                <button className="btn-secondary" onClick={addItem}>Add</button>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">Check = Pass/Fail · Photo = inspector must upload a photo · Document = a record/certificate must be received · Reading = a measured value is recorded.</p>
            </div>
          ) : (
            <div className="flex items-center justify-center text-sm text-slate-400">Add an inspection type to get started.</div>
          )}
        </div>
      )}
    </Modal>
  );
}

const QUICK = [
  { item: 'Site photographs (overall view)', kind: 'photo' },
  { item: 'Photo of current work progress', kind: 'photo' },
  { item: 'Document / test certificate received', kind: 'document' },
];

/**
 * Pick requirements from the inspection list, plus one-off custom ones.
 * value: [{ item, kind, type }]
 */
export function RequirementPicker({ library, value, onChange }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(() => new Set());
  const [custom, setCustom] = useState({ text: '', kind: 'check' });
  const keyOf = (r) => `${r.type || ''}::${r.item}`;
  const chosen = useMemo(() => new Set(value.map(keyOf)), [value]);

  const toggleItem = (type, it) => {
    const r = { item: it.text, kind: it.kind, type: type.name };
    onChange(chosen.has(keyOf(r)) ? value.filter((x) => keyOf(x) !== keyOf(r)) : [...value, r]);
  };
  const toggleType = (type) => {
    const rows = type.items.map((it) => ({ item: it.text, kind: it.kind, type: type.name }));
    const all = rows.every((r) => chosen.has(keyOf(r)));
    onChange(all ? value.filter((x) => x.type !== type.name) : [...value, ...rows.filter((r) => !chosen.has(keyOf(r)))]);
  };
  const addCustom = (r) => {
    const row = r || { item: custom.text.trim(), kind: custom.kind };
    if (!row.item) return;
    const withType = { ...row, type: 'Custom' };
    if (!chosen.has(keyOf(withType))) onChange([...value, withType]);
    if (!r) setCustom({ text: '', kind: custom.kind });
  };
  const flip = (k) => setOpen((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const ql = q.trim().toLowerCase();
  const types = library
    .map((t) => ({ ...t, shown: ql && !t.name.toLowerCase().includes(ql) ? t.items.filter((it) => it.text.toLowerCase().includes(ql)) : t.items }))
    .filter((t) => t.shown.length);

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_18rem]">
      <div className="min-w-0">
        <input className="input mb-2" placeholder="Search inspection types or requirements…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="scroll-thin max-h-[22rem] space-y-1.5 overflow-y-auto pr-1">
          {types.map((t) => {
            const picked = t.items.filter((it) => chosen.has(`${t.name}::${it.text}`)).length;
            const isOpen = open.has(t.key) || !!ql;
            return (
              <div key={t.key} className={`rounded-lg border ${picked ? 'border-brand-300 bg-brand-50/40 dark:border-brand-700 dark:bg-slate-800' : 'border-slate-200 dark:border-slate-700'}`}>
                <div className="flex items-center gap-2 px-3 py-2">
                  <input type="checkbox" className="h-4 w-4" aria-label={`Select all of ${t.name}`} checked={picked === t.items.length && t.items.length > 0} ref={(el) => { if (el) el.indeterminate = picked > 0 && picked < t.items.length; }} onChange={() => toggleType(t)} />
                  <button type="button" className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left" onClick={() => flip(t.key)}>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">{t.name}</span>
                      <span className="block truncate text-[11px] text-slate-400">{CATEGORIES[t.category] || 'Other'}{t.description ? ` · ${t.description}` : ''}</span>
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">{picked ? <b className="text-brand-700">{picked}</b> : 0}/{t.items.length}</span>
                  </button>
                </div>
                {isOpen && (
                  <ul className="border-t border-slate-100 px-3 py-1.5 dark:border-slate-700">
                    {t.shown.map((it) => (
                      <li key={it.text}>
                        <label className="flex cursor-pointer items-center gap-2 py-1 text-sm text-slate-700 dark:text-slate-200">
                          <input type="checkbox" className="h-4 w-4" checked={chosen.has(`${t.name}::${it.text}`)} onChange={() => toggleItem(t, it)} />
                          <span className="flex-1">{it.text}</span>
                          <KindBadge kind={it.kind} />
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
          {!types.length && <p className="p-3 text-sm text-slate-400">{library.length ? 'Nothing matches your search.' : 'The inspection list is empty — use the gear icon to add inspection types, or add custom requirements.'}</p>}
        </div>

        <div className="mt-3 rounded-lg border border-dashed border-slate-300 p-3 dark:border-slate-600">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Custom requirement (this inspection only)</p>
          <div className="flex flex-wrap gap-2">
            <input className="input min-w-[12rem] flex-1" placeholder="e.g. Photo of terrace drain outlets" value={custom.text} onChange={(e) => setCustom({ ...custom, text: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom())} />
            <Select className="input w-36" value={custom.kind} onChange={(e) => setCustom({ ...custom, kind: e.target.value })}>{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
            <button type="button" className="btn-secondary" onClick={() => addCustom()}>Add</button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK.map((r) => (
              <button key={r.item} type="button" className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:border-brand-300 hover:text-brand-700 dark:border-slate-600 dark:text-slate-300" onClick={() => addCustom(r)}>+ {r.item}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900/40">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected ({value.length})</p>
          {value.length > 0 && <button type="button" className="text-xs text-slate-500 hover:text-red-600" onClick={() => onChange([])}>Clear</button>}
        </div>
        {!value.length ? <p className="text-sm text-slate-400">Tick requirements on the left, or add a custom one.</p> : (
          <ol className="scroll-thin max-h-[26rem] space-y-1 overflow-y-auto">
            {value.map((r, i) => (
              <li key={keyOf(r)} className="flex items-start gap-1.5 rounded bg-white px-2 py-1.5 text-xs shadow-sm dark:bg-slate-800">
                <span className="w-4 shrink-0 text-right text-slate-400">{i + 1}</span>
                <span className="min-w-0 flex-1 text-slate-700 dark:text-slate-200">{r.item}<span className="block text-[10px] text-slate-400">{r.type}</span></span>
                <KindBadge kind={r.kind} />
                <button type="button" className="text-slate-400 hover:text-red-600" aria-label={`Remove ${r.item}`} onClick={() => onChange(value.filter((x) => keyOf(x) !== keyOf(r)))}>×</button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
