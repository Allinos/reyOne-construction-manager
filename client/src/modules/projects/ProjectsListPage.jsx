import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { listProjects } from './api';
import { useAuth } from '../../context/AuthContext';
import { errorMessage } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { PageHeader, Card, Spinner, EmptyState, Pagination, StatusBadge, Alert } from '../../components/ui';

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
          can('projects.create') && (
            <Link to="/projects/new" className="btn-primary">
              + Add Project
            </Link>
          )
        }
      />

      <Card className="mb-4">
        <div className="flex flex-wrap gap-3">
          <input
            className="input flex-1 min-w-[200px]"
            placeholder="Search reference, client, or name…"
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
          />
          <select className="input w-auto" value={filters.category} onChange={(e) => update({ category: e.target.value })}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select className="input w-auto" value={filters.status} onChange={(e) => update({ status: e.target.value })}>
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </Card>

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
              <thead className="bg-cream-100 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Reference</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Project</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Agreement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {result.items.map((p) => (
                  <tr
                    key={p.id}
                    className="cursor-pointer hover:bg-cream-100"
                    onClick={() => navigate(`/projects/${p.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-brand-700">{p.referenceNumber}</td>
                    <td className="px-4 py-3 text-slate-600">{p.clientName}</td>
                    <td className="px-4 py-3 text-slate-800">{p.name}</td>
                    <td className="px-4 py-3 text-slate-600">{p.category || '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} label={statusLabel(p.status)} />
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(p.agreementDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Pagination meta={result.meta} onPage={(page) => update({ page })} />
    </div>
  );
}
