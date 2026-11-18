import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { errorMessage } from '../../lib/api';
import { formatMoney, formatDate } from '../../lib/format';
import Modal from '../../components/Modal';
import InstallmentStatus from './InstallmentStatus';
import { getSchedule, addInstallment, planInstallments, deleteInstallment } from './accountsApi';

const iso = (d) => d.toISOString().slice(0, 10);

/**
 * Client payment schedule (installments) for a project, with received money
 * allocated oldest-due-first and an automatic outstanding / overdue status.
 */
export default function PaymentScheduleCard({ projectId, refreshKey }) {
  const { bootstrap, can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const currency = bootstrap?.company?.currency || 'INR';
  const money = (v) => formatMoney(v, currency);
  const canEdit = can('finance.update') || can('finance.create');
  const [data, setData] = useState(null);
  const [add, setAdd] = useState(null);
  const [plan, setPlan] = useState(null);

  const load = useCallback(() => getSchedule(projectId).then(setData).catch(() => setData(null)), [projectId]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const saveOne = async () => {
    if (!add.title.trim() || !(Number(add.amount) > 0) || !add.dueDate) { toast.error('Fill title, amount and due date'); return; }
    try { await addInstallment({ projectId, title: add.title.trim(), amount: Number(add.amount), dueDate: add.dueDate }); setAdd(null); load(); } catch (e) { toast.error(errorMessage(e)); }
  };
  const remaining = data ? Math.max(0, data.value - data.scheduled) : 0;
  const planPreview = () => {
    if (!plan) return [];
    const n = Math.max(1, Math.min(60, Number(plan.count) || 1));
    const total = Number(plan.total) || 0;
    const each = Math.floor((total / n) * 100) / 100;
    const start = new Date(plan.start);
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(start);
      d.setMonth(d.getMonth() + i * (Number(plan.every) || 1));
      return { title: `${plan.prefix || 'Installment'} ${i + 1}`, dueDate: iso(d), amount: i === n - 1 ? Math.round((total - each * (n - 1)) * 100) / 100 : each };
    });
  };
  const savePlan = async () => {
    const items = planPreview();
    if (!items.length || !(Number(plan.total) > 0)) { toast.error('Enter the total and count'); return; }
    try { await planInstallments({ projectId, items, replace: plan.replace }); toast.success(`${items.length} installments planned`); setPlan(null); load(); } catch (e) { toast.error(errorMessage(e)); }
  };
  const remove = async (i) => {
    if (!(await confirm({ title: 'Remove installment?', message: i.title, confirmLabel: 'Remove' }))) return;
    try { await deleteInstallment(i.id); load(); } catch (e) { toast.error(errorMessage(e)); }
  };

  if (!data) return null;
  return (
    <div className="card mb-6 !p-0 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-cream-200 px-5 py-3 dark:border-slate-700">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Payment Schedule</h2>
        {data.overdueAmount > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">{money(data.overdueAmount)} overdue</span>}
        {canEdit && (
          <div className="ml-auto flex gap-2">
            <button className="btn-secondary py-1 text-sm" onClick={() => setPlan({ total: remaining || data.value, count: 4, every: 1, start: iso(new Date()), prefix: 'Installment', replace: data.installments.length === 0 })}>Plan installments</button>
            <button className="btn-ghost py-1 text-brand-600" onClick={() => setAdd({ title: '', amount: remaining || '', dueDate: iso(new Date()) })}>+ Add</button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 px-5 py-3 text-sm sm:grid-cols-4">
        <div><p className="text-xs text-slate-500">Contract value</p><p className="font-semibold">{money(data.value)}</p></div>
        <div><p className="text-xs text-slate-500">Received</p><p className="font-semibold text-green-600">{money(data.received)}</p></div>
        <div><p className="text-xs text-slate-500">Outstanding</p><p className="font-semibold text-red-600">{money(data.outstanding)}</p></div>
        <div><p className="text-xs text-slate-500">Next due</p><p className="font-semibold">{data.nextDue ? `${money(data.nextDue.balance)} · ${formatDate(data.nextDue.dueDate)}` : '—'}</p></div>
      </div>
      {data.installments.length === 0 ? (
        <p className="px-5 pb-4 text-sm text-slate-400">No installments planned. {canEdit ? 'Use “Plan installments” to split the contract value.' : ''}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream-100 text-left text-xs text-slate-500 dark:bg-slate-800"><tr><th className="px-5 py-2">Installment</th><th className="px-3 py-2">Due</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-right">Paid</th><th className="px-3 py-2 text-right">Balance</th><th className="px-3 py-2">Status</th><th className="px-3 py-2" /></tr></thead>
            <tbody className="divide-y divide-cream-200 dark:divide-slate-700">
              {data.installments.map((i) => (
                <tr key={i.id}>
                  <td className="px-5 py-2 font-medium">{i.title}</td>
                  <td className="px-3 py-2">{formatDate(i.dueDate)}</td>
                  <td className="px-3 py-2 text-right">{money(i.amount)}</td>
                  <td className="px-3 py-2 text-right text-green-600">{money(i.paid)}</td>
                  <td className={`px-3 py-2 text-right ${i.balance > 0 ? 'font-medium' : 'text-slate-400'}`}>{money(i.balance)}</td>
                  <td className="px-3 py-2"><InstallmentStatus status={i.status} /></td>
                  <td className="px-3 py-2 text-right">{canEdit && <button className="text-xs text-red-500 hover:underline" onClick={() => remove(i)}>Remove</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {Math.abs(data.scheduled - data.value) > 0.5 && <p className="px-5 py-2 text-xs text-amber-600">Scheduled total {money(data.scheduled)} differs from contract value {money(data.value)}.</p>}
        </div>
      )}

      {add && (
        <Modal open onClose={() => setAdd(null)} title="Add Installment" footer={<><button className="btn-secondary" onClick={() => setAdd(null)}>Cancel</button><button className="btn-primary" onClick={saveOne}>Add</button></>}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">Title</label><input className="input" placeholder="e.g. On plinth completion" value={add.title} onChange={(e) => setAdd({ ...add, title: e.target.value })} /></div>
            <div><label className="label">Amount</label><input type="number" min="0" className="input" value={add.amount} onChange={(e) => setAdd({ ...add, amount: e.target.value })} /></div>
            <div><label className="label">Due date</label><input type="date" className="input" value={add.dueDate} onChange={(e) => setAdd({ ...add, dueDate: e.target.value })} /></div>
          </div>
        </Modal>
      )}
      {plan && (
        <Modal open onClose={() => setPlan(null)} title="Plan Installments" footer={<><button className="btn-secondary" onClick={() => setPlan(null)}>Cancel</button><button className="btn-primary" onClick={savePlan}>Save plan</button></>}>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Total to schedule</label><input type="number" min="0" className="input" value={plan.total} onChange={(e) => setPlan({ ...plan, total: e.target.value })} /></div>
            <div><label className="label">Number of installments</label><input type="number" min="1" max="60" className="input" value={plan.count} onChange={(e) => setPlan({ ...plan, count: e.target.value })} /></div>
            <div><label className="label">First due date</label><input type="date" className="input" value={plan.start} onChange={(e) => setPlan({ ...plan, start: e.target.value })} /></div>
            <div><label className="label">Every (months)</label><input type="number" min="1" max="12" className="input" value={plan.every} onChange={(e) => setPlan({ ...plan, every: e.target.value })} /></div>
            <div className="col-span-2"><label className="label">Name prefix</label><input className="input" value={plan.prefix} onChange={(e) => setPlan({ ...plan, prefix: e.target.value })} /></div>
            {data.installments.length > 0 && <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={plan.replace} onChange={(e) => setPlan({ ...plan, replace: e.target.checked })} /> Replace the existing schedule</label>}
          </div>
          <ul className="mt-3 max-h-40 divide-y divide-cream-200 overflow-auto rounded-lg border border-cream-200 text-xs dark:divide-slate-700 dark:border-slate-700">
            {planPreview().map((i) => <li key={i.title} className="flex justify-between px-3 py-1.5"><span>{i.title} · {formatDate(i.dueDate)}</span><span>{money(i.amount)}</span></li>)}
          </ul>
        </Modal>
      )}
    </div>
  );
}
