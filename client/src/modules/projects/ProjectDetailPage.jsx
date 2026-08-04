import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  getProject, deleteProject, updateProject, updatePhase, deletePhase, addPhase,
  addTask, updateTask, deleteTask, getFieldDefs,
  assignProjectEmployees, listEmployees,
} from './api';
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
  const requirementsEnabled = (bootstrap?.modules || []).some((m) => m.key === 'requirements') && can('requirements.read');

  const [project, setProject] = useState(null);
  const [customDefs, setCustomDefs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState('');
  const [empModal, setEmpModal] = useState(null); // { scope, phaseId, selected:Set }
  const [taskModal, setTaskModal] = useState(null); // { phaseId, taskId, title }

  const load = useCallback(async () => {
    try {
      const [p, defs] = await Promise.all([getProject(id), getFieldDefs().catch(() => [])]);
      setProject(p);
      setCustomDefs(defs.filter((d) => d.isCustom));
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
            {requirementsEnabled && <RequirementsButton projectId={project.id} />}
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
          {customDefs.map((d) => <Info key={d.key} label={d.label} value={project.customFields?.[d.key]} />)}
        </div>
      </div>

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

              {/* Deadline */}
              <div className="border-t border-cream-200 pt-3 dark:border-slate-700">
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
