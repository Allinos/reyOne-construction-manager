import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { errorMessage } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { listDirectory } from '../../lib/files';
import { PageHeader, Card, Spinner, EmptyState } from '../../components/ui';
import Modal from '../../components/Modal';
import Attachments from '../../components/Attachments';
import * as api from './api';
import Select from '../../components/Select';

export const PRIORITY = {
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  normal: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};
export const QSTATUS = {
  open: { label: 'Open', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  in_progress: { label: 'In progress', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  resolved: { label: 'Resolved', cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  closed: { label: 'Closed', cls: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
};

function UserMultiSelect({ users, value, onChange }) {
  const [q, setQ] = useState('');
  const list = users.filter((u) => !q || u.name.toLowerCase().includes(q.toLowerCase()));
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div>
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((id) => <span key={id} className="badge bg-brand-50 text-brand-700">{users.find((u) => u.id === id)?.name || id}<button className="ml-1" onClick={() => toggle(id)}>×</button></span>)}
        </div>
      )}
      <input className="input mb-2" placeholder="Search people…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="max-h-40 overflow-auto rounded-lg border border-cream-300 dark:border-slate-700">
        {list.map((u) => (
          <label key={u.id} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-cream-100 dark:hover:bg-slate-800">
            <input type="checkbox" checked={value.includes(u.id)} onChange={() => toggle(u.id)} />
            <span>{u.name}</span><span className="ml-auto text-xs text-slate-400">{u.designation}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function QueryDetail({ id, users, onClose, onChanged }) {
  const { user, can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [q, setQ] = useState(null);
  const [msg, setMsg] = useState('');
  const [assigning, setAssigning] = useState(null);
  const endRef = useRef(null);
  const load = useCallback(() => api.getQuery(id).then(setQ).catch((e) => { toast.error(errorMessage(e)); onClose(); }), [id, toast, onClose]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [q?.replies?.length]);
  if (!q) return null;
  const isOwner = q.createdById === user?.id;
  const isManager = can('queries.manage');
  const isAssignee = q.assignees.some((a) => a.id === user?.id);
  const canEditStatus = isManager || isOwner || isAssignee;

  const send = async () => {
    if (!msg.trim()) return;
    try { await api.replyQuery(id, msg.trim()); setMsg(''); load(); onChanged(); } catch (e) { toast.error(errorMessage(e)); }
  };
  const patch = async (b, okMsg) => {
    try { await api.updateQuery(id, b); if (okMsg) toast.success(okMsg); load(); onChanged(); } catch (e) { toast.error(errorMessage(e)); }
  };
  const remove = async () => {
    if (!(await confirm({ title: 'Delete query?', message: q.title, confirmLabel: 'Delete' }))) return;
    try { await api.deleteQuery(id); onChanged(); onClose(); } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <Modal open onClose={onClose} title={q.title} wide fullscreenable footer={
      <div className="flex w-full flex-wrap items-center gap-2">
        {(isManager || isOwner) && <button className="btn-secondary text-red-600" onClick={remove}>Delete</button>}
        <div className="ml-auto flex gap-2">
          {canEditStatus && q.status !== 'resolved' && q.status !== 'closed' && <button className="btn-primary" onClick={() => patch({ status: 'resolved' }, 'Marked resolved')}>Mark Resolved</button>}
          {(isManager || isOwner) && q.status === 'resolved' && <button className="btn-secondary" onClick={() => patch({ status: 'closed' }, 'Closed')}>Close</button>}
          {canEditStatus && ['resolved', 'closed'].includes(q.status) && <button className="btn-secondary" onClick={() => patch({ status: 'open' }, 'Reopened')}>Reopen</button>}
        </div>
      </div>
    }>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-2 py-0.5 font-medium ${QSTATUS[q.status].cls}`}>{QSTATUS[q.status].label}</span>
        <span className={`rounded-full px-2 py-0.5 font-medium capitalize ${PRIORITY[q.priority]}`}>{q.priority}</span>
        {q.projectName && <span className="badge bg-cream-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200">{q.projectName}</span>}
        <span className="text-slate-400">{q.visibility === 'all' ? 'Visible to everyone' : 'Assigned only'} · by {q.createdByName} · {formatDateTime(q.createdAt)}</span>
      </div>
      {q.description && <p className="mb-3 whitespace-pre-wrap rounded-lg bg-cream-100 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">{q.description}</p>}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-500">Assigned:</span>
        {q.assignees.length ? q.assignees.map((a) => <span key={a.id} className="badge bg-brand-50 text-brand-700">{a.name}</span>) : <span className="text-slate-400">—</span>}
        {(isManager || isOwner) && <button className="text-xs text-brand-600 hover:underline" onClick={() => setAssigning(q.assignees.map((a) => a.id))}>Change</button>}
      </div>
      {assigning && (
        <div className="mb-4 rounded-lg border border-cream-300 p-3 dark:border-slate-700">
          <UserMultiSelect users={users} value={assigning} onChange={setAssigning} />
          <div className="mt-2 flex justify-end gap-2"><button className="btn-secondary py-1" onClick={() => setAssigning(null)}>Cancel</button><button className="btn-primary py-1" onClick={() => { patch({ assigneeIds: assigning }, 'Assignees updated'); setAssigning(null); }}>Save</button></div>
        </div>
      )}
      <div className="mb-4"><Attachments entityType="query" entityId={q.id} label="Attachments" /></div>
      <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Conversation</p>
      <div className="max-h-[40vh] space-y-2 overflow-auto rounded-lg border border-cream-200 p-3 dark:border-slate-700">
        {q.replies.length === 0 && <p className="text-center text-xs text-slate-400">No replies yet.</p>}
        {q.replies.map((r) => (
          <div key={r.id} className={`flex ${r.userId === user?.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${r.userId === user?.id ? 'bg-brand-500 text-brand-900' : 'bg-cream-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>
              <p className={`text-[10px] ${r.userId === user?.id ? 'text-brand-100' : 'text-slate-400'}`}>{r.userName} · {formatDateTime(r.createdAt)}</p>
              <p className="whitespace-pre-wrap">{r.message}</p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="mt-3 flex gap-2">
        <textarea className="input flex-1" rows={2} placeholder="Write a reply…" value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); }} />
        <button className="btn-primary self-end" onClick={send} disabled={!msg.trim()}>Send</button>
      </div>
    </Modal>
  );
}

export default function QueriesPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState({ scope: 'all', status: 'active', projectId: '', priority: '', search: '' });
  const [rows, setRows] = useState(null);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [create, setCreate] = useState(null);
  const openId = params.get('id');

  useEffect(() => { api.listProjectsLite().then(setProjects); listDirectory().then(setUsers); }, []);
  const load = useCallback(() => {
    const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v && v !== 'all'));
    if (filters.status === 'all') delete clean.status;
    api.listQueries(clean).then(setRows).catch((e) => toast.error(errorMessage(e)));
  }, [filters, toast]);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!create.title.trim()) { toast.error('Enter a title'); return; }
    try {
      const q = await api.createQuery({ title: create.title.trim(), description: create.description || undefined, priority: create.priority, visibility: create.visibility, projectId: create.projectId ? Number(create.projectId) : null, assigneeIds: create.assigneeIds });
      toast.success(create.assigneeIds.length ? 'Query raised — assignees notified' : 'Query raised');
      setCreate(null);
      load();
      setParams({ id: String(q.id) });
    } catch (e) { toast.error(errorMessage(e)); }
  };
  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  return (
    <div>
      <PageHeader title="Queries" subtitle="Raise, assign and resolve project & site queries" actions={can('queries.create') && <button className="btn-primary" onClick={() => setCreate({ title: '', description: '', priority: 'normal', visibility: 'assigned', projectId: '', assigneeIds: [] })}>+ Raise Query</button>} />
      <div className="mb-4 flex flex-wrap gap-2">
        {[['all', 'All'], ['mine', 'Raised by / for me'], ['assigned', 'Assigned to me']].map(([k, l]) => (
          <button key={k} onClick={() => set('scope', k)} className={`rounded-full px-3 py-1.5 text-sm font-medium ${filters.scope === k ? 'bg-brand-500 text-brand-900' : 'bg-cream-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>{l}</button>
        ))}
      </div>
      <Card className="mb-4">
        <div className="flex flex-wrap gap-3">
          <input className="input min-w-[180px] flex-1" placeholder="Search…" value={filters.search} onChange={(e) => set('search', e.target.value)} />
          <Select className="input w-auto" value={filters.status} onChange={(e) => set('status', e.target.value)}><option value="active">Open &amp; in progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option><option value="all">All</option></Select>
          <Select className="input w-auto" value={filters.priority} onChange={(e) => set('priority', e.target.value)}><option value="">Any priority</option>{Object.keys(PRIORITY).map((p) => <option key={p} value={p}>{p}</option>)}</Select>
          <Select className="input w-auto" value={filters.projectId} onChange={(e) => set('projectId', e.target.value)}><option value="">All projects</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        </div>
      </Card>
      {!rows ? <div className="flex justify-center p-10"><Spinner /></div> : rows.length === 0 ? <Card><EmptyState title="No queries" hint="Nothing matches these filters." /></Card> : (
        <Card className="!p-0 overflow-hidden">
          <ul className="divide-y divide-cream-200 dark:divide-slate-700">
            {rows.map((q) => (
              <li key={q.id}>
                <button className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-cream-50 dark:hover:bg-slate-800/60" onClick={() => setParams({ id: String(q.id) })}>
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${q.priority === 'urgent' ? 'bg-red-500' : q.priority === 'high' ? 'bg-orange-500' : q.priority === 'normal' ? 'bg-sky-500' : 'bg-slate-400'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-800 dark:text-slate-100">{q.title}</p>
                    <p className="truncate text-xs text-slate-500">{q.projectName ? `${q.projectName} · ` : ''}by {q.createdByName}{q.assignees.length ? ` → ${q.assignees.map((a) => a.name).join(', ')}` : ''}</p>
                  </div>
                  <span className="text-xs text-slate-400">{q.replyCount} repl{q.replyCount === 1 ? 'y' : 'ies'}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${QSTATUS[q.status].cls}`}>{QSTATUS[q.status].label}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {openId && <QueryDetail id={Number(openId)} users={users} onClose={() => setParams({})} onChanged={load} />}
      {create && (
        <Modal open onClose={() => setCreate(null)} title="Raise a Query" dismissOnBackdrop={false} footer={<><button className="btn-secondary" onClick={() => setCreate(null)}>Cancel</button><button className="btn-primary" onClick={submit}>Submit</button></>}>
          <div className="space-y-3">
            <div><label className="label">Title</label><input className="input" autoFocus value={create.title} onChange={(e) => setCreate({ ...create, title: e.target.value })} /></div>
            <div><label className="label">Details</label><textarea className="input" rows={3} value={create.description} onChange={(e) => setCreate({ ...create, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Project / Site</label><Select className="input" value={create.projectId} onChange={(e) => setCreate({ ...create, projectId: e.target.value })}><option value="">General (no project)</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></div>
              <div><label className="label">Priority</label><Select className="input" value={create.priority} onChange={(e) => setCreate({ ...create, priority: e.target.value })}>{Object.keys(PRIORITY).map((p) => <option key={p} value={p}>{p}</option>)}</Select></div>
            </div>
            <div><label className="label">Visibility</label><Select className="input" value={create.visibility} onChange={(e) => setCreate({ ...create, visibility: e.target.value })}><option value="assigned">Only me, assignees &amp; managers</option><option value="all">Everyone (with project access)</option></Select></div>
            <div><label className="label">Assign to</label><UserMultiSelect users={users} value={create.assigneeIds} onChange={(v) => setCreate({ ...create, assigneeIds: v })} /></div>
            <p className="text-xs text-slate-400">You can attach photos or files after submitting.</p>
          </div>
        </Modal>
      )}
    </div>
  );
}
