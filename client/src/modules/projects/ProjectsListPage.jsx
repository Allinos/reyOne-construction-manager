import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { listProjects } from './api';
import { useAuth } from '../../context/AuthContext';
import { errorMessage } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { PageHeader, Card, Spinner, EmptyState, Pagination, StatusBadge, Alert, Progress } from '../../components/ui';
import AnalyticsModal, { AnalyticsButton } from '../../components/AnalyticsModal';
import { ProjectAnalytics } from './analytics';
import Select from '../../components/Select';
import Icon from '../../components/Icon';

export default function ProjectsListPage() {
  const { bootstrap, can } = useAuth();
  const navigate = useNavigate();
  const categories = bootstrap?.settings?.projects?.categories || [];
  const statuses = bootstrap?.settings?.projects?.statuses || [];
  const statusLabel = (key) => statuses.find((s) => s.key === key)?.label || key;

  const [filters, setFilters] = useState({ search: '', category: '', status: '', page: 1 });
  const [result, setResult] = useState({ items: [], meta: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [analytics, setAnalytics] = useState(false);

  const load = useCallback(async (params) => {
    setLoading(true);
    setError('');
    try {
      const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null));
      setResult(await listProjects(clean));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filters);
  }, [filters, load]);

  const update = (patch) => setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle="All projects"
        actions={
          <div className="flex gap-2">
            {can('projects.create') && (
              <Link to="/projects/new" className="btn-primary">
                <Icon name="add" className="h-4 w-4" /> Add Project
              </Link>
            )}
            <AnalyticsButton onClick={() => setAnalytics(true)} />
          </div>
        }
      />

      <div className="mb-3">
        <div className="flex flex-wrap gap-2">
          <input
            className="input flex-1 min-w-[200px]"
            placeholder="Search reference, client, or name…"
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
          />
          <Select className="input w-auto" value={filters.category} onChange={(e) => update({ category: e.target.value })}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select className="input w-auto" value={filters.status} onChange={(e) => update({ status: e.target.value })}>
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      <Card className="!p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-10">
            <Spinner />
          </div>
        ) : result.items.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No projects found" hint="Try adjusting filters or add a project." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/40">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Reference</th>
                  <th className="px-4 py-2.5 font-medium">Client</th>
                  <th className="px-4 py-2.5 font-medium">Project</th>
                  <th className="px-4 py-2.5 font-medium">Category</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Progress</th>
                  <th className="px-4 py-2.5 font-medium">Agreement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {result.items.map((p) => (
                  <tr
                    key={p.id}
                    className="cursor-pointer hover:bg-cream-100"
                    onClick={() => navigate(`/projects/${p.id}`)}
                  >
                    <td className="px-4 py-2.5 font-medium text-brand-700">{p.referenceNumber}</td>
                    <td className="px-4 py-2.5 text-slate-600">{p.clientName}</td>
                    <td className="px-4 py-2.5 text-slate-800">{p.name}</td>
                    <td className="px-4 py-2.5 text-slate-600">{p.category || '—'}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={p.status} label={statusLabel(p.status)} />
                    </td>
                    <td className="px-4 py-2.5">
                      <Progress value={p.progress ?? 0} className="w-28" />
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{formatDate(p.agreementDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Pagination meta={result.meta} onPage={(page) => update({ page })} />

      <AnalyticsModal open={analytics} onClose={() => setAnalytics(false)} title="Project Analytics">
        <ProjectAnalytics open={analytics} />
      </AnalyticsModal>
    </div>
  );
}
