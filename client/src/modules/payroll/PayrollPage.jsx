import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { errorMessage } from '../../lib/api';
import { formatMoney, formatDate, localDate, localMonth } from '../../lib/format';
import { PageHeader, Card, Spinner, EmptyState, Alert, Pagination } from '../../components/ui';
import Modal from '../../components/Modal';
import { Tabs } from '../../components/ui';
import {
  getProfiles, saveProfile, getPayrollSummary, getLedger, listPayments, createPayment,
  deletePayment, listAdvances, createAdvance, deleteAdvance,
} from './api';
import Select from '../../components/Select';

const thisMonth = () => localMonth();
const today = () => localDate();
const monthLabel = (m) => {
  if (!m) return '';
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
};

function useCurrency() {
  const { bootstrap } = useAuth();
  const currency = bootstrap?.company?.currency || 'INR';
  return (v) => formatMoney(v, currency);
}
function usePaymentMethods() {
  const { bootstrap } = useAuth();
  return bootstrap?.settings?.finance?.payment_methods || ['Cash', 'Bank', 'UPI'];
}

function Stat({ label, value, tone = 'text-slate-800 dark:text-slate-100', sub }) {
  return (
    <div className="card px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-semibold ${tone}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}

// --- Pay salary ------------------------------------------------------------
function PayModal({ target, month, onClose, onDone }) {
  const toast = useToast();
  const money = useCurrency();
  const methods = usePaymentMethods();
  const [f, setF] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!target) return;
    setF({
      period: month,
      grossAmount: target.pending || '',
      advanceDeduction: '',
      otherDeduction: '',
      bonus: '',
      date: today(),
      method: methods[0] || 'Cash',
      notes: '',
      addToExpenses: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, month]);

  if (!target || !f) return null;
  const n = (v) => Number(v) || 0;
  const net = n(f.grossAmount) + n(f.bonus) - n(f.advanceDeduction) - n(f.otherDeduction);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const submit = async () => {
    if (!(n(f.grossAmount) > 0) && !(n(f.bonus) > 0)) { toast.error('Enter an amount'); return; }
    setSaving(true);
    try {
      await createPayment({
        personType: target.personType,
        personId: target.personId,
        period: f.period,
        grossAmount: n(f.grossAmount),
        advanceDeduction: n(f.advanceDeduction),
        otherDeduction: n(f.otherDeduction),
        bonus: n(f.bonus),
        date: f.date,
        method: f.method,
        notes: f.notes || undefined,
        addToExpenses: f.addToExpenses,
      });
      toast.success('Salary payment recorded');
      onDone();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Pay Salary · ${target.name}`}
      dismissOnBackdrop={false}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : `Pay ${money(net)}`}</button></>}
    >
      <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-cream-100 p-2 dark:bg-slate-800"><p className="text-slate-500">Earned</p><p className="font-semibold">{money(target.earned)}</p></div>
        <div className="rounded-lg bg-cream-100 p-2 dark:bg-slate-800"><p className="text-slate-500">Pending</p><p className="font-semibold text-red-600">{money(target.pending)}</p></div>
        <div className="rounded-lg bg-cream-100 p-2 dark:bg-slate-800"><p className="text-slate-500">Advance due</p><p className="font-semibold text-amber-600">{money(target.advanceOutstanding)}</p></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Salary month</label><input type="month" className="input" value={f.period} onChange={(e) => set('period', e.target.value)} /></div>
        <div><label className="label">Payment date</label><input type="date" className="input" value={f.date} onChange={(e) => set('date', e.target.value)} /></div>
        <div><label className="label">Salary amount settled</label><input type="number" min="0" className="input" value={f.grossAmount} onChange={(e) => set('grossAmount', e.target.value)} /></div>
        <div><label className="label">Bonus / incentive</label><input type="number" min="0" className="input" value={f.bonus} onChange={(e) => set('bonus', e.target.value)} /></div>
        <div>
          <label className="label">Advance recovery</label>
          <input type="number" min="0" max={target.advanceOutstanding} className="input" value={f.advanceDeduction} onChange={(e) => set('advanceDeduction', e.target.value)} />
          {target.advanceOutstanding > 0 && (
            <button type="button" className="mt-1 text-xs text-brand-600 hover:underline" onClick={() => set('advanceDeduction', Math.min(target.advanceOutstanding, n(f.grossAmount)))}>Recover max</button>
          )}
        </div>
        <div><label className="label">Other deductions</label><input type="number" min="0" className="input" value={f.otherDeduction} onChange={(e) => set('otherDeduction', e.target.value)} /></div>
        <div>
          <label className="label">Method</label>
          <Select className="input" value={f.method} onChange={(e) => set('method', e.target.value)}>{methods.map((m) => <option key={m}>{m}</option>)}</Select>
        </div>
        <div className="flex items-end"><label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><input type="checkbox" checked={f.addToExpenses} onChange={(e) => set('addToExpenses', e.target.checked)} /> Record in company expenses</label></div>
        <div className="col-span-2"><label className="label">Notes</label><input className="input" value={f.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      </div>
      <div className="mt-4 flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 dark:border-slate-600 dark:bg-slate-800">
        <span className="text-sm text-slate-600 dark:text-slate-300">Net cash paid</span>
        <span className={`text-lg font-bold ${net < 0 ? 'text-red-600' : 'text-brand-600'}`}>{money(net)}</span>
      </div>
    </Modal>
  );
}

// --- Give advance ----------------------------------------------------------
function AdvanceModal({ target, onClose, onDone }) {
  const toast = useToast();
  const methods = usePaymentMethods();
  const [f, setF] = useState({ amount: '', date: today(), method: '', notes: '', addToExpenses: true });
  const [saving, setSaving] = useState(false);
  if (!target) return null;
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const submit = async () => {
    if (!(Number(f.amount) > 0)) { toast.error('Enter an amount'); return; }
    setSaving(true);
    try {
      await createAdvance({ personType: target.personType, personId: target.personId, amount: Number(f.amount), date: f.date, method: f.method || methods[0], notes: f.notes || undefined, addToExpenses: f.addToExpenses });
      toast.success('Advance recorded');
      onDone();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={`Salary Advance · ${target.name}`} dismissOnBackdrop={false}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={submit} disabled={saving}>Save Advance</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Amount</label><input type="number" min="0" className="input" autoFocus value={f.amount} onChange={(e) => set('amount', e.target.value)} /></div>
        <div><label className="label">Date</label><input type="date" className="input" value={f.date} onChange={(e) => set('date', e.target.value)} /></div>
        <div><label className="label">Method</label><Select className="input" value={f.method} onChange={(e) => set('method', e.target.value)}>{methods.map((m) => <option key={m}>{m}</option>)}</Select></div>
        <div className="flex items-end"><label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><input type="checkbox" checked={f.addToExpenses} onChange={(e) => set('addToExpenses', e.target.checked)} /> Record in company expenses</label></div>
        <div className="col-span-2"><label className="label">Notes</label><input className="input" value={f.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      </div>
      <p className="mt-3 text-xs text-slate-400">Advances are recovered from future salary payments using “Advance recovery”.</p>
    </Modal>
  );
}

// --- Employee ledger -------------------------------------------------------
function LedgerModal({ target, onClose }) {
  const money = useCurrency();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!target) return;
    setData(null);
    getLedger({ personType: target.personType, personId: target.personId }).then(setData).catch((e) => setError(errorMessage(e)));
  }, [target]);
  if (!target) return null;
  return (
    <Modal open onClose={onClose} title={`Salary History · ${target.name}`} wide fullscreenable>
      {error && <Alert>{error}</Alert>}
      {!data ? <div className="flex justify-center p-6"><Spinner /></div> : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Stat label="Salary" value={data.profile ? `${money(data.profile.rate)}${data.profile.payType === 'daily' ? '/day' : '/mo'}` : '—'} />
            <Stat label="Total earned" value={money(data.totals.earned)} />
            <Stat label="Net paid (all time)" value={money(data.totals.netPaidAllTime)} tone="text-green-600" />
            <Stat label="Pending" value={money(data.totals.pending)} tone="text-red-600" />
            <Stat label="Advance due" value={money(data.totals.advanceOutstanding)} tone="text-amber-600" sub={`Given ${money(data.totals.advanceGiven)} · Recovered ${money(data.totals.advanceRecovered)}`} />
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Month by month</h4>
            <div className="max-h-56 overflow-auto rounded-lg border border-cream-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-cream-100 text-left text-xs text-slate-500 dark:bg-slate-800"><tr><th className="px-3 py-2">Month</th><th className="px-3 py-2 text-right">Days</th><th className="px-3 py-2 text-right">Earned</th><th className="px-3 py-2 text-right">Settled</th><th className="px-3 py-2 text-right">Pending</th></tr></thead>
                <tbody className="divide-y divide-cream-200 dark:divide-slate-700">
                  {data.months.map((m) => (
                    <tr key={m.month}><td className="px-3 py-1.5">{monthLabel(m.month)}</td><td className="px-3 py-1.5 text-right">{data.profile?.payType === 'daily' ? m.days : '—'}</td><td className="px-3 py-1.5 text-right">{money(m.earned)}</td><td className="px-3 py-1.5 text-right">{money(m.settled)}</td><td className={`px-3 py-1.5 text-right ${m.pending ? 'font-medium text-red-600' : 'text-slate-400'}`}>{money(m.pending)}</td></tr>
                  ))}
                  {!data.months.length && <tr><td colSpan={5} className="px-3 py-3 text-center text-slate-400">No salary configured</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Payments</h4>
              <ul className="max-h-56 divide-y divide-cream-200 overflow-auto rounded-lg border border-cream-200 text-sm dark:divide-slate-700 dark:border-slate-700">
                {data.payments.map((p) => (
                  <li key={p.id} className="px-3 py-2">
                    <div className="flex justify-between"><span>{formatDate(p.date)} · {monthLabel(p.period)}</span><span className="font-medium text-green-600">{money(p.netPaid)}</span></div>
                    <p className="text-xs text-slate-400">Settled {money(p.grossAmount)}{Number(p.advanceDeduction) ? ` · Adv −${money(p.advanceDeduction)}` : ''}{Number(p.otherDeduction) ? ` · Ded −${money(p.otherDeduction)}` : ''}{Number(p.bonus) ? ` · Bonus +${money(p.bonus)}` : ''}{p.method ? ` · ${p.method}` : ''}</p>
                  </li>
                ))}
                {!data.payments.length && <li className="px-3 py-3 text-center text-slate-400">No payments</li>}
              </ul>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Advances</h4>
              <ul className="max-h-56 divide-y divide-cream-200 overflow-auto rounded-lg border border-cream-200 text-sm dark:divide-slate-700 dark:border-slate-700">
                {data.advances.map((a) => (
                  <li key={a.id} className="flex justify-between px-3 py-2"><span>{formatDate(a.date)}{a.notes ? ` · ${a.notes}` : ''}</span><span className="font-medium text-amber-600">{money(a.amount)}</span></li>
                ))}
                {!data.advances.length && <li className="px-3 py-3 text-center text-slate-400">No advances</li>}
              </ul>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

// --- Tabs ------------------------------------------------------------------
function MonthlyPayroll() {
  const { can } = useAuth();
  const money = useCurrency();
  const canManage = can('payroll.manage');
  const [month, setMonth] = useState(thisMonth());
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [pay, setPay] = useState(null);
  const [adv, setAdv] = useState(null);
  const [ledger, setLedger] = useState(null);

  const load = useCallback(() => {
    setError('');
    getPayrollSummary({ month, ...(type ? { type } : {}) }).then(setData).catch((e) => setError(errorMessage(e)));
  }, [month, type]);
  useEffect(() => { setData(null); load(); }, [load]);

  const rows = useMemo(() => (data?.rows || []).filter((r) => !search || r.name.toLowerCase().includes(search.toLowerCase())), [data, search]);

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-3">
        <input type="month" className="input w-auto" value={month} onChange={(e) => setMonth(e.target.value)} />
        <Select className="input w-auto" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Everyone</option><option value="USER">Employees</option><option value="WORKFORCE">Workforce / Labour</option>
        </Select>
        <input className="input min-w-[160px] flex-1" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {error && <Alert>{error}</Alert>}
      {data && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label={`Earned · ${monthLabel(month)}`} value={money(data.totals.earned)} />
          <Stat label="Paid this month" value={money(data.totals.settled)} tone="text-green-600" />
          <Stat label="Pending this month" value={money(data.totals.pending)} tone="text-red-600" />
          <Stat label="Total pending (all months)" value={money(data.totals.totalPending)} tone="text-red-700" />
          <Stat label="Advances outstanding" value={money(data.totals.advanceOutstanding)} tone="text-amber-600" />
        </div>
      )}
      <Card className="!p-0 overflow-hidden">
        {!data ? <div className="flex justify-center p-10"><Spinner /></div> : rows.length === 0 ? (
          <div className="p-6"><EmptyState title="No salaries configured" hint="Set up salaries in the Salary Setup tab." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream-100 text-left text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-3 py-3 font-medium">Salary</th>
                  <th className="px-3 py-3 text-right font-medium">Days</th>
                  <th className="px-3 py-3 text-right font-medium">Earned</th>
                  <th className="px-3 py-3 text-right font-medium">Paid</th>
                  <th className="px-3 py-3 text-right font-medium">Pending</th>
                  <th className="px-3 py-3 text-right font-medium">Total Due</th>
                  <th className="px-3 py-3 text-right font-medium">Advance</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200 dark:divide-slate-700">
                {rows.map((r) => (
                  <tr key={r.key} className="hover:bg-cream-50 dark:hover:bg-slate-800/60">
                    <td className="px-4 py-2.5">
                      <button className="text-left font-medium text-slate-800 hover:text-brand-600 dark:text-slate-100" onClick={() => setLedger(r)}>{r.name}</button>
                      <p className="text-xs text-slate-400">{r.group}{r.detail ? ` · ${r.detail}` : ''}</p>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{r.payType ? `${money(r.rate)}${r.payType === 'daily' ? '/day' : '/mo'}` : '—'}</td>
                    <td className="px-3 py-2.5 text-right">{r.payType === 'daily' ? r.days : '—'}</td>
                    <td className="px-3 py-2.5 text-right">{money(r.earned)}</td>
                    <td className="px-3 py-2.5 text-right text-green-600">{money(r.settled)}</td>
                    <td className={`px-3 py-2.5 text-right ${r.pending ? 'font-semibold text-red-600' : 'text-slate-400'}`}>{money(r.pending)}</td>
                    <td className={`px-3 py-2.5 text-right ${r.totalPending ? 'text-red-700' : 'text-slate-400'}`}>{money(r.totalPending)}</td>
                    <td className={`px-3 py-2.5 text-right ${r.advanceOutstanding ? 'text-amber-600' : 'text-slate-400'}`}>{money(r.advanceOutstanding)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        {canManage && <button className="pill bg-brand-500 text-brand-900 hover:bg-brand-400" onClick={() => setPay(r)}>Pay</button>}
                        {canManage && <button className="pill bg-amber-50 text-amber-700 hover:bg-amber-100" onClick={() => setAdv(r)}>Advance</button>}
                        <button className="pill bg-cream-200 text-slate-600 hover:bg-cream-300" onClick={() => setLedger(r)}>History</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {pay && <PayModal target={pay} month={month} onClose={() => setPay(null)} onDone={load} />}
      {adv && <AdvanceModal target={adv} onClose={() => setAdv(null)} onDone={load} />}
      {ledger && <LedgerModal target={ledger} onClose={() => setLedger(null)} />}
    </>
  );
}

function SalarySetup() {
  const { can } = useAuth();
  const toast = useToast();
  const money = useCurrency();
  const canManage = can('payroll.manage');
  const [rows, setRows] = useState(null);
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [edit, setEdit] = useState(null);
  const load = useCallback(() => getProfiles(type ? { type } : {}).then(setRows).catch((e) => toast.error(errorMessage(e))), [type, toast]);
  useEffect(() => { setRows(null); load(); }, [load]);

  const save = async () => {
    try {
      await saveProfile({
        personType: edit.personType, personId: edit.personId, payType: edit.payType,
        rate: Number(edit.rate) || 0, effectiveFrom: edit.effectiveFrom || null, notes: edit.notes || null, active: edit.active,
      });
      toast.success('Salary saved');
      setEdit(null);
      load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const list = (rows || []).filter((r) => !search || r.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-3">
        <Select className="input w-auto" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Everyone</option><option value="USER">Employees</option><option value="WORKFORCE">Workforce / Labour</option>
        </Select>
        <input className="input min-w-[160px] flex-1" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <Card className="!p-0 overflow-hidden">
        {!rows ? <div className="flex justify-center p-10"><Spinner /></div> : (
          <ul className="divide-y divide-cream-200 dark:divide-slate-700">
            {list.map((r) => (
              <li key={r.key} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <div className="min-w-[10rem] flex-1">
                  <p className="font-medium text-slate-800 dark:text-slate-100">{r.name}</p>
                  <p className="text-xs text-slate-400">{r.group}{r.detail ? ` · ${r.detail}` : ''}</p>
                </div>
                <div className="text-sm">
                  {r.profile ? (
                    <span className={r.profile.active ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 line-through'}>
                      {money(r.profile.rate)}<span className="text-xs text-slate-400">{r.profile.payType === 'daily' ? ' / day' : ' / month'}</span>
                    </span>
                  ) : <span className="text-xs text-slate-400">Not set</span>}
                </div>
                {canManage && (
                  <button className="pill bg-cream-200 text-slate-600 hover:bg-cream-300" onClick={() => setEdit({
                    ...r, payType: r.profile?.payType || (r.personType === 'WORKFORCE' ? 'daily' : 'monthly'), rate: r.profile ? Number(r.profile.rate) : '',
                    effectiveFrom: r.profile?.effectiveFrom ? r.profile.effectiveFrom.slice(0, 10) : '', notes: r.profile?.notes || '', active: r.profile?.active ?? true,
                  })}>{r.profile ? 'Edit' : 'Set salary'}</button>
                )}
              </li>
            ))}
            {!list.length && <li className="p-6"><EmptyState title="No people" /></li>}
          </ul>
        )}
      </Card>
      {edit && (
        <Modal open onClose={() => setEdit(null)} title={`Salary · ${edit.name}`}
          footer={<><button className="btn-secondary" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" onClick={save}>Save</button></>}>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Pay type</label><Select className="input" value={edit.payType} onChange={(e) => setEdit({ ...edit, payType: e.target.value })}><option value="monthly">Monthly salary</option><option value="daily">Daily wage</option></Select></div>
            <div><label className="label">{edit.payType === 'daily' ? 'Wage per day' : 'Monthly salary'}</label><input type="number" min="0" className="input" value={edit.rate} onChange={(e) => setEdit({ ...edit, rate: e.target.value })} /></div>
            <div><label className="label">Effective from</label><input type="date" className="input" value={edit.effectiveFrom} onChange={(e) => setEdit({ ...edit, effectiveFrom: e.target.value })} /></div>
            <div className="flex items-end"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Active</label></div>
            <div className="col-span-2"><label className="label">Notes</label><input className="input" value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></div>
          </div>
          <p className="mt-3 text-xs text-slate-400">Daily wages are calculated from attendance (half day = 0.5). Pending dues are tracked from the effective date.</p>
        </Modal>
      )}
    </>
  );
}

function PaymentsTab() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const money = useCurrency();
  const [period, setPeriod] = useState('');
  const [page, setPage] = useState(1);
  const [res, setRes] = useState(null);
  const load = useCallback(() => listPayments({ page, ...(period ? { period } : {}) }).then(setRes).catch((e) => toast.error(errorMessage(e))), [page, period, toast]);
  useEffect(() => { load(); }, [load]);
  const remove = async (p) => {
    if (!(await confirm({ title: 'Delete payment?', message: `Remove ${money(p.netPaid)} paid to ${p.personName}. The linked expense is removed too.`, confirmLabel: 'Delete' }))) return;
    try { await deletePayment(p.id); toast.success('Deleted'); load(); } catch (e) { toast.error(errorMessage(e)); }
  };
  return (
    <>
      <div className="mb-4 flex gap-3">
        <input type="month" className="input w-auto" value={period} onChange={(e) => { setPeriod(e.target.value); setPage(1); }} />
        {period && <button className="btn-secondary" onClick={() => setPeriod('')}>Reset</button>}
      </div>
      <Card className="!p-0 overflow-hidden">
        {!res ? <div className="flex justify-center p-10"><Spinner /></div> : res.items.length === 0 ? <div className="p-6"><EmptyState title="No salary payments" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream-100 text-left text-slate-500 dark:bg-slate-800"><tr><th className="px-4 py-3">Date</th><th className="px-3 py-3">Name</th><th className="px-3 py-3">Month</th><th className="px-3 py-3 text-right">Settled</th><th className="px-3 py-3 text-right">Deductions</th><th className="px-3 py-3 text-right">Net Paid</th><th className="px-3 py-3">Method</th><th className="px-4 py-3" /></tr></thead>
              <tbody className="divide-y divide-cream-200 dark:divide-slate-700">
                {res.items.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2.5">{formatDate(p.date)}</td>
                    <td className="px-3 py-2.5 font-medium">{p.personName}</td>
                    <td className="px-3 py-2.5">{monthLabel(p.period)}</td>
                    <td className="px-3 py-2.5 text-right">{money(p.grossAmount)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-500">{money(Number(p.advanceDeduction) + Number(p.otherDeduction))}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-green-600">{money(p.netPaid)}</td>
                    <td className="px-3 py-2.5 text-slate-500">{p.method || '—'}</td>
                    <td className="px-4 py-2.5 text-right">{can('payroll.manage') && <button className="text-xs text-red-500 hover:underline" onClick={() => remove(p)}>Delete</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Pagination meta={res?.meta} onPage={setPage} />
    </>
  );
}

function AdvancesTab() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const money = useCurrency();
  const [rows, setRows] = useState(null);
  const load = useCallback(() => listAdvances({}).then(setRows).catch((e) => toast.error(errorMessage(e))), [toast]);
  useEffect(() => { load(); }, [load]);
  const remove = async (a) => {
    if (!(await confirm({ title: 'Delete advance?', message: `Remove ${money(a.amount)} advance to ${a.personName}.`, confirmLabel: 'Delete' }))) return;
    try { await deleteAdvance(a.id); toast.success('Deleted'); load(); } catch (e) { toast.error(errorMessage(e)); }
  };
  return (
    <Card className="!p-0 overflow-hidden">
      {!rows ? <div className="flex justify-center p-10"><Spinner /></div> : rows.length === 0 ? <div className="p-6"><EmptyState title="No advances given" /></div> : (
        <ul className="divide-y divide-cream-200 dark:divide-slate-700">
          {rows.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <div className="flex-1"><p className="font-medium">{a.personName}</p><p className="text-xs text-slate-400">{formatDate(a.date)}{a.method ? ` · ${a.method}` : ''}{a.notes ? ` · ${a.notes}` : ''}</p></div>
              <span className="font-semibold text-amber-600">{money(a.amount)}</span>
              {can('payroll.manage') && <button className="text-xs text-red-500 hover:underline" onClick={() => remove(a)}>Delete</button>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function PayrollPage() {
  const [tab, setTab] = useState('monthly');
  return (
    <div>
      <PageHeader title="Salary & Payroll" subtitle="Salaries, payments, advances and pending dues" />
      <Tabs
        tabs={[{ key: 'monthly', label: 'Monthly Payroll' }, { key: 'setup', label: 'Salary Setup' }, { key: 'payments', label: 'Payments' }, { key: 'advances', label: 'Advances' }]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'monthly' && <MonthlyPayroll />}
      {tab === 'setup' && <SalarySetup />}
      {tab === 'payments' && <PaymentsTab />}
      {tab === 'advances' && <AdvancesTab />}
    </div>
  );
}
