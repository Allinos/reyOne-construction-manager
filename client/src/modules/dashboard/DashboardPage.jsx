import { useEffect, useState } from 'react';
import api, { unwrap, errorMessage } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, FullPageLoader, StatusBadge } from '../../components/ui';
import { formatMoney, formatDate } from '../../lib/format';
import { DonutChart, PieChart, BarChart, CHART_COLORS } from '../../components/charts';

const STATUS_COLORS = {
  pending: '#f59e0b',
  in_progress: '#3b82f6',
  on_hold: '#94a3b8',
  completed: '#16a34a',
};

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
  const [charts, setCharts] = useState(null);
  const [error, setError] = useState('');
  const statuses = bootstrap?.settings?.projects?.statuses || [];
  const statusLabel = (key) => statuses.find((st) => st.key === key)?.label || key;

  useEffect(() => {
    Promise.all([
      unwrap(api.get('/dashboard/summary')),
      unwrap(api.get('/dashboard/activity')),
      unwrap(api.get('/dashboard/charts', { params: { period: 'monthly' } })),
    ])
      .then(([summary, act, ch]) => {
        setData(summary);
        setActivity(act);
        setCharts(ch);
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

  const statusData = Object.entries(data.projectStatus || {})
    .filter(([, v]) => v > 0)
    .map(([key, value], i) => ({
      label: statusLabel(key),
      value,
      color: STATUS_COLORS[key] || CHART_COLORS[i % CHART_COLORS.length],
    }));
  const paymentData = [
    { label: 'Received', value: Number(s.totalRevenue || 0), color: '#16a34a' },
    { label: 'Pending', value: Number(s.pendingPayments || 0), color: '#f59e0b' },
  ];
  const expenseCats = (data.expenseByCategory || []).map((cat, i) => ({
    label: cat.category,
    value: Number(cat.amount || 0),
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

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

      {/* Analytics charts */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <h2 className="mb-4 font-semibold text-slate-700 dark:text-slate-200">Project Status Distribution</h2>
          {statusData.length ? (
            <DonutChart data={statusData} centerTop={s.totalProjects} centerBottom="Projects" />
          ) : (
            <p className="text-sm text-slate-400">No projects yet.</p>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 font-semibold text-slate-700 dark:text-slate-200">Payment Status</h2>
          {Number(s.totalRevenue) + Number(s.pendingPayments) > 0 ? (
            <DonutChart data={paymentData} centerTop={`${Math.round((Number(s.totalRevenue) / (Number(s.totalRevenue) + Number(s.pendingPayments) || 1)) * 100)}%`} centerBottom="Collected" />
          ) : (
            <p className="text-sm text-slate-400">No payment data.</p>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 font-semibold text-slate-700 dark:text-slate-200">Expense Breakdown</h2>
          {expenseCats.length ? (
            <PieChart data={expenseCats} />
          ) : (
            <p className="text-sm text-slate-400">No expenses recorded.</p>
          )}
        </Card>

        <Card className="lg:col-span-2 xl:col-span-3">
          <h2 className="mb-4 font-semibold text-slate-700 dark:text-slate-200">Revenue vs Expenses (Monthly)</h2>
          {charts ? (
            <BarChart
              labels={charts.labels}
              formatValue={(v) => formatMoney(v, currency)}
              series={[
                { name: 'Revenue', color: '#16a34a', values: charts.revenue },
                { name: 'Expenses', color: '#ef4444', values: charts.expenses },
              ]}
              height={220}
            />
          ) : (
            <p className="text-sm text-slate-400">Loading…</p>
          )}
        </Card>
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
