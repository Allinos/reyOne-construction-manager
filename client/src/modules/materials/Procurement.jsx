import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { errorMessage } from '../../lib/api';
import { formatMoney, formatDate, localDate } from '../../lib/format';
import { Spinner, EmptyState, Progress } from '../../components/ui';
import Modal from '../../components/Modal';
import Select from '../../components/Select';
import Icon from '../../components/Icon';
import { previewDocument } from '../documents/api';
import { printHtml } from '../documents/print';
import * as api from './api';

export const PO_STATUS = {
  draft: { label: 'Draft', cls: 'bg-slate-100 text-slate-700' },
  ordered: { label: 'Ordered', cls: 'bg-blue-50 text-blue-700' },
  partially_received: { label: 'Partly received', cls: 'bg-amber-50 text-amber-800' },
  received: { label: 'Received', cls: 'bg-emerald-50 text-emerald-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-50 text-red-700' },
};
const qty = (n, unit) => `${Number(n).toLocaleString(undefined, { maximumFractionDigits: 3 })}${unit ? ` ${unit}` : ''}`;

function useMoney() {
  const { bootstrap } = useAuth();
  return (v) => formatMoney(v, bootstrap?.company?.currency || 'INR');
}

// Material line editor shared by POs and direct receipts.
function Lines({ lines, setLines, materials, prices, showRate = true }) {
  const money = useMoney();
  const set = (i, patch) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <div className="space-y-2">
      {lines.map((l, i) => {
        const m = materials.find((x) => String(x.id) === String(l.materialId));
        const p = prices[l.materialId];
        return (
          <div key={i} className="grid grid-cols-12 items-start gap-2">
            <div className="col-span-12 sm:col-span-6">
              <Select className="input" value={l.materialId} placeholder="Select material…" searchable onChange={(e) => set(i, { materialId: e.target.value, rate: l.rate || (prices[e.target.value]?.last ?? '') })}>
                <option value="">Select material…</option>
                {materials.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.unit})</option>)}
              </Select>
              {p && <p className="mt-0.5 text-[11px] text-slate-400">Last {money(p.last)}{p.lastVendor ? ` from ${p.lastVendor}` : ''} · avg {money(p.avg)}</p>}
            </div>
            <input type="number" min="0" step="any" className="input col-span-4 sm:col-span-2" placeholder={`Qty${m ? ` (${m.unit})` : ''}`} value={l.quantity} onChange={(e) => set(i, { quantity: e.target.value })} />
            {showRate && <input type="number" min="0" step="0.01" className="input col-span-5 sm:col-span-3" placeholder="Rate" value={l.rate} onChange={(e) => set(i, { rate: e.target.value })} />}
            <button type="button" className="btn-ghost col-span-3 px-2 text-red-600 sm:col-span-1" onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label="Remove line" disabled={lines.length === 1}>×</button>
          </div>
        );
      })}
      <button type="button" className="text-sm font-medium text-brand-600 hover:underline" onClick={() => setLines([...lines, { materialId: '', quantity: '', rate: '' }])}>+ Add material</button>
    </div>
  );
}

function usePrices() {
  const [prices, setPrices] = useState({});
  useEffect(() => { api.getPrices().then((rows) => setPrices(Object.fromEntries(rows.map((r) => [String(r.materialId), r])))).catch(() => {}); }, []);
  return prices;
}

export function POModal({ lookups, preset, onClose, onSaved }) {
  const toast = useToast();
  const money = useMoney();
  const prices = usePrices();
  const [f, setF] = useState({
    vendorId: preset?.vendorId ? String(preset.vendorId) : '', projectId: preset?.projectId ? String(preset.projectId) : '', requestId: preset?.requestId || null,
    expectedDate: preset?.expectedDate || '', taxPercent: '18', notes: preset?.notes || '', terms: 'Delivery to site. Payment as per agreed credit terms. Material subject to quality check on receipt.',
  });
  const [lines, setLines] = useState(preset?.items?.length ? preset.items.map((i) => ({ materialId: String(i.materialId), quantity: String(i.quantity), rate: '' })) : [{ materialId: preset?.materialId ? String(preset.materialId) : '', quantity: '', rate: '' }]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    // Fill blank rates with the last purchase rate once prices load.
    setLines((ls) => ls.map((l) => (l.rate === '' && prices[l.materialId] ? { ...l, rate: String(prices[l.materialId].last) } : l)));
  }, [prices]);
  const subtotal = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.rate) || 0), 0);
  const tax = (subtotal * (Number(f.taxPercent) || 0)) / 100;
  const save = async (status) => {
    const items = lines.filter((l) => l.materialId && Number(l.quantity) > 0).map((l) => ({ materialId: Number(l.materialId), quantity: Number(l.quantity), rate: Number(l.rate) || 0 }));
    if (!f.vendorId) { toast.error('Select a vendor'); return; }
    if (!items.length) { toast.error('Add at least one material with a quantity'); return; }
    setBusy(true);
    try {
      const po = await api.createPO({ vendorId: Number(f.vendorId), projectId: f.projectId ? Number(f.projectId) : null, requestId: f.requestId, status, expectedDate: f.expectedDate || null, taxPercent: Number(f.taxPercent) || 0, notes: f.notes || null, terms: f.terms || null, items });
      toast.success(status === 'ordered' ? `${po.number} placed with vendor` : `${po.number} saved as draft`);
      onSaved(po);
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={preset?.requestId ? `Purchase order for request #${preset.requestId}` : 'New purchase order'} wide dismissOnBackdrop={false}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-secondary" disabled={busy} onClick={() => save('draft')}>Save draft</button><button className="btn-primary" disabled={busy} onClick={() => save('ordered')}>Place order</button></>}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div><label className="label">Vendor</label><Select className="input" value={f.vendorId} searchable placeholder="Select vendor…" onChange={(e) => setF({ ...f, vendorId: e.target.value })}><option value="">Select vendor…</option>{lookups.vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select></div>
        <div><label className="label">Deliver to</label><Select className="input" value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })}><option value="">Central store</option><optgroup label="Sites">{lookups.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup></Select></div>
        <div><label className="label">Expected delivery</label><input type="date" className="input" value={f.expectedDate} onChange={(e) => setF({ ...f, expectedDate: e.target.value })} /></div>
      </div>
      <p className="label mt-4">Materials</p>
      <Lines lines={lines} setLines={setLines} materials={lookups.materials} prices={prices} />
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-700">
        <div className="w-28"><label className="label">GST / tax %</label><input type="number" min="0" max="100" className="input" value={f.taxPercent} onChange={(e) => setF({ ...f, taxPercent: e.target.value })} /></div>
        <div className="text-right text-sm">
          <p className="text-slate-500">Subtotal {money(subtotal)} · Tax {money(tax)}</p>
          <p className="text-lg font-semibold">{money(subtotal + tax)}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><label className="label">Notes to vendor</label><textarea className="input" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
        <div><label className="label">Terms</label><textarea className="input" rows={2} value={f.terms} onChange={(e) => setF({ ...f, terms: e.target.value })} /></div>
      </div>
    </Modal>
  );
}

// Goods received note: against a PO (remaining quantities) or a direct purchase.
export function ReceiveModal({ po, lookups, onClose, onDone }) {
  const toast = useToast();
  const money = useMoney();
  const { bootstrap, can } = useAuth();
  const prices = usePrices();
  const fin = bootstrap?.settings?.finance || {};
  const [f, setF] = useState({ date: localDate(), billNumber: '', vendorId: '', projectId: '', taxPercent: '0', paidNow: false, method: (fin.payment_methods || ['Cash'])[0], account: (fin.accounts || [])[0]?.key || 'cash', notes: '' });
  const [lines, setLines] = useState(po
    ? po.items.map((i) => ({ materialId: String(i.materialId), name: i.name, unit: i.unit, ordered: i.quantity, received: i.receivedQty || 0, quantity: String(Math.max(0, i.quantity - (i.receivedQty || 0))), rate: String(i.rate) }))
    : [{ materialId: '', quantity: '', rate: '' }]);
  const [busy, setBusy] = useState(false);
  const total = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.rate) || 0), 0) * (1 + (Number(po ? po.taxPercent : f.taxPercent) || 0) / 100);
  const submit = async () => {
    const items = lines.filter((l) => l.materialId && Number(l.quantity) > 0).map((l) => ({ materialId: Number(l.materialId), quantity: Number(l.quantity), rate: Number(l.rate) || 0 }));
    if (!items.length) { toast.error('Enter the quantity received'); return; }
    if (!po && !f.vendorId) { toast.error('Select the vendor'); return; }
    setBusy(true);
    try {
      await api.receiveGoods({
        ...(po ? { purchaseOrderId: po.id } : { vendorId: Number(f.vendorId), projectId: f.projectId ? Number(f.projectId) : null, taxPercent: Number(f.taxPercent) || 0 }),
        date: f.date, billNumber: f.billNumber || null, items, paidNow: f.paidNow, method: f.paidNow ? f.method : undefined, account: f.account, notes: f.notes || null,
      });
      toast.success('Goods received — stock and vendor bill updated');
      onDone();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={po ? `Receive goods · ${po.number}` : 'Receive goods (direct purchase)'} wide dismissOnBackdrop={false}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy} onClick={submit}>Save receipt</button></>}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {!po && <div><label className="label">Vendor</label><Select className="input" value={f.vendorId} searchable placeholder="Select vendor…" onChange={(e) => setF({ ...f, vendorId: e.target.value })}><option value="">Select vendor…</option>{lookups.vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select></div>}
        {!po && <div><label className="label">Received at</label><Select className="input" value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })}><option value="">Central store</option><optgroup label="Sites">{lookups.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup></Select></div>}
        <div><label className="label">Received on</label><input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
        <div><label className="label">Vendor bill / challan no.</label><input className="input" value={f.billNumber} onChange={(e) => setF({ ...f, billNumber: e.target.value })} /></div>
        {!po && <div><label className="label">GST / tax %</label><input type="number" min="0" className="input" value={f.taxPercent} onChange={(e) => setF({ ...f, taxPercent: e.target.value })} /></div>}
      </div>
      <p className="label mt-4">Quantities received</p>
      {po ? (
        <table className="table-base">
          <thead><tr><th>Material</th><th className="text-right">Ordered</th><th className="text-right">Already received</th><th className="w-32 text-right">Receiving now</th><th className="w-28 text-right">Rate</th></tr></thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.materialId}>
                <td>{l.name}</td>
                <td className="text-right tabular-nums">{qty(l.ordered, l.unit)}</td>
                <td className="text-right tabular-nums text-slate-500">{qty(l.received, '')}</td>
                <td className="text-right"><input type="number" min="0" step="any" className="input py-1 text-right" value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} /></td>
                <td className="text-right tabular-nums">{money(l.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <Lines lines={lines} setLines={setLines} materials={lookups.materials} prices={prices} />
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900/40">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-brand-600" checked={f.paidNow} onChange={(e) => setF({ ...f, paidNow: e.target.checked })} disabled={!can('vendors.pay') && !can('finance.create')} />
          Paid to vendor now
        </label>
        {f.paidNow && (
          <div className="flex gap-2">
            <Select className="input w-auto py-1" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{(fin.payment_methods || ['Cash']).map((m) => <option key={m}>{m}</option>)}</Select>
            <Select className="input w-auto py-1" value={f.account} onChange={(e) => setF({ ...f, account: e.target.value })}>{(fin.accounts || []).map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}</Select>
          </div>
        )}
        <p className="text-sm">Bill value <b>{money(total)}</b>{!f.paidNow && <span className="text-slate-500"> — added to vendor dues</span>}</p>
      </div>
      <label className="label mt-3">Notes (quality, shortages, vehicle no.)</label>
      <input className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
    </Modal>
  );
}

function PODrawer({ id, lookups, onClose, onChanged }) {
  const { can, bootstrap } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const money = useMoney();
  const [po, setPo] = useState(null);
  const [receiving, setReceiving] = useState(false);
  const load = useCallback(() => api.getPO(id).then(setPo).catch((e) => toast.error(errorMessage(e))), [id, toast]);
  useEffect(() => { load(); }, [load]);
  const manage = can('materials.manage');
  const setStatus = async (status, msg) => {
    try { await api.updatePO(id, { status }); toast.success(msg); load(); onChanged(); } catch (e) { toast.error(errorMessage(e)); }
  };
  const remove = async () => {
    if (!(await confirm({ title: `Delete ${po.number}?`, message: 'The draft will be removed.', confirmLabel: 'Delete' }))) return;
    try { await api.deletePO(id); onChanged(); onClose(); } catch (e) { toast.error(errorMessage(e)); }
  };
  const print = async () => {
    try {
      const { html } = await previewDocument('purchase_order', {
        reference: po.number, date: String(po.orderDate).slice(0, 10), vendor: po.vendor?.name, vendorAddress: [po.vendor?.address, po.vendor?.gstNumber && `GSTIN: ${po.vendor.gstNumber}`].filter(Boolean).join('\n'),
        projectName: po.projectId ? po.location : '', deliverTo: po.location, taxPercent: Number(po.taxPercent),
        items: po.items.map((i) => ({ description: `${i.name} (${i.unit})`, qty: String(i.quantity), rate: String(i.rate) })),
        terms: [po.terms, po.expectedDate && `Expected delivery: ${formatDate(po.expectedDate)}`, po.notes].filter(Boolean).join('\n'),
        companyName: bootstrap?.company?.name,
      });
      printHtml(html);
    } catch (e) { toast.error(errorMessage(e)); }
  };
  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl dark:bg-slate-800">
        {!po ? <div className="flex flex-1 items-center justify-center"><Spinner /></div> : (
          <>
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <div>
                <div className="flex items-center gap-2"><h3 className="text-lg font-semibold">{po.number}</h3><span className={`badge ${PO_STATUS[po.status]?.cls}`}>{PO_STATUS[po.status]?.label}</span></div>
                <p className="text-xs text-slate-500">{po.vendorName} → {po.location} · ordered {formatDate(po.orderDate)}{po.expectedDate ? ` · expected ${formatDate(po.expectedDate)}` : ''}</p>
              </div>
              <button className="btn-ghost px-2" onClick={onClose} aria-label="Close"><Icon name="close" className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <div>
                <div className="mb-1 flex justify-between text-xs text-slate-500"><span>Received</span><span>{po.receivedPct}%</span></div>
                <Progress value={po.receivedPct} showLabel={false} />
              </div>
              <table className="table-base">
                <thead><tr><th>Material</th><th className="text-right">Ordered</th><th className="text-right">Received</th><th className="text-right">Rate</th><th className="text-right">Amount</th></tr></thead>
                <tbody>
                  {po.items.map((i) => (
                    <tr key={i.materialId}>
                      <td>{i.name}</td>
                      <td className="text-right tabular-nums">{qty(i.quantity, i.unit)}</td>
                      <td className={`text-right tabular-nums ${i.receivedQty >= i.quantity ? 'text-emerald-700' : i.receivedQty > 0 ? 'text-amber-700' : 'text-slate-400'}`}>{qty(i.receivedQty || 0, '')}</td>
                      <td className="text-right tabular-nums">{money(i.rate)}</td>
                      <td className="text-right tabular-nums">{money(i.quantity * i.rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-right text-sm">
                <p className="text-slate-500">Subtotal {money(po.subtotal)} · Tax {Number(po.taxPercent)}% {money(po.tax)}</p>
                <p className="text-lg font-semibold">{money(po.total)}</p>
              </div>
              {(po.notes || po.terms) && <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-900/40">{po.notes && <p>{po.notes}</p>}{po.terms && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{po.terms}</p>}</div>}
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Goods received</p>
                {po.receipts.length === 0 ? <p className="text-sm text-slate-400">Nothing received yet.</p> : (
                  <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
                    {po.receipts.map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                        <span><b>{r.number}</b> · {formatDate(r.date)}{r.billNumber ? ` · bill ${r.billNumber}` : ''}<span className="block text-xs text-slate-400">{r.items.map((i) => `${i.name} ${qty(i.quantity, i.unit)}`).join(', ')}</span></span>
                        <span className="shrink-0 font-semibold tabular-nums">{money(r.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-700">
              <button className="btn-secondary" onClick={print}><Icon name="print" className="h-4 w-4" /> Print PO</button>
              {manage && po.status === 'draft' && <button className="btn-primary" onClick={() => setStatus('ordered', 'Order placed')}>Place order</button>}
              {manage && ['ordered', 'partially_received'].includes(po.status) && <button className="btn-primary" onClick={() => setReceiving(true)}>Receive goods</button>}
              {manage && po.status === 'partially_received' && <button className="btn-secondary" onClick={() => setStatus('received', 'Order closed')}>Close (short supply)</button>}
              {manage && ['draft', 'ordered'].includes(po.status) && <button className="btn-ghost text-red-600 hover:bg-red-50" onClick={() => setStatus('cancelled', 'Order cancelled')}>Cancel order</button>}
              {manage && ['draft', 'cancelled'].includes(po.status) && <button className="btn-ghost ml-auto text-red-600 hover:bg-red-50" onClick={remove}><Icon name="trash" className="h-4 w-4" /></button>}
            </div>
          </>
        )}
      </aside>
      {receiving && <ReceiveModal po={po} lookups={lookups} onClose={() => setReceiving(false)} onDone={() => { setReceiving(false); load(); onChanged(); }} />}
    </div>
  );
}

export function PurchaseOrdersTab({ lookups, refreshKey, onChanged, openId, onNew }) {
  const money = useMoney();
  const { can } = useAuth();
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(openId || null);
  useEffect(() => { if (openId) setOpen(openId); }, [openId]);
  useEffect(() => {
    setRows(null);
    api.listPOs(status ? { status } : {}).then(setRows).catch(() => setRows([]));
  }, [status, refreshKey]);
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {[['', 'All'], ['draft', 'Drafts'], ['open', 'Awaiting delivery'], ['received', 'Received'], ['cancelled', 'Cancelled']].map(([k, l]) => (
          <button key={k || 'all'} onClick={() => setStatus(k)} className={`rounded-full px-3 py-1 text-xs font-medium ${status === k ? 'bg-brand-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600'}`}>{l}</button>
        ))}
        {can('materials.manage') && <button className="btn-secondary btn-sm ml-auto" onClick={onNew}><Icon name="add" className="h-3.5 w-3.5" /> New PO</button>}
      </div>
      {!rows ? <div className="flex justify-center p-10"><Spinner /></div> : rows.length === 0 ? (
        <EmptyState title="No purchase orders" hint="Raise a PO to a vendor; receive goods against it to update stock and vendor dues." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>PO</th><th>Vendor</th><th>Deliver to</th><th>Expected</th><th className="text-right">Value</th><th>Received</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60" onClick={() => setOpen(p.id)}>
                    <td><p className="font-medium text-slate-800 dark:text-slate-100">{p.number}</p><p className="text-xs text-slate-400">{formatDate(p.orderDate)} · {p.items.length} item(s)</p></td>
                    <td>{p.vendorName}</td>
                    <td className="text-slate-600 dark:text-slate-300">{p.location}</td>
                    <td className={p.expectedDate && new Date(p.expectedDate) < new Date(new Date().toDateString()) && ['ordered', 'partially_received'].includes(p.status) ? 'font-medium text-red-600' : 'text-slate-500'}>{p.expectedDate ? formatDate(p.expectedDate) : '—'}</td>
                    <td className="text-right tabular-nums">{money(p.total)}</td>
                    <td><Progress value={p.receivedPct} className="w-24" /></td>
                    <td><span className={`badge ${PO_STATUS[p.status]?.cls}`}>{PO_STATUS[p.status]?.label}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {open && <PODrawer id={open} lookups={lookups} onClose={() => setOpen(null)} onChanged={onChanged} />}
    </>
  );
}

export function ReceiptsTab({ refreshKey }) {
  const money = useMoney();
  const [rows, setRows] = useState(null);
  useEffect(() => { api.listReceipts().then(setRows).catch(() => setRows([])); }, [refreshKey]);
  if (!rows) return <div className="flex justify-center p-10"><Spinner /></div>;
  if (!rows.length) return <EmptyState title="No goods received yet" />;
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>GRN</th><th>Vendor</th><th>Received at</th><th>Materials</th><th className="text-right">Bill value</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><p className="font-medium">{r.number}</p><p className="text-xs text-slate-400">{formatDate(r.date)}{r.poNumber ? ` · ${r.poNumber}` : ' · direct'}{r.billNumber ? ` · bill ${r.billNumber}` : ''}</p></td>
                <td>{r.vendorName || '—'}</td>
                <td className="text-slate-600 dark:text-slate-300">{r.location}</td>
                <td className="max-w-xs text-xs text-slate-500">{r.items.map((i) => `${i.name} ${qty(i.quantity, i.unit)}`).join(', ')}</td>
                <td className="text-right tabular-nums">{money(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
