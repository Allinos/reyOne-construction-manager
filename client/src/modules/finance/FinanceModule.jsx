import { useEffect, useState } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import PaymentsPage from './PaymentsPage';
import ProjectFinancePage from './ProjectFinancePage';
import { getOverview } from './api';
import { FinanceAnalytics } from './analytics';
import { useAuth } from '../../context/AuthContext';
import { formatMoney } from '../../lib/format';
import { PageHeader } from '../../components/ui';
import { AnalyticsButton } from '../../components/AnalyticsModal';
import AnalyticsModal from '../../components/AnalyticsModal';

function OverviewBar() {
  const { bootstrap } = useAuth();
  const currency = bootstrap?.company?.currency || 'INR';
  const [o, setO] = useState(null);

  useEffect(() => {
    getOverview({}).then(setO).catch(() => {});
  }, []);

  const accountBalance = o ? o.accounts.reduce((sum, a) => sum + Number(a.balance || 0), 0) : 0;
  const items = [
    { label: 'Total Received', value: o ? formatMoney(o.totalReceived, currency) : '—', accent: 'text-green-600' },
    { label: 'Total Expenses', value: o ? formatMoney(o.totalExpenses, currency) : '—', accent: 'text-red-600' },
    { label: 'Profit', value: o ? formatMoney(o.profit, currency) : '—', accent: 'text-brand-600' },
    { label: 'Account Balance', value: o ? formatMoney(accountBalance, currency) : '—', accent: 'text-slate-800' },
  ];

  return (
    <div className="mb-5 grid grid-cols-2 gap-3 rounded-xl border border-cream-300 bg-white p-3 sm:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="px-2">
          <p className="text-xs text-slate-500">{it.label}</p>
          <p className={`text-lg font-semibold ${it.accent}`}>{it.value}</p>
        </div>
      ))}
    </div>
  );
}

const TABS = [
  { to: '/finance', label: 'Payments', end: true },
  { to: '/finance/project', label: 'Project Finance' },
];

export default function FinanceModule() {
  const [analytics, setAnalytics] = useState(false);

  return (
    <div>
      <PageHeader title="Finance" subtitle="Payments & balances" actions={<AnalyticsButton onClick={() => setAnalytics(true)} />} />
      <OverviewBar />

      <div className="mb-5 flex gap-1 border-b border-cream-300">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
                isActive ? 'border-brand-500 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </div>

      <Routes>
        <Route index element={<PaymentsPage />} />
        <Route path="project" element={<ProjectFinancePage />} />
      </Routes>

      <AnalyticsModal open={analytics} onClose={() => setAnalytics(false)} title="Financial Analytics">
        <FinanceAnalytics open={analytics} />
      </AnalyticsModal>
    </div>
  );
}
