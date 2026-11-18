import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { formatMoney } from '../../lib/format';
import { Card, Spinner, EmptyState } from '../../components/ui';
import { BarChart, HBars } from '../../components/charts';
import { getExpenseReport } from './accountsApi';
import Select from '../../components/Select';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function ReportsPage() {
  const { bootstrap } = useAuth();
  const currency = bootstrap?.company?.currency || 'INR';
  const money = (v) => formatMoney(v, currency);
  const short = (v) => (v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v ? Math.round(v) : '—');
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [scope, setScope] = useState('');
  const [data, setData] = useState(null);
  useEffect(() => { setData(null); getExpenseReport({ year, ...(scope ? { scope } : {}) }).then(setData).catch(() => setData(null)); }, [year, scope]);

  const change = data && data.previousYearTotal ? Math.round(((data.total - data.previousYearTotal) / data.previousYearTotal) * 100) : null;
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-3">
        <Select className="input w-auto" value={year} onChange={(e) => setYear(Number(e.target.value))}>{Array.from({ length: 6 }, (_, i) => thisYear - i).map((y) => <option key={y}>{y}</option>)}</Select>
        <Select className="input w-auto" value={scope} onChange={(e) => setScope(e.target.value)}><option value="">All expenses</option><option value="PROJECT">Project expenses</option><option value="COMPANY">Company expenses</option></Select>
        <button className="btn-secondary ml-auto" onClick={() => window.print()}>Print</button>
      </div>
      {!data ? <div className="flex justify-center p-10"><Spinner /></div> : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
            <div className="card px-4 py-3"><p className="text-xs text-slate-500">Total {year}</p><p className="text-lg font-semibold text-red-600">{money(data.total)}</p></div>
            <div className="card px-4 py-3"><p className="text-xs text-slate-500">{year - 1}</p><p className="text-lg font-semibold">{money(data.previousYearTotal)}</p>{change !== null && <p className={`text-xs ${change > 0 ? 'text-red-600' : 'text-green-600'}`}>{change > 0 ? '▲' : '▼'} {Math.abs(change)}% vs last year</p>}</div>
            <div className="card px-4 py-3"><p className="text-xs text-slate-500">Monthly average</p><p className="text-lg font-semibold">{money(data.total / 12)}</p></div>
          </div>
          <Card className="mb-4">
            <h3 className="mb-3 font-semibold text-slate-700 dark:text-slate-200">Monthly expenses · {year}</h3>
            <BarChart labels={MONTHS.map((m, i) => `${year}-${String(i + 1).padStart(2, '0')}`)} series={[{ name: 'Expenses', color: '#CC6E02', values: data.months }]} formatValue={money} />
          </Card>
          {data.categories.length === 0 ? <Card><EmptyState title="No expenses this year" /></Card> : (
            <Card className="mb-4 !p-0 overflow-hidden">
              <div className="border-b border-cream-200 px-4 py-3 font-semibold dark:border-slate-700">Category × Month</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-cream-100 text-slate-500 dark:bg-slate-800"><tr><th className="sticky left-0 bg-cream-100 px-3 py-2 text-left dark:bg-slate-800">Category</th>{MONTHS.map((m) => <th key={m} className="px-2 py-2 text-right">{m}</th>)}<th className="px-3 py-2 text-right">Total</th></tr></thead>
                  <tbody className="divide-y divide-cream-200 dark:divide-slate-700">
                    {data.categories.map((c) => (
                      <tr key={c.category}><td className="sticky left-0 bg-white px-3 py-2 font-medium dark:bg-slate-900">{c.category}</td>{c.months.map((v, i) => <td key={i} className={`px-2 py-2 text-right ${v ? '' : 'text-slate-300'}`}>{short(v)}</td>)}<td className="px-3 py-2 text-right font-semibold">{money(c.total)}</td></tr>
                    ))}
                    <tr className="bg-cream-50 font-semibold dark:bg-slate-800"><td className="sticky left-0 bg-cream-50 px-3 py-2 dark:bg-slate-800">Total</td>{data.months.map((v, i) => <td key={i} className="px-2 py-2 text-right">{short(v)}</td>)}<td className="px-3 py-2 text-right text-red-600">{money(data.total)}</td></tr>
                  </tbody>
                </table>
              </div>
            </Card>
          )}
          {data.projects.length > 0 && (
            <Card>
              <h3 className="mb-3 font-semibold text-slate-700 dark:text-slate-200">Project-wise expenses · {year}</h3>
              <HBars items={data.projects.slice(0, 15).map((p) => ({ label: p.projectName, value: p.total }))} formatValue={money} />
            </Card>
          )}
        </>
      )}
    </>
  );
}
