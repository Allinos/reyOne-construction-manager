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

// Compact label/value block used to show full details without tall rows.
// `wrap` shows the full value (no truncation) on its own row.
function Field({ label, value, accent, full, wrap }) {
  return (
    <div className={`min-w-0 ${full ? 'col-span-2 sm:col-span-3 lg:col-span-4' : ''}`}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={`text-xs font-medium ${wrap ? 'whitespace-pre-wrap break-words' : 'truncate'} ${accent || 'text-slate-700 dark:text-slate-200'}`}
        title={!wrap && typeof value === 'string' ? value : undefined}
      >
        {value}
      </p>
    </div>
  );
}

function ProjectRow({ p, view, currency, active, onClick }) {
  const pct = Number(p.totalAmount) > 0 ? Math.min(100, Math.round((Number(p.receivedAmount) / Number(p.totalAmount)) * 100)) : 0;
  // Typography hierarchy flips by view — no names displayed outside the card.
  const primary = view === 'client' ? p.clientName : p.name;
  const secondary = view === 'client' ? p.name : p.clientName;
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
      <p className="mt-0.5 text-base font-semibold text-slate-800 dark:text-slate-100">{primary}</p>
      <p className="text-xs text-slate-500">{secondary}</p>
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

  const sorted = useMemo(() => {
    if (!projects) return [];
    if (view === 'client') return [...projects].sort((a, b) => (a.clientName || '').localeCompare(b.clientName || ''));
    return projects;
  }, [projects, view]);

  if (error) return <Alert>{error}</Alert>;
  if (!projects) return <div className="flex justify-center p-10"><Spinner /></div>;
  if (projects.length === 0) return <EmptyState title="No projects yet" hint="Create a project to track its finances." />;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Project list — scrolls independently so the page doesn't move */}
      <div className="lg:col-span-1 lg:sticky lg:top-4 lg:self-start">
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
        <div className="scroll-thin space-y-2 overflow-y-auto pr-1" style={{ maxHeight: 'calc(100vh - 15rem)' }}>
          {sorted.map((p) => (
            <ProjectRow key={p.id} p={p} view={view} currency={currency} active={selected === p.id} onClick={() => setSelected(p.id)} />
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
                <div className="space-y-2">
                  {summary.expenses.map((x) => {
                    const balance = (Number(x.amount) || 0) - (Number(x.amountPaid) || 0);
                    return (
                      <div key={x.id} className="rounded-lg border border-cream-200 p-2.5 dark:border-slate-700">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-4">
                          <Field label="Date" value={formatDate(x.date)} />
                          <Field label="Category" value={x.category} />
                          <Field label="Amount" value={formatMoney(x.amount, currency)} accent="text-red-600" />
                          <Field label="Status" value={x.paymentStatus || '—'} />
                          <Field label="Paid" value={formatMoney(x.amountPaid, currency)} accent="text-green-700" />
                          <Field label="Balance" value={formatMoney(balance > 0 ? balance : 0, currency)} />
                          <Field label="Paid To" value={x.paidTo || '—'} />
                          <Field label="Paid By" value={x.expenseBy || '—'} />
                          <Field label="Account" value={x.account || '—'} />
                          {x.notes && <Field label="Notes" value={x.notes} full />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No expenses.</p>
              )}
            </Card>

            <Card>
              <h3 className="mb-3 font-semibold text-slate-700 dark:text-slate-200">Payment History</h3>
              {summary.payments.length ? (
                <div className="space-y-2">
                  {summary.payments.map((p) => (
                    <div key={p.id} className="rounded-lg border border-cream-200 p-2.5 dark:border-slate-700">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-4">
                        <Field label="Date" value={formatDate(p.date)} />
                        <Field label="Amount" value={formatMoney(p.amount, currency)} accent="text-green-700" />
                        <Field label="Method" value={p.method || '—'} />
                        <Field label="Account" value={p.account || '—'} />
                        {p.notes && <Field label="Notes" value={p.notes} full wrap />}
                      </div>
                    </div>
                  ))}
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
