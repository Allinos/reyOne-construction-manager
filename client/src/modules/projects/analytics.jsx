import { useEffect, useState } from 'react';
import { projectAnalytics } from './api';
import { useAuth } from '../../context/AuthContext';
import { errorMessage } from '../../lib/api';
import { formatMoney, formatDate } from '../../lib/format';
import { Spinner, Alert, Card } from '../../components/ui';
import { HBars } from '../../components/charts';
import { statusColor } from '../../lib/status';

function Stat({ label, value, tone = 'text-slate-800' }) {
  return (
    <div className="rounded-lg border border-cream-300 bg-cream-100 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

export function ProjectAnalytics({ open }) {
  const { bootstrap } = useAuth();
  const currency = bootstrap?.company?.currency || 'INR';
  const statuses = bootstrap?.settings?.projects?.statuses || [];
  const statusLabel = (key) => statuses.find((s) => s.key === key)?.label || key;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setData(null);
    setError('');
    projectAnalytics().then(setData).catch((err) => setError(errorMessage(err)));
  }, [open]);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <div className="flex justify-center p-6"><Spinner /></div>;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Total Projects" value={data.totalProjects} />
        <Stat label="Total Project Value" value={formatMoney(data.totalValue, currency)} tone="text-brand-600" />
        <Stat label="Average Progress" value={`${data.avgProgress ?? 0}%`} tone="text-brand-600" />
        <Stat label="In Progress" value={data.inProgress ?? 0} />
        <Stat label="Completed" value={data.completed ?? 0} tone="text-green-600" />
        <Stat label="Overdue" value={data.overdue ?? 0} tone={data.overdue ? 'text-red-600' : 'text-slate-800'} />
      </div>

      {data.pendingApprovals > 0 && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
          <span className="font-semibold">{data.pendingApprovals}</span> approval request(s) awaiting a decision.
        </div>
      )}

      <Card className="mt-3">
        <h3 className="mb-3 font-semibold text-slate-700 dark:text-slate-200">Completion Distribution</h3>
        <HBars items={data.progressBuckets || []} color="#CC6E02" />
      </Card>

      {data.upcoming?.length > 0 && (
        <Card className="mt-3">
          <h3 className="mb-3 font-semibold text-slate-700 dark:text-slate-200">Upcoming Deadlines (30 days)</h3>
          <ul className="divide-y divide-cream-200 dark:divide-slate-700">
            {data.upcoming.map((u) => (
              <li key={u.id} className="flex items-center justify-between py-2 text-sm">
                <div className="min-w-0">
                  <span className="font-medium text-slate-700 dark:text-slate-200">{u.name}</span>
                  <span className="ml-2 text-xs text-slate-400">{u.referenceNumber}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-slate-500">{u.progress ?? 0}%</span>
                  <span className="font-medium text-amber-600">{formatDate(u.endDate)}</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="mt-3">
        <h3 className="mb-3 font-semibold text-slate-700 dark:text-slate-200">Projects by Status</h3>
        <HBars items={data.byStatus.map((s) => ({ label: statusLabel(s.label), value: s.value, color: statusColor(s.label) }))} />
      </Card>
      <Card className="mt-3">
        <h3 className="mb-3 font-semibold text-slate-700 dark:text-slate-200">Projects by Category</h3>
        <HBars items={data.byCategory} color="#0ea5e9" />
      </Card>
    </>
  );
}
