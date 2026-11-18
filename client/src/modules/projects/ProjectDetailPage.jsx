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
import { PageHeader, FullPageLoader, SectionCard, Alert, StatusBadge } from '../../components/ui';
import { statusColor, statusSelectClass } from '../../lib/status';
import Modal from '../../components/Modal';
import Icon from '../../components/Icon';
import RequirementsButton from '../requirements/RequirementsWorkspace';

// Colors <option> text and applies a status-tinted class to a <select>.
function StatusSelect({ value, statuses, onChange, className = '' }) {
  return (
    <select
      className={`input py-1.5 font-medium ${statusSelectClass(value)} ${className}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {statuses.map((s) => (
        <option key={s.key} value={s.key} style={{ color: statusColor(s.key) }}>
          {s.label}
        </option>
      ))}
    </select>
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
      <span className="text-slate-500">{label}:</span>
      <span className="font-medium text-slate-700 dark:text-slate-200">{value ?? '—'}</span>
    </div>
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
      className="rounded-md bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 dark:bg-slate-700 dark:text-brand-300"
      onClick={() => canEdit && setEditing(true)}
      disabled={!canEdit}
    >
      {value ? formatDate(value) : 'not set yet'}
    </button>
  );
}

// A thin progress bar with an optional inline label.
function ProgressBar({ value = 0, height = 'h-2.5', color = '#F97316' }) {
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

  const [project, setProject] = useState(null);
  const [customDefs, setCustomDefs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState('');
  const [empModal, setEmpModal] = useState(null); // { scope, phaseId, selected:Set }
  const [taskModal, setTaskModal] = useState(null); // { phaseId, taskId, title }
  const [approvals, setApprovals] = useState([]);
  const [approvalModal, setApprovalModal] = useState(null); // { type, title, description, priority, phaseId }

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

  return (
    <div>
      <PageHeader
        title={project.name}
        subtitle={`Reference no: ${project.referenceNumber} · Category: ${project.category || '—'}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/projects"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-white shadow-sm hover:bg-brand-600"
              title="Back"
              aria-label="Back"
            >
              <Icon name="arrowLeft" className="h-4 w-4" />
            </Link>
            {canEdit && <StatusSelect value={project.status} statuses={statuses} onChange={changeStatus} className="w-auto" />}
            {canEdit && <button className="btn-secondary" onClick={openProjectEmp}>Assign Employees</button>}
            {canEdit && <Link to={`/projects/${id}/edit`} className="btn-secondary">Edit</Link>}
            {can('projects.delete') && <button className="btn-secondary text-red-600" onClick={onDelete}>Delete</button>}
          </div>
        }
      />

      {/* Project info */}
      <div className="card mb-6 p-5">
        <div className="mb-3 flex items-center gap-3">
          <StatusBadge status={project.status} label={statusLabel(project.status)} />
          {project.assignees?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {project.assignees.map((u) => (
                <span key={u.id} className="badge bg-cream-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200">{u.name}</span>
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 gap-y-2 md:grid-cols-2">
          <Info label="Client Name" value={project.clientName} />
          <Info label="Phone Number" value={project.clientPhone} />
          <Info label="Email ID" value={project.clientEmail} />
          <Info label="Address" value={project.clientAddress} />
          <Info label="Project Amount" value={formatMoney(project.projectAmount, currency)} />
          <Info label="Agreement Date" value={formatDate(project.agreementDate)} />
          <Info label="Start Date" value={formatDate(project.startDate)} />
          <Info label="Target Completion" value={formatDate(project.endDate)} />
          {customDefs.map((d) => <Info key={d.key} label={d.label} value={project.customFields?.[d.key]} />)}
        </div>

        {/* Overall progress */}
        <div className="mt-4 border-t border-cream-200 pt-4 dark:border-slate-700">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Overall Progress</span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-brand-600">{project.progress ?? 0}%</span>
              {canEdit && (
                <select
                  className="input w-auto py-1 text-xs"
                  value={project.progressMode || 'auto'}
                  onChange={(e) => changeProgressMode(e.target.value)}
                  title="Auto = from stage/task completion. Manual = set it yourself."
                >
                  <option value="auto">Auto</option>
                  <option value="manual">Manual</option>
                </select>
              )}
            </div>
          </div>
          <ProgressBar value={project.progress ?? 0} height="h-3" />
          {project.progressMode === 'manual' && canEdit && (
            <input
              type="range"
              min="0"
              max="100"
              value={project.progress ?? 0}
              onChange={(e) => changeManualProgress(e.target.value)}
              className="mt-2 w-full accent-brand-500"
            />
          )}
          {project.progressMode !== 'manual' && (
            <p className="mt-1 text-xs text-slate-400">Calculated automatically from stage &amp; task completion.</p>
          )}
        </div>
      </div>

      {/* Project Finance / Requirements & Details / Photos & Docs */}
      {(requirementsEnabled || financeEnabled) && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {financeEnabled && (
              <button className="btn-secondary" onClick={() => navigate(`/finance/project?projectId=${project.id}`)}>
                <span className="mr-1.5 inline-flex align-middle"><Icon name="finance" className="h-4 w-4" /></span>
                Project Finance
              </button>
            )}
            {requirementsEnabled && <RequirementsButton projectId={project.id} />}
          </div>
          {photosEnabled && (
            <RequirementsButton
              projectId={project.id}
              initialTab="photo_upload"
              label="Photos & Docs"
              icon="photo"
            />
          )}
        </div>
      )}

      {/* Timeline / Gantt */}
      {project.phases.length > 0 && (
        <div className="card mb-6 p-5">
          <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-100">Timeline</h2>
          <GanttChart phases={project.phases} project={project} statusLabel={statusLabel} />
        </div>
      )}

      {/* Stages */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Stages</h2>
        {canEdit && <button className="btn-ghost text-brand-600" onClick={onAddPhase}>+ Add Stage</button>}
      </div>

      {project.phases.length === 0 ? (
        <div className="card p-6 text-sm text-slate-400">No stages.</div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {project.phases.map((phase) => (
            <SectionCard
              key={phase.id}
              title={phase.name}
              actions={
                canEdit && (
                  <button className="text-xs text-red-500 hover:underline" onClick={() => onDeletePhase(phase)}>Remove</button>
                )
              }
            >
              {/* Controls */}
              <div className="mb-4 grid grid-cols-3 gap-2">
                {canEdit ? (
                  <StatusSelect value={phase.status} statuses={statuses} onChange={(v) => changePhaseStatus(phase, v)} />
                ) : (
                  <StatusBadge status={phase.status} label={statusLabel(phase.status)} />
                )}
                <button className="btn-secondary py-1.5" onClick={() => canEdit && openPhaseEmp(phase)} disabled={!canEdit}>Employee</button>
                <button className="btn-secondary py-1.5" onClick={() => canEdit && openAddTask(phase)} disabled={!canEdit}>+ Task</button>
              </div>

              {/* Phase progress */}
              <div className="mb-4">
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-slate-500">Progress</span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">{phase.progress ?? 0}%</span>
                </div>
                <ProgressBar value={phase.progress ?? 0} color={statusColor(phase.status)} />
              </div>

              {/* Assigned employees */}
              <p className="mb-1 text-sm font-medium text-brand-700 dark:text-brand-300">Assigned To</p>
              {phase.assignees?.length ? (
                <ul className="mb-4 divide-y divide-cream-200 dark:divide-slate-700">
                  {phase.assignees.map((u) => (
                    <li key={u.id} className="flex items-center justify-between py-1.5 text-sm">
                      <span className="text-slate-700 dark:text-slate-200">{u.name}</span>
                      {canEdit && (
                        <button className="text-slate-400 hover:text-red-500" onClick={() => removePhaseAssignee(phase, u.id)} aria-label="Remove">
                          <Icon name="trash" className="h-4 w-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mb-4 text-sm text-slate-400">No employees assigned.</p>
              )}

              {/* Tasks */}
              <p className="mb-1 text-sm font-medium text-brand-700 dark:text-brand-300">Tasks</p>
              {phase.tasks?.length ? (
                <ul className="mb-4 space-y-1">
                  {phase.tasks.map((task) => (
                    <li key={task.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={task.status === 'completed'}
                        disabled={!canEdit}
                        onChange={() => toggleTask(phase, task)}
                      />
                      <span className={task.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}>
                        {task.title}
                      </span>
                      {canEdit && (
                        <span className="ml-auto flex gap-2">
                          <button className="text-xs text-brand-600 hover:underline" onClick={() => openEditTask(phase, task)}>Edit</button>
                          <button className="text-xs text-red-500 hover:underline" onClick={() => onDeleteTask(phase, task)}>Delete</button>
                        </span>
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
                {(() => {
                  const w = deadlineWarning(phase.deadline);
                  return w ? <p className={`mt-1 text-xs font-medium ${w.tone}`}>⚠ {w.text}</p> : null;
                })()}
              </div>
            </SectionCard>
          ))}
        </div>
      )}

      {/* Approvals & Requests */}
      <div className="mt-8 mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          Approvals &amp; Requests
          {pendingApprovals.length > 0 && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              {pendingApprovals.length} pending
            </span>
          )}
        </h2>
        <button className="btn-ghost text-brand-600" onClick={openRequest}>+ New Request</button>
      </div>

      {approvals.length === 0 ? (
        <div className="card p-6 text-sm text-slate-400">No requests yet.</div>
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
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                    <span className="badge bg-cream-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200">{typeLabel}</span>
                    {a.priority && a.priority !== 'normal' && (
                      <span className={`text-xs font-semibold uppercase ${PRIORITY_CLS[a.priority] || ''}`}>{a.priority}</span>
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
                    <button className="btn-secondary py-1 text-green-600" onClick={() => decide(a, 'approve')}>Approve</button>
                    <button className="btn-secondary py-1 text-red-600" onClick={() => decide(a, 'reject')}>Reject</button>
                  </div>
                )}
              </div>
            );
          })}
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
                <select
                  className="input"
                  value={approvalModal.type}
                  onChange={(e) => setApprovalModal((m) => ({ ...m, type: e.target.value }))}
                >
                  {APPROVAL_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Priority</label>
                <select
                  className="input"
                  value={approvalModal.priority}
                  onChange={(e) => setApprovalModal((m) => ({ ...m, priority: e.target.value }))}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            {project.phases.length > 0 && (
              <div>
                <label className="label">Related stage (optional)</label>
                <select
                  className="input"
                  value={approvalModal.phaseId}
                  onChange={(e) => setApprovalModal((m) => ({ ...m, phaseId: e.target.value }))}
                >
                  <option value="">—</option>
                  {project.phases.map((ph) => <option key={ph.id} value={ph.id}>{ph.name}</option>)}
                </select>
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
          employees.length === 0 ? (
            <p className="text-sm text-slate-400">No employees available.</p>
          ) : (
            <ul className="space-y-2">
              {employees.map((u) => (
                <li key={u.id}>
                  <label className="flex items-center gap-3 rounded-lg border border-cream-300 px-3 py-2 dark:border-slate-700">
                    <input type="checkbox" checked={empModal.selected.has(u.id)} onChange={() => toggleEmp(u.id)} />
                    <span className="text-sm text-slate-700 dark:text-slate-200">{u.name}</span>
                    <span className="ml-auto text-xs text-slate-400">{u.designation || u.role?.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          )
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
