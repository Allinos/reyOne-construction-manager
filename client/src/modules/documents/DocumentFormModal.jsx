import { useEffect, useState } from 'react';
import Modal from '../../components/Modal';
import SearchSelect from '../../components/SearchSelect';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { errorMessage } from '../../lib/api';
import {
  getTemplate, previewDocument, createDocument, updateDocument, getDocument,
  listProjectsForDocs, getProjectForDocs, listClientsForDocs, getClientForDocs,
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
    default: return '';
  }
}

// Line-items editor (description / qty / rate).
function ItemsEditor({ value = [], onChange, showRate }) {
  const rows = value.length ? value : [{ description: '', qty: '', rate: '' }];
  const update = (i, patch) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const add = () => onChange([...rows, { description: '', qty: '', rate: '' }]);
  const remove = (i) => onChange(rows.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="Description"
            value={r.description || ''}
            onChange={(e) => update(i, { description: e.target.value })}
          />
          <input
            className="input w-20"
            placeholder="Qty"
            value={r.qty ?? ''}
            onChange={(e) => update(i, { qty: e.target.value })}
          />
          {showRate && (
            <input
              className="input w-28"
              placeholder="Rate"
              type="number"
              value={r.rate ?? ''}
              onChange={(e) => update(i, { rate: e.target.value })}
            />
          )}
          <button type="button" className="btn-secondary px-2 text-red-500" onClick={() => remove(i)} aria-label="Remove">×</button>
        </div>
      ))}
      <button type="button" className="btn-ghost text-brand-600" onClick={add}>+ Add row</button>
    </div>
  );
}

export default function DocumentFormModal({ open, templateKey, docId, presetProjectId, presetClientId, onClose, onSaved }) {
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
        if (docId) {
          const doc = await getDocument(docId);
          if (cancelled) return;
          setValues(doc.data || {});
          setTitle(doc.title || t.name);
          setProjectId(doc.projectId || '');
          setClientId(doc.clientId || '');
        } else {
          // Seed source defaults (company/today) for a fresh document.
          const seed = {};
          for (const f of t.fields) {
            if (f.source) {
              const v = resolveSource(f.source, { company, project: null });
              if (v) seed[f.key] = v;
            }
          }
          setValues(seed);
          setTitle(t.name);
          setProjectId('');
          setClientId('');
          setSelectedProject(null);
          // Pre-selected from "Create Document": fill project / client details.
          if (presetProjectId) await fillFromProject(presetProjectId, t, seed);
          else if (presetClientId) await fillFromClient(presetClientId, t, seed);
        }
      } catch (err) {
        toast.error(errorMessage(err));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, templateKey, docId]);

  useEffect(() => {
    if (open) {
      listProjectsForDocs().then(setProjects);
      listClientsForDocs().then(setClients);
    }
  }, [open]);

  // Fill empty project/client-sourced fields from the chosen record.
  const fillSources = (t, ctxIn) => setValues((prev) => {
    const next = { ...prev };
    for (const f of t?.fields || []) {
      if (!f.source || !(f.source.startsWith('project') || f.source.startsWith('client'))) continue;
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

  const onPickProject = (pid) => fillFromProject(pid);
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
      if (values.reference) body.reference = values.reference;
      const saved = docId ? await updateDocument(docId, { title: body.title, data: body.data, projectId: body.projectId ?? null, clientId: body.clientId ?? null }) : await createDocument(body);
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
      const showRate = !['material_requisition', 'delivery_challan', 'goods_received_note', 'snag_list'].includes(templateKey);
      return <ItemsEditor value={Array.isArray(v) ? v : []} onChange={(rows) => setVal(f.key, rows)} showRate={showRate} />;
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
      title={tpl ? `${docId ? 'Edit' : 'New'} · ${tpl.name}` : 'Loading…'}
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {tpl.fields.map((f) => (
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
