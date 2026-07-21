import { useEffect, useMemo, useState } from 'react';
import { getProjectsFinance, getProjectSummary } from './api';
import { useAuth } from '../../context/AuthContext';
import { errorMessage } from '../../lib/api';
import { formatMoney, formatDate } from '../../lib/format';
import { Card, Spinner, EmptyState, Alert, StatusBadge } from '../../components/ui';

function Stat({ label, value, accent }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-xl font-semibold ${accent || 'text-slate-800 dark:text-slate-100'}`}>{value}</span>
    </Card>
  );
}

function ProjectRow({ p, currency, active, onClick }) {
  const pct = Number(p.totalAmount) > 0 ? Math.min(100, Math.round((Number(p.receivedAmount) / Number(p.totalAmount)) * 100)) : 0;
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-lg border p-3 text-left transition-colors ${
        active ? 'border-brand-400 bg-brand-50 dark:bg-slate-700' : 'border-cream-300 bg-white hover:bg-cream-100 dark:border-slate-700 dark:bg-slate-800'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-brand-700 dark:text-brand-300">{p.referenceNumber}</span>
        <StatusBadge status={p.status} />
      </div>
      <p className="mt-0.5 font-medium text-slate-800 dark:text-slate-100">{p.name}</p>
      <p className="text-xs text-slate-500">{p.clientName}</p>
      <div className="mt-2 h-1.5 rounded-full bg-cream-200 dark:bg-slate-700">
        <div className="h-1.5 rounded-full bg-green-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-xs text-slate-500">
        <span>{formatMoney(p.receivedAmount, currency)}</span>
        <span>{pct}%</span>
      </div>
    </button>
  );
}

export default function ProjectFinancePage() {
  const { bootstrap } = useAuth();
  const currency = bootstrap?.company?.currency || 'INR';
  const [projects, setProjects] = useState(null);
  const [view, setView] = useState('project'); // 'project' | 'client'
  const [selected, setSelected] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getProjectsFinance()
      .then((list) => {
        setProjects(list);
        if (list.length) setSelected(list[0].id); // auto-select first — no manual search needed
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setSummary(null);
    getProjectSummary(selected).then(setSummary).catch((err) => setError(errorMessage(err)));
  }, [selected]);

  const grouped = useMemo(() => {
    if (!projects) return [];
    if (view === 'project') return [{ key: 'all', label: null, items: projects }];
    const byClient = {};
    projects.forEach((p) => {
      (byClient[p.clientName] ||= []).push(p);
    });
    return Object.entries(byClient).map(([label, items]) => ({ key: label, label, items }));
  }, [projects, view]);

  if (error) return <Alert>{error}</Alert>;
  if (!projects) return <div className="flex justify-center p-10"><Spinner /></div>;
  if (projects.length === 0) return <EmptyState title="No projects yet" hint="Create a project to track its finances." />;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Project list */}
      <div className="lg:col-span-1">
        <div className="mb-3 flex overflow-hidden rounded-lg border border-cream-300 text-sm dark:border-slate-700">
          {['project', 'client'].map((v) => (
            <button
              key={v}
              className={`flex-1 px-3 py-1.5 ${view === v ? 'bg-brand-500 text-white' : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}
              onClick={() => setView(v)}
            >
              {v === 'project' ? 'Project-wise' : 'Client-wise'}
            </button>
          ))}
        </div>
        <div className="space-y-4">
          {grouped.map((g) => (
            <div key={g.key}>
              {g.label && <p className="mb-2 px-1 text-base font-semibold text-slate-800 dark:text-slate-100">{g.label}</p>}
              <div className="space-y-2">
                {g.items.map((p) => (
                  <ProjectRow key={p.id} p={p} currency={currency} active={selected === p.id} onClick={() => setSelected(p.id)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail */}
      <div className="lg:col-span-2">
        {!summary ? (
          <div className="flex justify-center p-10"><Spinner /></div>
        ) : (
          <div className="space-y-6">
            <div>
              <h2 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">Financial Overview</h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Stat label="Total Value" value={formatMoney(summary.totalAmount, currency)} />
                <Stat label="Received" value={formatMoney(summary.receivedAmount, currency)} accent="text-green-600" />
                <Stat label="Balance" value={formatMoney(summary.balanceAmount, currency)} accent="text-red-600" />
                <Stat label="Advance" value={formatMoney(summary.advanceAmount, currency)} />
              </div>
            </div>

            <Card>
              <h3 className="mb-3 font-semibold text-slate-700 dark:text-slate-200">
                Expense Summary
                <span className="ml-2 text-sm font-normal text-red-600">{formatMoney(summary.projectExpenses, currency)}</span>
              </h3>
              {summary.expenses?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-slate-400">
                      <tr>
                        <th className="py-2 font-medium">Date</th>
                        <th className="py-2 font-medium">Category</th>
                        <th className="py-2 font-medium">Paid To</th>
                        <th className="py-2 font-medium">Expense By</th>
                        <th className="py-2 text-right font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cream-200 dark:divide-slate-700">
                      {summary.expenses.map((x) => (
                        <tr key={x.id}>
                          <td className="py-2 text-slate-500">{formatDate(x.date)}</td>
                          <td className="py-2 text-slate-600 dark:text-slate-300">{x.category}</td>
                          <td className="py-2 text-slate-600 dark:text-slate-300">{x.paidTo || '—'}</td>
                          <td className="py-2 text-slate-600 dark:text-slate-300">{x.expenseBy || '—'}</td>
                          <td className="py-2 text-right font-medium text-red-600">{formatMoney(x.amount, currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-400">No expenses.</p>
              )}
            </Card>

            <Card>
              <h3 className="mb-3 font-semibold text-slate-700 dark:text-slate-200">Payment History</h3>
              {summary.payments.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-slate-400">
                      <tr>
                        <th className="py-2 font-medium">Date</th>
                        <th className="py-2 font-medium">Method</th>
                        <th className="py-2 font-medium">Account</th>
                        <th className="py-2 text-right font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cream-200 dark:divide-slate-700">
                      {summary.payments.map((p) => (
                        <tr key={p.id}>
                          <td className="py-2 text-slate-500">{formatDate(p.date)}</td>
                          <td className="py-2 text-slate-600 dark:text-slate-300">{p.method}</td>
                          <td className="py-2 text-slate-600 dark:text-slate-300">{p.account}</td>
                          <td className="py-2 text-right font-medium text-green-700">{formatMoney(p.amount, currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-400">No payments recorded.</p>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
