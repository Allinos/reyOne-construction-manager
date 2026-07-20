import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getProject, deleteProject, updatePhase, getFieldDefs } from './api';
import { useAuth } from '../../context/AuthContext';
import { errorMessage } from '../../lib/api';
import { formatMoney, formatDate } from '../../lib/format';
import { PageHeader, Card, FullPageLoader, StatusBadge, Alert } from '../../components/ui';
import Modal from '../../components/Modal';

function Info({ label, value }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-700">{value ?? '—'}</dd>
    </div>
  );
}

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { bootstrap, can } = useAuth();
  const currency = bootstrap?.company?.currency || 'INR';
  const statuses = bootstrap?.settings?.projects?.statuses || [];
  const statusLabel = (key) => statuses.find((s) => s.key === key)?.label || key;

  const [project, setProject] = useState(null);
  const [customDefs, setCustomDefs] = useState([]);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

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
  }, [load]);

  const onPhaseStatus = async (phaseId, status) => {
    await updatePhase(id, phaseId, { status });
    load();
  };

  const onDelete = async () => {
    await deleteProject(id);
    navigate('/projects');
  };

  if (error) return <Alert>{error}</Alert>;
  if (!project) return <FullPageLoader />;

  return (
    <div>
      <PageHeader
        title={project.name}
        subtitle={`${project.referenceNumber} · ${project.clientName}`}
        actions={
          <div className="flex gap-2">
            <Link to="/projects" className="btn-secondary">
              Back
            </Link>
            {can('projects.update') && (
              <Link to={`/projects/${id}/edit`} className="btn-secondary">
                Edit
              </Link>
            )}
            {can('projects.delete') && (
              <button className="btn-secondary text-red-600" onClick={() => setConfirmDelete(true)}>
                Delete
              </button>
            )}
          </div>
        }
      />

      <Card className="mb-6">
        <div className="mb-3 flex items-center gap-3">
          <StatusBadge status={project.status} label={statusLabel(project.status)} />
          <span className="text-sm text-slate-400">{project.category || 'Uncategorized'}</span>
        </div>
        <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Info label="Client" value={project.clientName} />
          <Info label="Phone" value={project.clientPhone} />
          <Info label="Email" value={project.clientEmail} />
          <Info label="Address" value={project.clientAddress} />
          <Info label="Project Amount" value={formatMoney(project.projectAmount, currency)} />
          <Info label="Advance" value={formatMoney(project.advanceAmount, currency)} />
          <Info label="Agreement Date" value={formatDate(project.agreementDate)} />
          {customDefs.map((d) => (
            <Info key={d.key} label={d.label} value={project.customFields?.[d.key]} />
          ))}
        </dl>
      </Card>

      <h2 className="mb-3 text-lg font-semibold text-slate-800">Phases</h2>
      {project.phases.length === 0 ? (
        <Card className="text-sm text-slate-400">No phases.</Card>
      ) : (
        <div className="space-y-4">
          {project.phases.map((phase) => (
            <Card key={phase.id}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium text-slate-800">{phase.name}</h3>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-slate-400">Deadline: {formatDate(phase.deadline)}</span>
                  {can('projects.update') ? (
                    <select
                      className="input w-auto py-1"
                      value={phase.status}
                      onChange={(e) => onPhaseStatus(phase.id, e.target.value)}
                    >
                      {statuses.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <StatusBadge status={phase.status} label={statusLabel(phase.status)} />
                  )}
                </div>
              </div>

              {phase.assignees?.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {phase.assignees.map((u) => (
                    <span key={u.id} className="badge bg-cream-200 text-slate-600">
                      {u.name}
                    </span>
                  ))}
                </div>
              )}

              {phase.tasks?.length > 0 ? (
                <ul className="divide-y divide-cream-200 rounded-lg border border-cream-200">
                  {phase.tasks.map((task) => (
                    <li key={task.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="text-slate-700">{task.title}</span>
                      <div className="flex items-center gap-2">
                        {task.assignees?.map((u) => (
                          <span key={u.id} className="text-xs text-slate-400">
                            {u.name}
                          </span>
                        ))}
                        <StatusBadge status={task.status} label={statusLabel(task.status)} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400">No tasks.</p>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete project?"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
            <button className="btn-primary bg-red-600 hover:bg-red-700" onClick={onDelete}>
              Delete
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          This will remove <strong>{project.name}</strong>. This action cannot be undone from the UI.
        </p>
      </Modal>
    </div>
  );
}
