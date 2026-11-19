import { useEffect, useState } from 'react';
import Modal from '../../components/Modal';
import SearchSelect from '../../components/SearchSelect';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { errorMessage } from '../../lib/api';
import {
  getTemplate, previewDocument, createDocument, updateDocument, getDocument,
  listProjectsForDocs, getProjectForDocs, listClientsForDocs, getClientForDocs, listVendorsForDocs, getVendorForDocs,
} from './api';
import { printHtml } from './print';
import PreviewModal from './PreviewModal';
import Select from '../../components/Select';
import { localDate } from '../../lib/format';

const todayISO = () => localDate();

function resolveSource(source, ctx) {
  switch (source) {
    case 'today': return todayISO();
    case 'company.name': return ctx.company?.name || '';
    case 'company.address': return ctx.company?.address || '';
    case 'project.name': return ctx.project?.name || '';
    case 'project.address': return ctx.project?.clientAddress || '';
    case 'client.name': return ctx.client?.name || ctx.project?.clientName || '';
    case 'client.phone': return ctx.client?.phone || ctx.project?.clientPhone || '';
    case 'client.address': return ctx.client?.address || ctx.project?.clientAddress || '';
    case 'vendor.name': return ctx.vendor?.name || '';
    case 'vendor.address': return [ctx.vendor?.address, ctx.vendor?.gstNumber && `GSTIN: ${ctx.vendor.gstNumber}`].filter(Boolean).join('\n');
    default: return '';
  }
}

const DEFAULT_COLUMNS = [
  { key: 'description', label: 'Description', type: 'text' },
  { key: 'qty', label: 'Qty', type: 'number' },
  { key: 'rate', label: 'Rate', type: 'money' },
  { key: 'amount', label: 'Amount', type: 'money', calc: 'qty*rate', sum: true },
];
const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
function calcValue(calc, row) {
  if (calc.startsWith('product:')) {
    const vals = calc.slice(8).split(',').map((k) => num(row[k])).filter((v) => v != null);
    return vals.length ? vals.reduce((x, y) => x * y, 1) : null;
  }
  const [a, b] = calc.split('*');
  return num(row[a]) == null || num(row[b]) == null ? null : num(row[a]) * num(row[b]);
}
const fmt = (n, money) => (n == null ? '' : money ? n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(Math.round(n * 1000) / 1000));

// Line-items editor driven by the template's column list (HSN, unit, L×B×D, …).
function ItemsEditor({ value = [], onChange, columns }) {
  const cols = columns || DEFAULT_COLUMNS;
  const blankRow = () => Object.fromEntries(cols.filter((c) => !c.calc).map((c) => [c.key, '']));
  const rows = value.length ? value : [blankRow()];
  const update = (i, patch) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const add = () => onChange([...rows, blankRow()]);
  const remove = (i) => onChange(rows.filter((_, idx) => idx !== i));
  const sums = {};
  for (const r of rows) for (const c of cols) if (c.sum) { const v = c.calc ? calcValue(c.calc, r) : num(r[c.key]); if (v != null) sums[c.key] = (sums[c.key] || 0) + v; }
  const width = (c) => (c.key === 'description' ? 'min-w-0 flex-[3]' : c.type === 'date' ? 'w-36 shrink-0' : c.type === 'text' ? 'min-w-0 flex-1' : c.type === 'money' ? 'w-28 shrink-0' : 'w-20 shrink-0');
  return (
    <div className="overflow-x-auto">
      <div className={`space-y-1.5 ${cols.length > 5 ? 'min-w-[640px]' : 'min-w-[420px]'}`}>
        <div className="flex gap-2 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <span className="w-6 shrink-0 text-center">#</span>
          {cols.map((c) => <span key={c.key} className={`${width(c)} truncate ${['number', 'money'].includes(c.type) ? 'text-right' : ''}`} title={c.label}>{c.label}</span>)}
          <span className="w-8 shrink-0" />
        </div>
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-center text-xs text-slate-400">{i + 1}</span>
            {cols.map((c) => (c.calc ? (
              <span key={c.key} className={`${width(c)} rounded-md bg-cream-100 px-2 py-2 text-right text-sm tabular-nums text-slate-700 dark:bg-slate-700/60 dark:text-slate-200`}>{fmt(calcValue(c.calc, r), c.type === 'money') || '—'}</span>
            ) : (
              <input
                key={c.key}
                className={`input ${width(c)} px-2 ${['number', 'money'].includes(c.type) ? 'text-right' : ''}`}
                type={c.type === 'number' || c.type === 'money' ? 'number' : c.type === 'date' ? 'date' : 'text'}
                step={c.type === 'money' ? '0.01' : 'any'}
                placeholder={c.label}
                aria-label={`${c.label} row ${i + 1}`}
                value={r[c.key] ?? ''}
                onChange={(e) => update(i, { [c.key]: e.target.value })}
              />
            )))}
            <button type="button" className="btn-ghost w-8 shrink-0 px-0 text-red-500" onClick={() => remove(i)} aria-label={`Remove row ${i + 1}`}>×</button>
          </div>
        ))}
        {Object.keys(sums).length > 0 && (
          <div className="flex gap-2 border-t border-cream-200 pt-1.5 text-sm font-semibold dark:border-slate-700">
            <span className="w-6 shrink-0" />
            {cols.map((c, idx) => <span key={c.key} className={`${width(c)} ${['number', 'money'].includes(c.type) ? 'text-right tabular-nums' : ''}`}>{c.sum ? fmt(sums[c.key] || 0, c.type === 'money') : idx === 0 ? 'Total' : ''}</span>)}
            <span className="w-8 shrink-0" />
          </div>
        )}
        <button type="button" className="btn-ghost text-brand-600" onClick={add}>+ Add row</button>
      </div>
    </div>
  );
}

export default function DocumentFormModal({ open, templateKey, docId, copyFrom, presetProjectId, presetClientId, presetVendorId, onClose, onSaved }) {
  const { bootstrap } = useAuth();
  const toast = useToast();
  const company = bootstrap?.company || {};

  const [tpl, setTpl] = useState(null);
  const [values, setValues] = useState({});
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [clientId, setClientId] = useState('');
  const [clients, setClients] = useState([]);
  const [vendorId, setVendorId] = useState('');
  const [vendors, setVendors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  // Load the template (and, in edit mode, the existing document).
  useEffect(() => {
    if (!open || !templateKey) return;
    let cancelled = false;
    (async () => {
      try {
        const t = await getTemplate(templateKey);
        if (cancelled) return;
        setTpl(t);
        if (copyFrom && !docId) {
          // Duplicate: same content, new number.
          const doc = await getDocument(copyFrom);
          if (cancelled) return;
          const { reference, ...rest } = doc.data || {};
          setValues({ ...rest, ...(t.fields.some((f) => f.key === 'date') ? { date: todayISO() } : {}) });
          setTitle(`${doc.title || t.name} (copy)`);
          setProjectId(doc.projectId || '');
          setClientId(doc.clientId || '');
          setVendorId(doc.vendorId || '');
        } else if (docId) {
          const doc = await getDocument(docId);
          if (cancelled) return;
          setValues(doc.data || {});
          setTitle(doc.title || t.name);
          setProjectId(doc.projectId || '');
          setClientId(doc.clientId || '');
          setVendorId(doc.vendorId || '');
        } else {
          // Seed source defaults (company/today) for a fresh document.
          const seed = {};
          for (const f of t.fields) {
            if (f.source) {
              const v = resolveSource(f.source, { company, project: null });
              if (v) seed[f.key] = v;
            }
            if (seed[f.key] == null && f.default != null && f.default !== '') seed[f.key] = f.default;
          }
          setValues(seed);
          setTitle(t.name);
          setProjectId('');
          setClientId('');
          setVendorId('');
          setSelectedProject(null);
          // Pre-selected from "Create Document": fill project / client details.
          if (presetProjectId) await fillFromProject(presetProjectId, t, seed);
          else if (presetClientId) await fillFromClient(presetClientId, t, seed);
          if (presetVendorId) await fillFromVendor(presetVendorId, t);
        }
      } catch (err) {
        toast.error(errorMessage(err));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, templateKey, docId, copyFrom]);

  useEffect(() => {
    if (open) {
      listProjectsForDocs().then(setProjects);
      listClientsForDocs().then(setClients);
      listVendorsForDocs().then(setVendors);
    }
  }, [open]);

  // Fill empty project/client-sourced fields from the chosen record.
  const fillSources = (t, ctxIn) => setValues((prev) => {
    const next = { ...prev };
    for (const f of t?.fields || []) {
      if (!f.source || !(f.source.startsWith('project') || f.source.startsWith('client') || f.source.startsWith('vendor'))) continue;
      if (!next[f.key] || next[f.key] === '') {
        const v = resolveSource(f.source, { company, ...ctxIn });
        if (v) next[f.key] = v;
      }
    }
    return next;
  });

  async function fillFromProject(pid, t = tpl) {
    setProjectId(pid || '');
    if (!pid) { setSelectedProject(null); return; }
    const detail = await getProjectForDocs(pid);
    setSelectedProject(detail);
    if (detail) fillSources(t, { project: detail });
  }

  async function fillFromClient(cid, t = tpl) {
    setClientId(cid || '');
    if (!cid) return;
    const c = await getClientForDocs(cid);
    if (c) fillSources(t, { client: c });
  }

  async function fillFromVendor(vid, t = tpl) {
    setVendorId(vid || '');
    if (!vid) return;
    const v = await getVendorForDocs(vid);
    if (v) fillSources(t, { vendor: v });
  }

  const onPickProject = (pid) => fillFromProject(pid);
  const onPickVendor = (vid) => fillFromVendor(vid);
  const usesVendor = (tpl?.fields || []).some((f) => f.source?.startsWith('vendor'));
  const onPickClient = (cid) => fillFromClient(cid);

  const setVal = (key, v) => setValues((prev) => ({ ...prev, [key]: v }));

  const buildData = () => ({ ...values });

  const missingRequired = () =>
    (tpl?.fields || [])
      .filter((f) => f.required && f.type !== 'items')
      .filter((f) => !values[f.key] || String(values[f.key]).trim() === '')
      .map((f) => f.label);

  const doPreview = () => setPreviewing(true);

  const save = async (thenPrint) => {
    const missing = missingRequired();
    if (missing.length) { toast.error(`Please fill: ${missing.join(', ')}`); return; }
    setSaving(true);
    try {
      const body = { templateKey, title: title.trim() || tpl.name, data: buildData() };
      if (projectId) body.projectId = Number(projectId);
      if (clientId) body.clientId = Number(clientId);
      if (vendorId) body.vendorId = Number(vendorId);
      if (values.reference) body.reference = values.reference;
      const saved = docId ? await updateDocument(docId, { title: body.title, data: body.data, projectId: body.projectId ?? null, clientId: body.clientId ?? null, vendorId: body.vendorId ?? null }) : await createDocument(body);
      toast.success(docId ? 'Document updated' : 'Document created');
      onSaved?.(saved);
      if (thenPrint) {
        const { html } = await previewDocument(templateKey, buildData());
        printHtml(html);
      }
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const renderField = (f) => {
    const v = values[f.key] ?? '';
    if (f.type === 'items') {
      return <ItemsEditor value={Array.isArray(v) ? v : []} onChange={(rows) => setVal(f.key, rows)} columns={f.columns} />;
    }
    if (f.type === 'textarea') {
      return <textarea className="input" rows={3} value={v} onChange={(e) => setVal(f.key, e.target.value)} placeholder={f.placeholder || ''} />;
    }
    if (f.type === 'select') {
      return (
        <Select className="input" value={v} onChange={(e) => setVal(f.key, e.target.value)}>
          <option value="">—</option>
          {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
        </Select>
      );
    }
    const inputType = f.type === 'date' ? 'date' : f.type === 'number' || f.type === 'money' ? 'number' : 'text';
    return (
      <input
        className="input"
        type={inputType}
        step={f.type === 'money' ? '0.01' : undefined}
        value={v}
        onChange={(e) => setVal(f.key, e.target.value)}
        placeholder={f.placeholder || ''}
      />
    );
  };

  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      title={tpl ? `${docId ? 'Edit' : copyFrom ? 'Copy' : 'New'} · ${tpl.name}` : 'Loading…'}
      wide
      dismissOnBackdrop={false}
      fullscreenable
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-secondary" onClick={doPreview} disabled={!tpl}>Preview</button>
          <button className="btn-secondary" onClick={() => save(false)} disabled={saving || !tpl}>Save</button>
          <button className="btn-primary" onClick={() => save(true)} disabled={saving || !tpl}>Save &amp; Print</button>
        </>
      }
    >
      {tpl && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="label">Document title</label>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="label">Client (auto-fills)</label>
              <SearchSelect
                options={clients}
                value={clientId}
                onChange={onPickClient}
                getLabel={(c) => c.name}
                getSub={(c) => c.phone || c.contactPerson}
                placeholder="Search clients…"
              />
            </div>
            <div>
              <label className="label">Project (auto-fills)</label>
              <SearchSelect
                options={projects}
                value={projectId}
                onChange={onPickProject}
                getLabel={(p) => p.name}
                getSub={(p) => p.clientName}
                getSearch={(p) => `${p.name} ${p.clientName} ${p.referenceNumber || ''}`}
                placeholder="Search projects…"
              />
            </div>
          </div>

          {(usesVendor || vendorId) && (
            <div className="sm:w-1/2">
              <label className="label">Vendor / contractor (auto-fills)</label>
              <SearchSelect options={vendors} value={vendorId} onChange={onPickVendor} getLabel={(v) => v.name} getSub={(v) => v.category || v.phone} placeholder="Search vendors…" />
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {tpl.fields.filter((f) => !f.legacy || (values[f.key] != null && values[f.key] !== '' && !(Array.isArray(values[f.key]) && !values[f.key].length))).map((f) => (
              <div key={f.key} className={f.type === 'items' || f.type === 'textarea' ? 'sm:col-span-2' : ''}>
                <label className="label">
                  {f.label}{f.required && <span className="text-red-500"> *</span>}
                </label>
                {renderField(f)}
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
    <PreviewModal
      open={previewing}
      title={`Preview · ${title || tpl?.name || ''}`}
      load={() => previewDocument(templateKey, buildData())}
      onClose={() => setPreviewing(false)}
    />
    </>
  );
}
