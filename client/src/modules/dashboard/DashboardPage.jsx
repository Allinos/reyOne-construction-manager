import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { unwrap, errorMessage } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { FullPageLoader, StatusBadge } from '../../components/ui';
import { formatMoney, formatDate } from '../../lib/format';
import { DonutChart, PieChart, CHART_COLORS } from '../../components/charts';
import { QuickAdd } from '../../components/layout/TopNav';
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

const ATTN = {
  queries: ['queries', 'b', 'Answer'], issues: ['inspection', 'r', 'Fix'], approvals: ['check', 'y', 'Review'], material_requests: ['materials', 'y', 'Review'],
  dispatch: ['materials', 'b', 'Dispatch'], late_projects: ['projects', 'r', 'View'], overdue_installments: ['finance', 'r', 'Follow up'],
  attendance: ['attendance', 'y', 'Mark'], low_stock: ['materials', 'y', 'Order'],
};
const ICON_BG = {
  g: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  r: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  y: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
  b: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};
const IconBox = ({ name, tone = 'y', size = 'h-7 w-7' }) => (
  <span className={`flex ${size} shrink-0 items-center justify-center rounded-lg ${ICON_BG[tone]}`}><Icon name={name} className="h-3.5 w-3.5" /></span>
);

function Spark({ values = [], color }) {
  const pts = values.filter((v) => v != null);
  if (pts.length < 2) return null;
  const w = 96; const h = 36;
  const mx = Math.max(...pts); const mn = Math.min(...pts);
  const xy = pts.map((v, i) => [(i * w) / (pts.length - 1), h - 4 - ((v - mn) / ((mx - mn) || 1)) * (h - 8)]);
  const d = `M${xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L')}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0" aria-hidden="true">
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={color} opacity=".12" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Kpi({ label, value, sub, subTone, icon, tone = 'y', to, children, spark }) {
  const body = (
    <div className="card flex h-full flex-col px-[18px] py-4 transition hover:border-brand-300">
      <p className="flex items-center gap-2 text-xs font-medium text-slate-400"><IconBox name={icon} tone={tone} />{label}</p>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-2xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white">{value}</p>
          {sub && <p className={`mt-0.5 truncate text-xs font-semibold ${subTone || 'font-medium text-slate-400'}`}>{sub}</p>}
        </div>
        {spark}
      </div>
      {children}
    </div>
  );
  return to ? <Link to={to} className="block">{body}</Link> : body;
}

function Bar({ value, tone = 'bg-brand-500' }) {
  const v = Math.max(0, Math.min(100, value || 0));
  return <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className={`h-full rounded-full ${tone}`} style={{ width: `${v}%` }} /></div>;
}

function Panel({ title, meta, action, children, className = '' }) {
  return (
    <div className={`card ${className}`}>
      <div className="flex items-center justify-between px-[18px] pb-2.5 pt-3.5">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
        {action || (meta && <span className="text-xs text-slate-400">{meta}</span>)}
      </div>
      {children}
    </div>
  );
}

// Received vs spent, last six months.
function CashFlow({ charts, money }) {
  const n = 6;
  const labels = charts.labels.slice(-n);
  const rev = charts.revenue.slice(-n).map(Number);
  const exp = charts.expenses.slice(-n).map(Number);
  const max = Math.max(1, ...rev, ...exp);
  const H = 170;
  const month = (l) => new Date(`${l}-01T00:00:00`).toLocaleString(undefined, { month: 'short' });
  return (
    <div className="px-[18px] pb-4">
      <div className="flex h-[200px] items-end gap-3 border-b border-slate-200 pb-0 dark:border-slate-700" style={{ backgroundImage: 'repeating-linear-gradient(to top, transparent 0 49px, rgba(125,110,92,.12) 49px 50px)' }}>
        {labels.map((l, i) => (
          <div key={l} className="group relative flex flex-1 items-end justify-center gap-1">
            <div className="w-[38%] max-w-[28px] rounded-t-md bg-brand-500" style={{ height: `${Math.max(2, (rev[i] / max) * H)}px` }} />
            <div className="w-[38%] max-w-[28px] rounded-t-md bg-slate-500/50" style={{ height: `${Math.max(2, (exp[i] / max) * H)}px` }} />
            <div className="pointer-events-none absolute bottom-full mb-2 hidden whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-pop group-hover:block dark:bg-slate-700">
              <b>{month(l)}</b> · In {money(rev[i])} · Out {money(exp[i])}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-3">{labels.map((l) => <span key={l} className="flex-1 text-center text-[11px] text-slate-400">{month(l)}</span>)}</div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function DashboardPage() {
  const { bootstrap, user, can } = useAuth();
  const currency = bootstrap?.company?.currency || 'INR';
  const money = (v) => formatMoney(v, currency);
  const short = (v) => {
    const n = Number(v) || 0;
    if (currency !== 'INR') return money(n);
    const a = Math.abs(n);
    if (a >= 1e7) return `₹${(n / 1e7).toFixed(2).replace(/\.?0+$/, '')}Cr`;
    if (a >= 1e5) return `₹${(n / 1e5).toFixed(1).replace(/\.0$/, '')}L`;
    if (a >= 1e3) return `₹${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
    return `₹${Math.round(n).toLocaleString('en-IN')}`;
  };
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

  if (error) return <div className="card p-5 text-red-600">{error}</div>;
  if (!ins) return <FullPageLoader />;

  const p = ins.projects;
  const f = ins.finance;
  const a = ins.attendance;
  const pay = ins.payroll;
  const trend = (now, prev) => (prev ? Math.round(((now - prev) / prev) * 100) : null);
  const inTrend = f ? trend(f.collectedThisMonth, f.collectedLastMonth) : null;
  const lastExp = charts ? Number(charts.expenses[charts.expenses.length - 2] || 0) : 0;
  const outTrend = f && charts ? trend(f.expensesThisMonth, lastExp) : null;
  const pct = (t) => (t === null ? null : `${t >= 0 ? '↑' : '↓'} ${Math.abs(t)}% vs last month`);

  // Four headline tiles: money first for finance users, otherwise site work.
  const kpis = [
    f && <Kpi key="in" icon="finance" tone="g" label="Received this month" value={short(f.collectedThisMonth)} sub={pct(inTrend) || `Last month ${short(f.collectedLastMonth)}`} subTone={inTrend === null ? '' : inTrend >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'} to="/finance" spark={charts && <Spark values={charts.revenue.slice(-7).map(Number)} color="#15803D" />} />,
    f && <Kpi key="out" icon="expenses" tone="r" label="Spent this month" value={short(f.expensesThisMonth)} sub={pct(outTrend) || ' '} subTone={outTrend === null ? '' : outTrend > 0 ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'} to="/expenses" spark={charts && <Spark values={charts.expenses.slice(-7).map(Number)} color="#C2410C" />} />,
    f && <Kpi key="due" icon="attendance" tone="y" label="Client dues" value={short(f.outstanding)} sub={f.overdue ? `${short(f.overdue)} overdue` : 'Nothing overdue'} subTone={f.overdue ? 'text-red-700 dark:text-red-400' : ''} to="/finance/collections" />,
    a && (
      <Kpi key="att" icon="workforce" tone="b" label="On site today" value={<>{a.present + a.half_day} <span className="text-sm font-semibold text-slate-400">/ {a.people}</span></>} to="/attendance">
        <div className="mt-3"><Bar value={a.people ? ((a.present + a.half_day) / a.people) * 100 : 0} tone="bg-emerald-600" /></div>
        <p className="mt-1.5 text-xs text-slate-400">{a.absent} absent · {a.leave} leave · {a.unmarked} unmarked</p>
      </Kpi>
    ),
    !f && p && <Kpi key="p" icon="projects" tone="y" label="Active projects" value={p.active} sub={`Avg progress ${p.avgProgress}%`} to="/projects" />,
    !f && ins.queries && <Kpi key="q" icon="queries" tone="b" label="Open queries" value={ins.queries.open} sub={ins.queries.urgent ? `${ins.queries.urgent} high / urgent` : 'None urgent'} to="/queries" />,
    !f && ins.inspections && <Kpi key="i" icon="inspection" tone="r" label="Open site issues" value={ins.inspections.openIssues} sub={ins.inspections.bySeverity?.critical ? `${ins.inspections.bySeverity.critical} critical` : ' '} to="/inspections" />,
    !f && ins.materials && <Kpi key="m" icon="materials" tone="y" label="Low-stock materials" value={ins.materials.lowStockCount} sub={`${ins.materials.pendingRequests} pending request(s)`} to="/materials" />,
  ].filter(Boolean).slice(0, 4);

  const active = p?.activeList || [];
  const statusData = p ? Object.entries(p.byStatus).filter(([, v]) => v > 0).map(([key, value]) => ({ label: statusLabel(key), value, color: statusColor(key) })) : [];
  const s = summary?.stats;
  const expenseCats = (summary?.expenseByCategory || []).map((cat, i) => ({ label: cat.category, value: Number(cat.amount || 0), color: CHART_COLORS[i % CHART_COLORS.length] }));
  const deadlines = p ? [...p.overdue.map((x) => ({ ...x, late: true })), ...p.upcoming] : [];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-white">{greeting()}, {user?.name?.split(' ')[0] || 'there'}</h1>
          <p className="mt-0.5 text-[13px] text-slate-400">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}
            {p ? ` · ${p.active} active site${p.active === 1 ? '' : 's'}` : ''}
            {` · ${ins.attention.length ? `${ins.attention.length} thing${ins.attention.length === 1 ? '' : 's'} need${ins.attention.length === 1 ? 's' : ''} you today` : "you're all caught up"}`}
          </p>
        </div>
        <QuickAdd variant="primary" />
      </div>

      <MyAttendance />

      {kpis.length > 0 && <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{kpis}</div>}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.55fr_1fr]">
        <div className="space-y-4">
          {showFinance && charts && (
            <Panel title="Cash flow" action={<span className="flex items-center gap-3 text-xs text-slate-400"><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-brand-500" />Received</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-slate-500/50" />Spent</span></span>}>
              <CashFlow charts={charts} money={money} />
            </Panel>
          )}
          {active.length > 0 && (
            <Panel title="Active projects" action={<Link to="/projects" className="text-xs font-semibold text-brand-600 hover:underline">View all ›</Link>}>
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead><tr><th>Project</th><th>Progress</th>{showFinance && <th>Spent</th>}<th>Due</th></tr></thead>
                  <tbody>
                    {active.map((x) => (
                      <tr key={x.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">
                        <td className="min-w-[12rem]"><Link to={`/projects/${x.id}`} className="font-semibold text-slate-800 hover:text-brand-600 dark:text-slate-100">{x.name}</Link><p className="text-xs text-slate-400">{x.clientName}{x.stage ? ` · ${x.stage}` : ''}</p></td>
                        <td className="w-44"><div className="flex items-center gap-2"><Bar value={x.progress} tone={x.progress >= 80 ? 'bg-emerald-600' : 'bg-brand-500'} /><span className="w-9 text-right text-xs font-semibold tabular-nums">{x.progress}%</span></div></td>
                        {showFinance && <td className="whitespace-nowrap tabular-nums">{short(x.spent)}{x.contract > 0 ? <span className="text-xs text-slate-400"> / {short(x.contract)}</span> : null}{x.contract > 0 && x.spent / x.contract > 0.9 && <span className="badge ml-2 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300">{Math.round((x.spent / x.contract) * 100)}%</span>}</td>}
                        <td className="whitespace-nowrap">{x.endDate ? <span className={`badge ${x.late ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{x.late ? 'Late' : formatDate(x.endDate)}</span> : <StatusBadge status={x.status} label={statusLabel(x.status)} />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </div>

        <div className="space-y-4">
          <Panel title="Needs your attention" action={ins.attention.length > 0 && <span className="rounded-full bg-red-50 px-2 text-xs font-bold leading-5 text-red-700 dark:bg-red-900/30 dark:text-red-300">{ins.attention.length}</span>}>
            <div className="space-y-2.5 px-[18px] pb-4">
              {ins.attention.length === 0 ? (
                <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400"><Icon name="check" className="h-4 w-4" /> You're all caught up.</p>
              ) : ins.attention.map((x) => {
                const [icon, tone, verb] = ATTN[x.kind] || ['bell', 'y', 'Open'];
                return (
                  <Link key={x.kind} to={x.to} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 transition hover:border-brand-300 dark:border-slate-700 dark:bg-slate-900/40">
                    <IconBox name={icon} tone={x.tone === 'red' ? 'r' : tone} />
                    <span className="min-w-0 flex-1 text-[13px] font-semibold text-slate-800 dark:text-slate-100">{x.label}</span>
                    <span className="btn-secondary btn-sm">{verb}</span>
                  </Link>
                );
              })}
            </div>
          </Panel>

          {deadlines.length > 0 && (
            <Panel title="Deadlines" meta="next 30 days">
              <ul className="px-[18px] pb-3">
                {deadlines.map((x) => (
                  <li key={x.id}>
                    <Link to={`/projects/${x.id}`} className="flex items-center gap-3 border-t border-slate-200 py-2.5 first:border-t-0 dark:border-slate-700">
                      <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">{x.name}</span><span className="mt-1 block w-28"><Bar value={x.progress} /></span></span>
                      <span className={`text-right text-xs ${x.late ? 'font-semibold text-red-700 dark:text-red-400' : 'text-slate-400'}`}>{x.late ? 'Late · ' : ''}{formatDate(x.endDate)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {ins.mine?.projects?.length > 0 && (
            <Panel title="My projects">
              <ul className="px-[18px] pb-3">
                {ins.mine.projects.map((x) => (
                  <li key={x.id}><Link to={`/projects/${x.id}`} className="block border-t border-slate-200 py-2.5 first:border-t-0 dark:border-slate-700"><div className="mb-1.5 flex justify-between text-[13px]"><span className="font-semibold text-slate-800 dark:text-slate-100">{x.name}</span><span className="text-xs text-slate-400">{x.progress}%</span></div><Bar value={x.progress} /></Link></li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {f && f.dueSoon.length > 0 && (
          <Panel title="Client installments due">
            <ul className="px-[18px] pb-3">
              {f.dueSoon.map((d, i) => (
                <li key={i}><Link to={`/finance/project?projectId=${d.projectId}`} className="flex items-center gap-3 border-t border-slate-200 py-2.5 text-sm first:border-t-0 dark:border-slate-700"><span className="min-w-0 flex-1"><span className="block truncate font-semibold text-slate-800 dark:text-slate-100">{d.clientName}</span><span className="block truncate text-xs text-slate-400">{d.projectName} · {d.title}</span></span><span className="text-right"><span className="block font-semibold tabular-nums">{short(d.balance)}</span><InstallmentStatus status={d.status} /></span></Link></li>
              ))}
            </ul>
          </Panel>
        )}
        {ins.materials?.lowStock?.length > 0 && (
          <Panel title="Low stock (central store)" action={<Link to="/materials" className="text-xs font-semibold text-brand-600 hover:underline">Order ›</Link>}>
            <ul className="px-[18px] pb-3">
              {ins.materials.lowStock.map((m) => <li key={m.id} className="flex items-center justify-between border-t border-slate-200 py-2.5 text-sm first:border-t-0 dark:border-slate-700"><span className="text-slate-700 dark:text-slate-200">{m.name}</span><span className="text-xs"><b className="text-red-700 dark:text-red-400">{m.inStore} {m.unit}</b> <span className="text-slate-400">/ reorder {m.reorderLevel}</span></span></li>)}
            </ul>
          </Panel>
        )}
        {pay && pay.totalPending > 0 && (
          <Panel title="Salaries" action={<Link to="/payroll" className="text-xs font-semibold text-brand-600 hover:underline">Pay ›</Link>}>
            <div className="px-[18px] pb-4"><p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{short(pay.totalPending)}</p><p className="text-xs text-slate-400">pending this month · advances due {short(pay.advanceOutstanding)}</p></div>
          </Panel>
        )}
        {showFinance && summary?.finance?.accounts?.length > 0 && (
          <Panel title="Account balances">
            <ul className="px-[18px] pb-3">{summary.finance.accounts.map((acc) => <li key={acc.key} className="flex items-center justify-between border-t border-slate-200 py-2.5 text-sm first:border-t-0 dark:border-slate-700"><span className="text-slate-600 dark:text-slate-300">{acc.name}</span><span className="font-semibold tabular-nums">{money(acc.balance)}</span></li>)}</ul>
          </Panel>
        )}
        {p && statusData.length > 0 && (
          <Panel title="Projects by status"><div className="px-[18px] pb-4"><DonutChart data={statusData} centerTop={p.total} centerBottom="Projects" /></div></Panel>
        )}
        {showFinance && s && Number(s.totalRevenue) + Number(s.pendingPayments) > 0 && (
          <Panel title="Collections">
            <div className="px-[18px] pb-4">
              <DonutChart data={[{ label: 'Received', value: Number(s.totalRevenue || 0), color: '#15803D' }, { label: 'Pending', value: Number(s.pendingPayments || 0), color: '#F2A900' }]} centerTop={`${Math.round((Number(s.totalRevenue) / (Number(s.totalRevenue) + Number(s.pendingPayments) || 1)) * 100)}%`} centerBottom="Collected" formatValue={money} />
            </div>
          </Panel>
        )}
        {showFinance && expenseCats.length > 0 && (
          <Panel title="Where the money went"><div className="px-[18px] pb-4"><PieChart data={expenseCats} formatValue={money} /></div></Panel>
        )}
        {activity?.recentActivities?.length > 0 && (
          <Panel title="Recent activity">
            <ul className="px-[18px] pb-3">{activity.recentActivities.map((x) => <li key={x.id} className="flex items-center justify-between gap-3 border-t border-slate-200 py-2.5 text-sm first:border-t-0 dark:border-slate-700"><span className="truncate capitalize text-slate-600 dark:text-slate-300">{x.action.replace(/[._]/g, ' ')}</span><span className="shrink-0 text-xs text-slate-400">{x.user?.name || 'System'} · {formatDate(x.createdAt)}</span></li>)}</ul>
          </Panel>
        )}
      </div>
    </div>
  );
}
