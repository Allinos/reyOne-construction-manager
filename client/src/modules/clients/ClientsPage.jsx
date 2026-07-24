import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listClients } from './api';
import { errorMessage } from '../../lib/api';
import { PageHeader, Card, Spinner, EmptyState, Pagination, Alert } from '../../components/ui';

export default function ClientsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ items: [], meta: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setResult(await listClients({ page, search: search || undefined }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader title="Clients" subtitle="All clients across projects" />

      <Card className="mb-4">
        <input className="input" placeholder="Search clients…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </Card>

      {error && <Alert>{error}</Alert>}

      <Card className="!p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-10"><Spinner /></div>
        ) : result.items.length === 0 ? (
          <div className="p-6"><EmptyState title="No clients yet" hint="Clients appear here once projects are created." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream-100 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">GST</th>
                  <th className="px-4 py-3 text-center font-medium">Total</th>
                  <th className="px-4 py-3 text-center font-medium">Active</th>
                  <th className="px-4 py-3 text-center font-medium">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {result.items.map((c) => (
                  <tr key={c.id} className="cursor-pointer hover:bg-cream-100" onClick={() => navigate(`/clients/${c.id}`)}>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{c.name}</td>
                    <td className="px-4 py-3 text-slate-600">{c.phone || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{c.email || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{c.gstNumber || '—'}</td>
                    <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-200">{c.totalProjects}</td>
                    <td className="px-4 py-3 text-center text-blue-600">{c.activeProjects}</td>
                    <td className="px-4 py-3 text-center text-green-600">{c.completedProjects}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Pagination meta={result.meta} onPage={setPage} />
    </div>
  );
}
