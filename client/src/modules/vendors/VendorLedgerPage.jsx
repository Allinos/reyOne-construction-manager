import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getStatement, addBill, payVendor, applyAdvance, deleteVendorPayment } from './api';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import Modal from '../../components/Modal';
import Select from '../../components/Select';
import { Tabs, Stat as Kpi, EmptyState } from '../../components/ui';
import { localDate } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { errorMessage } from '../../lib/api';
import { formatMoney, formatDate } from '../../lib/format';
import { FullPageLoader, Alert } from '../../components/ui';
import Attachments from '../../components/Attachments';
import StarRating from '../../components/StarRating';
import api, { unwrap } from '../../lib/api';
import Icon from '../../components/Icon';

function VendorPurchases({ vendorId }) {
  const { bootstrap } = useAuth();
  const money = (v) => formatMoney(v, bootstrap?.company?.currency || 'INR');
  const [data, setData] = useState(null);
  useEffect(() => { unwrap(api.get(`/vendors/${vendorId}/purchases`)).then(setData).catch(() => setData({ items: [], totalValue: 0 })); }, [vendorId]);
  if (!data) return null;
  if (!data.items.length) return <EmptyState title="No material purchases from this vendor yet" />;
  return (
    <div className="card overflow-hidden">
      <div className="section-head">
        <span className="section-title">Material purchase history</span>
        <span className="text-sm font-semibold text-brand-600">{money(data.totalValue)}</span>
      </div>
      <div className="max-h-80 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-cream-100 text-left text-xs text-slate-500 dark:bg-slate-800"><tr><th className="px-4 py-2">Date</th><th className="px-3 py-2">Material</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Rate</th><th className="px-3 py-2 text-right">Value</th><th className="px-3 py-2">Delivered to</th></tr></thead>
          <tbody className="divide-y divide-cream-200 dark:divide-slate-700">
            {data.items.map((i) => (
              <tr key={i.id}><td className="px-4 py-2">{formatDate(i.date)}</td><td className="px-3 py-2 font-medium">{i.materialName}</td><td className="px-3 py-2 text-right">{i.quantity} {i.unit}</td><td className="px-3 py-2 text-right">{i.rate != null ? money(i.rate) : '—'}</td><td className="px-3 py-2 text-right">{i.value != null ? money(i.value) : '—'}</td><td className="px-3 py-2 text-slate-500">{i.location}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const BILL_BADGE = {
  paid: 'bg-emerald-50 text-emerald-700',
  partial: 'bg-amber-50 text-amber-800',
  unpaid: 'bg-slate-100 text-slate-700',
  overdue: 'bg-red-50 text-red-700',
};

export function PayModal({ vendor, bills, onClose, onDone }) {
  const { bootstrap } = useAuth();
  const toast = useToast();
  const fin = bootstrap?.settings?.finance || {};
  const methods = fin.payment_methods || ['Cash'];
  const accounts = fin.accounts || [];
  const money = (v) => formatMoney(v, bootstrap?.company?.currency || 'INR');
  const open = bills.filter((b) => b.balance > 0).sort((a, b) => String(a.dueDate || '9').localeCompare(String(b.dueDate || '9')));
  const totalDue = open.reduce((s, b) => s + b.balance, 0);
  const [f, setF] = useState({ amount: totalDue ? String(Math.round(totalDue * 100) / 100) : '', date: localDate(), method: methods[0], account: accounts[0]?.key || 'cash', reference: '', notes: '', mode: open.length ? 'auto' : 'advance' });
  const [pick, setPick] = useState({});
  const [busy, setBusy] = useState(false);
  const picked = Object.entries(pick).filter(([, v]) => Number(v) > 0).map(([id, v]) => ({ expenseId: Number(id), amount: Number(v) }));
  const pickedSum = picked.reduce((s, p) => s + p.amount, 0);
  const amount = Number(f.amount) || 0;
  const submit = async () => {
    if (!(amount > 0)) { toast.error('Enter the amount paid'); return; }
    if (f.mode === 'choose' && pickedSum > amount + 0.005) { toast.error('Selected bills add up to more than the payment'); return; }
    setBusy(true);
    try {
      const r = await payVendor(vendor.id, { amount, date: f.date, method: f.method, account: f.account, reference: f.reference || null, notes: f.notes || null, ...(f.mode === 'advance' ? { asAdvance: true } : {}), ...(f.mode === 'choose' ? { allocations: picked } : {}) });
      toast.success(r.advance > 0 ? `Payment recorded — ${money(r.advance)} kept as advance` : 'Payment recorded');
      onDone();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`Pay ${vendor.name}`} wide footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy} onClick={submit}>Record payment</button></>}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="col-span-2"><label className="label">Amount</label><input type="number" min="0" step="0.01" className="input" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /><p className="mt-1 text-[11px] text-slate-400">Total outstanding {money(totalDue)}</p></div>
        <div className="col-span-2"><label className="label">Paid on</label><input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
        <div><label className="label">Method</label><Select className="input" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{methods.map((m) => <option key={m}>{m}</option>)}</Select></div>
        <div><label className="label">From account</label><Select className="input" value={f.account} onChange={(e) => setF({ ...f, account: e.target.value })}>{accounts.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}</Select></div>
        <div className="col-span-2"><label className="label">Cheque / UTR / reference</label><input className="input" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></div>
      </div>
      <label className="label mt-4">Apply this payment to</label>
      <div className="grid grid-cols-3 gap-2">
        {[['auto', 'Oldest bills first', 'Settles bills by due date'], ['choose', 'Selected bills', 'Pick bills and amounts'], ['advance', 'Advance', 'Keep as credit for future bills']].map(([k, t, d]) => (
          <button key={k} type="button" disabled={k !== 'advance' && !open.length} onClick={() => setF({ ...f, mode: k })} className={`rounded-lg border px-3 py-2 text-left disabled:opacity-40 ${f.mode === k ? 'border-brand-500 bg-brand-50 dark:bg-slate-700' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-600'}`}>
            <span className="block text-sm font-medium">{t}</span><span className="block text-[11px] text-slate-500">{d}</span>
          </button>
        ))}
      </div>
      {f.mode === 'choose' && (
        <div className="mt-3 max-h-60 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="table-base">
            <thead><tr><th>Bill</th><th>Due</th><th className="text-right">Balance</th><th className="w-36 text-right">Pay</th></tr></thead>
            <tbody>
              {open.map((b) => (
                <tr key={b.id}>
                  <td>{b.billNumber || `#${b.id}`}<span className="block text-xs text-slate-400">{formatDate(b.date)}{b.projectName ? ` · ${b.projectName}` : ''}</span></td>
                  <td className={b.status === 'overdue' ? 'text-red-600' : 'text-slate-500'}>{b.dueDate ? formatDate(b.dueDate) : '—'}</td>
                  <td className="text-right tabular-nums">{money(b.balance)}</td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" className="text-[11px] font-medium text-brand-600" onClick={() => setPick({ ...pick, [b.id]: String(b.balance) })}>Full</button>
                      <input type="number" min="0" max={b.balance} step="0.01" className="input w-24 py-1 text-right text-xs" value={pick[b.id] || ''} onChange={(e) => setPick({ ...pick, [b.id]: e.target.value })} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {f.mode === 'choose' && <p className={`mt-1 text-xs ${pickedSum > amount + 0.005 ? 'text-red-600' : 'text-slate-500'}`}>Allocated {money(pickedSum)} of {money(amount)}{amount - pickedSum > 0.005 ? ` — ${money(amount - pickedSum)} will be kept as advance` : ''}</p>}
      {f.mode === 'auto' && amount > totalDue + 0.005 && <p className="mt-2 text-xs text-blue-700">{money(amount - totalDue)} more than outstanding will be kept as advance.</p>}
      <label className="label mt-3">Notes</label><input className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
    </Modal>
  );
}

export function BillModal({ vendor, onClose, onDone }) {
  const { bootstrap } = useAuth();
  const toast = useToast();
  const fin = bootstrap?.settings?.finance || {};
  const cats = [...new Set([...(fin.project_expense_categories || []), ...(fin.company_expense_categories || [])])];
  const [projects, setProjects] = useState([]);
  const due = (d) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() + (vendor.creditDays || 0)); return localDate(x); };
  const [f, setF] = useState({ billNumber: '', date: localDate(), dueDate: vendor.creditDays ? due(localDate()) : '', amount: '', category: cats.includes('Materials') ? 'Materials' : cats[0] || 'Materials', projectId: '', notes: '' });
  useEffect(() => { api.get('/projects', { params: { limit: 100 } }).then((r) => setProjects(r.data.data)).catch(() => {}); }, []);
  const submit = async () => {
    if (!(Number(f.amount) > 0)) { toast.error('Enter the bill amount'); return; }
    try {
      await addBill(vendor.id, { billNumber: f.billNumber || null, date: f.date, dueDate: f.dueDate || null, amount: Number(f.amount), category: f.category, projectId: f.projectId ? Number(f.projectId) : null, notes: f.notes || null });
      toast.success('Bill added');
      onDone();
    } catch (e) { toast.error(errorMessage(e)); }
  };
  return (
    <Modal open onClose={onClose} title={`Add bill · ${vendor.name}`} footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={submit}>Add bill</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Vendor bill no.</label><input className="input" value={f.billNumber} onChange={(e) => setF({ ...f, billNumber: e.target.value })} /></div>
        <div><label className="label">Amount (incl. tax)</label><input type="number" min="0" step="0.01" className="input" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
        <div><label className="label">Bill date</label><input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value, dueDate: vendor.creditDays ? due(e.target.value) : f.dueDate })} /></div>
        <div><label className="label">Due date</label><input type="date" className="input" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></div>
        <div><label className="label">Category</label><Select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{cats.map((c) => <option key={c}>{c}</option>)}</Select></div>
        <div><label className="label">Project (optional)</label><Select className="input" value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })}><option value="">Company / general</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></div>
        <div className="col-span-2"><label className="label">Notes</label><input className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
      </div>
      <p className="mt-3 text-xs text-slate-500">Any advance already paid to this vendor is adjusted against the bill automatically.</p>
    </Modal>
  );
}

function VendorPOs({ vendorId }) {
  const { bootstrap } = useAuth();
  const money = (v) => formatMoney(v, bootstrap?.company?.currency || 'INR');
  const [rows, setRows] = useState(null);
  useEffect(() => { unwrap(api.get('/materials/purchase-orders', { params: { vendorId } })).then(setRows).catch(() => setRows([])); }, [vendorId]);
  if (!rows) return null;
  if (!rows.length) return <EmptyState title="No purchase orders for this vendor" />;
  return (
    <div className="card overflow-hidden">
      <table className="table-base">
        <thead><tr><th>PO</th><th>Deliver to</th><th>Date</th><th className="text-right">Value</th><th>Received</th><th>Status</th></tr></thead>
        <tbody>{rows.map((p) => <tr key={p.id}><td><Link className="font-medium text-brand-700 hover:underline" to={`/materials?po=${p.id}`}>{p.number}</Link></td><td>{p.location}</td><td>{formatDate(p.orderDate)}</td><td className="text-right tabular-nums">{money(p.total)}</td><td>{p.receivedPct}%</td><td className="capitalize">{p.status.replace('_', ' ')}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

export default function VendorLedgerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { bootstrap, can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const currency = bootstrap?.company?.currency || 'INR';
  const money = (v) => formatMoney(v, currency);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('bills');
  const [modal, setModal] = useState(null);
  const [billFilter, setBillFilter] = useState('open');

  const load = () => getStatement(id).then(setData).catch((err) => setError(errorMessage(err)));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <FullPageLoader />;
  const v = data.vendor;
  const t = data.totals;
  const canPay = can('vendors.pay');
  const bills = data.bills.filter((b) => billFilter === 'all' || (billFilter === 'open' ? b.balance > 0 : b.status === billFilter));
  const done = () => { setModal(null); load(); };
  const removePay = async (p) => {
    if (!(await confirm({ title: 'Delete payment?', message: `${money(p.amount)} on ${formatDate(p.date)}. Bills it settled will show as unpaid again.`, confirmLabel: 'Delete' }))) return;
    try { await deleteVendorPayment(p.id); toast.success('Payment deleted'); load(); } catch (e) { toast.error(errorMessage(e)); }
  };
  const useAdvance = async () => {
    try { const r = await applyAdvance(v.id); toast.success(r.applied > 0 ? `${money(r.applied)} adjusted against bills` : 'Nothing to adjust'); load(); } catch (e) { toast.error(errorMessage(e)); }
  };
  const agingCols = [['current', 'Not due'], ['d1_30', '1–30 days'], ['d31_60', '31–60'], ['d61_90', '61–90'], ['d90plus', '90+']];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <button className="btn-secondary mt-0.5 h-9 w-9 shrink-0 p-0" onClick={() => navigate('/vendors')} aria-label="Back"><Icon name="arrowLeft" className="h-4 w-4" /></button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">{v.name}</h1>
              {v.rating ? <span title={v.ratingNote || ''}><StarRating value={v.rating} size="text-base" /></span> : null}
            </div>
            <p className="text-sm text-slate-500">{[v.category, v.contactPerson, v.phone, v.gstNumber && `GST ${v.gstNumber}`, v.creditDays ? `${v.creditDays}-day credit` : 'Pay on delivery'].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
        {canPay && (
          <div className="flex flex-wrap gap-2">
            {t.advance > 0 && t.outstanding > 0 && <button className="btn-secondary" onClick={useAdvance}>Adjust advance</button>}
            <button className="btn-secondary" onClick={() => setModal('bill')}><Icon name="add" className="h-4 w-4" /> Add bill</button>
            <button className="btn-primary" onClick={() => setModal('pay')}>Pay vendor</button>
          </div>
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Total billed" value={money(t.billed)} />
        <Kpi label="Paid" value={money(t.paid)} tone="success" />
        <Kpi label="Outstanding" value={money(t.outstanding)} tone={t.outstanding > 0 ? 'warning' : 'neutral'} hint={`${t.openBills} open bill(s)`} />
        <Kpi label="Overdue" value={money(t.overdue)} tone={t.overdue > 0 ? 'danger' : 'neutral'} />
        <Kpi label="Advance" value={money(t.advance)} tone="info" hint="Paid ahead of bills" />
      </div>

      {t.outstanding > 0 && (
        <div className="card mb-4 flex flex-wrap divide-x divide-slate-100 dark:divide-slate-700">
          <p className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Ageing</p>
          {agingCols.map(([k, l]) => (
            <div key={k} className="flex-1 px-4 py-2">
              <p className="text-[11px] text-slate-500">{l}</p>
              <p className={`text-sm font-semibold tabular-nums ${data.aging[k] > 0 && k !== 'current' ? 'text-red-600' : ''}`}>{money(data.aging[k])}</p>
            </div>
          ))}
        </div>
      )}

      <Tabs
        tabs={[
          { key: 'bills', label: 'Bills', count: t.openBills },
          { key: 'payments', label: 'Payments', count: data.payments.length },
          { key: 'pos', label: 'Purchase orders' },
          { key: 'purchases', label: 'Materials supplied' },
          { key: 'docs', label: 'Documents' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'bills' && (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            {[['open', 'Unpaid'], ['overdue', 'Overdue'], ['paid', 'Paid'], ['all', 'All']].map(([k, l]) => (
              <button key={k} onClick={() => setBillFilter(k)} className={`chip ${billFilter === k ? 'chip-on' : ''}`}>{l}</button>
            ))}
          </div>
          {bills.length === 0 ? <EmptyState title="No bills here" hint={canPay ? 'Bills are created when goods are received, or with "Add bill".' : undefined} /> : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead><tr><th>Bill</th><th>For</th><th>Due</th><th className="text-right">Amount</th><th className="text-right">Paid</th><th className="text-right">Balance</th><th>Status</th></tr></thead>
                  <tbody>
                    {bills.map((b) => (
                      <tr key={b.id}>
                        <td><p className="font-medium text-slate-800 dark:text-slate-100">{b.billNumber || `Bill #${b.id}`}</p><p className="text-xs text-slate-400">{formatDate(b.date)} · {b.category}</p></td>
                        <td className="max-w-[16rem] text-slate-600 dark:text-slate-300">{b.projectId ? <Link to={`/projects/${b.projectId}`} className="hover:underline">{b.projectName}</Link> : 'Company'}{b.notes && <span className="block truncate text-xs text-slate-400" title={b.notes}>{b.notes}</span>}</td>
                        <td className={b.status === 'overdue' ? 'font-medium text-red-600' : 'text-slate-500'}>{b.dueDate ? formatDate(b.dueDate) : '—'}{b.daysOverdue > 0 && <span className="block text-[11px]">{b.daysOverdue} days late</span>}</td>
                        <td className="text-right tabular-nums">{money(b.amount)}</td>
                        <td className="text-right tabular-nums text-emerald-700">{money(b.paid)}</td>
                        <td className="text-right font-semibold tabular-nums">{b.balance > 0 ? money(b.balance) : '—'}</td>
                        <td><span className={`badge capitalize ${BILL_BADGE[b.status]}`}>{b.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'payments' && (data.payments.length === 0 ? <EmptyState title="No payments yet" /> : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Date</th><th>Method</th><th className="text-right">Amount</th><th>Applied to</th><th className="text-right">Advance</th><th /></tr></thead>
              <tbody>
                {data.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap">{formatDate(p.date)}</td>
                    <td className="text-slate-600 dark:text-slate-300">{p.method} · {p.account}{p.reference && <span className="block text-xs text-slate-400">Ref {p.reference}</span>}</td>
                    <td className="text-right font-semibold tabular-nums">{money(p.amount)}</td>
                    <td className="text-xs text-slate-500">{p.allocations.length ? p.allocations.map((a) => `${a.bill} (${money(a.amount)})`).join(', ') : '—'}</td>
                    <td className="text-right tabular-nums text-blue-700">{p.advance > 0 ? money(p.advance) : '—'}</td>
                    <td className="text-right">{canPay && <button className="btn-ghost btn-sm text-red-600 hover:bg-red-50" onClick={() => removePay(p)} title="Delete payment"><Icon name="trash" className="h-4 w-4" /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {tab === 'pos' && <VendorPOs vendorId={v.id} />}
      {tab === 'purchases' && <VendorPurchases vendorId={v.id} />}
      {tab === 'docs' && <div className="card p-4"><Attachments entityType="vendor_bill" entityId={v.id} canUpload={can('vendors.update')} label="Bills, quotations & agreements" capture /></div>}

      {modal === 'pay' && <PayModal vendor={v} bills={data.bills} onClose={() => setModal(null)} onDone={done} />}
      {modal === 'bill' && <BillModal vendor={v} onClose={() => setModal(null)} onDone={done} />}
    </div>
  );
}
