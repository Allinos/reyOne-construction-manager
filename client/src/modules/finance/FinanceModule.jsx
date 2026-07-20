import { Routes, Route, NavLink } from 'react-router-dom';
import FinanceOverviewPage from './FinanceOverviewPage';
import PaymentsPage from './PaymentsPage';
import ExpensesPage from './ExpensesPage';
import ProjectFinancePage from './ProjectFinancePage';

const TABS = [
  { to: '/finance', label: 'Overview', end: true },
  { to: '/finance/payments', label: 'Payments' },
  { to: '/finance/expenses', label: 'Expenses' },
  { to: '/finance/project', label: 'Project Finance' },
];

function FinanceTabs() {
  return (
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
  );
}

export default function FinanceModule() {
  return (
    <div>
      <FinanceTabs />
      <Routes>
        <Route index element={<FinanceOverviewPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="project" element={<ProjectFinancePage />} />
      </Routes>
    </div>
  );
}
