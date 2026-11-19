import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { errorMessage } from '../../lib/api';
import { formatDate, formatDateTime } from '../../lib/format';
import { listDirectory } from '../../lib/files';
import { PageHeader, Spinner, EmptyState, Tabs, Stat } from '../../components/ui';
import Modal from '../../components/Modal';
import Attachments from '../../components/Attachments';
import Select from '../../components/Select';
import MultiSelect from '../../components/MultiSelect';
import Icon from '../../components/Icon';
import * as api from './api';

export const PRIORITY = {
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  normal: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  high: 'bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  urgent: 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};
export const QSTATUS = {
  open: { label: 'Open', cls: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200' },
  assigned: { label: 'Assigned', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  awaiting_response: { label: 'Awaiting response', cls: 'bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  responded: { label: 'Responded', cls: 'bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' },
  resolved: { label: 'Resolved', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  closed: { label: 'Closed', cls: 'bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-200' },
};
export const QTYPE = { rfi: 'RFI', clarification: 'Technical clarification', site_issue: 'Site issue', design_change: 'Design change', approval: 'Approval needed', general: 'General' };
const STEPS = ['open', 'assigned', 'responded', 'resolved', 'closed'];

const peopleOptions = (users) => users.map((u) => ({ value: u.id, label: u.name, sub: u.designation || '' }));

function StatusSteps({ status }) {
  const at = status === 'awaiting_response' ? 1 : STEPS.indexOf(status);
  return (
    <ol className="flex items-center gap-1 text-[11px]">
      {STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-1">
          <span className={`rounded-full px-2 py-0.5 font-medium ${i < at ? 'bg-emerald-50 text-emerald-700' : i === at ? QSTATUS[status]?.cls : 'bg-slate-50 text-slate-400 dark:bg-slate-800'}`}>{i === at ? QSTATUS[status]?.label : QSTATUS[s].label}</span>
          {i < STEPS.length - 1 && <span className="text-slate-300">›</span>}
        </li>
      ))}
    </ol>
  );
}

function QueryForm({ initial, users, projects, onClose, onSaved }) {
  const { bootstrap } = useAuth();
  const toast = useToast();
  const categories = bootstrap?.settings?.queries?.categories || [];
  const [f, setF] = useState(initial);
  const [phases, setPhases] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (f.projectId) api.getProjectPhases(f.projectId).then(setPhases);
    else setPhases([]);
  }, [f.projectId]);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    if (!f.title.trim()) { toast.error('Enter a subject'); return; }
    setBusy(true);
    try {
      const body = {
        type: f.type, category: f.category || null, projectId: f.projectId ? Number(f.projectId) : null, phaseId: f.phaseId ? Number(f.phaseId) : null,
        location: f.location || null, workItem: f.workItem || null, title: f.title.trim(), description: f.description || undefined, priority: f.priority,
        visibility: f.visibility, assigneeIds: f.assigneeIds, mentionIds: f.mentionIds, dueDate: f.dueDate || null, costImpact: f.costImpact, scheduleImpact: f.scheduleImpact,
      };
      const q = f.id ? await api.updateQuery(f.id, body) : await api.createQuery(body);
      toast.success(f.id ? 'Query updated' : `Query ${q.number || ''} raised`);
      onSaved(q);
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={f.id ? `Edit ${f.ref}` : 'Raise a query / RFI'} wide dismissOnBackdrop={false}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy} onClick={save}>{f.id ? 'Save' : 'Raise query'}</button></>}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
        <div className="sm:col-span-2"><label className="label">Type</label><Select className="input" value={f.type} onChange={(e) => set('type', e.target.value)}>{Object.entries(QTYPE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></div>
        <div className="sm:col-span-2"><label className="label">Priority</label><Select className="input" value={f.priority} onChange={(e) => set('priority', e.target.value)}>{['low', 'normal', 'high', 'urgent'].map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}</Select></div>
        <div className="sm:col-span-2"><label className="label">Response needed by</label><input type="date" className="input" value={f.dueDate} onChange={(e) => set('dueDate', e.target.value)} /></div>
        <div className="sm:col-span-6"><label className="label">Subject</label><input className="input" autoFocus placeholder="e.g. Beam B4 reinforcement clashes with duct opening" value={f.title} onChange={(e) => set('title', e.target.value)} /></div>
        <div className="sm:col-span-3"><label className="label">Project</label><Select className="input" value={f.projectId} clearable placeholder="General (no project)" onChange={(e) => setF((x) => ({ ...x, projectId: e.target.value, phaseId: '' }))}><option value="">General (no project)</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></div>
        <div className="sm:col-span-3"><label className="label">Stage / phase</label><Select className="input" value={f.phaseId} clearable disabled={!f.projectId} placeholder={f.projectId ? 'Whole project' : 'Select a project first'} emptyText="This project has no stages" onChange={(e) => set('phaseId', e.target.value)}><option value="">Whole project</option>{phases.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></div>
        <div className="sm:col-span-3"><label className="label">Location</label><input className="input" placeholder="Block / floor / grid / room" value={f.location} onChange={(e) => set('location', e.target.value)} /></div>
        <div className="sm:col-span-3"><label className="label">Activity / work item</label><input className="input" placeholder="e.g. Slab casting, plumbing rough-in" value={f.workItem} onChange={(e) => set('workItem', e.target.value)} /></div>
        <div className="sm:col-span-6"><label className="label">Question / details</label><textarea className="input" rows={4} placeholder="What exactly do you need answered? Reference drawings, specs or photos." value={f.description} onChange={(e) => set('description', e.target.value)} /></div>
        <div className="sm:col-span-3"><label className="label">Assign to (responders)</label><MultiSelect options={peopleOptions(users)} value={f.assigneeIds} onChange={(v) => set('assigneeIds', v)} placeholder="Who should answer?" loading={!users.length} /></div>
        <div className="sm:col-span-3"><label className="label">Tag / keep informed</label><MultiSelect options={peopleOptions(users).filter((o) => !f.assigneeIds.includes(o.value))} value={f.mentionIds} onChange={(v) => set('mentionIds', v)} placeholder="Mention people" loading={!users.length} /></div>
        {categories.length > 0 && <div className="sm:col-span-2"><label className="label">Category</label><Select className="input" value={f.category} clearable onChange={(e) => set('category', e.target.value)}><option value="">—</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</Select></div>}
        <div className={categories.length ? 'sm:col-span-2' : 'sm:col-span-3'}><label className="label">Visible to</label><Select className="input" value={f.visibility} onChange={(e) => set('visibility', e.target.value)}><option value="assigned">Only people involved</option><option value="all">Everyone on the project</option></Select></div>
        <div className={`flex items-end gap-4 pb-2 ${categories.length ? 'sm:col-span-2' : 'sm:col-span-3'}`}>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-600" checked={f.costImpact} onChange={(e) => set('costImpact', e.target.checked)} /> Cost impact</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-600" checked={f.scheduleImpact} onChange={(e) => set('scheduleImpact', e.target.checked)} /> Delay impact</label>
        </div>
      </div>
      {!f.id && <p className="mt-3 text-xs text-slate-500">You can attach drawings and photos after raising the query.</p>}
    </Modal>
  );
}

function QueryDetail({ id, users, projects, onClose, onChanged }) {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [q, setQ] = useState(null);
  const [msg, setMsg] = useState('');
  const [tag, setTag] = useState([]);
  const [resolving, setResolving] = useState(null);
  const [editing, setEditing] = useState(false);
  const endRef = useRef(null);
  const load = useCallback(() => api.getQuery(id).then(setQ).catch((e) => { toast.error(errorMessage(e)); onClose(); }), [id, toast, onClose]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [q?.replies?.length]);
  if (!q) return null;
  const active = !['resolved', 'closed'].includes(q.status);
  const run = async (fn, okMsg) => { try { await fn(); if (okMsg) toast.success(okMsg); load(); onChanged(); } catch (e) { toast.error(errorMessage(e)); } };
  const send = () => msg.trim() && run(async () => { await api.replyQueryWith(id, { message: msg.trim(), mentionIds: tag }); setMsg(''); setTag([]); });
  const remove = async () => {
    if (!(await confirm({ title: `Delete ${q.ref}?`, message: q.title, confirmLabel: 'Delete' }))) return;
    try { await api.deleteQuery(id); onChanged(); onClose(); } catch (e) { toast.error(errorMessage(e)); }
  };
  const lastResponse = [...q.replies].reverse().find((r) => r.kind === 'response');

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl dark:bg-slate-800">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500">{q.ref} · {QTYPE[q.type] || q.type}{q.category ? ` · ${q.category}` : ''}</p>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{q.title}</h3>
            </div>
            <button className="btn-ghost px-2" onClick={onClose} aria-label="Close"><Icon name="close" className="h-4 w-4" /></button>
          </div>
          <div className="mt-2"><StatusSteps status={q.status} /></div>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
            {[
              ['Project', q.projectName || 'General'], ['Stage', q.phaseName || '—'], ['Location', q.location || '—'], ['Work item', q.workItem || '—'],
              ['Raised by', `${q.createdByName} · ${formatDate(q.createdAt)}`], ['Response due', q.dueDate ? formatDate(q.dueDate) : '—'],
              ['Priority', q.priority], ['Impact', [q.costImpact && 'Cost', q.scheduleImpact && 'Schedule'].filter(Boolean).join(' & ') || 'None noted'],
            ].map(([k, v]) => (
              <div key={k}><dt className="text-[11px] uppercase tracking-wide text-slate-400">{k}</dt><dd className={`capitalize-first ${k === 'Response due' && q.overdue ? 'font-semibold text-red-600' : 'text-slate-800 dark:text-slate-200'}`}>{v}{k === 'Response due' && q.overdue ? ' · overdue' : ''}</dd></div>
            ))}
          </dl>
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className="text-xs text-slate-500">Responders:</span>
            {q.assignees.length ? q.assignees.map((a) => <span key={a.id} className="badge bg-blue-50 text-blue-700">{a.name}</span>) : <span className="text-xs text-amber-700">Not assigned yet</span>}
            {q.mentions.length > 0 && <><span className="ml-2 text-xs text-slate-500">Tagged:</span>{q.mentions.map((m) => <span key={m.id} className="badge bg-slate-100 text-slate-600">@{m.name}</span>)}</>}
          </div>
          {q.description && <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-900/40 dark:text-slate-200">{q.description}</p>}
          {q.status === 'resolved' || q.status === 'closed' ? (
            q.resolution && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:text-emerald-200"><p className="text-xs font-semibold uppercase tracking-wide">Resolution · {q.resolvedByName} · {formatDate(q.resolvedAt)}</p><p className="mt-1 whitespace-pre-wrap">{q.resolution}</p></div>
          ) : q.status === 'responded' && q.canManage ? (
            <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900 dark:border-violet-900/50 dark:text-violet-200">A responder has answered. If it settles the question, <b>resolve</b> it; otherwise reply with a follow-up.</div>
          ) : null}
          <Attachments entityType="query" entityId={q.id} label="Drawings, photos & files" capture />
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Discussion</p>
            <div className="space-y-2">
              {q.replies.length === 0 && <p className="text-sm text-slate-400">No replies yet.</p>}
              {q.replies.map((r) => (r.kind === 'event' ? (
                <p key={r.id} className="text-center text-[11px] text-slate-400">{r.userName} · {r.message} · {formatDateTime(r.createdAt)}</p>
              ) : (
                <div key={r.id} className={`flex ${r.userId === user?.id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${r.kind === 'response' ? 'border border-violet-200 bg-violet-50 text-slate-800 dark:border-violet-900/50 dark:bg-violet-900/20 dark:text-slate-100' : r.userId === user?.id ? 'bg-brand-100 text-brand-900 dark:bg-slate-700 dark:text-slate-100' : 'bg-slate-100 text-slate-800 dark:bg-slate-900/50 dark:text-slate-100'}`}>
                    <p className="text-[10px] text-slate-500">{r.userName}{r.kind === 'response' ? ' · RESPONSE' : ''} · {formatDateTime(r.createdAt)}</p>
                    <p className="whitespace-pre-wrap">{r.message}</p>
                  </div>
                </div>
              )))}
              <div ref={endRef} />
            </div>
          </div>
        </div>
        <div className="border-t border-slate-200 p-4 dark:border-slate-700">
          {active ? (
            <>
              <textarea className="input" rows={2} placeholder={q.isAssignee ? 'Write your response…' : 'Reply or ask a follow-up…'} value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); }} />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="min-w-[14rem] flex-1"><MultiSelect options={peopleOptions(users)} value={tag} onChange={setTag} placeholder="@ Tag people (optional)" /></div>
                <button className="btn-primary" disabled={!msg.trim()} onClick={send}>{q.isAssignee ? 'Send response' : 'Send'}</button>
              </div>
            </>
          ) : <p className="text-sm text-slate-500">This query is {q.status}. Reopen it to continue the discussion.</p>}
          <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
            {q.canManage && active && <button className="btn-success btn-sm" onClick={() => setResolving(lastResponse?.message || '')}>Resolve</button>}
            {q.canManage && q.status === 'resolved' && <button className="btn-secondary btn-sm" onClick={() => run(() => api.closeQuery(id), 'Closed')}>Close</button>}
            {q.canManage && !active && <button className="btn-secondary btn-sm" onClick={() => run(() => api.reopenQuery(id), 'Reopened')}>Reopen</button>}
            {q.canManage && active && <button className="btn-secondary btn-sm" onClick={() => setEditing(true)}><Icon name="edit" className="h-3.5 w-3.5" /> Edit / reassign</button>}
            {q.canManage && <button className="btn-ghost btn-sm ml-auto text-red-600 hover:bg-red-50" onClick={remove}><Icon name="trash" className="h-3.5 w-3.5" /></button>}
          </div>
        </div>
      </aside>
      {resolving !== null && (
        <Modal open onClose={() => setResolving(null)} title={`Resolve ${q.ref}`} footer={<><button className="btn-secondary" onClick={() => setResolving(null)}>Cancel</button><button className="btn-success" onClick={() => run(async () => { await api.resolveQuery(id, resolving); setResolving(null); }, 'Query resolved')}>Resolve</button></>}>
          <label className="label">Resolution / decision</label>
          <textarea className="input" rows={4} autoFocus value={resolving} onChange={(e) => setResolving(e.target.value)} placeholder="Record the answer and any instruction given to site." />
          <p className="mt-2 text-xs text-slate-500">Everyone involved is notified.</p>
        </Modal>
      )}
      {editing && (
        <QueryForm
          initial={{ ...q, projectId: q.projectId ? String(q.projectId) : '', phaseId: q.phaseId ? String(q.phaseId) : '', location: q.location || '', workItem: q.workItem || '', description: q.description || '', category: q.category || '', dueDate: q.dueDate ? String(q.dueDate).slice(0, 10) : '', assigneeIds: q.assignees.map((a) => a.id), mentionIds: q.mentions.map((m) => m.id) }}
          users={users}
          projects={projects}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); load(); onChanged(); }}
        />
      )}
    </div>
  );
}

const blankQuery = () => ({ type: 'rfi', category: '', projectId: '', phaseId: '', location: '', workItem: '', title: '', description: '', priority: 'normal', visibility: 'assigned', assigneeIds: [], mentionIds: [], dueDate: '', costImpact: false, scheduleImpact: false });

function QueryRow({ q, onOpen, showProject }) {
  const resolved = ['resolved', 'closed'].includes(q.status);
  return (
    <tr className="cursor-pointer align-top hover:bg-slate-50 dark:hover:bg-slate-800/60" onClick={onOpen}>
      <td className="max-w-sm">
        <p className="font-medium text-slate-800 dark:text-slate-100">{q.title}</p>
        <p className="text-xs text-slate-400">{q.ref} · {QTYPE[q.type] || q.type}{q.phaseName ? ` · ${q.phaseName}` : ''}{q.location ? ` · ${q.location}` : ''}</p>
        {showProject && <p className="mt-0.5 text-xs font-medium text-brand-700 dark:text-brand-300">{q.projectName || 'General'}</p>}
      </td>
      <td className="text-sm">
        {q.assignees.length ? <span className="text-slate-700 dark:text-slate-200">{q.assignees.map((a) => a.name).join(', ')}</span> : <span className="text-amber-700">Unassigned</span>}
        <span className="block text-xs text-slate-400">Raised by {q.createdByName || '—'}</span>
      </td>
      <td className="whitespace-nowrap">
        <span className={`badge ${QSTATUS[q.status]?.cls}`}>{QSTATUS[q.status]?.label || q.status}</span>
        {q.priority !== 'normal' && <span className={`badge ml-1 capitalize ${PRIORITY[q.priority]}`}>{q.priority}</span>}
        <span className={`block pt-0.5 text-xs ${q.overdue ? 'font-semibold text-red-600' : 'text-slate-400'}`}>{q.dueDate ? `${q.overdue ? 'Overdue · ' : 'Due '}${formatDate(q.dueDate)}` : `${q.replyCount} message${q.replyCount === 1 ? '' : 's'}`}</span>
      </td>
      <td className="max-w-xs text-sm">
        {resolved && q.resolution ? (
          <>
            <p className="line-clamp-2 text-slate-700 dark:text-slate-200" title={q.resolution}>{q.resolution}</p>
            <p className="text-xs text-slate-400">{q.resolvedByName || '—'}{q.resolvedAt ? ` · ${formatDate(q.resolvedAt)}` : ''}</p>
          </>
        ) : <span className="text-xs text-slate-400">{resolved ? 'Resolved' : 'Not resolved yet'}</span>}
      </td>
    </tr>
  );
}

export default function QueriesPage() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const openId = params.get('id');
  const [scope, setScope] = useState(() => (params.get('projectId') ? 'all' : 'mine'));
  const [filters, setFilters] = useState(() => ({ status: 'active', projectId: params.get('projectId') || '', type: '', search: '', overdue: '' }));
  const [group, setGroup] = useState(true);
  const [rows, setRows] = useState(null);
  const [counts, setCounts] = useState(null);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [create, setCreate] = useState(null);

  const load = useCallback(() => {
    const p = Object.fromEntries(Object.entries({ ...filters, scope }).filter(([, v]) => v));
    api.listQueries(p).then(setRows).catch(() => setRows([]));
    api.queryCounts().then(setCounts).catch(() => {});
  }, [filters, scope]);
  useEffect(() => { setRows(null); load(); }, [load]);
  useEffect(() => { listDirectory().then(setUsers); api.listProjectsLite().then(setProjects); }, []);
  // Deep link from a project / stage: /queries?new=1&projectId=..&phaseId=..
  useEffect(() => {
    if (params.get('new')) {
      setCreate({ ...blankQuery(), projectId: params.get('projectId') || '', phaseId: params.get('phaseId') || '' });
      setParams({}, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const open = (q) => setParams({ id: String(q.id) });

  // Group by project so each site's queries sit together.
  const groups = [];
  if (rows) {
    const by = new Map();
    for (const q of rows) {
      const k = q.projectId || 0;
      if (!by.has(k)) { by.set(k, { id: k, name: q.projectName || 'General (no project)', rows: [] }); groups.push(by.get(k)); }
      by.get(k).rows.push(q);
    }
    groups.sort((a, b) => (a.id === 0) - (b.id === 0) || a.name.localeCompare(b.name));
  }
  const STATUS_CHIPS = [['active', 'Open'], ['responded', 'Answered'], ['resolved', 'Resolved'], ['closed', 'Closed'], ['', 'All']];

  return (
    <div>
      <PageHeader
        title="Queries & RFIs"
        subtitle="Questions from site — which project, who must answer, and how each was resolved"
        actions={can('queries.create') && <button className="btn-primary" onClick={() => setCreate({ ...blankQuery(), projectId: filters.projectId || '' })}><Icon name="add" className="h-4 w-4" /> Raise query</button>}
      />
      {counts && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Open queries" value={counts.active} onClick={() => { setScope('all'); setFilters((f) => ({ ...f, status: 'active', overdue: '' })); }} />
          <Stat label="Need my response" value={counts.assignedToMe} tone={counts.assignedToMe ? 'info' : 'neutral'} onClick={() => setScope('assigned')} />
          <Stat label="Answered — to review" value={counts.awaitingMe} tone={counts.awaitingMe ? 'warning' : 'neutral'} onClick={() => { setScope('raised'); set('status', 'responded'); }} hint="Raised by me" />
          <Stat label="Overdue" value={counts.overdue} tone={counts.overdue ? 'danger' : 'neutral'} onClick={() => { setScope('all'); setFilters((f) => ({ ...f, status: 'active', overdue: 'true' })); }} />
        </div>
      )}
      <Tabs tabs={[{ key: 'mine', label: 'Involving me' }, { key: 'assigned', label: 'Assigned to me' }, { key: 'raised', label: 'Raised by me' }, { key: 'all', label: 'All I can see' }]} value={scope} onChange={setScope} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input className="input pl-9" placeholder="Search subject, number or location…" value={filters.search} onChange={(e) => set('search', e.target.value)} />
        </div>
        <Select className="input w-auto" value={filters.projectId} searchable clearable placeholder="All projects" onChange={(e) => set('projectId', e.target.value)}><option value="">All projects</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        <Select className="input w-auto" value={filters.type} onChange={(e) => set('type', e.target.value)}><option value="">All types</option>{Object.entries(QTYPE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
        {filters.overdue && <button className="btn-secondary btn-sm" onClick={() => set('overdue', '')}>Overdue only ×</button>}
      </div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_CHIPS.map(([k, l]) => (
            <button key={l} onClick={() => set('status', k)} className={`rounded-full px-3 py-1 text-xs font-medium ${filters.status === k ? 'bg-brand-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600'}`}>{l}</button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><input type="checkbox" checked={group} onChange={(e) => setGroup(e.target.checked)} /> Group by project</label>
      </div>
      {!rows ? <div className="flex justify-center p-10"><Spinner /></div> : rows.length === 0 ? (
        <EmptyState title="No queries here" hint={can('queries.create') ? 'Raise a query when site needs an answer, a clarification or a decision.' : undefined} />
      ) : group ? (
        <div className="space-y-4">
          {groups.map((g) => {
            const openN = g.rows.filter((q) => !['resolved', 'closed'].includes(q.status)).length;
            return (
              <div key={g.id} className="card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cream-200 bg-cream-50 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800/60">
                  <div className="flex min-w-0 items-center gap-2">
                    <Icon name="projects" className="h-4 w-4 shrink-0 text-brand-600" />
                    {g.id ? <Link to={`/projects/${g.id}`} className="truncate font-semibold text-slate-800 hover:text-brand-700 dark:text-slate-100">{g.name}</Link> : <span className="font-semibold text-slate-800 dark:text-slate-100">{g.name}</span>}
                    <span className="text-xs text-slate-500">{g.rows.length} quer{g.rows.length === 1 ? 'y' : 'ies'}{openN ? ` · ${openN} open` : ''}</span>
                  </div>
                  {can('queries.create') && <button className="btn-ghost btn-sm text-brand-700" onClick={() => setCreate({ ...blankQuery(), projectId: g.id ? String(g.id) : '' })}><Icon name="add" className="h-3.5 w-3.5" /> Add query</button>}
                </div>
                <div className="overflow-x-auto">
                  <table className="table-base">
                    <thead><tr><th>Query</th><th>Responsible</th><th>Status</th><th>Outcome / resolution</th></tr></thead>
                    <tbody>{g.rows.map((q) => <QueryRow key={q.id} q={q} onOpen={() => open(q)} />)}</tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Query · project</th><th>Responsible</th><th>Status</th><th>Outcome / resolution</th></tr></thead>
              <tbody>{rows.map((q) => <QueryRow key={q.id} q={q} showProject onOpen={() => open(q)} />)}</tbody>
            </table>
          </div>
        </div>
      )}
      {create && <QueryForm initial={create} users={users} projects={projects} onClose={() => setCreate(null)} onSaved={(q) => { setCreate(null); load(); setParams({ id: String(q.id) }); }} />}
      {openId && <QueryDetail id={Number(openId)} users={users} projects={projects} onClose={() => setParams({})} onChanged={load} />}
    </div>
  );
}
