import { useEffect, useState } from 'react';
import { getAnalytics } from './api';
import { useAuth } from '../../context/AuthContext';
import { errorMessage } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import { Spinner, Alert, Card } from '../../components/ui';
import { BarChart, HBars } from '../../components/charts';

function useAnalytics(open) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    setData(null);
    setError('');
    getAnalytics().then(setData).catch((err) => setError(errorMessage(err)));
  }, [open]);
  return { data, error };
}

function Tile({ label, value, accent }) {
  return (
    <div className="rounded-lg border border-cream-300 bg-cream-100 px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-semibold ${accent || 'text-slate-800'}`}>{value}</p>
    </div>
  );
}

export function FinanceAnalytics({ open }) {
  const { bootstrap } = useAuth();
  const currency = bootstrap?.company?.currency || 'INR';
  const { data, error } = useAnalytics(open);
  if (error) return <Alert>{error}</Alert>;
  if (!data) return <div className="flex justify-center p-6"><Spinner /></div>;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Payment Received" value={formatMoney(data.totals.received, currency)} accent="text-green-600" />
        <Tile label="Pending Payments" value={formatMoney(data.totals.pending, currency)} accent="text-amber-600" />
        <Tile label="Total Expenses" value={formatMoney(data.totals.expenses, currency)} accent="text-red-600" />
        <Tile label="Profit" value={formatMoney(data.totals.profit, currency)} accent="text-brand-600" />
      </div>
      <Card>
        <h3 className="mb-3 font-semibold text-slate-700">Monthly Income vs Expenses</h3>
        <BarChart
          labels={data.monthly.labels}
          formatValue={(v) => formatMoney(v, currency)}
          series={[
            { name: 'Income', color: '#16a34a', values: data.monthly.revenue },
            { name: 'Expenses', color: '#ef4444', values: data.monthly.expenses },
          ]}
        />
      </Card>
    </>
  );
}

export function ExpenseAnalytics({ open }) {
  const { bootstrap } = useAuth();
  const currency = bootstrap?.company?.currency || 'INR';
  const { data, error } = useAnalytics(open);
  if (error) return <Alert>{error}</Alert>;
  if (!data) return <div className="flex justify-center p-6"><Spinner /></div>;

  return (
    <>
      <Card>
        <h3 className="mb-3 font-semibold text-slate-700">Category-wise Expenses</h3>
        <HBars items={data.byCategory.map((c) => ({ label: c.category, value: c.amount }))} formatValue={(v) => formatMoney(v, currency)} />
      </Card>
      <Card>
        <h3 className="mb-3 font-semibold text-slate-700">Monthly Expenses</h3>
        <BarChart
          labels={data.monthly.labels}
          formatValue={(v) => formatMoney(v, currency)}
          series={[{ name: 'Expenses', color: '#ef4444', values: data.monthly.expenses }]}
        />
      </Card>
    </>
  );
}
