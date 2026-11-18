import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { unwrap, errorMessage } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Card, FullPageLoader, StatusBadge } from '../../components/ui';
import { formatMoney, formatDate } from '../../lib/format';
import { DonutChart, PieChart, BarChart, CHART_COLORS } from '../../components/charts';
import { statusColor } from '../../lib/status';
import Icon from '../../components/Icon';
import InstallmentStatus from '../finance/InstallmentStatus';

// Self check-in card (shown when Settings → Attendance → self check-in is on).
function MyAttendance() {
  const { bootstrap } = useAuth();
  const [me, setMe] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const on = (bootstrap?.modules || []).some((m) => m.key === 'attendance');
  useEffect(() => { if (on) unwrap(api.get('/attendance/me')).then(setMe).catch(() => {}); }, [on]);
  if (!me?.enabled) return null;
  const r = me.record;
  const punch = async (kind) => {
    setBusy(true);
    setErr('');
    try { setMe(await unwrap(api.post(`/attendance/me/check-${kind}`, {}))); } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <div className="card mb-5 flex flex-wrap items-center gap-4 px-4 py-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-100 text-brand-800"><Icon name="attendance" className="h-5 w-5" /></span>
      <div className="mr-auto">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">My attendance today</p>
        <p className="text-xs text-slate-500">
          {r?.checkIn ? <>In {r.checkIn}{r.late && <span className="ml-1 font-medium text-amber-700">(late)</span>}{r.checkOut ? ` · Out ${r.checkOut}` : ''}</> : `Not checked in · work starts ${me.rules.workStart}`}
        </p>
        {err && <p className="text-xs text-red-600">{err}</p>}
      </div>
      {!r?.checkIn && <button className="btn-primary" disabled={busy} onClick={() => punch('in')}>Check in</button>}
      {r?.checkIn && !r.checkOut && <button className="btn-secondary" disabled={busy} onClick={() => punch('out')}>Check out</button>}
      {r?.checkOut && <span className="badge bg-emerald-50 text-emerald-700">Done for today</span>}
    </div>
  );
}

const TONE = {
  red: 'border-l-red-500 bg-red-50/70 dark:bg-red-900/10',
  amber: 'border-l-amber-500 bg-amber-50/70 dark:bg-amber-900/10',
  sky: 'border-l-sky-500 bg-sky-50/70 dark:bg-sky-900/10',
};
const ATTN_ICON = { queries: 'queries', issues: 'inspection', approvals: 'check', material_requests: 'materials', dispatch: 'materials', late_projects: 'projects', overdue_installments: 'finance', attendance: 'attendance', low_stock: 'materials' };

function Kpi({ label, value, sub, tone = 'text-slate-800 dark:text-slate-100', to, icon }) {
  const body = (
    <div className="card flex h-full items-start gap-3 px-4 py-3.5 transition hover:shadow-md">
      {icon && <span className="mt-0.5 rounded-lg bg-brand-50 p-2 text-brand-600 dark:bg-slate-700 dark:text-brand-300"><Icon name={icon} className="h-4 w-4" /></span>}
      <div className="min-w-0">
        <p className="truncate text-xs text-slate-500">{label}</p>
        <p className={`truncate text-xl font-semibold ${tone}`}>{value}</p>
        {sub && <p className="truncate text-[11px] text-slate-400">{sub}</p>}
      </div>
    </div>
  );
  return to ? <Link to={to} className="block">{body}</Link> : body;
}

function Progress({ value }) {
  const v = Math.max(0, Math.min(100, value || 0));
  return <div className="h-1.5 w-full rounded-full bg-cream-200 dark:bg-slate-700"><div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${v}%` }} /></div>;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function DashboardPage() {
  const { bootstrap, user, can } = useAuth();
  const currency = bootstrap?.company?.currency || 'INR';
  const money = (v) => formatMoney(v, currency);
  const statuses = bootstrap?.settings?.projects?.statuses || [];
  const statusLabel = (key) => statuses.find((st) => st.key === key)?.label || key;
  const showFinance = can('finance.read') && (bootstrap?.modules || []).some((m) => m.key === 'finance');

  const [ins, setIns] = useState(null);
  const [summary, setSummary] = useState(null);
  const [charts, setCharts] = useState(null);
  const [activity, setActivity] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    unwrap(api.get('/dashboard/insights')).then(setIns).catch((e) => setError(errorMessage(e)));
    unwrap(api.get('/dashboard/activity')).then(setActivity).catch(() => {});
    if (showFinance) {
      unwrap(api.get('/dashboard/summary')).then(setSummary).catch(() => {});
      unwrap(api.get('/dashboard/charts', { params: { period: 'monthly' } })).then(setCharts).catch(() => {});
    }
  }, [showFinance]);

  if (error) return <Card className="text-red-600">{error}</Card>;
  if (!ins) return <FullPageLoader />;

  const p = ins.projects;
  const f = ins.finance;
  const a = ins.attendance;
  const pay = ins.payroll;
  const trend = f && f.collectedLastMonth ? Math.round(((f.collectedThisMonth - f.collectedLastMonth) / f.collectedLastMonth) * 100) : null;

  const kpis = [
    p && <Kpi key="p" icon="projects" label="Active projects" value={p.active} sub={`Avg progress ${p.avgProgress}% · ${p.completed} completed`} to="/projects" />,
    f && <Kpi key="c" icon="finance" label="Collected this month" value={money(f.collectedThisMonth)} tone="text-green-600" sub={trend === null ? `Last month ${money(f.collectedLastMonth)}` : `${trend >= 0 ? '▲' : '▼'} ${Math.abs(trend)}% vs last month`} to="/finance" />,
    f && <Kpi key="o" icon="finance" label="Outstanding from clients" value={money(f.outstanding)} tone="text-red-600" sub={f.overdue ? `${money(f.overdue)} overdue` : 'Nothing overdue'} to="/finance/collections" />,
    f && <Kpi key="e" icon="expenses" label="Expenses this month" value={money(f.expensesThisMonth)} to="/expenses" />,
    a && <Kpi key="a" icon="attendance" label="Present today" value={`${a.present + a.half_day} / ${a.people}`} sub={`${a.absent} absent · ${a.leave} leave · ${a.unmarked} unmarked`} to="/attendance" />,
    pay && <Kpi key="s" icon="payroll" label="Salary pending" value={money(pay.totalPending)} tone="text-red-600" sub={`Advances due ${money(pay.advanceOutstanding)}`} to="/payroll" />,
    ins.materials && <Kpi key="m" icon="materials" label="Low-stock materials" value={ins.materials.lowStockCount} tone={ins.materials.lowStockCount ? 'text-amber-600' : undefined} sub={`${ins.materials.pendingRequests} pending request(s)`} to="/materials" />,
    ins.inspections && <Kpi key="i" icon="inspection" label="Open site issues" value={ins.inspections.openIssues} tone={ins.inspections.bySeverity?.critical || ins.inspections.bySeverity?.high ? 'text-red-600' : undefined} sub={ins.inspections.bySeverity?.critical ? `${ins.inspections.bySeverity.critical} critical` : ''} to="/inspections" />,
    ins.queries && <Kpi key="q" icon="queries" label="Open queries" value={ins.queries.open} sub={ins.queries.urgent ? `${ins.queries.urgent} high/urgent` : ''} to="/queries" />,
  ].filter(Boolean);

  const statusData = p ? Object.entries(p.byStatus).filter(([, v]) => v > 0).map(([key, value]) => ({ label: statusLabel(key), value, color: statusColor(key) })) : [];
  const s = summary?.stats;
  const expenseCats = (summary?.expenseByCategory || []).map((cat, i) => ({ label: cat.category, value: Number(cat.amount || 0), color: CHART_COLORS[i % CHART_COLORS.length] }));

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">{greeting()}, {user?.name?.split(' ')[0] || 'there'}</h1>
        <p className="text-sm text-slate-500">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      <MyAttendance />

      {/* Needs attention */}
      <div className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Needs your attention</h2>
        {ins.attention.length === 0 ? (
          <div className="card flex items-center gap-3 px-4 py-3 text-sm text-green-700 dark:text-green-400"><Icon name="check" className="h-5 w-5" /> You're all caught up.</div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {ins.attention.map((x) => (
              <Link key={x.kind} to={x.to} className={`flex items-center gap-3 rounded-xl border border-cream-300 border-l-4 px-4 py-3 text-sm transition hover:shadow-md dark:border-slate-700 ${TONE[x.tone] || ''}`}>
                <Icon name={ATTN_ICON[x.kind] || 'bell'} className="h-5 w-5 shrink-0 text-slate-500" />
                <span className="flex-1 font-medium text-slate-700 dark:text-slate-200">{x.label}</span>
                <span className="text-slate-400">›</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {kpis.length > 0 && <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{kpis}</div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {ins.mine?.projects?.length > 0 && (
          <Card>
            <h2 className="mb-3 font-semibold text-slate-700 dark:text-slate-200">My Projects</h2>
            <ul className="space-y-3">
              {ins.mine.projects.map((x) => (
                <li key={x.id}>
                  <Link to={`/projects/${x.id}`} className="block rounded-lg p-1 hover:bg-cream-100 dark:hover:bg-slate-800">
                    <div className="mb-1 flex items-center justify-between text-sm"><span className="font-medium text-slate-700 dark:text-slate-200">{x.name}</span><span className="text-xs text-slate-500">{x.progress}%{x.endDate ? ` · due ${formatDate(x.endDate)}` : ''}</span></div>
                    <Progress value={x.progress} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {p && (p.overdue.length > 0 || p.upcoming.length > 0) && (
          <Card>
            <h2 className="mb-3 font-semibold text-slate-700 dark:text-slate-200">Project Deadlines</h2>
            <ul className="divide-y divide-cream-200 dark:divide-slate-700">
              {[...p.overdue.map((x) => ({ ...x, late: true })), ...p.upcoming].map((x) => (
                <li key={x.id}>
                  <Link to={`/projects/${x.id}`} className="flex items-center gap-3 py-2 text-sm hover:text-brand-600">
                    <span className="flex-1 truncate text-slate-700 dark:text-slate-200">{x.name}</span>
                    <span className="w-24"><Progress value={x.progress} /></span>
                    <span className={`w-24 text-right text-xs ${x.late ? 'font-semibold text-red-600' : 'text-slate-500'}`}>{x.late ? 'Late · ' : ''}{formatDate(x.endDate)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {f && f.dueSoon.length > 0 && (
          <Card>
            <h2 className="mb-3 font-semibold text-slate-700 dark:text-slate-200">Client Installments Due</h2>
            <ul className="divide-y divide-cream-200 dark:divide-slate-700">
              {f.dueSoon.map((d, i) => (
                <li key={i}>
                  <Link to={`/finance/project?projectId=${d.projectId}`} className="flex items-center gap-3 py-2 text-sm hover:text-brand-600">
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium text-slate-700 dark:text-slate-200">{d.clientName}</span><span className="block truncate text-xs text-slate-400">{d.projectName} · {d.title}</span></span>
                    <span className="text-right"><span className="block font-semibold">{money(d.balance)}</span><span className="text-xs text-slate-400">{formatDate(d.dueDate)}</span></span>
                    <InstallmentStatus status={d.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {ins.materials?.lowStock?.length > 0 && (
          <Card>
            <h2 className="mb-3 font-semibold text-slate-700 dark:text-slate-200">Low Stock (Central Store)</h2>
            <ul className="divide-y divide-cream-200 dark:divide-slate-700">
              {ins.materials.lowStock.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-2 text-sm"><span className="text-slate-700 dark:text-slate-200">{m.name}</span><span className="text-xs"><span className="font-semibold text-red-600">{m.inStore} {m.unit}</span> <span className="text-slate-400">/ reorder at {m.reorderLevel}</span></span></li>
              ))}
            </ul>
          </Card>
        )}

        {p && statusData.length > 0 && (
          <Card>
            <h2 className="mb-4 font-semibold text-slate-700 dark:text-slate-200">Project Status</h2>
            <DonutChart data={statusData} centerTop={p.total} centerBottom="Projects" />
          </Card>
        )}

        {showFinance && s && (
          <Card>
            <h2 className="mb-4 font-semibold text-slate-700 dark:text-slate-200">Collections</h2>
            {Number(s.totalRevenue) + Number(s.pendingPayments) > 0 ? (
              <DonutChart
                data={[{ label: 'Received', value: Number(s.totalRevenue || 0), color: '#16a34a' }, { label: 'Pending', value: Number(s.pendingPayments || 0), color: '#f59e0b' }]}
                centerTop={`${Math.round((Number(s.totalRevenue) / (Number(s.totalRevenue) + Number(s.pendingPayments) || 1)) * 100)}%`}
                centerBottom="Collected"
                formatValue={money}
              />
            ) : <p className="text-sm text-slate-400">No payment data.</p>}
          </Card>
        )}

        {showFinance && charts && (
          <Card className="lg:col-span-2">
            <h2 className="mb-4 font-semibold text-slate-700 dark:text-slate-200">Revenue vs Expenses (12 months)</h2>
            <BarChart labels={charts.labels} formatValue={money} series={[{ name: 'Revenue', color: '#16a34a', values: charts.revenue }, { name: 'Expenses', color: '#ef4444', values: charts.expenses }]} height={220} />
          </Card>
        )}

        {showFinance && expenseCats.length > 0 && (
          <Card>
            <h2 className="mb-4 font-semibold text-slate-700 dark:text-slate-200">Expense Breakdown</h2>
            <PieChart data={expenseCats} formatValue={money} />
          </Card>
        )}

        {showFinance && summary?.finance?.accounts?.length > 0 && (
          <Card>
            <h2 className="mb-3 font-semibold text-slate-700 dark:text-slate-200">Account Balances</h2>
            <ul className="divide-y divide-cream-200 dark:divide-slate-700">
              {summary.finance.accounts.map((acc) => (
                <li key={acc.key} className="flex items-center justify-between py-2 text-sm"><span className="text-slate-600 dark:text-slate-300">{acc.name}</span><span className="font-medium">{money(acc.balance)}</span></li>
              ))}
            </ul>
          </Card>
        )}

        {activity?.recentProjects?.length > 0 && (
          <Card>
            <h2 className="mb-3 font-semibold text-slate-700 dark:text-slate-200">Recent Projects</h2>
            <ul className="divide-y divide-cream-200 dark:divide-slate-700">
              {activity.recentProjects.map((x) => (
                <li key={x.id}><Link to={`/projects/${x.id}`} className="flex items-center justify-between py-2 text-sm hover:text-brand-600"><span className="text-slate-600 dark:text-slate-300"><span className="text-slate-400">{x.referenceNumber}</span> {x.name}</span><StatusBadge status={x.status} label={statusLabel(x.status)} /></Link></li>
              ))}
            </ul>
          </Card>
        )}

        {activity?.recentActivities?.length > 0 && (
          <Card>
            <h2 className="mb-3 font-semibold text-slate-700 dark:text-slate-200">Recent Activity</h2>
            <ul className="divide-y divide-cream-200 dark:divide-slate-700">
              {activity.recentActivities.map((x) => (
                <li key={x.id} className="flex items-center justify-between py-2 text-sm"><span className="text-slate-600 dark:text-slate-300">{x.action.replace(/[._]/g, ' ')}</span><span className="text-xs text-slate-400">{x.user?.name || 'System'} · {formatDate(x.createdAt)}</span></li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
