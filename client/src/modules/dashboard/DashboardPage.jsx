import { useEffect, useState } from 'react';
import api, { unwrap, errorMessage } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, FullPageLoader, StatusBadge } from '../../components/ui';
import { formatMoney, formatDate } from '../../lib/format';

function StatCard({ label, value, accent }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-2xl font-semibold ${accent || 'text-slate-800'}`}>{value}</span>
    </Card>
  );
}

export default function DashboardPage() {
  const { bootstrap } = useAuth();
  const currency = bootstrap?.company?.currency || 'INR';
  const [data, setData] = useState(null);
  const [activity, setActivity] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([unwrap(api.get('/dashboard/summary')), unwrap(api.get('/dashboard/activity'))])
      .then(([summary, act]) => {
        setData(summary);
        setActivity(act);
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  if (error) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <Card className="text-red-600">{error}</Card>
      </div>
    );
  }
  if (!data) return <FullPageLoader />;

  const s = data.stats;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Company overview" />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total Projects" value={s.totalProjects} />
        <StatCard label="Running" value={s.runningProjects} accent="text-blue-600" />
        <StatCard label="Completed" value={s.completedProjects} accent="text-green-600" />
        <StatCard label="Pending" value={s.pendingProjects} accent="text-amber-600" />
        <StatCard label="Total Revenue" value={formatMoney(s.totalRevenue, currency)} accent="text-green-600" />
        <StatCard label="Total Expenses" value={formatMoney(s.totalExpenses, currency)} accent="text-red-600" />
        <StatCard label="Total Profit" value={formatMoney(s.totalProfit, currency)} accent="text-brand-600" />
        <StatCard label="Pending Payments" value={formatMoney(s.pendingPayments, currency)} accent="text-amber-600" />
        <StatCard label="Total Users" value={s.totalUsers} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold text-slate-700">Finance by Account</h2>
          {data.finance.accounts.length ? (
            <ul className="divide-y divide-cream-200">
              {data.finance.accounts.map((a) => (
                <li key={a.key} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-slate-600">{a.name}</span>
                  <span className="font-medium text-slate-800">{formatMoney(a.balance, currency)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">No accounts configured.</p>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold text-slate-700">Upcoming Deadlines</h2>
          {activity?.upcomingDeadlines?.length ? (
            <ul className="divide-y divide-cream-200">
              {activity.upcomingDeadlines.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-slate-600">
                    {p.project?.name} — <span className="text-slate-400">{p.name}</span>
                  </span>
                  <span className="text-slate-500">{formatDate(p.deadline)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">No upcoming deadlines.</p>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold text-slate-700">Recent Projects</h2>
          {activity?.recentProjects?.length ? (
            <ul className="divide-y divide-cream-200">
              {activity.recentProjects.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-slate-600">
                    <span className="text-slate-400">{p.referenceNumber}</span> {p.name}
                  </span>
                  <StatusBadge status={p.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">No projects yet.</p>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold text-slate-700">Recent Activity</h2>
          {activity?.recentActivities?.length ? (
            <ul className="divide-y divide-cream-200">
              {activity.recentActivities.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-slate-600">{a.action}</span>
                  <span className="text-slate-400">{a.user?.name || 'System'}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">No activity yet.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
