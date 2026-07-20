import { useEffect, useState, useCallback } from 'react';
import { listActivity } from './api';
import { errorMessage } from '../../lib/api';
import { PageHeader, Card, Spinner, EmptyState, Pagination, Alert } from '../../components/ui';

function formatWhen(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export default function ActivityPage() {
  const [filters, setFilters] = useState({ action: '', entityType: '', from: '', to: '', page: 1 });
  const [result, setResult] = useState({ items: [], meta: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v != null));
      setResult(await listActivity(clean));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const update = (patch) => setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));

  return (
    <div>
      <PageHeader title="Activity Logs" subtitle="Audit trail" />

      <Card className="mb-4">
        <div className="flex flex-wrap gap-3">
          <input className="input flex-1 min-w-[160px]" placeholder="Action (e.g. project.created)" value={filters.action} onChange={(e) => update({ action: e.target.value })} />
          <input className="input w-auto" placeholder="Entity type" value={filters.entityType} onChange={(e) => update({ entityType: e.target.value })} />
          <input type="date" className="input w-auto" value={filters.from} onChange={(e) => update({ from: e.target.value })} />
          <input type="date" className="input w-auto" value={filters.to} onChange={(e) => update({ to: e.target.value })} />
        </div>
      </Card>

      {error && <Alert>{error}</Alert>}

      <Card className="!p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-10"><Spinner /></div>
        ) : result.items.length === 0 ? (
          <div className="p-6"><EmptyState title="No activity found" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream-100 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Entity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {result.items.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-3 text-slate-500">{formatWhen(a.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-600">{a.user?.name || 'System'}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{a.action}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {a.entityType ? `${a.entityType}${a.entityId ? ` #${a.entityId}` : ''}` : '—'}
                    </td>
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
