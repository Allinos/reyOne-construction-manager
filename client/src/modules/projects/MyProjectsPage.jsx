import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listProjects } from './api';
import { useAuth } from '../../context/AuthContext';
import { errorMessage } from '../../lib/api';
import { formatMoney, formatDate } from '../../lib/format';
import { PageHeader, Spinner, EmptyState, StatusBadge, Alert } from '../../components/ui';

// Employee panel: card-based list of the projects assigned to the current user.
export default function MyProjectsPage() {
  const { bootstrap } = useAuth();
  const navigate = useNavigate();
  const currency = bootstrap?.company?.currency || 'INR';
  const statuses = bootstrap?.settings?.projects?.statuses || [];
  const statusLabel = (key) => statuses.find((s) => s.key === key)?.label || key;

  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    listProjects({ mine: 'true', limit: 100 })
      .then((r) => setItems(r.items))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  if (error) return <Alert>{error}</Alert>;

  return (
    <div>
      <PageHeader title="My Projects" subtitle="Projects assigned to you" />
      {items === null ? (
        <div className="flex justify-center p-10"><Spinner /></div>
      ) : items.length === 0 ? (
        <EmptyState title="No projects assigned" hint="Assigned projects will appear here." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(`/projects/${p.id}`)}
              className="card p-5 text-left transition-shadow hover:shadow-md"
            >
              <div className="mb-2 flex items-start justify-between">
                <span className="text-xs font-medium text-brand-700 dark:text-brand-300">{p.referenceNumber}</span>
                <StatusBadge status={p.status} label={statusLabel(p.status)} />
              </div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">{p.name}</h3>
              <p className="mt-0.5 text-sm text-slate-500">{p.clientName}</p>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-slate-400">{formatDate(p.agreementDate)}</span>
                <span className="font-medium text-slate-700 dark:text-slate-200">{formatMoney(p.projectAmount, currency)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
