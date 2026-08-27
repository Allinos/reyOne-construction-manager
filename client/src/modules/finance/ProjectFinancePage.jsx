import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProjectsFinance, getProjectSummary } from './api';
import { vendorOptions } from '../vendors/api';
import { workforceOptions } from '../workforce/api';
import ExpenseFormModal from './ExpenseFormModal';
import PaymentFormModal from './PaymentFormModal';
import { useAuth } from '../../context/AuthContext';
import { errorMessage } from '../../lib/api';
import { formatMoney, formatDate } from '../../lib/format';
import { Card, Spinner, EmptyState, Alert, StatusBadge } from '../../components/ui';
import Icon from '../../components/Icon';

// Truncated note that reveals the full text on hover (native tooltip) and on
// click (a small popup that auto-dismisses after ~2.5s).
function NoteCell({ text }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => setOpen(false), 2500);
    return () => clearTimeout(t);
  }, [open]);
  if (!text) return <span className="text-slate-400">—</span>;
  return (
    <div className="relative">
      <button
        type="button"
        className="block max-w-[160px] truncate text-left text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        title={text}
        onClick={() => setOpen((o) => !o)}
      >
        {text}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-56 max-w-[70vw] rounded-lg border border-cream-300 bg-white p-2 text-xs text-slate-600 shadow-lg dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
          {text}
        </div>
      )}
    </div>
  );
}

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
  const { bootstrap, can } = useAuth();
  const navigate = useNavigate();
  const currency = bootstrap?.company?.currency || 'INR';
  const [projects, setProjects] = useState(null);
  const [view, setView] = useState('project'); // 'project' | 'client'
  const [selected, setSelected] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [vendorMap, setVendorMap] = useState({});
  const [workforceMap, setWorkforceMap] = useState({});
  const [expandExp, setExpandExp] = useState(false);
  const [expandPay, setExpandPay] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  // Refresh the selected project's summary and the left-hand totals after a
  // new expense/payment is recorded.
  const reload = () => {
    if (selected) getProjectSummary(selected).then(setSummary).catch(() => {});
    getProjectsFinance().then(setProjects).catch(() => {});
  };

  useEffect(() => {
    getProjectsFinance()
      .then((list) => {
        setProjects(list);
        if (list.length) setSelected(list[0].id); // auto-select first — no manual search needed
      })
      .catch((err) => setError(errorMessage(err)));
    vendorOptions().then((list) => setVendorMap(Object.fromEntries(list.map((v) => [v.id, v.name])))).catch(() => {});
    workforceOptions().then((list) => setWorkforceMap(Object.fromEntries(list.map((w) => [w.id, w])))).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) return;
    setSummary(null);
    setExpandExp(false);
    setExpandPay(false);
    getProjectSummary(selected).then(setSummary).catch((err) => setError(errorMessage(err)));
  }, [selected]);

  // Resolve an expense's payee: vendor → workforce → manual "Paid To".
  const payeeOf = (x) => {
    if (x.vendorId && vendorMap[x.vendorId]) return vendorMap[x.vendorId];
    if (x.workforceId && workforceMap[x.workforceId]) return workforceMap[x.workforceId].name;
    return x.paidTo || '—';
  };

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
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-700 dark:text-slate-200">
                  Expense Summary
                  <span className="ml-2 text-sm font-normal text-red-600">{formatMoney(summary.projectExpenses, currency)}</span>
                </h3>
                <div className="flex items-center gap-2">
                  {can('finance.create') && (
                    <button className="btn-secondary px-2 py-1.5" title="Add expense" onClick={() => setExpenseOpen(true)}>
                      <Icon name="add" className="h-4 w-4" />
                    </button>
                  )}
                  <button className="btn-secondary whitespace-nowrap py-1.5 text-xs" onClick={() => navigate(`/expenses?projectId=${selected}`)}>
                    <Icon name="expenses" className="mr-1 inline h-4 w-4 align-middle" />See all Expenses
                  </button>
                </div>
              </div>
              {summary.expenses?.length ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs text-slate-400">
                        <tr>
                          <th className="py-1.5 font-medium">Category</th>
                          <th className="py-1.5 font-medium">Date</th>
                          <th className="py-1.5 font-medium">Amount</th>
                          <th className="py-1.5 font-medium">Vendor / Paid To</th>
                          <th className="py-1.5 font-medium">Note</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-cream-200 dark:divide-slate-700">
                        {(expandExp ? summary.expenses : summary.expenses.slice(0, 5)).map((x) => (
                          <tr key={x.id}>
                            <td className="py-1.5 pr-3 text-slate-700 dark:text-slate-200">{x.category}</td>
                            <td className="py-1.5 pr-3 text-slate-500">{formatDate(x.date)}</td>
                            <td className="py-1.5 pr-3 font-medium text-red-600">{formatMoney(x.amount, currency)}</td>
                            <td className="py-1.5 pr-3 text-slate-600 dark:text-slate-300">
                              <span className="block max-w-[150px] truncate" title={payeeOf(x)}>{payeeOf(x)}</span>
                            </td>
                            <td className="py-1.5"><NoteCell text={x.notes} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {summary.expenses.length > 5 && (
                    <button className="mt-2 text-xs font-medium text-brand-600 hover:underline" onClick={() => setExpandExp((v) => !v)}>
                      {expandExp ? 'Show less' : `See More (${summary.expenses.length - 5} more)`}
                    </button>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-400">No expenses.</p>
              )}
            </Card>

            <Card>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-700 dark:text-slate-200">Payment History</h3>
                <div className="flex items-center gap-2">
                  {can('finance.create') && (
                    <button className="btn-secondary px-2 py-1.5" title="Record payment" onClick={() => setPaymentOpen(true)}>
                      <Icon name="add" className="h-4 w-4" />
                    </button>
                  )}
                  <button className="btn-secondary whitespace-nowrap py-1.5 text-xs" onClick={() => navigate(`/finance?projectId=${selected}`)}>
                    <Icon name="finance" className="mr-1 inline h-4 w-4 align-middle" />See all Payments
                  </button>
                </div>
              </div>
              {summary.payments.length ? (
                <>
                  <div className="space-y-2">
                    {(expandPay ? summary.payments : summary.payments.slice(0, 5)).map((p) => (
                      <div key={p.id} className="rounded-lg border border-cream-200 p-2.5 dark:border-slate-700">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-5">
                          <Field label="Date" value={formatDate(p.date)} />
                          <Field label="Amount" value={formatMoney(p.amount, currency)} accent="text-green-700" />
                          <Field label="Method" value={p.method || '—'} />
                          <Field label="Account" value={p.account || '—'} />
                          <Field label="Notes" value={p.notes || '—'} />
                        </div>
                      </div>
                    ))}
                  </div>
                  {summary.payments.length > 5 && (
                    <button className="mt-2 text-xs font-medium text-brand-600 hover:underline" onClick={() => setExpandPay((v) => !v)}>
                      {expandPay ? 'Show less' : `See More (${summary.payments.length - 5} more)`}
                    </button>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-400">No payments recorded.</p>
              )}
            </Card>
          </div>
        )}
      </div>

      {expenseOpen && (
        <ExpenseFormModal
          open
          scope="PROJECT"
          editing={null}
          presetProjectId={selected}
          onClose={() => setExpenseOpen(false)}
          onSaved={reload}
        />
      )}
      {paymentOpen && (
        <PaymentFormModal
          open
          projectId={selected}
          projectLabel={(() => {
            const p = (projects || []).find((pr) => pr.id === selected);
            return p ? `${p.name}${p.clientName ? ` · ${p.clientName}` : ''}` : '';
          })()}
          onClose={() => setPaymentOpen(false)}
          onSaved={reload}
        />
      )}
    </div>
  );
}
