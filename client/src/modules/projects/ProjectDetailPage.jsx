import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  getProject, deleteProject, updateProject, updatePhase, deletePhase, addPhase,
  addTask, updateTask, deleteTask, getFieldDefs,
  assignProjectEmployees, listEmployees,
  listApprovals, createApproval, decideApproval,
} from './api';
import GanttChart from '../../components/GanttChart';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { errorMessage } from '../../lib/api';
import { formatMoney, formatDate } from '../../lib/format';
import { FullPageLoader, Alert, StatusBadge, Tabs, Progress, EmptyState } from '../../components/ui';
import { statusColor, statusSelectClass } from '../../lib/status';
import Modal from '../../components/Modal';
import Icon from '../../components/Icon';
import RequirementsButton from '../requirements/RequirementsWorkspace';
import Select from '../../components/Select';
import MultiSelect from '../../components/MultiSelect';

// Colors <option> text and applies a status-tinted class to a <Select>.
function StatusSelect({ value, statuses, onChange, className = '' }) {
  return (
    <Select
      className={`input py-1.5 font-medium ${statusSelectClass(value)} ${className}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {statuses.map((s) => (
        <option key={s.key} value={s.key} style={{ color: statusColor(s.key) }}>
          {s.label}
        </option>
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
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-slate-800 dark:text-slate-200">{value || '—'}</dd>
    </div>
  );
}

function Avatar({ name, ring = false }) {
  const initials = (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span title={name} className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700 ${ring ? 'ring-2 ring-white dark:ring-slate-800' : ''}`}>
      {initials}
    </span>
  );
}

// Inline deadline: shows formatted date (DD-MM-YYYY) or "not set yet", edits via a date input.
function DeadlineField({ value, canEdit, onChange }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <input
        type="date"
        autoFocus
        className="input w-auto py-1"
        defaultValue={value ? value.slice(0, 10) : ''}
        onBlur={() => setEditing(false)}
        onChange={(e) => {
          onChange(e.target.value || null);
          setEditing(false);
        }}
      />
    );
  }
  return (
    <button
      className="rounded-md bg-white px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:ring-brand-300 disabled:hover:ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600"
      onClick={() => canEdit && setEditing(true)}
      disabled={!canEdit}
    >
      {value ? formatDate(value) : 'not set yet'}
    </button>
  );
}

const APPROVAL_STATUS = {
  pending: { label: 'Pending', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  approved: { label: 'Approved', cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
};
const PRIORITY_CLS = {
  low: 'text-slate-400',
  normal: 'text-slate-500',
  high: 'text-amber-600',
  urgent: 'text-red-600',
};
const APPROVAL_TYPES = [
  { key: 'general', label: 'General request' },
  { key: 'phase_completion', label: 'Phase completion' },
  { key: 'budget', label: 'Budget / finance' },
  { key: 'material', label: 'Material request' },
];

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { bootstrap, can } = useAuth();
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
  const [taskModal, setTaskModal] = useState(null); // { phaseId, taskId, title }
  const [approvals, setApprovals] = useState([]);
  const [approvalModal, setApprovalModal] = useState(null); // { type, title, description, priority, phaseId }
  const [tab, setTab] = useState('overview');
  const [openStages, setOpenStages] = useState(() => new Set());
  const toggleStage = (pid) => setOpenStages((s) => {
    const n = new Set(s);
    n.has(pid) ? n.delete(pid) : n.add(pid);
    return n;
  });

  const load = useCallback(async () => {
    try {
      const [p, defs, appr] = await Promise.all([
        getProject(id),
        getFieldDefs().catch(() => []),
        listApprovals(id).catch(() => []),
      ]);
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
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  // Optimistic mutate: update local state instantly, sync in the background,
  // reload only if the server rejects it — keeps the UI feeling immediate.
  const optimistic = (mutateLocal, apiCall, successMsg) => {
    setProject((p) => mutateLocal(p));
    apiCall()
      .then(() => successMsg && toast.success(successMsg))
      .catch((err) => {
        toast.error(errorMessage(err));
        load();
      });
  };

  // --- project ---
  const changeStatus = (status) =>
    optimistic((p) => ({ ...p, status }), () => updateProject(id, { status }), 'Status updated successfully');
  // Progress: switching mode reloads (server recomputes auto %); manual slider is optimistic.
  const changeProgressMode = (mode) => guard(() => updateProject(id, { progressMode: mode }), 'Progress mode updated');
  const changeManualProgress = (value) => {
    const v = Math.max(0, Math.min(100, Number(value) || 0));
    optimistic(
      (p) => ({ ...p, progress: v, progressMode: 'manual' }),
      () => updateProject(id, { progress: v, progressMode: 'manual' }),
    );
  };
  const onDelete = async () => {
    const ok = await confirm({ title: 'Delete project?', message: `This will remove ${project.name}.`, confirmLabel: 'Delete' });
    if (ok) guard(() => deleteProject(id), 'Project deleted').then(() => navigate('/projects'));
  };

  // --- employees ---
  const openProjectEmp = () => setEmpModal({ scope: 'project', selected: new Set((project.assignees || []).map((a) => a.id)) });
  const openPhaseEmp = (phase) => setEmpModal({ scope: 'phase', phaseId: phase.id, selected: new Set((phase.assignees || []).map((a) => a.id)) });
  const toggleEmp = (uid) => setEmpModal((m) => {
    const selected = new Set(m.selected);
    selected.has(uid) ? selected.delete(uid) : selected.add(uid);
    return { ...m, selected };
  });
  const saveEmp = () => {
    const ids = [...empModal.selected];
    const fn = empModal.scope === 'project'
      ? () => assignProjectEmployees(id, ids)
      : () => updatePhase(id, empModal.phaseId, { assigneeIds: ids });
    const msg = empModal.scope === 'project' ? 'Employees assigned & notified' : 'Phase employees updated';
    guard(fn, msg).then(() => setEmpModal(null));
  };
  const removePhaseAssignee = (phase, uid) =>
    guard(() => updatePhase(id, phase.id, { assigneeIds: phase.assignees.filter((a) => a.id !== uid).map((a) => a.id) }), 'Employee removed');

  // --- phases ---
  const patchPhase = (p, phaseId, patch) => ({ ...p, phases: p.phases.map((ph) => (ph.id === phaseId ? { ...ph, ...patch } : ph)) });
  const changePhaseStatus = (phase, status) =>
    optimistic((p) => patchPhase(p, phase.id, { status }), () => updatePhase(id, phase.id, { status }), 'Phase status updated successfully');
  const setPhaseDeadline = (phase, deadline) =>
    optimistic((p) => patchPhase(p, phase.id, { deadline }), () => updatePhase(id, phase.id, { deadline }), 'Deadline updated');
  const setPhaseStart = (phase, startDate) =>
    optimistic((p) => patchPhase(p, phase.id, { startDate }), () => updatePhase(id, phase.id, { startDate }), 'Start date updated');
  const onAddPhase = () => {
    const name = window.prompt('New stage name');
    if (name?.trim()) guard(() => addPhase(id, { name: name.trim() }), 'Stage added');
  };
  const onDeletePhase = async (phase) => {
    const ok = await confirm({ title: 'Delete stage?', message: `Remove "${phase.name}" and its tasks.`, confirmLabel: 'Delete' });
    if (ok) guard(() => deletePhase(id, phase.id), 'Stage deleted');
  };

  // --- tasks ---
  const toggleTask = (phase, task) => {
    const next = task.status === 'completed' ? 'pending' : 'completed';
    optimistic(
      (p) => ({
        ...p,
        phases: p.phases.map((ph) =>
          ph.id === phase.id ? { ...ph, tasks: ph.tasks.map((t) => (t.id === task.id ? { ...t, status: next } : t)) } : ph,
        ),
      }),
      () => updateTask(id, phase.id, task.id, { status: next }),
    );
  };

  const openAddTask = (phase) =>
    setTaskModal({ phaseId: phase.id, taskId: null, existing: new Set(), tempChips: [], tempDraft: '' });
  const openEditTask = (phase, task) => setTaskModal({ phaseId: phase.id, taskId: task.id, title: task.title });

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

  const saveTask = () => {
    // Edit mode: rename a single task.
    if (taskModal.taskId) {
      const title = (taskModal.title || '').trim();
      if (!title) return;
      guard(() => updateTask(id, taskModal.phaseId, taskModal.taskId, { title }), 'Task updated').then(() => setTaskModal(null));
      return;
    }
    // Add mode: create selected predefined + temporary tasks in one go.
    const titles = [...taskModal.existing, ...taskModal.tempChips];
    if (taskModal.tempDraft?.trim()) titles.push(taskModal.tempDraft.trim());
    if (!titles.length) return;
    guard(async () => {
      for (const title of titles) {
        // eslint-disable-next-line no-await-in-loop
        await addTask(id, taskModal.phaseId, { title });
      }
    }, `${titles.length} task(s) added`).then(() => setTaskModal(null));
  };
  const onDeleteTask = async (phase, task) => {
    const ok = await confirm({ title: 'Delete task?', message: `Remove "${task.title}".`, confirmLabel: 'Delete' });
    if (ok) guard(() => deleteTask(id, phase.id, task.id), 'Task deleted');
  };

  // --- approvals / requests ---
  const openRequest = () => setApprovalModal({ type: 'general', title: '', description: '', priority: 'normal', phaseId: '' });
  const submitRequest = () => {
    const title = (approvalModal.title || '').trim();
    if (!title) {
      toast.error('Please enter a title');
      return;
    }
    const body = { type: approvalModal.type, title, priority: approvalModal.priority };
    if ((approvalModal.description || '').trim()) body.description = approvalModal.description.trim();
    if (approvalModal.phaseId) body.phaseId = Number(approvalModal.phaseId);
    guard(() => createApproval(id, body), 'Request submitted').then(() => setApprovalModal(null));
  };
  const decide = (approval, decision) =>
    guard(() => decideApproval(id, approval.id, { decision }), decision === 'approve' ? 'Request approved' : 'Request rejected');

  const pendingApprovals = approvals.filter((a) => a.status === 'pending');

  if (error) return <Alert>{error}</Alert>;
  if (!project) return <FullPageLoader />;

  const sections = bootstrap?.settings?.projects?.detail_sections || {};
  const showApprovals = sections.approvals !== false;
  const showTimeline = sections.timeline !== false;
  const stagesDone = project.phases.filter((p) => p.status === 'completed').length;
  const tasksAll = project.phases.flatMap((p) => p.tasks || []);
  const tasksDone = tasksAll.filter((t) => t.status === 'completed').length;
  const dl = deadlineWarning(project.endDate);
  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'stages', label: 'Stages', count: project.phases.length },
    { key: 'timeline', label: 'Timeline', hidden: !showTimeline || project.phases.length === 0 },
    { key: 'approvals', label: 'Approvals', count: pendingApprovals.length, hidden: !showApprovals },
  ];
  const activeTab = tabs.find((t) => t.key === tab && !t.hidden) ? tab : 'overview';

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Link to="/projects" className="btn-secondary mt-0.5 h-9 w-9 shrink-0 p-0" title="Back to projects" aria-label="Back">
            <Icon name="arrowLeft" className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 dark:text-white">{project.name}</h1>
              <StatusBadge status={project.status} label={statusLabel(project.status)} />
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              {project.referenceNumber}
              {project.category ? ` · ${project.category}` : ''}
              {project.clientName ? ` · ${project.clientName}` : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && <StatusSelect value={project.status} statuses={statuses} onChange={changeStatus} className="w-40" />}
          {canEdit && (
            <Link to={`/projects/${id}/edit`} className="btn-secondary">
              <Icon name="edit" className="h-4 w-4" /> Edit
            </Link>
          )}
          {can('projects.delete') && (
            <button className="btn-ghost px-2.5 text-red-600 hover:bg-red-50" onClick={onDelete} title="Delete project" aria-label="Delete project">
              <Icon name="trash" className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div className="card mb-4 grid grid-cols-2 divide-slate-100 md:grid-cols-5 md:divide-x dark:divide-slate-700">
        <div className="col-span-2 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Overall progress</span>
            {canEdit && (
              <div className="flex rounded-md bg-slate-100 p-0.5 text-[11px] font-medium dark:bg-slate-700" title="Auto = from stage/task completion · Manual = set it yourself">
                {['auto', 'manual'].map((m) => (
                  <button
                    key={m}
                    className={`rounded px-2 py-0.5 capitalize ${(project.progressMode || 'auto') === m ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-600 dark:text-white' : 'text-slate-500'}`}
                    onClick={() => (project.progressMode || 'auto') !== m && changeProgressMode(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Progress value={project.progress ?? 0} className="mt-2" size="md" />
          {project.progressMode === 'manual' && canEdit && (
            <input type="range" min="0" max="100" value={project.progress ?? 0} onChange={(e) => changeManualProgress(e.target.value)} className="mt-1 h-1 w-full accent-brand-500" />
          )}
        </div>
        <div className="px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Contract value</p>
          <p className="mt-0.5 truncate text-base font-semibold text-slate-900 dark:text-white">{formatMoney(project.projectAmount, currency)}</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Stages · Tasks</p>
          <p className="mt-0.5 text-base font-semibold text-slate-900 dark:text-white">
            {stagesDone}/{project.phases.length} <span className="text-slate-300">·</span> {tasksDone}/{tasksAll.length}
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Target completion</p>
          <p className={`mt-0.5 text-base font-semibold ${dl ? dl.tone : 'text-slate-900 dark:text-white'}`}>{project.endDate ? formatDate(project.endDate) : '—'}</p>
          {dl && <p className={`text-[11px] font-medium ${dl.tone}`}>{dl.text}</p>}
        </div>
      </div>

      <Tabs
        tabs={tabs}
        value={activeTab}
        onChange={setTab}
        right={
          <>
            {financeEnabled && (
              <button className="btn-secondary btn-sm" onClick={() => navigate(`/finance/project?projectId=${project.id}`)}>
                <Icon name="finance" className="h-3.5 w-3.5" /> Finance
              </button>
            )}
            {requirementsEnabled && <RequirementsButton projectId={project.id} compact />}
            {photosEnabled && <RequirementsButton projectId={project.id} initialTab="photo_upload" label="Photos" icon="photo" compact />}
          </>
        }
      />

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="card lg:col-span-2">
            <div className="section-head"><span className="section-title">Client &amp; contract</span></div>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 p-4 sm:grid-cols-2">
              <Info label="Client" value={project.clientName} />
              <Info label="Phone" value={project.clientPhone} />
              <Info label="Email" value={project.clientEmail} />
              <Info label="Address" value={project.clientAddress} />
              <Info label="Agreement date" value={formatDate(project.agreementDate)} />
              <Info label="Start date" value={formatDate(project.startDate)} />
              {customDefs.map((d) => <Info key={d.key} label={d.label} value={project.customFields?.[d.key]} />)}
            </dl>
          </div>
          <div className="space-y-4">
            <div className="card">
              <div className="section-head">
                <span className="section-title">Team</span>
                {canEdit && <button className="text-xs font-medium text-brand-600 hover:underline" onClick={openProjectEmp}>Manage</button>}
              </div>
              <div className="p-4">
                {project.assignees?.length ? (
                  <ul className="space-y-2">
                    {project.assignees.map((u) => (
                      <li key={u.id} className="flex items-center gap-2 text-sm">
                        <Avatar name={u.name} />
                        <span className="truncate text-slate-700 dark:text-slate-200">{u.name}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-400">No one assigned yet.</p>
                )}
              </div>
            </div>
            <div className="card">
              <div className="section-head"><span className="section-title">Stage progress</span></div>
              <ul className="space-y-2.5 p-4">
                {project.phases.length === 0 && <li className="text-sm text-slate-400">No stages.</li>}
                {project.phases.map((ph) => (
                  <li key={ph.id}>
                    <div className="mb-0.5 flex items-center justify-between text-xs">
                      <span className="truncate font-medium text-slate-700 dark:text-slate-200">{ph.name}</span>
                      <span className="text-slate-400">{statusLabel(ph.status)}</span>
                    </div>
                    <Progress value={ph.progress ?? 0} color={statusColor(ph.status)} size="xs" />
                  </li>
                ))}
              </ul>
            </div>
            {showApprovals && pendingApprovals.length > 0 && (
              <button className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-800 hover:bg-amber-100 dark:border-amber-900/50" onClick={() => setTab('approvals')}>
                <span className="font-semibold">{pendingApprovals.length} pending approval{pendingApprovals.length > 1 ? 's' : ''}</span> — review now →
              </button>
            )}
          </div>
        </div>
      )}

      {activeTab === 'timeline' && (
        <div className="card p-4">
          <GanttChart phases={project.phases} project={project} statusLabel={statusLabel} />
        </div>
      )}

      {activeTab === 'stages' && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-slate-500">{stagesDone} of {project.phases.length} stages completed</p>
            {canEdit && <button className="btn-primary btn-sm" onClick={onAddPhase}><Icon name="add" className="h-3.5 w-3.5" /> Add stage</button>}
          </div>
          {project.phases.length === 0 ? (
            <EmptyState title="No stages yet" hint="Add the first stage to start tracking work." />
          ) : (
            <div className="card divide-y divide-slate-100 overflow-hidden dark:divide-slate-700">
              {project.phases.map((phase, idx) => {
                const isOpen = openStages.has(phase.id);
                const done = (phase.tasks || []).filter((t) => t.status === 'completed').length;
                const w = phase.status !== 'completed' ? deadlineWarning(phase.deadline) : null;
                return (
                  <div key={phase.id}>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                      <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => toggleStage(phase.id)} aria-expanded={isOpen}>
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${phase.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                          {phase.status === 'completed' ? <Icon name="check" className="h-3.5 w-3.5" /> : idx + 1}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">{phase.name}</span>
                          <span className="block text-xs text-slate-400">
                            {done}/{(phase.tasks || []).length} tasks
                            {phase.deadline ? ` · due ${formatDate(phase.deadline)}` : ''}
                            {w && <span className={`ml-1 font-medium ${w.tone}`}>· {w.text}</span>}
                          </span>
                        </span>
                      </button>
                      <Progress value={phase.progress ?? 0} color={statusColor(phase.status)} className="w-40" />
                      <div className="flex -space-x-1.5">
                        {(phase.assignees || []).slice(0, 4).map((u) => <Avatar key={u.id} name={u.name} ring />)}
                        {(phase.assignees || []).length > 4 && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold ring-2 ring-white">+{phase.assignees.length - 4}</span>}
                      </div>
                      {canEdit ? (
                        <StatusSelect value={phase.status} statuses={statuses} onChange={(v) => changePhaseStatus(phase, v)} className="w-36 py-1 text-xs" />
                      ) : (
                        <StatusBadge status={phase.status} label={statusLabel(phase.status)} />
                      )}
                      <button className="btn-ghost px-1.5 py-1" onClick={() => toggleStage(phase.id)} aria-label={isOpen ? 'Collapse' : 'Expand'}>
                        <svg className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.06l3.71-3.83a.75.75 0 1 1 1.08 1.04l-4.25 4.39a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06z" clipRule="evenodd" /></svg>
                      </button>
                    </div>

                    {isOpen && (
                      <div className="grid grid-cols-1 gap-4 border-t border-slate-100 bg-slate-50/60 px-4 py-3 md:grid-cols-3 dark:border-slate-700 dark:bg-slate-900/30">
                        <div className="md:col-span-2">
                          <div className="mb-1.5 flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tasks</span>
                            {canEdit && <button className="text-xs font-medium text-brand-600 hover:underline" onClick={() => openAddTask(phase)}>+ Add task</button>}
                          </div>
                          {phase.tasks?.length ? (
                            <ul className="space-y-0.5">
                              {phase.tasks.map((task) => (
                                <li key={task.id} className="group flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-white dark:hover:bg-slate-800">
                                  <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={task.status === 'completed'} disabled={!canEdit} onChange={() => toggleTask(phase, task)} />
                                  <span className={`flex-1 ${task.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}>{task.title}</span>
                                  {canEdit && (
                                    <span className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                                      <button className="rounded p-1 text-slate-400 hover:text-brand-600" onClick={() => openEditTask(phase, task)} aria-label="Edit task"><Icon name="edit" className="h-3.5 w-3.5" /></button>
                                      <button className="rounded p-1 text-slate-400 hover:text-red-600" onClick={() => onDeleteTask(phase, task)} aria-label="Delete task"><Icon name="trash" className="h-3.5 w-3.5" /></button>
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-slate-400">No tasks yet.</p>
                          )}
                        </div>
                        <div className="space-y-3">
                          <div>
                            <div className="mb-1.5 flex items-center justify-between">
                              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assigned</span>
                              {canEdit && <button className="text-xs font-medium text-brand-600 hover:underline" onClick={() => openPhaseEmp(phase)}>Manage</button>}
                            </div>
                            {phase.assignees?.length ? (
                              <div className="flex flex-wrap gap-1.5">
                                {phase.assignees.map((u) => (
                                  <span key={u.id} className="inline-flex items-center gap-1 rounded-full bg-white py-0.5 pl-2 pr-1 text-xs text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600">
                                    {u.name}
                                    {canEdit && <button className="rounded-full px-1 text-slate-400 hover:text-red-600" onClick={() => removePhaseAssignee(phase, u.id)} aria-label={`Remove ${u.name}`}>×</button>}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-slate-400">Nobody assigned.</p>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <p className="mb-1 font-semibold uppercase tracking-wide text-slate-500">Start</p>
                              <DeadlineField value={phase.startDate} canEdit={canEdit} onChange={(d) => setPhaseStart(phase, d)} />
                            </div>
                            <div>
                              <p className="mb-1 font-semibold uppercase tracking-wide text-slate-500">Deadline</p>
                              <DeadlineField value={phase.deadline} canEdit={canEdit} onChange={(d) => setPhaseDeadline(phase, d)} />
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-3">
                            {queriesEnabled && <button className="text-xs font-medium text-brand-600 hover:underline" onClick={() => navigate(`/queries?new=1&projectId=${project.id}&phaseId=${phase.id}`)}>Raise query on this stage</button>}
                            {canEdit && <button className="text-xs font-medium text-red-600 hover:underline" onClick={() => onDeletePhase(phase)}>Delete stage</button>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'approvals' && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-slate-500">Requests raised on this project — stage sign-offs, budget, materials and more.</p>
            <button className="btn-primary btn-sm" onClick={openRequest}><Icon name="add" className="h-3.5 w-3.5" /> New request</button>
          </div>
          {approvals.length === 0 ? (
            <EmptyState title="No requests yet" hint="Raise a request when something needs a manager's sign-off." />
          ) : (
            <div className="card divide-y divide-slate-100 dark:divide-slate-700">
              {approvals.map((a) => {
                const st = APPROVAL_STATUS[a.status] || APPROVAL_STATUS.pending;
                const typeLabel = APPROVAL_TYPES.find((t) => t.key === a.type)?.label || a.type;
                return (
                  <div key={a.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{a.title}</span>
                        <span className={`badge ${st.cls}`}>{st.label}</span>
                        <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200">{typeLabel}</span>
                        {a.priority && a.priority !== 'normal' && (
                          <span className={`text-[11px] font-semibold uppercase ${PRIORITY_CLS[a.priority] || ''}`}>{a.priority}</span>
                        )}
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
                        <button className="btn-success btn-sm" onClick={() => decide(a, 'approve')}>Approve</button>
                        <button className="btn-secondary btn-sm text-red-600" onClick={() => decide(a, 'reject')}>Reject</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* New request modal */}
      <Modal
        open={Boolean(approvalModal)}
        onClose={() => setApprovalModal(null)}
        title="New Request / Approval"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setApprovalModal(null)}>Cancel</button>
            <button className="btn-primary" onClick={submitRequest}>Submit</button>
          </>
        }
      >
        {approvalModal && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Type</label>
                <Select
                  className="input"
                  value={approvalModal.type}
                  onChange={(e) => setApprovalModal((m) => ({ ...m, type: e.target.value }))}
                >
                  {APPROVAL_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </Select>
              </div>
              <div>
                <label className="label">Priority</label>
                <Select
                  className="input"
                  value={approvalModal.priority}
                  onChange={(e) => setApprovalModal((m) => ({ ...m, priority: e.target.value }))}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </Select>
              </div>
            </div>
            {project.phases.length > 0 && (
              <div>
                <label className="label">Related stage (optional)</label>
                <Select
                  className="input"
                  value={approvalModal.phaseId}
                  onChange={(e) => setApprovalModal((m) => ({ ...m, phaseId: e.target.value }))}
                >
                  <option value="">—</option>
                  {project.phases.map((ph) => <option key={ph.id} value={ph.id}>{ph.name}</option>)}
                </Select>
              </div>
            )}
            <div>
              <label className="label">Title</label>
              <input
                className="input"
                autoFocus
                placeholder="e.g. Approve Foundation stage completion"
                value={approvalModal.title}
                onChange={(e) => setApprovalModal((m) => ({ ...m, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Details (optional)</label>
              <textarea
                className="input"
                rows={3}
                value={approvalModal.description}
                onChange={(e) => setApprovalModal((m) => ({ ...m, description: e.target.value }))}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Employee picker modal (project or phase) */}
      <Modal
        open={Boolean(empModal)}
        onClose={() => setEmpModal(null)}
        title={empModal?.scope === 'project' ? 'Assign Employees to Project' : 'Phase Employees'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setEmpModal(null)}>Cancel</button>
            <button className="btn-primary" onClick={saveEmp}>Update</button>
          </>
        }
      >
        {empModal && (
          <div className="min-h-[14rem]">
            <label className="label">{empModal.scope === 'project' ? 'People working on this project' : 'People on this stage'}</label>
            <MultiSelect
              options={employees.map((u) => ({ value: u.id, label: u.name, sub: u.designation || u.role?.name || '' }))}
              value={[...empModal.selected]}
              onChange={(ids) => setEmpModal((m) => ({ ...m, selected: new Set(ids) }))}
              placeholder="Search and add people…"
              loading={!employees.length && can('users.read')}
              emptyText="No active users"
            />
            <p className="mt-2 text-xs text-slate-500">{empModal.scope === 'project' ? 'Assigned people see this project and are notified.' : 'Only people already on the project can usually see it.'}</p>
          </div>
        )}
      </Modal>

      {/* Task add/edit modal */}
      <Modal
        open={Boolean(taskModal)}
        onClose={() => setTaskModal(null)}
        title={taskModal?.taskId ? 'Edit Task' : 'Add Tasks'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setTaskModal(null)}>Cancel</button>
            <button className="btn-primary" onClick={saveTask}>{taskModal?.taskId ? 'Save' : 'Update'}</button>
          </>
        }
      >
        {taskModal && taskModal.taskId && (
          <div>
            <label className="label">Task title</label>
            <input
              className="input"
              autoFocus
              value={taskModal.title}
              onChange={(e) => setTaskModal((m) => ({ ...m, title: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && saveTask()}
            />
          </div>
        )}
        {taskModal && !taskModal.taskId && (
          <div className="space-y-5">
            <div>
              <p className="label">Existing Tasks</p>
              <p className="mb-2 text-xs text-slate-400">From Settings → Task Management. Select one or more.</p>
              {masterTasks.length === 0 ? (
                <p className="text-sm text-slate-400">No predefined tasks. Create some in Settings.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
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
                      {t}
                      <button type="button" className="ml-1 text-slate-400 hover:text-red-500" onClick={() => removeTempChip(t)}>&times;</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="Temporary task name"
                  value={taskModal.tempDraft}
                  onChange={(e) => setTaskModal((m) => ({ ...m, tempDraft: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTempChip())}
                />
                <button type="button" className="btn-secondary" onClick={addTempChip}>Add</button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
