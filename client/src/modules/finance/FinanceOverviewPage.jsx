import { useEffect, useState } from 'react';
import { getOverview } from './api';
import { useAuth } from '../../context/AuthContext';
import { errorMessage } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import { PageHeader, Card, FullPageLoader, Alert } from '../../components/ui';

function StatCard({ label, value, accent }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-2xl font-semibold ${accent || 'text-slate-800'}`}>{value}</span>
    </Card>
  );
}

export default function FinanceOverviewPage() {
  const { bootstrap } = useAuth();
  const currency = bootstrap?.company?.currency || 'INR';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getOverview({}).then(setData).catch((err) => setError(errorMessage(err)));
  }, []);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <FullPageLoader />;

  return (
    <div>
      <PageHeader title="Company Finance" subtitle="Overview" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Received" value={formatMoney(data.totalReceived, currency)} accent="text-green-600" />
        <StatCard label="Total Expenses" value={formatMoney(data.totalExpenses, currency)} accent="text-red-600" />
        <StatCard label="Profit" value={formatMoney(data.profit, currency)} accent="text-brand-600" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold text-slate-700">Account Balances</h2>
          {data.accounts.length ? (
            <ul className="divide-y divide-cream-200">
              {data.accounts.map((a) => (
                <li key={a.key} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-slate-600">
                    {a.name} <span className="text-xs text-slate-400">({a.type})</span>
                  </span>
                  <span className="font-medium text-slate-800">{formatMoney(a.balance, currency)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">No accounts configured in Settings.</p>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold text-slate-700">Expenses by Category</h2>
          {data.expenseByCategory.length ? (
            <ul className="divide-y divide-cream-200">
              {data.expenseByCategory.map((c) => (
                <li key={c.category} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-slate-600">{c.category}</span>
                  <span className="font-medium text-slate-800">{formatMoney(c.amount, currency)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">No expenses recorded.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
