import { useEffect, useState, useCallback } from 'react';
import { Routes, Route, useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { errorMessage } from '../../lib/api';
import { formatDate, localDate } from '../../lib/format';
import { listDirectory } from '../../lib/files';
import { PageHeader, Card, Spinner, EmptyState, Alert, Progress, Stat } from '../../components/ui';
import Modal from '../../components/Modal';
import Icon from '../../components/Icon';
import Attachments from '../../components/Attachments';
import { Tabs } from '../../components/ui';
import { printHtml } from '../documents/print';
import * as api from './api';
import Select from '../../components/Select';

const SEVERITY = { low: 'bg-slate-100 text-slate-600', medium: 'bg-amber-100 text-amber-700', high: 'bg-orange-100 text-orange-700', critical: 'bg-red-600 text-white' };
const ISSUE_STATUS = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved', verified: 'Verified' };
const today = () => localDate();

export const INSPECTION_STATUS = {
  pending: { label: 'Pending', cls: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300' },
  assigned: { label: 'Assigned', cls: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200' },
  in_progress: { label: 'In progress', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  completed: { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  follow_up: { label: 'Needs follow-up', cls: 'bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  closed: { label: 'Closed', cls: 'bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-100' },
};
const StatusPill = ({ status }) => {
  const st = INSPECTION_STATUS[status] || INSPECTION_STATUS.in_progress;
  return <span className={`badge ${st.cls}`}>{st.label}</span>;
};

function ScoreBar({ score }) {
  if (!score || score.pct == null) return <span className="text-xs text-slate-400">Not rated</span>;
  const color = score.pct >= 85 ? '#059669' : score.pct >= 60 ? '#d97706' : '#dc2626';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-1.5 rounded-full" style={{ width: `${score.pct}%`, backgroundColor: color }} /></div>
      <span className="text-xs font-semibold" style={{ color }}>{score.pct}%</span>
    </div>
  );
}

function IssueStatusSelect({ issue, onChange, allowVerify }) {
  return (
    <Select className="input w-auto py-1 text-xs" value={issue.status} onChange={(e) => onChange(e.target.value)}>
      {Object.entries(ISSUE_STATUS).filter(([k]) => allowVerify || k !== 'verified' || issue.status === 'verified').map(([k, l]) => <option key={k} value={k}>{l}</option>)}
    </Select>
  );
}

function AssignModal({ onClose, onCreated }) {
  const { user } = useAuth();
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [users, setUsers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ projectId: '', title: '', date: today(), dueDate: '', templateKey: '', inspectorId: String(user?.id || ''), instructions: '' });
  useEffect(() => {
    api.listProjectsLite().then(setProjects);
    api.getTemplates().then((t) => { setTemplates(t); setF((x) => ({ ...x, templateKey: x.templateKey || t[0]?.key || '' })); }).catch(() => {});
    listDirectory().then(setUsers);
  }, []);
  const tpl = templates.find((t) => t.key === f.templateKey);
  const submit = async () => {
    if (!f.projectId || !f.title.trim()) { toast.error('Select a site and enter a title'); return; }
    setBusy(true);
    try {
      const row = await api.createInspection({
        projectId: Number(f.projectId), title: f.title.trim(), date: f.date,
        ...(f.dueDate ? { dueDate: f.dueDate } : {}),
        ...(f.templateKey ? { templateKey: f.templateKey } : {}),
        ...(f.inspectorId === 'none' ? { unassigned: true } : f.inspectorId ? { inspectorId: Number(f.inspectorId) } : {}),
        ...(f.instructions.trim() ? { instructions: f.instructions.trim() } : {}),
      });
      toast.success(f.inspectorId === 'none' ? 'Inspection created — assign an inspector when ready' : Number(f.inspectorId) === user?.id ? 'Inspection started' : 'Inspection assigned — inspector notified');
      onCreated(row);
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title="New inspection" wide footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy} onClick={submit}>{Number(f.inspectorId) === user?.id ? 'Start inspection' : 'Assign inspection'}</button></>}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><label className="label">Site / Project</label><Select className="input" value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })}><option value="">Select site…</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></div>
        <div><label className="label">Title</label><input className="input" placeholder="e.g. Slab L3 pre-pour check" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div><label className="label">Inspector</label><Select className="input" value={f.inspectorId} searchable onChange={(e) => setF({ ...f, inspectorId: e.target.value })}><option value="none">Assign later (pending)</option>{users.map((u) => <option key={u.id} value={u.id}>{u.id === user?.id ? `${u.name} (me)` : u.name}{u.designation ? ` · ${u.designation}` : ''}</option>)}</Select></div>
        <div><label className="label">Checklist template</label><Select className="input" value={f.templateKey} onChange={(e) => setF({ ...f, templateKey: e.target.value })}><option value="">Blank checklist</option>{templates.map((t) => <option key={t.key} value={t.key}>{t.name} ({t.items.length} items)</option>)}</Select></div>
        <div><label className="label">Inspection date</label><input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
        <div><label className="label">Due by</label><input type="date" className="input" value={f.dueDate} min={f.date} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></div>
        <div className="sm:col-span-2">
          <label className="label">What to inspect / instructions</label>
          <textarea className="input" rows={3} placeholder="e.g. Check reinforcement spacing on grid C–D, cover blocks, and shuttering alignment before tomorrow's pour." value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} />
        </div>
        {tpl && (
          <div className="sm:col-span-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-900/40">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Checklist the inspector will fill</p>
            <ol className="grid list-decimal gap-x-6 pl-5 text-xs text-slate-600 sm:grid-cols-2 dark:text-slate-300">{tpl.items.map((it) => <li key={it}>{it}</li>)}</ol>
          </div>
        )}
      </div>
    </Modal>
  );
}

function InspectionsList({ mine = false, onChanged }) {
  const { can } = useAuth();
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [filters, setFilters] = useState({ projectId: '', status: mine ? 'active' : '' });
  const [rows, setRows] = useState(null);

  useEffect(() => { if (!mine) api.listProjectsLite().then(setProjects); }, [mine]);
  useEffect(() => {
    setRows(null);
    const clean = Object.fromEntries(Object.entries({ ...filters, ...(mine ? { mine: 'true' } : {}) }).filter(([, v]) => v));
    api.listInspections(clean).then(setRows).catch((e) => { toast.error(errorMessage(e)); setRows([]); });
  }, [filters, mine, toast, onChanged]);

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        {!mine && <Select className="input w-auto" value={filters.projectId} onChange={(e) => setFilters({ ...filters, projectId: e.target.value })}><option value="">All sites</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>}
        <Select className="input w-auto" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">All statuses</option>
          <option value="active">Not yet done</option>
          {Object.entries(INSPECTION_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
      </div>
      {!rows ? <div className="flex justify-center p-10"><Spinner /></div> : rows.length === 0 ? (
        <EmptyState title={mine ? 'Nothing assigned to you' : 'No inspections found'} hint={!mine && can('inspections.manage') ? 'Use "New inspection" to assign one to a site inspector.' : undefined} />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Inspection</th><th>Inspector</th><th>Due</th><th>Checklist</th><th>Score</th><th>Issues</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <td>
                      <Link to={`/inspections/${r.id}`} className="font-medium text-slate-800 hover:text-brand-600 dark:text-slate-100">{r.title}</Link>
                      <p className="text-xs text-slate-400">{r.projectName} · {formatDate(r.date)}</p>
                    </td>
                    <td className="text-slate-600 dark:text-slate-300">{r.inspectorName || '—'}</td>
                    <td className={`whitespace-nowrap ${r.overdue ? 'font-medium text-red-600' : 'text-slate-500'}`}>{r.dueDate ? formatDate(r.dueDate) : '—'}{r.overdue && <span className="block text-[11px]">Overdue</span>}</td>
                    <td><Progress value={r.checklistCount ? (r.answered / r.checklistCount) * 100 : 0} className="w-24" showLabel={false} /><span className="text-[11px] text-slate-400">{r.answered}/{r.checklistCount} checked{r.flagged ? <span className="text-amber-700"> · {r.flagged} flagged</span> : ''}</span></td>
                    <td><ScoreBar score={r.score} /></td>
                    <td className={r.openIssues ? 'font-semibold text-red-600' : 'text-slate-400'}>{r.openIssues ? `${r.openIssues} open` : r.issueCount || '—'}</td>
                    <td><StatusPill status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
  const addItem = () => { if (newItem.trim()) { setChecklist((c) => [...c, { item: newItem.trim(), result: '', remark: '' }]); setNewItem(''); setDirty(true); } };
  const save = async () => {
    try { await api.updateInspection(id, { checklist, remarks: remarks || null }); toast.success('Progress saved'); load(); } catch (e) { toast.error(errorMessage(e)); }
  };
  const setStatus = async (status, msg) => {
    try {
      if (dirty) await api.updateInspection(id, { checklist, remarks: remarks || null });
      await api.updateInspection(id, { status });
      toast.success(msg);
      load();
    } catch (e) { toast.error(errorMessage(e)); }
  };
  const submitIssue = async () => {
    if (!issueForm.description.trim()) { toast.error('Describe the issue'); return; }
    try {
      await api.addIssue(id, { description: issueForm.description.trim(), severity: issueForm.severity, assignedToId: issueForm.assignedToId ? Number(issueForm.assignedToId) : null, correctiveAction: issueForm.correctiveAction || undefined, dueDate: issueForm.dueDate || null });
      toast.success('Issue recorded');
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
  const isInspector = data.isInspector;
  const open = ['pending', 'assigned', 'in_progress'].includes(data.status) && (data.status !== 'pending' || canManage);
  const editable = open && (isInspector || canManage);
  const answeredNow = checklist.filter((c) => c.result).length;
  const left = checklist.length - answeredNow;
  const pctNow = (() => { const r = checklist.filter((c) => c.result === 'pass' || c.result === 'fail'); return r.length ? Math.round((r.filter((c) => c.result === 'pass').length / r.length) * 100) : null; })();
  const overdue = open && data.dueDate && new Date(data.dueDate) < new Date(new Date().toDateString());
  const RESULTS = [{ k: 'pass', l: 'Pass', on: 'bg-emerald-600 text-white' }, { k: 'fail', l: 'Fail', on: 'bg-red-600 text-white' }, { k: 'action', l: 'Action', on: 'bg-amber-500 text-amber-950', t: 'Needs corrective action' }, { k: 'na', l: 'N/A', on: 'bg-slate-500 text-white' }];
  const raiseFromItem = (c) => setIssueForm({ description: `${c.item}${c.remark ? ` — ${c.remark}` : ''}`, severity: c.result === 'fail' ? 'high' : 'medium', assignedToId: '', correctiveAction: '', dueDate: '' });
  const assignInspector = async (uid) => {
    try { await api.updateInspection(id, { inspectorId: Number(uid) }); toast.success('Inspector assigned and notified'); load(); } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Link to="/inspections" className="btn-secondary mt-0.5 h-9 w-9 shrink-0 p-0" aria-label="Back"><Icon name="arrowLeft" className="h-4 w-4" /></Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">{data.title}</h1>
              <StatusPill status={data.status} />
              {overdue && <span className="badge bg-red-50 text-red-700">Overdue</span>}
            </div>
            <p className="mt-0.5 text-sm text-slate-500">{data.projectName} · {formatDate(data.date)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={report}><Icon name="print" className="h-4 w-4" /> Report</button>
          {editable && (
            <button className="btn-success" disabled={left > 0} title={left > 0 ? `${left} checklist item(s) still to mark` : 'Submit as completed'} onClick={() => setStatus('completed', 'Inspection submitted')}>
              <Icon name="check" className="h-4 w-4" /> Mark completed
            </button>
          )}
          {canManage && ['completed', 'follow_up'].includes(data.status) && <button className="btn-primary" onClick={() => setStatus('closed', 'Inspection closed')}>Close inspection</button>}
          {canManage && ['completed', 'follow_up', 'closed'].includes(data.status) && <button className="btn-secondary" onClick={() => setStatus('in_progress', 'Reopened')}>Reopen</button>}
          {canManage && <button className="btn-ghost px-2.5 text-red-600 hover:bg-red-50" onClick={remove} aria-label="Delete inspection" title="Delete"><Icon name="trash" className="h-4 w-4" /></button>}
        </div>
      </div>

      <div className="card mb-4 grid grid-cols-2 divide-slate-100 md:grid-cols-5 md:divide-x dark:divide-slate-700">
        {[
          ['Inspector', data.inspectorName || '—'],
          ['Assigned by', data.createdByName || '—'],
          ['Due by', data.dueDate ? formatDate(data.dueDate) : '—'],
          ['Checklist', `${answeredNow}/${checklist.length} checked`],
          ['Completed', data.completedAt ? `${formatDate(data.completedAt)}${data.completedByName ? ` · ${data.completedByName}` : ''}` : 'Not yet'],
        ].map(([k, v]) => (
          <div key={k} className="px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{k}</p>
            <p className={`mt-0.5 truncate text-sm font-semibold ${k === 'Due by' && overdue ? 'text-red-600' : k === 'Completed' && data.completedAt ? 'text-emerald-600' : 'text-slate-800 dark:text-slate-100'}`}>{v}</p>
          </div>
        ))}
      </div>

      {data.instructions && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/50 dark:text-blue-200">
          <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">What to inspect</p>
          <p className="whitespace-pre-wrap">{data.instructions}</p>
        </div>
      )}
      {data.status === 'pending' && canManage && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:text-amber-200">
          <span className="font-medium">No inspector yet.</span>
          <div className="w-64"><Select className="input py-1.5" value="" searchable placeholder="Assign inspector…" onChange={(e) => e.target.value && assignInspector(e.target.value)}><option value="">Assign inspector…</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}{u.designation ? ` · ${u.designation}` : ''}</option>)}</Select></div>
        </div>
      )}
      {data.status === 'follow_up' && (
        <div className="mb-4"><Alert type="warning">Submitted with {data.checklist.filter((c) => ['fail', 'action'].includes(c.result)).length} item(s) needing corrective action{data.issues.filter((x) => !['resolved', 'verified'].includes(x.status)).length ? ` and ${data.issues.filter((x) => !['resolved', 'verified'].includes(x.status)).length} open issue(s)` : ''}. Track fixes below; it becomes Completed when all issues are resolved.</Alert></div>
      )}
      {isInspector && data.status === 'assigned' && (
        <div className="mb-4"><Alert type="info">This inspection is assigned to you. Mark each checklist item Pass / Fail / N/A, add notes and photos, then click <b>Mark completed</b>.</Alert></div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <div className="card">
            <div className="section-head">
              <span className="section-title">Checklist</span>
              <div className="flex items-center gap-3"><ScoreBar score={{ pct: pctNow }} /><span className="text-xs text-slate-400">{left > 0 ? `${left} left` : 'All checked'}</span></div>
            </div>
            <Progress value={checklist.length ? (answeredNow / checklist.length) * 100 : 0} showLabel={false} size="xs" className="px-4 pt-2" />
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {checklist.map((c, i) => (
                <li key={i} className={`px-4 py-2.5 ${!c.result && editable ? '' : ''}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`flex-1 text-sm ${c.result ? 'text-slate-700 dark:text-slate-200' : 'font-medium text-slate-800 dark:text-slate-100'}`}>{i + 1}. {c.item}</span>
                    <div className="flex gap-1">
                      {RESULTS.map((r) => (
                        <button key={r.k} title={r.t || r.l} disabled={!editable} onClick={() => setItem(i, { result: c.result === r.k ? '' : r.k })}
                          className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition ${c.result === r.k ? `${r.on} border-transparent` : 'border-slate-200 text-slate-500 hover:bg-slate-50 disabled:hover:bg-transparent dark:border-slate-600'}`}>{r.l}</button>
                      ))}
                    </div>
                  </div>
                  {(editable || c.remark) && (
                    <input className="input mt-1.5 py-1 text-xs" placeholder={['fail', 'action'].includes(c.result) ? 'What is wrong / what must be done?' : 'Note (optional)…'} disabled={!editable} value={c.remark || ''} onChange={(e) => setItem(i, { remark: e.target.value })} />
                  )}
                  {['fail', 'action'].includes(c.result) && (canManage || isInspector) && data.status !== 'closed' && !data.issues.some((x) => x.description.startsWith(c.item)) && (
                    <button className="mt-1 text-xs font-medium text-brand-600 hover:underline" onClick={() => raiseFromItem(c)}>+ Raise issue for this item</button>
                  )}
                </li>
              ))}
              {!checklist.length && <li className="px-4 py-4 text-sm text-slate-400">No checklist items yet{editable ? ' — add what needs checking below.' : '.'}</li>}
            </ul>
            {editable && (
              <div className="flex gap-2 border-t border-slate-100 p-3 dark:border-slate-700">
                <input className="input flex-1" placeholder="Add checklist item…" value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addItem()} />
                <button className="btn-secondary" onClick={addItem}>Add</button>
              </div>
            )}
          </div>
          <div className="card p-4">
            <label className="label">Inspection notes</label>
            <textarea className="input" rows={3} placeholder="Overall observations, measurements, weather, people present…" disabled={!editable} value={remarks} onChange={(e) => { setRemarks(e.target.value); setDirty(true); }} />
            {editable && <div className="mt-3 flex justify-end"><button className="btn-primary" disabled={!dirty} onClick={save}>{dirty ? 'Save progress' : 'Saved'}</button></div>}
          </div>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div className="card p-4"><Attachments entityType="inspection" entityId={Number(id)} canUpload={(canManage || isInspector) && data.status !== 'closed'} label="Site photos" accept="image/*" capture /></div>
          <div className="card">
            <div className="section-head">
              <span className="section-title">Issues &amp; corrective actions</span>
              {(canManage || isInspector) && data.status !== 'closed' && <button className="text-xs font-medium text-brand-600 hover:underline" onClick={() => setIssueForm({ description: '', severity: 'medium', assignedToId: '', correctiveAction: '', dueDate: '' })}>+ Record issue</button>}
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {data.issues.map((is) => (
                <li key={is.id} className="space-y-1.5 px-4 py-3">
                  <div className="flex items-start gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${SEVERITY[is.severity]}`}>{is.severity}</span>
                    <p className="flex-1 text-sm text-slate-700 dark:text-slate-200">{is.description}</p>
                  </div>
                  <p className="text-xs text-slate-500">{is.assignedToName ? `Assigned: ${is.assignedToName}` : 'Unassigned'}{is.dueDate ? ` · Due ${formatDate(is.dueDate)}` : ''}</p>
                  {is.correctiveAction && <p className="text-xs text-slate-500"><span className="font-medium">Action:</span> {is.correctiveAction}</p>}
                  <div className="flex flex-wrap gap-2">
                    {canManage ? <IssueStatusSelect issue={is} allowVerify onChange={(v) => patchIssue(is, { status: v })} /> : <span className="badge bg-slate-100 text-slate-600">{ISSUE_STATUS[is.status]}</span>}
                    {canManage && (
                      <Select className="input w-auto py-1 text-xs" value={is.assignedToId || ''} onChange={(e) => patchIssue(is, { assignedToId: e.target.value ? Number(e.target.value) : null })}>
                        <option value="">Unassigned</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </Select>
                    )}
                  </div>
                </li>
              ))}
              {!data.issues.length && <li className="px-4 py-4 text-sm text-slate-400">No issues identified.</li>}
            </ul>
          </div>
        </div>
      </div>

      {issueForm && (
        <Modal open onClose={() => setIssueForm(null)} title="Record issue" footer={<><button className="btn-secondary" onClick={() => setIssueForm(null)}>Cancel</button><button className="btn-primary" onClick={submitIssue}>Add issue</button></>}>
          <div className="space-y-3">
            <div><label className="label">Issue</label><textarea className="input" rows={3} autoFocus value={issueForm.description} onChange={(e) => setIssueForm({ ...issueForm, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Severity</label><Select className="input" value={issueForm.severity} onChange={(e) => setIssueForm({ ...issueForm, severity: e.target.value })}>{Object.keys(SEVERITY).map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}</Select></div>
              <div><label className="label">Due date</label><input type="date" className="input" value={issueForm.dueDate} onChange={(e) => setIssueForm({ ...issueForm, dueDate: e.target.value })} /></div>
            </div>
            <div><label className="label">Assign to</label><Select className="input" value={issueForm.assignedToId} onChange={(e) => setIssueForm({ ...issueForm, assignedToId: e.target.value })}><option value="">— Unassigned —</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}{u.designation ? ` · ${u.designation}` : ''}</option>)}</Select></div>
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
  const navigate = useNavigate();
  const canRead = can('inspections.read');
  const [stats, setStats] = useState(null);
  const [tab, setTab] = useState(canRead ? 'list' : 'assigned');
  const [assign, setAssign] = useState(false);
  useEffect(() => { api.getStats().then(setStats).catch(() => {}); }, []);
  const tabs = [
    { key: 'list', label: 'All inspections', hidden: !canRead },
    { key: 'assigned', label: 'Assigned to me', count: stats?.mine },
    { key: 'issues', label: 'My issues' },
  ];
  return (
    <div>
      <PageHeader
        title="Site Inspection"
        subtitle="Assign checklists to inspectors, track completion, photos and corrective actions"
        actions={can('inspections.manage') && <button className="btn-primary" onClick={() => setAssign(true)}><Icon name="add" className="h-4 w-4" /> New inspection</button>}
      />
      {stats && canRead && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="Pending / assigned" value={(stats.pending || 0) + (stats.assigned || 0)} hint={stats.pending ? `${stats.pending} without inspector` : 'Not started'} />
          <Stat label="In progress" value={stats.in_progress || 0} tone="info" />
          <Stat label="Needs follow-up" value={stats.follow_up || 0} tone={stats.follow_up ? 'warning' : 'neutral'} hint="Corrective actions open" />
          <Stat label="Completed / closed" value={(stats.completed || 0) + (stats.closed || 0)} tone="success" />
          <Stat label="Overdue" value={stats.overdue || 0} tone={stats.overdue ? 'danger' : 'neutral'} />
        </div>
      )}
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'list' && <InspectionsList />}
      {tab === 'assigned' && <InspectionsList mine />}
      {tab === 'issues' && <MyIssues />}
      {assign && <AssignModal onClose={() => setAssign(false)} onCreated={(row) => { setAssign(false); navigate(`/inspections/${row.id}`); }} />}
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
