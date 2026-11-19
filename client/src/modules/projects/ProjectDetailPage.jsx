import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  getProject, deleteProject, updateProject, updatePhase, deletePhase, addPhase,
  addTask, updateTask, deleteTask, getFieldDefs,
  assignProjectEmployees, listEmployees,
  listApprovals, createApproval, decideApproval,
} from './api';
import { getProjectSummary } from '../finance/api';
import { listPhotos } from '../requirements/api';
import GanttChart from '../../components/GanttChart';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { errorMessage } from '../../lib/api';
import { formatMoney, formatDate } from '../../lib/format';
import { FullPageLoader, SectionCard, Alert, StatusBadge, Tabs, EmptyState } from '../../components/ui';
import { statusColor, statusSelectClass } from '../../lib/status';
import Modal from '../../components/Modal';
import Icon from '../../components/Icon';
import RequirementsButton from '../requirements/RequirementsWorkspace';
import Select from '../../components/Select';
import MultiSelect from '../../components/MultiSelect';

// Colors <option> text and applies a status-tinted class to a <Select>.
function StatusSelect({ value, statuses, onChange, className = '' }) {
  return (
    <Select className={`input py-1.5 font-medium ${statusSelectClass(value)} ${className}`} value={value} onChange={(e) => onChange(e.target.value)}>
      {statuses.map((s) => (
        <option key={s.key} value={s.key} style={{ color: statusColor(s.key) }}>{s.label}</option>
      ))}
    </Select>
  );
}

// Returns a deadline warning message (and tone) when a deadline is near/past.
function deadlineWarning(deadline) {
  if (!deadline) return null;
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  if (days < 0) return { text: 'Deadline passed', tone: 'text-red-600' };
  if (days <= 7) return { text: 'Deadline within 7 days', tone: 'text-amber-600' };
  return null;
}

function Info({ label, value }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="shrink-0 text-slate-500">{label}:</span>
      <span className="min-w-0 break-words font-medium text-slate-700 dark:text-slate-200">{value || '—'}</span>
    </div>
  );
}

function Avatar({ name }) {
  const initials = (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span title={name} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700 ring-2 ring-white dark:ring-slate-800">
      {initials}
    </span>
  );
}

// Inline date: shows formatted date (DD-MM-YYYY) or "not set yet", edits via a date input.
function DeadlineField({ value, canEdit, onChange }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <input type="date" autoFocus className="input w-auto py-1" defaultValue={value ? value.slice(0, 10) : ''} onBlur={() => setEditing(false)}
        onChange={(e) => { onChange(e.target.value || null); setEditing(false); }} />
    );
  }
  return (
    <button className="rounded-md bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 disabled:cursor-default dark:bg-slate-700 dark:text-brand-300" onClick={() => canEdit && setEditing(true)} disabled={!canEdit}>
      {value ? formatDate(value) : 'not set yet'}
    </button>
  );
}

// A thin progress bar.
function ProgressBar({ value = 0, height = 'h-2.5', color = '#cc6e02' }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={`w-full rounded-full bg-cream-200 dark:bg-slate-700 ${height}`}>
      <div className={`${height} rounded-full transition-all`} style={{ width: `${v}%`, backgroundColor: color }} />
    </div>
  );
}

const APPROVAL_STATUS = {
  pending: { label: 'Pending', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  approved: { label: 'Approved', cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
};
const PRIORITY_CLS = { low: 'text-slate-400', normal: 'text-slate-500', high: 'text-amber-600', urgent: 'text-red-600' };
const APPROVAL_TYPES = [
  { key: 'general', label: 'General request' },
  { key: 'phase_completion', label: 'Phase completion' },
  { key: 'budget', label: 'Budget / finance' },
  { key: 'material', label: 'Material request' },
];

// --- right-hand panel cards ------------------------------------------------

function SideCard({ title, action, children }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between border-b border-cream-200 px-4 py-2.5 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function FinanceCard({ projectId, currency, navigate }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => { getProjectSummary(projectId).then(setD).catch(() => setErr(true)); }, [projectId]);
  const money = (v) => formatMoney(v, currency);
  const spent = d ? (d.expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0) : 0;
  return (
    <SideCard title="Payments & expenses" action={<button className="text-xs font-medium text-brand-600 hover:underline" onClick={() => navigate(`/finance/project?projectId=${projectId}`)}>Open →</button>}>
      {err ? <p className="text-sm text-slate-400">Finance details unavailable.</p> : !d ? <p className="text-sm text-slate-400">Loading…</p> : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-emerald-50 px-2.5 py-2 dark:bg-emerald-900/20"><p className="text-[11px] text-emerald-700 dark:text-emerald-300">Received</p><p className="font-semibold text-emerald-800 dark:text-emerald-200">{money(d.receivedAmount)}</p></div>
            <div className="rounded-lg bg-amber-50 px-2.5 py-2 dark:bg-amber-900/20"><p className="text-[11px] text-amber-700 dark:text-amber-300">Balance due</p><p className="font-semibold text-amber-800 dark:text-amber-200">{money(d.balanceAmount)}</p></div>
            <div className="rounded-lg bg-red-50 px-2.5 py-2 dark:bg-red-900/20"><p className="text-[11px] text-red-700 dark:text-red-300">Spent</p><p className="font-semibold text-red-800 dark:text-red-200">{money(spent)}</p></div>
            <div className="rounded-lg bg-cream-100 px-2.5 py-2 dark:bg-slate-700/50"><p className="text-[11px] text-slate-500">Margin so far</p><p className="font-semibold text-slate-800 dark:text-slate-100">{money(Number(d.receivedAmount) - spent)}</p></div>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Recent payments received</p>
            {(d.payments || []).length ? (
              <ul className="space-y-1 text-sm">
                {d.payments.slice(0, 4).map((p) => (
                  <li key={p.id} className="flex justify-between gap-2"><span className="text-slate-500">{formatDate(p.date)}</span><span className="font-medium text-emerald-700">{money(p.amount)}</span></li>
                ))}
              </ul>
            ) : <p className="text-sm text-slate-400">None yet.</p>}
          </div>
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Recent expenses & payouts</p>
            {(d.expenses || []).length ? (
              <ul className="space-y-1 text-sm">
                {d.expenses.slice(0, 5).map((e) => (
                  <li key={e.id} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate text-slate-600 dark:text-slate-300" title={e.paidTo || e.category}>{e.paidTo || e.category}</span>
                    <span className="shrink-0 font-medium text-slate-800 dark:text-slate-100">{money(e.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-slate-400">None yet.</p>}
          </div>
        </div>
      )}
    </SideCard>
  );
}

function PhotosCard({ projectId }) {
  const [photos, setPhotos] = useState(null);
  useEffect(() => { listPhotos(projectId).then(setPhotos).catch(() => setPhotos([])); }, [projectId]);
  const images = (photos || []).filter((p) => (p.mimeType || '').startsWith('image/') || (p.data || '').startsWith('data:image'));
  return (
    <SideCard title={`Photos${photos ? ` (${photos.length})` : ''}`} action={<RequirementsButton projectId={projectId} initialTab="photo_upload" label="Open" icon="photo" compact />}>
      {!photos ? <p className="text-sm text-slate-400">Loading…</p> : !images.length ? <p className="text-sm text-slate-400">No photos uploaded yet.</p> : (
        <div className="grid grid-cols-3 gap-1.5">
          {images.slice(0, 6).map((p) => (
            <img key={p.id} src={p.data || p.url} alt={p.name || 'Site photo'} title={p.name || ''} className="aspect-square w-full rounded-md object-cover ring-1 ring-cream-200 dark:ring-slate-700" />
          ))}
        </div>
      )}
    </SideCard>
  );
}

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { bootstrap, can, user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const currency = bootstrap?.company?.currency || 'INR';
  const statuses = bootstrap?.settings?.projects?.statuses || [];
  const masterTasks = bootstrap?.settings?.projects?.task_templates || [];
  const statusLabel = (key) => statuses.find((s) => s.key === key)?.label || key;
  const canEdit = can('projects.update');
  const canApprove = can('projects.approve');
  const enabledModules = bootstrap?.modules || [];
  const requirementsEnabled = enabledModules.some((m) => m.key === 'requirements') && can('requirements.read');
  const photosEnabled = requirementsEnabled && enabledModules.some((m) => m.key === 'photo_upload');
  const financeEnabled = enabledModules.some((m) => m.key === 'finance') && can('finance.read');
  const queriesEnabled = enabledModules.some((m) => m.key === 'queries') && can('queries.create');

  const [project, setProject] = useState(null);
  const [customDefs, setCustomDefs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState('');
  const [empModal, setEmpModal] = useState(null); // { scope, phaseId, selected:Set }
  const [taskModal, setTaskModal] = useState(null); // add: { phaseId, existing, tempChips, ... }
  const [taskView, setTaskView] = useState(null); // { phaseId, task, draft }
  const [approvals, setApprovals] = useState([]);
  const [approvalModal, setApprovalModal] = useState(null);
  const [clientOpen, setClientOpen] = useState(false);
  const [tab, setTab] = useState('stages');

  const load = useCallback(async () => {
    try {
      const [p, defs, appr] = await Promise.all([getProject(id), getFieldDefs().catch(() => []), listApprovals(id).catch(() => [])]);
      setProject(p);
      setCustomDefs(defs.filter((d) => d.isCustom));
      setApprovals(appr || []);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id]);

  useEffect(() => {
    load();
    if (can('users.read')) listEmployees().then(setEmployees);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const guard = async (fn, msg) => {
    try {
      await fn();
      if (msg) toast.success(msg);
      await load();
      return true;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    }
  };

  // Optimistic mutate: update local state instantly, sync in the background,
  // reload only if the server rejects it — keeps the UI feeling immediate.
  const optimistic = (mutateLocal, apiCall, successMsg) => {
    setProject((p) => mutateLocal(p));
    apiCall()
      .then(() => successMsg && toast.success(successMsg))
      .catch((err) => { toast.error(errorMessage(err)); load(); });
  };

  // --- project ---
  const changeStatus = (status) => optimistic((p) => ({ ...p, status }), () => updateProject(id, { status }), 'Status updated successfully');
  const changeProgressMode = (mode) => guard(() => updateProject(id, { progressMode: mode }), 'Progress mode updated');
  const changeManualProgress = (value) => {
    const v = Math.max(0, Math.min(100, Number(value) || 0));
    optimistic((p) => ({ ...p, progress: v, progressMode: 'manual' }), () => updateProject(id, { progress: v, progressMode: 'manual' }));
  };
  const onDelete = async () => {
    const ok = await confirm({ title: 'Delete project?', message: `This will remove ${project.name}.`, confirmLabel: 'Delete' });
    if (ok) guard(() => deleteProject(id), 'Project deleted').then(() => navigate('/projects'));
  };

  // --- employees ---
  const openProjectEmp = () => setEmpModal({ scope: 'project', selected: new Set((project.assignees || []).map((a) => a.id)) });
  const openPhaseEmp = (phase) => setEmpModal({ scope: 'phase', phaseId: phase.id, selected: new Set((phase.assignees || []).map((a) => a.id)) });
  const saveEmp = () => {
    const ids = [...empModal.selected];
    const fn = empModal.scope === 'project' ? () => assignProjectEmployees(id, ids) : () => updatePhase(id, empModal.phaseId, { assigneeIds: ids });
    guard(fn, empModal.scope === 'project' ? 'Employees assigned & notified' : 'Stage employees updated').then(() => setEmpModal(null));
  };
  const removePhaseAssignee = (phase, uid) =>
    guard(() => updatePhase(id, phase.id, { assigneeIds: phase.assignees.filter((a) => a.id !== uid).map((a) => a.id) }), 'Employee removed');

  // --- phases ---
  const patchPhase = (p, phaseId, patch) => ({ ...p, phases: p.phases.map((ph) => (ph.id === phaseId ? { ...ph, ...patch } : ph)) });
  const changePhaseStatus = (phase, status) => optimistic((p) => patchPhase(p, phase.id, { status }), () => updatePhase(id, phase.id, { status }), 'Stage status updated');
  const setPhaseDeadline = (phase, deadline) => optimistic((p) => patchPhase(p, phase.id, { deadline }), () => updatePhase(id, phase.id, { deadline }), 'Deadline updated');
  const setPhaseStart = (phase, startDate) => optimistic((p) => patchPhase(p, phase.id, { startDate }), () => updatePhase(id, phase.id, { startDate }), 'Start date updated');
  const onAddPhase = () => {
    const name = window.prompt('New stage name');
    if (name?.trim()) guard(() => addPhase(id, { name: name.trim() }), 'Stage added');
  };
  const onDeletePhase = async (phase) => {
    const ok = await confirm({ title: 'Delete stage?', message: `Remove "${phase.name}" and its tasks.`, confirmLabel: 'Delete' });
    if (ok) guard(() => deletePhase(id, phase.id), 'Stage deleted');
  };

  // --- tasks ---
  const canTick = (phase, task) => canEdit || task.mine || phase.mine;
  const toggleTask = (phase, task) => {
    const next = task.status === 'completed' ? 'pending' : 'completed';
    optimistic(
      (p) => ({ ...p, phases: p.phases.map((ph) => (ph.id === phase.id ? { ...ph, tasks: ph.tasks.map((t) => (t.id === task.id ? { ...t, status: next } : t)) } : ph)) }),
      () => updateTask(id, phase.id, task.id, { status: next }),
    );
  };
  const openAddTask = (phase) => setTaskModal({ phaseId: phase.id, existing: new Set(), tempChips: [], tempDraft: '', description: '', assigneeIds: [], deadline: '' });
  const toggleExisting = (name) => setTaskModal((m) => {
    const existing = new Set(m.existing);
    existing.has(name) ? existing.delete(name) : existing.add(name);
    return { ...m, existing };
  });
  const addTempChip = () => setTaskModal((m) => {
    const v = (m.tempDraft || '').trim();
    if (!v || m.tempChips.includes(v)) return { ...m, tempDraft: '' };
    return { ...m, tempChips: [...m.tempChips, v], tempDraft: '' };
  });
  const removeTempChip = (t) => setTaskModal((m) => ({ ...m, tempChips: m.tempChips.filter((x) => x !== t) }));
  const saveNewTasks = () => {
    const titles = [...taskModal.existing, ...taskModal.tempChips];
    if (taskModal.tempDraft?.trim()) titles.push(taskModal.tempDraft.trim());
    if (!titles.length) { toast.error('Select or type at least one task'); return; }
    const extra = {
      ...(taskModal.description.trim() ? { description: taskModal.description.trim() } : {}),
      ...(taskModal.assigneeIds.length ? { assigneeIds: taskModal.assigneeIds } : {}),
      ...(taskModal.deadline ? { deadline: taskModal.deadline } : {}),
    };
    guard(async () => {
      for (const title of titles) {
        // eslint-disable-next-line no-await-in-loop
        await addTask(id, taskModal.phaseId, { title, ...extra });
      }
    }, `${titles.length} task(s) added`).then((ok) => ok && setTaskModal(null));
  };
  const openTask = (phase, task) => setTaskView({
    phaseId: phase.id,
    phaseName: phase.name,
    task,
    draft: { title: task.title, description: task.description || '', status: task.status, deadline: task.deadline ? task.deadline.slice(0, 10) : '', assigneeIds: (task.assignees || []).map((a) => a.id) },
  });
  const saveTaskView = () => {
    const d = taskView.draft;
    if (!d.title.trim()) { toast.error('Task title is required'); return; }
    guard(() => updateTask(id, taskView.phaseId, taskView.task.id, { title: d.title.trim(), description: d.description.trim() || null, status: d.status, deadline: d.deadline || null, assigneeIds: d.assigneeIds }), 'Task updated').then((ok) => ok && setTaskView(null));
  };
  const onDeleteTask = async (phaseId, task) => {
    const ok = await confirm({ title: 'Delete task?', message: `Remove "${task.title}".`, confirmLabel: 'Delete' });
    if (ok) guard(() => deleteTask(id, phaseId, task.id), 'Task deleted').then(() => setTaskView(null));
  };

  // --- approvals / requests ---
  const openRequest = () => setApprovalModal({ type: 'general', title: '', description: '', priority: 'normal', phaseId: '' });
  const submitRequest = () => {
    const title = (approvalModal.title || '').trim();
    if (!title) { toast.error('Please enter a title'); return; }
    const body = { type: approvalModal.type, title, priority: approvalModal.priority };
    if ((approvalModal.description || '').trim()) body.description = approvalModal.description.trim();
    if (approvalModal.phaseId) body.phaseId = Number(approvalModal.phaseId);
    guard(() => createApproval(id, body), 'Request submitted').then(() => setApprovalModal(null));
  };
  const decide = (approval, decision) => guard(() => decideApproval(id, approval.id, { decision }), decision === 'approve' ? 'Request approved' : 'Request rejected');

  if (error) return <Alert>{error}</Alert>;
  if (!project) return <FullPageLoader />;

  const access = project.access || { level: 'full', phaseIds: [], taskIds: [] };
  const full = access.level === 'full';
  const pendingApprovals = approvals.filter((a) => a.status === 'pending');
  const sections = bootstrap?.settings?.projects?.detail_sections || {};
  const showApprovals = sections.approvals !== false;
  const showTimeline = sections.timeline !== false;
  const stagesDone = project.phases.filter((p) => p.status === 'completed').length;
  const tasksAll = project.phases.flatMap((p) => p.tasks || []);
  const tasksDone = tasksAll.filter((t) => t.status === 'completed').length;
  const dl = project.status !== 'completed' ? deadlineWarning(project.endDate) : null;
  const myTasks = tasksAll.filter((t) => t.mine);
  const tabs = [
    { key: 'stages', label: 'Stages & tasks', count: project.phases.length },
    { key: 'details', label: 'Project details' },
    { key: 'timeline', label: 'Timeline', hidden: !showTimeline || project.phases.length === 0 },
    { key: 'approvals', label: 'Approvals', count: pendingApprovals.length, hidden: !showApprovals },
  ];
  const activeTab = tabs.find((t) => t.key === tab && !t.hidden) ? tab : 'stages';
  const client = project.client || {};
  const clientPhone = project.clientPhone || client.phone;

  return (
    <div>
      {/* Header — name, status and the key facts in one row */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Link to="/projects" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white shadow-sm hover:bg-brand-600" title="Back to projects" aria-label="Back">
            <Icon name="arrowLeft" className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">{project.name}</h1>
              <StatusBadge status={project.status} label={statusLabel(project.status)} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
              <span>Ref <b className="font-medium text-slate-700 dark:text-slate-200">{project.referenceNumber}</b></span>
              {project.category && <span>· {project.category}</span>}
              <button className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline dark:text-brand-300" onClick={() => setClientOpen(true)} title="View client details">
                · <Icon name="clients" className="h-3.5 w-3.5" />{project.clientName}
              </button>
              {(project.startDate || project.endDate) && <span>· {formatDate(project.startDate) || '—'} → <span className={dl ? `font-medium ${dl.tone}` : ''}>{formatDate(project.endDate) || '—'}</span></span>}
              {full && project.projectAmount != null && <span>· Contract <b className="font-medium text-slate-700 dark:text-slate-200">{formatMoney(project.projectAmount, currency)}</b></span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && <StatusSelect value={project.status} statuses={statuses} onChange={changeStatus} className="w-40" />}
          {canEdit && <button className="btn-secondary" onClick={openProjectEmp}><Icon name="users" className="h-4 w-4" /> Assign</button>}
          {canEdit && <Link to={`/projects/${id}/edit`} className="btn-secondary"><Icon name="edit" className="h-4 w-4" /> Edit</Link>}
          {can('projects.delete') && (
            <button className="btn-ghost px-2.5 text-red-600 hover:bg-red-50" onClick={onDelete} title="Delete project" aria-label="Delete project"><Icon name="trash" className="h-4 w-4" /></button>
          )}
        </div>
      </div>

      {!full && (
        <div className="mb-4">
          <Alert type="info">
            You are assigned to {access.level === 'phase' ? `${access.phaseIds.length} stage${access.phaseIds.length > 1 ? 's' : ''}` : `${access.taskIds.length} task${access.taskIds.length > 1 ? 's' : ''}`} on this project
            {myTasks.length ? ` (${myTasks.filter((t) => t.status === 'completed').length}/${myTasks.length} of your tasks done)` : ''}. Your work is highlighted; the rest is shown for reference.
          </Alert>
        </div>
      )}

      <Tabs
        tabs={tabs}
        value={activeTab}
        onChange={setTab}
        right={requirementsEnabled && full ? <RequirementsButton projectId={project.id} compact /> : null}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-10">
        {/* Main content (≈70%) */}
        <div className="min-w-0 lg:col-span-7">
          {activeTab === 'stages' && (
            <>
              {/* Overall progress */}
              <div className="card mb-5 p-4">
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    Overall progress <span className="ml-2 text-xs font-normal text-slate-400">{stagesDone}/{project.phases.length} stages · {tasksDone}/{tasksAll.length} tasks done</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold text-brand-600">{project.progress ?? 0}%</span>
                    {canEdit && (
                      <Select className="input w-auto py-1 text-xs" value={project.progressMode || 'auto'} onChange={(e) => changeProgressMode(e.target.value)} title="Auto = from stage/task completion. Manual = set it yourself.">
                        <option value="auto">Auto</option>
                        <option value="manual">Manual</option>
                      </Select>
                    )}
                  </div>
                </div>
                <ProgressBar value={project.progress ?? 0} height="h-3" />
                {project.progressMode === 'manual' && canEdit && (
                  <input type="range" min="0" max="100" value={project.progress ?? 0} onChange={(e) => changeManualProgress(e.target.value)} className="mt-2 w-full accent-brand-500" />
                )}
              </div>

              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Stages</h2>
                {canEdit && <button className="btn-ghost text-brand-600" onClick={onAddPhase}>+ Add Stage</button>}
              </div>

              {project.phases.length === 0 ? (
                <EmptyState title="No stages yet" hint={canEdit ? 'Add the first stage to start tracking work.' : undefined} />
              ) : (
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                  {project.phases.map((phase, idx) => {
                    const limited = phase.limited;
                    const w = phase.status !== 'completed' ? deadlineWarning(phase.deadline) : null;
                    return (
                      <SectionCard
                        key={phase.id}
                        className={phase.mine || (phase.tasks || []).some((t) => t.mine) ? 'ring-2 ring-brand-300 dark:ring-brand-700' : limited ? 'opacity-90' : ''}
                        title={
                          <span className="flex items-center gap-2">
                            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${phase.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-cream-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                              {phase.status === 'completed' ? <Icon name="check" className="h-3.5 w-3.5" /> : idx + 1}
                            </span>
                            {phase.name}
                            {phase.mine && <span className="badge bg-brand-100 text-brand-800">Your stage</span>}
                          </span>
                        }
                        actions={canEdit && <button className="text-xs text-red-500 hover:underline" onClick={() => onDeletePhase(phase)}>Remove</button>}
                      >
                        {/* Controls */}
                        {canEdit ? (
                          <div className="mb-4 grid grid-cols-3 gap-2">
                            <StatusSelect value={phase.status} statuses={statuses} onChange={(v) => changePhaseStatus(phase, v)} />
                            <button className="btn-secondary py-1.5" onClick={() => openPhaseEmp(phase)}>Employee</button>
                            <button className="btn-secondary py-1.5" onClick={() => openAddTask(phase)}>+ Task</button>
                          </div>
                        ) : (
                          <div className="mb-3"><StatusBadge status={phase.status} label={statusLabel(phase.status)} /></div>
                        )}

                        {/* Stage progress */}
                        <div className="mb-4">
                          <div className="mb-1 flex justify-between text-xs">
                            <span className="text-slate-500">Progress</span>
                            <span className="font-medium text-slate-700 dark:text-slate-200">{phase.progress ?? 0}%</span>
                          </div>
                          <ProgressBar value={phase.progress ?? 0} color={statusColor(phase.status)} />
                        </div>

                        {/* Assigned employees (hidden from people outside this stage) */}
                        {!limited && (
                          <>
                            <p className="mb-1 text-sm font-medium text-brand-700 dark:text-brand-300">Assigned To</p>
                            {phase.assignees?.length ? (
                              <ul className="mb-4 divide-y divide-cream-200 dark:divide-slate-700">
                                {phase.assignees.map((u) => (
                                  <li key={u.id} className="flex items-center justify-between py-1.5 text-sm">
                                    <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200"><Avatar name={u.name} />{u.name}{u.id === user?.id && <span className="text-xs text-slate-400">(you)</span>}</span>
                                    {canEdit && (
                                      <button className="text-slate-400 hover:text-red-500" onClick={() => removePhaseAssignee(phase, u.id)} aria-label={`Remove ${u.name}`}><Icon name="trash" className="h-4 w-4" /></button>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mb-4 text-sm text-slate-400">No employees assigned.</p>
                            )}
                          </>
                        )}

                        {/* Tasks */}
                        <div className="mb-1 flex items-center justify-between">
                          <p className="text-sm font-medium text-brand-700 dark:text-brand-300">Tasks</p>
                          {canEdit && <button className="text-xs font-medium text-brand-600 hover:underline" onClick={() => openAddTask(phase)}>+ Add</button>}
                        </div>
                        {phase.tasks?.length ? (
                          <ul className="mb-4 space-y-1">
                            {phase.tasks.map((task) => (
                              <li key={task.id} className={`flex items-start gap-2 rounded-md px-1.5 py-1 text-sm ${task.mine ? 'bg-brand-50 dark:bg-slate-700/60' : ''}`}>
                                <input type="checkbox" className="mt-0.5 h-4 w-4" checked={task.status === 'completed'} disabled={!canTick(phase, task)} onChange={() => toggleTask(phase, task)} aria-label={`Mark ${task.title} done`} />
                                {task.limited ? (
                                  <span className={`flex-1 ${task.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-500 dark:text-slate-400'}`}>{task.title}</span>
                                ) : (
                                  <button className="min-w-0 flex-1 text-left" onClick={() => openTask(phase, task)}>
                                    <span className={`block ${task.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-700 hover:text-brand-700 dark:text-slate-200'}`}>
                                      {task.title}
                                      {task.mine && <span className="ml-1.5 text-[10px] font-semibold uppercase text-brand-700">yours</span>}
                                    </span>
                                    {(task.description || task.deadline) && (
                                      <span className="block truncate text-xs text-slate-400">
                                        {task.deadline ? `Due ${formatDate(task.deadline)}` : ''}{task.deadline && task.description ? ' · ' : ''}{task.description || ''}
                                      </span>
                                    )}
                                  </button>
                                )}
                                {!task.limited && task.assignees?.length > 0 && (
                                  <span className="flex -space-x-1.5">{task.assignees.slice(0, 3).map((u) => <Avatar key={u.id} name={u.name} />)}</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mb-4 text-sm text-slate-400">No tasks.</p>
                        )}

                        {/* Schedule */}
                        <div className="border-t border-cream-200 pt-3 dark:border-slate-700">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm font-medium text-brand-700 dark:text-brand-300">Start</span>
                            <DeadlineField value={phase.startDate} canEdit={canEdit} onChange={(d) => setPhaseStart(phase, d)} />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-brand-700 dark:text-brand-300">Deadline</span>
                            <DeadlineField value={phase.deadline} canEdit={canEdit} onChange={(d) => setPhaseDeadline(phase, d)} />
                          </div>
                          {w && <p className={`mt-1 text-xs font-medium ${w.tone}`}>⚠ {w.text}</p>}
                          {queriesEnabled && !limited && (
                            <button className="mt-2 text-xs font-medium text-brand-600 hover:underline" onClick={() => navigate(`/queries?new=1&projectId=${project.id}&phaseId=${phase.id}`)}>Raise a query on this stage</button>
                          )}
                        </div>
                      </SectionCard>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {activeTab === 'details' && (
            <div className="card p-5">
              <div className="grid grid-cols-1 gap-y-2 md:grid-cols-2">
                <Info label="Client Name" value={project.clientName} />
                <Info label="Phone Number" value={clientPhone} />
                <Info label="Email ID" value={project.clientEmail || client.email} />
                <Info label="Site / Address" value={project.clientAddress || client.address} />
                {full && <Info label="Project Amount" value={formatMoney(project.projectAmount, currency)} />}
                {full && Number(project.advanceAmount) > 0 && <Info label="Advance" value={formatMoney(project.advanceAmount, currency)} />}
                <Info label="Category" value={project.category} />
                <Info label="Agreement Date" value={formatDate(project.agreementDate)} />
                <Info label="Start Date" value={formatDate(project.startDate)} />
                <Info label="Target Completion" value={formatDate(project.endDate)} />
                {customDefs.map((d) => <Info key={d.key} label={d.label} value={project.customFields?.[d.key]} />)}
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="card p-5"><GanttChart phases={project.phases} project={project} statusLabel={statusLabel} /></div>
          )}

          {activeTab === 'approvals' && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm text-slate-500">Stage sign-offs, budget, material and other requests on this project.</p>
                <button className="btn-primary btn-sm" onClick={openRequest}><Icon name="add" className="h-3.5 w-3.5" /> New request</button>
              </div>
              {approvals.length === 0 ? (
                <EmptyState title="No requests yet" hint="Raise a request when something needs a manager's sign-off." />
              ) : (
                <div className="card divide-y divide-cream-200 dark:divide-slate-700">
                  {approvals.map((a) => {
                    const st = APPROVAL_STATUS[a.status] || APPROVAL_STATUS.pending;
                    const typeLabel = APPROVAL_TYPES.find((t) => t.key === a.type)?.label || a.type;
                    return (
                      <div key={a.id} className="flex flex-wrap items-start gap-3 p-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-slate-800 dark:text-slate-100">{a.title}</span>
                            <span className={`badge ${st.cls}`}>{st.label}</span>
                            <span className="badge bg-cream-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200">{typeLabel}</span>
                            {a.priority && a.priority !== 'normal' && <span className={`text-xs font-semibold uppercase ${PRIORITY_CLS[a.priority] || ''}`}>{a.priority}</span>}
                          </div>
                          {a.description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{a.description}</p>}
                          <p className="mt-1 text-xs text-slate-400">
                            By {a.requestedBy?.name || 'Unknown'} · {formatDate(a.createdAt)}
                            {a.amount != null && <> · {formatMoney(a.amount, currency)}</>}
                            {a.status !== 'pending' && a.decidedBy && <> · {st.label} by {a.decidedBy.name}</>}
                          </p>
                        </div>
                        {a.status === 'pending' && canApprove && (
                          <div className="flex gap-2">
                            <button className="btn-secondary py-1 text-green-600" onClick={() => decide(a, 'approve')}>Approve</button>
                            <button className="btn-secondary py-1 text-red-600" onClick={() => decide(a, 'reject')}>Reject</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Related information (≈30%) */}
        <aside className="space-y-4 lg:col-span-3">
          <SideCard title="Client" action={<button className="text-xs font-medium text-brand-600 hover:underline" onClick={() => setClientOpen(true)}>Details</button>}>
            <button className="flex w-full items-center gap-3 text-left" onClick={() => setClientOpen(true)}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">{(project.clientName || '?').slice(0, 1).toUpperCase()}</span>
              <span className="min-w-0">
                <span className="block truncate font-medium text-slate-800 dark:text-slate-100">{project.clientName}</span>
                <span className="block truncate text-xs text-slate-500">{clientPhone || project.clientEmail || 'No contact details'}</span>
              </span>
            </button>
          </SideCard>

          {full && (
            <SideCard title="Project team" action={canEdit && <button className="text-xs font-medium text-brand-600 hover:underline" onClick={openProjectEmp}>Manage</button>}>
              {project.assignees?.length ? (
                <ul className="space-y-2">
                  {project.assignees.map((u) => (
                    <li key={u.id} className="flex items-center gap-2 text-sm"><Avatar name={u.name} /><span className="truncate text-slate-700 dark:text-slate-200">{u.name}</span></li>
                  ))}
                </ul>
              ) : <p className="text-sm text-slate-400">No one assigned to the whole project.</p>}
              <p className="mt-2 text-[11px] text-slate-400">Project team sees everything. Stage and task assignees see their own work.</p>
            </SideCard>
          )}

          {full && financeEnabled && <FinanceCard projectId={project.id} currency={currency} navigate={navigate} />}
          {photosEnabled && <PhotosCard projectId={project.id} />}

          {showApprovals && pendingApprovals.length > 0 && (
            <button className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-800 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200" onClick={() => setTab('approvals')}>
              <span className="font-semibold">{pendingApprovals.length} pending approval{pendingApprovals.length > 1 ? 's' : ''}</span> — review →
            </button>
          )}
        </aside>
      </div>

      {/* Client details */}
      <Modal open={clientOpen} onClose={() => setClientOpen(false)} title="Client details"
        footer={<>{client.id && can('clients.read') && <Link className="btn-secondary" to={`/clients/${client.id}`}>Open client profile</Link>}<button className="btn-primary" onClick={() => setClientOpen(false)}>Close</button></>}>
        <div className="space-y-2">
          <Info label="Name" value={project.clientName} />
          {client.contactPerson && <Info label="Contact person" value={client.contactPerson} />}
          <Info label="Phone" value={clientPhone ? <a className="text-brand-700 hover:underline" href={`tel:${clientPhone}`}>{clientPhone}</a> : null} />
          <Info label="Email" value={(project.clientEmail || client.email) ? <a className="text-brand-700 hover:underline" href={`mailto:${project.clientEmail || client.email}`}>{project.clientEmail || client.email}</a> : null} />
          <Info label="Address" value={project.clientAddress || client.address} />
          {client.gstNumber && <Info label="GSTIN" value={client.gstNumber} />}
          {full && <Info label="Contract value" value={formatMoney(project.projectAmount, currency)} />}
        </div>
      </Modal>

      {/* New request modal */}
      <Modal open={Boolean(approvalModal)} onClose={() => setApprovalModal(null)} title="New Request / Approval"
        footer={<><button className="btn-secondary" onClick={() => setApprovalModal(null)}>Cancel</button><button className="btn-primary" onClick={submitRequest}>Submit</button></>}>
        {approvalModal && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Type</label>
                <Select className="input" value={approvalModal.type} onChange={(e) => setApprovalModal((m) => ({ ...m, type: e.target.value }))}>
                  {APPROVAL_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </Select>
              </div>
              <div>
                <label className="label">Priority</label>
                <Select className="input" value={approvalModal.priority} onChange={(e) => setApprovalModal((m) => ({ ...m, priority: e.target.value }))}>
                  <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
                </Select>
              </div>
            </div>
            {project.phases.length > 0 && (
              <div>
                <label className="label">Related stage (optional)</label>
                <Select className="input" value={approvalModal.phaseId} onChange={(e) => setApprovalModal((m) => ({ ...m, phaseId: e.target.value }))}>
                  <option value="">—</option>
                  {project.phases.map((ph) => <option key={ph.id} value={ph.id}>{ph.name}</option>)}
                </Select>
              </div>
            )}
            <div>
              <label className="label">Title</label>
              <input className="input" autoFocus placeholder="e.g. Approve Foundation stage completion" value={approvalModal.title} onChange={(e) => setApprovalModal((m) => ({ ...m, title: e.target.value }))} />
            </div>
            <div>
              <label className="label">Details (optional)</label>
              <textarea className="input" rows={3} value={approvalModal.description} onChange={(e) => setApprovalModal((m) => ({ ...m, description: e.target.value }))} />
            </div>
          </div>
        )}
      </Modal>

      {/* Employee picker modal (project or stage) */}
      <Modal open={Boolean(empModal)} onClose={() => setEmpModal(null)} title={empModal?.scope === 'project' ? 'Assign Employees to Project' : 'Stage Employees'}
        footer={<><button className="btn-secondary" onClick={() => setEmpModal(null)}>Cancel</button><button className="btn-primary" onClick={saveEmp}>Update</button></>}>
        {empModal && (
          <div className="min-h-[14rem]">
            <label className="label">{empModal.scope === 'project' ? 'People working on the whole project' : 'People responsible for this stage'}</label>
            <MultiSelect
              options={employees.map((u) => ({ value: u.id, label: u.name, sub: u.designation || u.role?.name || '' }))}
              value={[...empModal.selected]}
              onChange={(ids) => setEmpModal((m) => ({ ...m, selected: new Set(ids) }))}
              placeholder="Search and add people…"
              loading={!employees.length && can('users.read')}
              emptyText="No active users"
            />
            <p className="mt-2 text-xs text-slate-500">
              {empModal.scope === 'project'
                ? 'Project-level people see all project information and are notified.'
                : 'Stage-level people see this stage in full and the rest of the project as basic information.'}
            </p>
          </div>
        )}
      </Modal>

      {/* Add tasks */}
      <Modal open={Boolean(taskModal)} onClose={() => setTaskModal(null)} title="Add Tasks" wide
        footer={<><button className="btn-secondary" onClick={() => setTaskModal(null)}>Cancel</button><button className="btn-primary" onClick={saveNewTasks}>Add tasks</button></>}>
        {taskModal && (
          <div className="space-y-5">
            <div>
              <p className="label">Existing Tasks</p>
              <p className="mb-2 text-xs text-slate-400">From Settings → Projects → task list. Select one or more.</p>
              {masterTasks.length === 0 ? (
                <p className="text-sm text-slate-400">No predefined tasks. Create some in Settings.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {masterTasks.map((t) => (
                    <label key={t} className="flex items-center gap-2 rounded-lg border border-cream-300 px-3 py-2 text-sm dark:border-slate-700">
                      <input type="checkbox" checked={taskModal.existing.has(t)} onChange={() => toggleExisting(t)} />
                      <span className="text-slate-700 dark:text-slate-200">{t}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t border-cream-200 pt-4 dark:border-slate-700">
              <p className="label">Create Temporary Task</p>
              <p className="mb-2 text-xs text-slate-400">Only for this project — not saved to the master list.</p>
              {taskModal.tempChips.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {taskModal.tempChips.map((t) => (
                    <span key={t} className="badge bg-cream-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                      {t}<button type="button" className="ml-1 text-slate-400 hover:text-red-500" onClick={() => removeTempChip(t)} aria-label={`Remove ${t}`}>&times;</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input className="input flex-1" placeholder="Temporary task name" value={taskModal.tempDraft} onChange={(e) => setTaskModal((m) => ({ ...m, tempDraft: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTempChip())} />
                <button type="button" className="btn-secondary" onClick={addTempChip}>Add</button>
              </div>
            </div>
            <div className="grid gap-3 border-t border-cream-200 pt-4 sm:grid-cols-2 dark:border-slate-700">
              <div className="sm:col-span-2">
                <label className="label">Details / description (optional)</label>
                <textarea className="input" rows={2} placeholder="What needs to be done, specifications, location…" value={taskModal.description} onChange={(e) => setTaskModal((m) => ({ ...m, description: e.target.value }))} />
              </div>
              <div>
                <label className="label">Assign to (optional)</label>
                <MultiSelect options={employees.map((u) => ({ value: u.id, label: u.name, sub: u.designation || u.role?.name || '' }))} value={taskModal.assigneeIds} onChange={(ids) => setTaskModal((m) => ({ ...m, assigneeIds: ids }))} placeholder="Responsible people…" emptyText="No active users" />
              </div>
              <div>
                <label className="label">Due date (optional)</label>
                <input type="date" className="input" value={taskModal.deadline} onChange={(e) => setTaskModal((m) => ({ ...m, deadline: e.target.value }))} />
              </div>
              <p className="text-xs text-slate-400 sm:col-span-2">Details, people and due date apply to every task added now. Assigned people are notified and see this task in full.</p>
            </div>
          </div>
        )}
      </Modal>

      {/* Task details */}
      <Modal open={Boolean(taskView)} onClose={() => setTaskView(null)} title={taskView ? `Task · ${taskView.phaseName}` : 'Task'}
        footer={taskView && (canEdit ? (
          <div className="flex w-full items-center justify-between gap-2">
            <button className="btn-ghost text-red-600" onClick={() => onDeleteTask(taskView.phaseId, taskView.task)}>Delete</button>
            <div className="flex gap-2"><button className="btn-secondary" onClick={() => setTaskView(null)}>Cancel</button><button className="btn-primary" onClick={saveTaskView}>Save</button></div>
          </div>
        ) : (
          <>
            <button className="btn-secondary" onClick={() => setTaskView(null)}>Close</button>
            {(taskView.task.mine || project.phases.find((p) => p.id === taskView.phaseId)?.mine) && (
              <button className="btn-primary" onClick={() => guard(() => updateTask(id, taskView.phaseId, taskView.task.id, { status: taskView.task.status === 'completed' ? 'pending' : 'completed' }), 'Task updated').then(() => setTaskView(null))}>
                {taskView.task.status === 'completed' ? 'Reopen task' : 'Mark as done'}
              </button>
            )}
          </>
        ))}>
        {taskView && (canEdit ? (
          <div className="space-y-3">
            <div><label className="label">Task</label><input className="input" value={taskView.draft.title} onChange={(e) => setTaskView((v) => ({ ...v, draft: { ...v.draft, title: e.target.value } }))} /></div>
            <div><label className="label">Details / description</label><textarea className="input" rows={4} placeholder="What needs to be done, specifications, location…" value={taskView.draft.description} onChange={(e) => setTaskView((v) => ({ ...v, draft: { ...v.draft, description: e.target.value } }))} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="label">Status</label><StatusSelect value={taskView.draft.status} statuses={statuses} onChange={(s) => setTaskView((v) => ({ ...v, draft: { ...v.draft, status: s } }))} /></div>
              <div><label className="label">Due date</label><input type="date" className="input" value={taskView.draft.deadline} onChange={(e) => setTaskView((v) => ({ ...v, draft: { ...v.draft, deadline: e.target.value } }))} /></div>
            </div>
            <div>
              <label className="label">Assigned to</label>
              <MultiSelect options={employees.map((u) => ({ value: u.id, label: u.name, sub: u.designation || u.role?.name || '' }))} value={taskView.draft.assigneeIds} onChange={(ids) => setTaskView((v) => ({ ...v, draft: { ...v.draft, assigneeIds: ids } }))} placeholder="Responsible people…" emptyText="No active users" />
              <p className="mt-1 text-xs text-slate-400">Task-level people see this task in full; the rest of the project only as basic information.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-base font-medium text-slate-800 dark:text-slate-100">{taskView.task.title}</p>
            <Info label="Status" value={statusLabel(taskView.task.status)} />
            <Info label="Due" value={formatDate(taskView.task.deadline)} />
            <Info label="Assigned to" value={(taskView.task.assignees || []).map((a) => a.name).join(', ')} />
            <div className="pt-1">
              <p className="text-sm text-slate-500">Details</p>
              <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{taskView.task.description || 'No details added.'}</p>
            </div>
          </div>
        ))}
      </Modal>
    </div>
  );
}
