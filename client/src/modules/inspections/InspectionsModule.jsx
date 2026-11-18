import { useEffect, useState, useCallback } from 'react';
import { Routes, Route, useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { errorMessage } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { listDirectory } from '../../lib/files';
import { PageHeader, Card, Spinner, EmptyState, Alert } from '../../components/ui';
import Modal from '../../components/Modal';
import Icon from '../../components/Icon';
import Attachments from '../../components/Attachments';
import { Tabs } from '../attendance/AttendancePage';
import { printHtml } from '../documents/print';
import * as api from './api';

const SEVERITY = { low: 'bg-slate-100 text-slate-600', medium: 'bg-amber-100 text-amber-700', high: 'bg-orange-100 text-orange-700', critical: 'bg-red-100 text-red-700' };
const ISSUE_STATUS = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved', verified: 'Verified' };
const today = () => new Date().toISOString().slice(0, 10);

function ScoreBar({ score }) {
  if (!score || score.pct == null) return <span className="text-xs text-slate-400">Not rated</span>;
  const color = score.pct >= 85 ? '#16a34a' : score.pct >= 60 ? '#f59e0b' : '#dc2626';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 rounded-full bg-cream-200 dark:bg-slate-700"><div className="h-2 rounded-full" style={{ width: `${score.pct}%`, backgroundColor: color }} /></div>
      <span className="text-xs font-semibold" style={{ color }}>{score.pct}%</span>
    </div>
  );
}

function IssueStatusSelect({ issue, onChange, allowVerify }) {
  return (
    <select className="input w-auto py-1 text-xs" value={issue.status} onChange={(e) => onChange(e.target.value)}>
      {Object.entries(ISSUE_STATUS).filter(([k]) => allowVerify || k !== 'verified' || issue.status === 'verified').map(([k, l]) => <option key={k} value={k}>{l}</option>)}
    </select>
  );
}

function InspectionsList() {
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [filters, setFilters] = useState({ projectId: '', status: '' });
  const [rows, setRows] = useState(null);
  const [create, setCreate] = useState(null);

  useEffect(() => { api.listProjectsLite().then(setProjects); api.getTemplates().then(setTemplates).catch(() => {}); }, []);
  useEffect(() => {
    setRows(null);
    const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    api.listInspections(clean).then(setRows).catch((e) => toast.error(errorMessage(e)));
  }, [filters, toast]);

  const submit = async () => {
    if (!create.projectId || !create.title.trim()) { toast.error('Select a project and enter a title'); return; }
    try {
      const row = await api.createInspection({ projectId: Number(create.projectId), title: create.title.trim(), date: create.date, ...(create.templateKey ? { templateKey: create.templateKey } : {}) });
      navigate(`/inspections/${row.id}`);
    } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-3">
        <select className="input w-auto" value={filters.projectId} onChange={(e) => setFilters({ ...filters, projectId: e.target.value })}><option value="">All projects</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select className="input w-auto" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All</option><option value="open">Open</option><option value="closed">Closed</option></select>
        {can('inspections.manage') && <button className="btn-primary ml-auto" onClick={() => setCreate({ projectId: '', title: '', date: today(), templateKey: templates[0]?.key || '' })}>+ New Inspection</button>}
      </div>
      {!rows ? <div className="flex justify-center p-10"><Spinner /></div> : rows.length === 0 ? <Card><EmptyState title="No inspections yet" hint="Start one from a checklist template." /></Card> : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => (
            <Link key={r.id} to={`/inspections/${r.id}`} className="card block p-4 transition hover:border-brand-300 hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{r.title}</p>
                  <p className="text-xs text-slate-500">{r.projectName} · {formatDate(r.date)}{r.inspectorName ? ` · ${r.inspectorName}` : ''}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${r.status === 'open' ? 'bg-sky-100 text-sky-700' : 'bg-green-100 text-green-700'}`}>{r.status === 'open' ? 'Open' : 'Closed'}</span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <ScoreBar score={r.score} />
                <span className={`text-xs ${r.openIssues ? 'font-semibold text-red-600' : 'text-slate-400'}`}>{r.openIssues ? `${r.openIssues} open issue(s)` : `${r.issueCount} issue(s)`}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
      {create && (
        <Modal open onClose={() => setCreate(null)} title="New Site Inspection" footer={<><button className="btn-secondary" onClick={() => setCreate(null)}>Cancel</button><button className="btn-primary" onClick={submit}>Start Inspection</button></>}>
          <div className="space-y-3">
            <div><label className="label">Project / Site</label><select className="input" value={create.projectId} onChange={(e) => setCreate({ ...create, projectId: e.target.value })}><option value="">— Select —</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div><label className="label">Title</label><input className="input" placeholder="e.g. Slab L3 pre-pour check" value={create.title} onChange={(e) => setCreate({ ...create, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Checklist</label><select className="input" value={create.templateKey} onChange={(e) => setCreate({ ...create, templateKey: e.target.value })}><option value="">Blank</option>{templates.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}</select></div>
              <div><label className="label">Date</label><input type="date" className="input" value={create.date} onChange={(e) => setCreate({ ...create, date: e.target.value })} /></div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function InspectionDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const canManage = can('inspections.manage');
  const [data, setData] = useState(null);
  const [checklist, setChecklist] = useState([]);
  const [remarks, setRemarks] = useState('');
  const [dirty, setDirty] = useState(false);
  const [users, setUsers] = useState([]);
  const [issueForm, setIssueForm] = useState(null);
  const [newItem, setNewItem] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => api.getInspection(id).then((d) => { setData(d); setChecklist(d.checklist || []); setRemarks(d.remarks || ''); setDirty(false); }).catch((e) => setError(errorMessage(e))), [id]);
  useEffect(() => { load(); listDirectory().then(setUsers); }, [load]);

  const setItem = (i, patch) => { setChecklist((c) => c.map((x, j) => (j === i ? { ...x, ...patch } : x))); setDirty(true); };
  const save = async () => {
    try { await api.updateInspection(id, { checklist, remarks: remarks || null }); toast.success('Inspection saved'); load(); } catch (e) { toast.error(errorMessage(e)); }
  };
  const setStatus = async (status) => {
    try { if (dirty) await api.updateInspection(id, { checklist, remarks: remarks || null }); await api.updateInspection(id, { status }); toast.success(status === 'closed' ? 'Inspection closed' : 'Reopened'); load(); } catch (e) { toast.error(errorMessage(e)); }
  };
  const submitIssue = async () => {
    if (!issueForm.description.trim()) { toast.error('Describe the issue'); return; }
    try {
      await api.addIssue(id, { description: issueForm.description.trim(), severity: issueForm.severity, assignedToId: issueForm.assignedToId ? Number(issueForm.assignedToId) : null, correctiveAction: issueForm.correctiveAction || undefined, dueDate: issueForm.dueDate || null });
      toast.success('Issue added');
      setIssueForm(null);
      load();
    } catch (e) { toast.error(errorMessage(e)); }
  };
  const patchIssue = async (issue, patch) => {
    try { await api.updateIssue(issue.id, patch); load(); } catch (e) { toast.error(errorMessage(e)); }
  };
  const report = async () => {
    try { if (dirty) await save(); const { html } = await api.getReport(id); printHtml(html); } catch (e) { toast.error(errorMessage(e)); }
  };
  const remove = async () => {
    if (!(await confirm({ title: 'Delete inspection?', message: data.title, confirmLabel: 'Delete' }))) return;
    try { await api.deleteInspection(id); navigate('/inspections'); } catch (e) { toast.error(errorMessage(e)); }
  };

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <div className="flex justify-center p-10"><Spinner /></div>;
  const editable = canManage && data.status === 'open';
  const RESULTS = [{ k: 'pass', l: 'Pass', on: 'bg-green-600 text-white' }, { k: 'fail', l: 'Fail', on: 'bg-red-600 text-white' }, { k: 'na', l: 'N/A', on: 'bg-slate-500 text-white' }];

  return (
    <div>
      <PageHeader
        title={data.title}
        subtitle={`${data.projectName} · ${formatDate(data.date)}${data.inspectorName ? ` · Inspector: ${data.inspectorName}` : ''}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/inspections" className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-white" aria-label="Back"><Icon name="arrowLeft" className="h-4 w-4" /></Link>
            <button className="btn-secondary" onClick={report}>Print Report</button>
            {canManage && data.status === 'open' && <button className="btn-primary" onClick={() => setStatus('closed')}>Close Inspection</button>}
            {canManage && data.status === 'closed' && <button className="btn-secondary" onClick={() => setStatus('open')}>Reopen</button>}
            {canManage && <button className="btn-secondary text-red-600" onClick={remove}>Delete</button>}
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <ScoreBar score={{ pct: (() => { const r = checklist.filter((c) => c.result === 'pass' || c.result === 'fail'); return r.length ? Math.round((r.filter((c) => c.result === 'pass').length / r.length) * 100) : null; })() }} />
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${data.status === 'open' ? 'bg-sky-100 text-sky-700' : 'bg-green-100 text-green-700'}`}>{data.status === 'open' ? 'Open' : 'Closed'}</span>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card className="!p-0">
            <div className="border-b border-cream-200 px-4 py-3 font-semibold dark:border-slate-700">Checklist</div>
            <ul className="divide-y divide-cream-200 dark:divide-slate-700">
              {checklist.map((c, i) => (
                <li key={i} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">{i + 1}. {c.item}</span>
                    <div className="flex gap-1">
                      {RESULTS.map((r) => (
                        <button key={r.k} disabled={!editable} onClick={() => setItem(i, { result: c.result === r.k ? '' : r.k })}
                          className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${c.result === r.k ? `${r.on} border-transparent` : 'border-cream-300 text-slate-500 dark:border-slate-600'}`}>{r.l}</button>
                      ))}
                    </div>
                  </div>
                  {(editable || c.remark) && (
                    <input className="input mt-2 py-1 text-xs" placeholder="Remark…" disabled={!editable} value={c.remark || ''} onChange={(e) => setItem(i, { remark: e.target.value })} />
                  )}
                </li>
              ))}
              {!checklist.length && <li className="px-4 py-4 text-sm text-slate-400">No checklist items.</li>}
            </ul>
            {editable && (
              <div className="flex gap-2 border-t border-cream-200 p-3 dark:border-slate-700">
                <input className="input flex-1" placeholder="Add checklist item…" value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newItem.trim()) { setChecklist((c) => [...c, { item: newItem.trim(), result: '', remark: '' }]); setNewItem(''); setDirty(true); } }} />
                <button className="btn-secondary" onClick={() => { if (newItem.trim()) { setChecklist((c) => [...c, { item: newItem.trim(), result: '', remark: '' }]); setNewItem(''); setDirty(true); } }}>Add</button>
              </div>
            )}
          </Card>
          <Card className="mt-4">
            <label className="label">Remarks</label>
            <textarea className="input" rows={3} disabled={!editable} value={remarks} onChange={(e) => { setRemarks(e.target.value); setDirty(true); }} />
            {editable && <div className="mt-3 flex justify-end"><button className="btn-primary" disabled={!dirty} onClick={save}>{dirty ? 'Save changes' : 'Saved'}</button></div>}
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <Card><Attachments entityType="inspection" entityId={Number(id)} canUpload={canManage} label="Site Photos" accept="image/*" capture /></Card>
          <Card className="!p-0">
            <div className="flex items-center justify-between border-b border-cream-200 px-4 py-3 dark:border-slate-700">
              <span className="font-semibold">Issues &amp; Corrective Actions</span>
              {canManage && <button className="btn-ghost py-1 text-brand-600" onClick={() => setIssueForm({ description: '', severity: 'medium', assignedToId: '', correctiveAction: '', dueDate: '' })}>+ Issue</button>}
            </div>
            <ul className="divide-y divide-cream-200 dark:divide-slate-700">
              {data.issues.map((is) => (
                <li key={is.id} className="space-y-1.5 px-4 py-3">
                  <div className="flex items-start gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${SEVERITY[is.severity]}`}>{is.severity}</span>
                    <p className="flex-1 text-sm text-slate-700 dark:text-slate-200">{is.description}</p>
                  </div>
                  <p className="text-xs text-slate-500">{is.assignedToName ? `Assigned: ${is.assignedToName}` : 'Unassigned'}{is.dueDate ? ` · Due ${formatDate(is.dueDate)}` : ''}</p>
                  {is.correctiveAction && <p className="text-xs text-slate-500"><span className="font-medium">Action:</span> {is.correctiveAction}</p>}
                  <div className="flex flex-wrap gap-2">
                    {canManage ? <IssueStatusSelect issue={is} allowVerify onChange={(v) => patchIssue(is, { status: v })} /> : <span className="text-xs">{ISSUE_STATUS[is.status]}</span>}
                    {canManage && (
                      <select className="input w-auto py-1 text-xs" value={is.assignedToId || ''} onChange={(e) => patchIssue(is, { assignedToId: e.target.value ? Number(e.target.value) : null })}>
                        <option value="">Unassigned</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    )}
                  </div>
                </li>
              ))}
              {!data.issues.length && <li className="px-4 py-4 text-sm text-slate-400">No issues identified.</li>}
            </ul>
          </Card>
        </div>
      </div>

      {issueForm && (
        <Modal open onClose={() => setIssueForm(null)} title="Record Issue" footer={<><button className="btn-secondary" onClick={() => setIssueForm(null)}>Cancel</button><button className="btn-primary" onClick={submitIssue}>Add Issue</button></>}>
          <div className="space-y-3">
            <div><label className="label">Issue</label><textarea className="input" rows={3} autoFocus value={issueForm.description} onChange={(e) => setIssueForm({ ...issueForm, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Severity</label><select className="input" value={issueForm.severity} onChange={(e) => setIssueForm({ ...issueForm, severity: e.target.value })}>{Object.keys(SEVERITY).map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}</select></div>
              <div><label className="label">Due date</label><input type="date" className="input" value={issueForm.dueDate} onChange={(e) => setIssueForm({ ...issueForm, dueDate: e.target.value })} /></div>
            </div>
            <div><label className="label">Assign to</label><select className="input" value={issueForm.assignedToId} onChange={(e) => setIssueForm({ ...issueForm, assignedToId: e.target.value })}><option value="">— Unassigned —</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}{u.designation ? ` · ${u.designation}` : ''}</option>)}</select></div>
            <div><label className="label">Corrective action required</label><textarea className="input" rows={2} value={issueForm.correctiveAction} onChange={(e) => setIssueForm({ ...issueForm, correctiveAction: e.target.value })} /></div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function MyIssues({ compact = false }) {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [edit, setEdit] = useState(null);
  const load = useCallback(() => api.listIssues({ mine: 'true', status: 'open' }).then(setRows).catch(() => setRows([])), []);
  useEffect(() => { load(); }, [load]);
  const save = async (is, patch) => { try { await api.updateIssue(is.id, patch); toast.success('Updated'); setEdit(null); load(); } catch (e) { toast.error(errorMessage(e)); } };
  if (!rows) return <div className="flex justify-center p-6"><Spinner /></div>;
  if (!rows.length) return <Card><EmptyState title="No open issues assigned to you" /></Card>;
  return (
    <div className="space-y-3">
      {rows.slice(0, compact ? 5 : 300).map((is) => (
        <div key={is.id} className="card p-4">
          <div className="flex items-start gap-2">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${SEVERITY[is.severity]}`}>{is.severity}</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{is.description}</p>
              <p className="text-xs text-slate-500">{is.projectName} · {is.inspection.title}{is.dueDate ? ` · Due ${formatDate(is.dueDate)}` : ''}</p>
            </div>
          </div>
          {is.correctiveAction && <p className="mt-1 text-xs text-slate-500">Action: {is.correctiveAction}</p>}
          <div className="mt-2 flex gap-2">
            {is.status === 'open' && <button className="btn-secondary py-1 text-xs" onClick={() => save(is, { status: 'in_progress' })}>Start</button>}
            <button className="btn-primary py-1 text-xs" onClick={() => setEdit({ ...is, note: is.correctiveAction || '' })}>Mark Resolved</button>
          </div>
        </div>
      ))}
      {edit && (
        <Modal open onClose={() => setEdit(null)} title="Resolve Issue" footer={<><button className="btn-secondary" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" onClick={() => save(edit, { status: 'resolved', correctiveAction: edit.note || null })}>Mark Resolved</button></>}>
          <p className="mb-2 text-sm">{edit.description}</p>
          <label className="label">What was done?</label>
          <textarea className="input" rows={3} value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} />
          <p className="mt-2 text-xs text-slate-400">The inspector will be notified to verify.</p>
        </Modal>
      )}
    </div>
  );
}

function InspectionsHome() {
  const { can } = useAuth();
  const [tab, setTab] = useState(can('inspections.read') ? 'list' : 'mine');
  const tabs = [...(can('inspections.read') ? [{ key: 'list', label: 'Inspections' }] : []), { key: 'mine', label: 'My Issues' }];
  return (
    <div>
      <PageHeader title="Site Inspection" subtitle="Checklists, photos, issues and corrective actions" />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'list' ? <InspectionsList /> : <MyIssues />}
    </div>
  );
}

export default function InspectionsModule() {
  return (
    <Routes>
      <Route index element={<InspectionsHome />} />
      <Route path=":id" element={<InspectionDetail />} />
    </Routes>
  );
}
