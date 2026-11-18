import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { errorMessage } from '../../lib/api';
import { formatMoney, formatDate, localDate, localMonth } from '../../lib/format';
import { PageHeader, Card, Spinner, EmptyState, Pagination, Stat } from '../../components/ui';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import { Tabs } from '../../components/ui';
import * as api from './api';
import Select from '../../components/Select';

const today = () => localDate();
const qty = (n, unit) => `${Number(n).toLocaleString(undefined, { maximumFractionDigits: 3 })} ${unit || ''}`;
const REQ_STATUS = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  approved: 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  partially_fulfilled: 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  fulfilled: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};
const REQ_LABEL = { pending: 'Awaiting approval', approved: 'Approved', partially_fulfilled: 'Partly sent', fulfilled: 'Delivered', rejected: 'Rejected' };
const TYPE_LABEL = { PURCHASE: 'Purchase', TRANSFER_IN: 'Transfer in', TRANSFER_OUT: 'Transfer out', CONSUME: 'Consumed', ADJUST: 'Adjustment', RETURN: 'Return' };

function useLookups() {
  const [projects, setProjects] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [materials, setMaterials] = useState([]);
  const reloadMaterials = useCallback(() => api.listItems().then(setMaterials).catch(() => {}), []);
  useEffect(() => {
    api.listProjectsLite().then(setProjects);
    api.listVendorsLite().then(setVendors);
    reloadMaterials();
  }, [reloadMaterials]);
  return { projects, vendors, materials, reloadMaterials };
}

function LocationSelect({ value, onChange, projects, includeStore = true, label }) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <Select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        {includeStore && <option value="">Central Store</option>}
        {!includeStore && <option value="">— Select site —</option>}
        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </Select>
    </div>
  );
}

// One modal for purchase / transfer / consume / adjust.
function StockOpModal({ op, lookups, onClose, onDone }) {
  const toast = useToast();
  const { bootstrap } = useAuth();
  const methods = bootstrap?.settings?.finance?.payment_methods || ['Cash'];
  const { projects, vendors, materials } = lookups;
  const [f, setF] = useState({
    materialId: op.materialId || '', quantity: '', rate: '', vendorId: '', projectId: op.projectId || '',
    fromProjectId: op.projectId || '', toProjectId: '', date: today(), notes: '', method: methods[0],
    paymentStatus: 'PAID', addToExpenses: true, direction: 'add',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const mat = materials.find((m) => String(m.id) === String(f.materialId));
  const titles = { purchase: 'Purchase / receive material', transfer: 'Transfer material', consume: 'Record site usage', adjust: 'Stock adjustment' };

  const submit = async () => {
    const q = Number(f.quantity);
    if (!f.materialId || !(q > 0)) { toast.error('Select a material and quantity'); return; }
    const opt = (v) => (v ? Number(v) : null);
    setSaving(true);
    try {
      if (op.kind === 'purchase') await api.purchase({ materialId: Number(f.materialId), quantity: q, rate: f.rate ? Number(f.rate) : undefined, vendorId: opt(f.vendorId), projectId: opt(f.projectId), date: f.date, notes: f.notes || undefined, method: f.method, paymentStatus: f.paymentStatus, addToExpenses: f.addToExpenses });
      if (op.kind === 'transfer') await api.transfer({ materialId: Number(f.materialId), quantity: q, fromProjectId: opt(f.fromProjectId), toProjectId: opt(f.toProjectId), date: f.date, notes: f.notes || undefined });
      if (op.kind === 'consume') {
        if (!f.projectId) { toast.error('Select the site'); setSaving(false); return; }
        await api.consume({ materialId: Number(f.materialId), quantity: q, projectId: Number(f.projectId), date: f.date, notes: f.notes || undefined });
      }
      if (op.kind === 'adjust') await api.adjust({ materialId: Number(f.materialId), quantity: f.direction === 'add' ? q : -q, projectId: opt(f.projectId), notes: f.notes || undefined });
      toast.success('Saved');
      onDone();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={titles[op.kind]} dismissOnBackdrop={false}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Material</label>
          <Select className="input" value={f.materialId} onChange={(e) => set('materialId', e.target.value)}>
            <option value="">— Select —</option>
            {materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.unit}) · store {qty(m.inStore, '')}</option>)}
          </Select>
        </div>
        <div><label className="label">Quantity {mat ? `(${mat.unit})` : ''}</label><input type="number" min="0" step="any" className="input" value={f.quantity} onChange={(e) => set('quantity', e.target.value)} /></div>
        {op.kind !== 'adjust' && <div><label className="label">Date</label><input type="date" className="input" value={f.date} onChange={(e) => set('date', e.target.value)} /></div>}
        {op.kind === 'purchase' && (
          <>
            <div><label className="label">Rate (per unit)</label><input type="number" min="0" className="input" value={f.rate} onChange={(e) => set('rate', e.target.value)} /></div>
            <div><label className="label">Vendor</label><Select className="input" value={f.vendorId} onChange={(e) => set('vendorId', e.target.value)}><option value="">—</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select></div>
            <LocationSelect label="Deliver to" value={f.projectId} onChange={(v) => set('projectId', v)} projects={projects} />
            <div><label className="label">Payment</label><Select className="input" value={f.paymentStatus} onChange={(e) => set('paymentStatus', e.target.value)}><option value="PAID">Paid</option><option value="CREDIT">On credit</option></Select></div>
            <div><label className="label">Method</label><Select className="input" value={f.method} onChange={(e) => set('method', e.target.value)}>{methods.map((m) => <option key={m}>{m}</option>)}</Select></div>
            <div className="flex items-end"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.addToExpenses} onChange={(e) => set('addToExpenses', e.target.checked)} /> Record as expense</label></div>
            {f.rate && f.quantity && <p className="col-span-2 text-sm text-slate-500">Value: <strong className="text-brand-600">{formatMoney(Number(f.rate) * Number(f.quantity), bootstrap?.company?.currency || 'INR')}</strong></p>}
          </>
        )}
        {op.kind === 'transfer' && (
          <>
            <LocationSelect label="From" value={f.fromProjectId} onChange={(v) => set('fromProjectId', v)} projects={projects} />
            <LocationSelect label="To" value={f.toProjectId} onChange={(v) => set('toProjectId', v)} projects={projects} />
          </>
        )}
        {op.kind === 'consume' && <div className="col-span-2"><LocationSelect label="Site" value={f.projectId} onChange={(v) => set('projectId', v)} projects={projects} includeStore={false} /></div>}
        {op.kind === 'adjust' && (
          <>
            <div><label className="label">Direction</label><Select className="input" value={f.direction} onChange={(e) => set('direction', e.target.value)}><option value="add">Add (+)</option><option value="remove">Remove (−)</option></Select></div>
            <LocationSelect label="Location" value={f.projectId} onChange={(v) => set('projectId', v)} projects={projects} />
          </>
        )}
        <div className="col-span-2"><label className="label">Notes</label><input className="input" value={f.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      </div>
    </Modal>
  );
}

function RequestsTab({ lookups, onChanged, openNew }) {
  const { can } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState(null);
  const [create, setCreate] = useState(null);
  const [decide, setDecide] = useState(null);
  const load = useCallback(() => api.listRequests(status ? { status } : {}).then(setRows).catch((e) => toast.error(errorMessage(e))), [status, toast]);
  useEffect(() => { setRows(null); load(); }, [load]);
  const blankRequest = () => ({ projectId: '', priority: 'normal', neededBy: '', notes: '', items: [{ materialId: '', quantity: '' }] });
  useEffect(() => { if (openNew) setCreate(blankRequest()); }, [openNew]);

  const submitCreate = async () => {
    const items = create.items.filter((i) => i.materialId && Number(i.quantity) > 0).map((i) => ({ materialId: Number(i.materialId), quantity: Number(i.quantity) }));
    if (!create.projectId || !items.length) { toast.error('Select a site and at least one material'); return; }
    try {
      await api.createRequest({ projectId: Number(create.projectId), items, priority: create.priority, neededBy: create.neededBy || null, notes: create.notes || undefined });
      toast.success('Request submitted — approvers notified');
      setCreate(null);
      load();
    } catch (e) { toast.error(errorMessage(e)); }
  };
  const submitDecision = async (decision) => {
    try {
      await api.decideRequest(decide.id, { decision, note: decide.note || undefined, items: decide.items.map((i) => ({ materialId: i.materialId, approvedQty: Number(i.approvedQty) || 0 })) });
      toast.success(decision === 'approve' ? 'Approved' : 'Rejected');
      setDecide(null);
      load();
    } catch (e) { toast.error(errorMessage(e)); }
  };
  const fulfill = async (r) => {
    try {
      const res = await api.fulfillRequest(r.id, {});
      toast.success(res.status === 'fulfilled' ? 'Dispatched to site' : 'Partly dispatched (store stock short)');
      load();
      onChanged();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {[['', 'All'], ['pending', 'Awaiting approval'], ['approved', 'Approved · to dispatch'], ['partially_fulfilled', 'Partly sent'], ['fulfilled', 'Delivered'], ['rejected', 'Rejected']].map(([k, l]) => (
          <button key={k || 'all'} onClick={() => setStatus(k)} className={`rounded-full px-3 py-1 text-xs font-medium ${status === k ? 'bg-brand-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600'}`}>{l}</button>
        ))}
        <p className="ml-auto hidden text-xs text-slate-400 lg:block">Site raises request → manager approves → store dispatches to site</p>
      </div>
      {!rows ? <div className="flex justify-center p-10"><Spinner /></div> : rows.length === 0 ? <EmptyState title="No material requests" hint="Sites can request materials with the Request material button." /> : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-800 dark:text-slate-100">#{r.id} · {r.projectName}</span>
                <span className={`badge ${REQ_STATUS[r.status]}`}>{REQ_LABEL[r.status] || r.status}</span>
                {r.priority !== 'normal' && <span className="text-xs font-semibold uppercase text-red-600">{r.priority}</span>}
                <span className="ml-auto text-xs text-slate-400">By {r.requestedByName} · {formatDate(r.createdAt)}{r.neededBy ? ` · needed by ${formatDate(r.neededBy)}` : ''}</span>
              </div>
              <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                {r.items.map((i) => (
                  <li key={i.materialId} className="flex justify-between rounded-md bg-slate-50 px-2.5 py-1 dark:bg-slate-900/40">
                    <span>{i.name}</span>
                    <span className="text-slate-600 dark:text-slate-300">
                      {qty(i.quantity, i.unit)}{i.approvedQty != null && i.approvedQty !== i.quantity ? ` → ${qty(i.approvedQty, '')}` : ''}{Number(i.fulfilledQty) > 0 ? ` · sent ${qty(i.fulfilledQty, '')}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
              {(r.notes || r.decisionNote) && <p className="mt-2 text-xs text-slate-500">{r.notes}{r.decisionNote ? ` · Decision: ${r.decisionNote}` : ''}</p>}
              <div className="mt-3 flex gap-2">
                {r.status === 'pending' && can('materials.approve') && <button className="btn-primary btn-sm" onClick={() => setDecide({ ...r, note: '', items: r.items.map((i) => ({ ...i, approvedQty: i.quantity })) })}>Review</button>}
                {['approved', 'partially_fulfilled'].includes(r.status) && can('materials.manage') && <button className="btn-success btn-sm" onClick={() => fulfill(r)}>Dispatch from store</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {create && (
        <Modal open onClose={() => setCreate(null)} title="New Material Request" dismissOnBackdrop={false}
          footer={<><button className="btn-secondary" onClick={() => setCreate(null)}>Cancel</button><button className="btn-primary" onClick={submitCreate}>Submit</button></>}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><LocationSelect label="Site / Project" value={create.projectId} onChange={(v) => setCreate({ ...create, projectId: v })} projects={lookups.projects} includeStore={false} /></div>
            <div><label className="label">Priority</label><Select className="input" value={create.priority} onChange={(e) => setCreate({ ...create, priority: e.target.value })}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></Select></div>
            <div><label className="label">Needed by</label><input type="date" className="input" value={create.neededBy} onChange={(e) => setCreate({ ...create, neededBy: e.target.value })} /></div>
          </div>
          <p className="label mt-4">Materials</p>
          <div className="space-y-2">
            {create.items.map((it, i) => (
              <div key={i} className="flex gap-2">
                <Select className="input flex-1" value={it.materialId} onChange={(e) => setCreate({ ...create, items: create.items.map((x, j) => (j === i ? { ...x, materialId: e.target.value } : x)) })}>
                  <option value="">— Material —</option>{lookups.materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
                </Select>
                <input type="number" min="0" step="any" className="input w-28" placeholder="Qty" value={it.quantity} onChange={(e) => setCreate({ ...create, items: create.items.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)) })} />
                <button className="btn-secondary px-2 text-red-500" onClick={() => setCreate({ ...create, items: create.items.filter((_, j) => j !== i) })}>×</button>
              </div>
            ))}
            <button className="btn-ghost text-brand-600" onClick={() => setCreate({ ...create, items: [...create.items, { materialId: '', quantity: '' }] })}>+ Add material</button>
          </div>
          <label className="label mt-3">Notes</label><textarea className="input" rows={2} value={create.notes} onChange={(e) => setCreate({ ...create, notes: e.target.value })} />
        </Modal>
      )}

      {decide && (
        <Modal open onClose={() => setDecide(null)} title={`Review Request #${decide.id} · ${decide.projectName}`}
          footer={<><button className="btn-secondary" onClick={() => setDecide(null)}>Cancel</button><button className="btn-secondary text-red-600" onClick={() => submitDecision('reject')}>Reject</button><button className="btn-primary" onClick={() => submitDecision('approve')}>Approve</button></>}>
          <p className="mb-2 text-xs text-slate-500">Adjust approved quantities if needed.</p>
          <div className="space-y-2">
            {decide.items.map((it, i) => (
              <div key={it.materialId} className="flex items-center gap-3">
                <span className="flex-1 text-sm">{it.name} <span className="text-xs text-slate-400">requested {qty(it.quantity, it.unit)}</span></span>
                <input type="number" min="0" step="any" className="input w-28" value={it.approvedQty} onChange={(e) => setDecide({ ...decide, items: decide.items.map((x, j) => (j === i ? { ...x, approvedQty: e.target.value } : x)) })} />
              </div>
            ))}
          </div>
          <label className="label mt-3">Note to requester</label><input className="input" value={decide.note} onChange={(e) => setDecide({ ...decide, note: e.target.value })} />
        </Modal>
      )}
    </>
  );
}

function stockState(m) {
  if (Number(m.total) <= 0) return { label: 'Out of stock', cls: 'bg-red-50 text-red-700' };
  if (m.low) return { label: 'Low', cls: 'bg-amber-50 text-amber-800' };
  return { label: 'In stock', cls: 'bg-emerald-50 text-emerald-700' };
}

// Side panel for one material: where it is, recent movements, quick actions.
function MaterialPanel({ material, onClose, openOp, onEdit }) {
  const { can } = useAuth();
  const [locs, setLocs] = useState(null);
  const [moves, setMoves] = useState(null);
  useEffect(() => {
    api.getLocations(material.id).then(setLocs).catch(() => setLocs([]));
    api.listMovements({ materialId: material.id, limit: 10 }).then((r) => setMoves(r.items)).catch(() => setMoves([]));
  }, [material.id, material.total]);
  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-slate-800">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{material.name}</h3>
            <p className="text-xs text-slate-500">{material.category || 'Uncategorised'} · unit: {material.unit}{Number(material.reorderLevel) ? ` · reorder at ${Number(material.reorderLevel)}` : ''}</p>
          </div>
          <button className="btn-ghost px-2" onClick={onClose} aria-label="Close"><Icon name="close" className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[['Store', material.inStore], ['At sites', material.atSites], ['Total', material.total]].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-slate-50 px-2 py-2 dark:bg-slate-900/40">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">{k}</p>
                <p className="font-semibold tabular-nums">{qty(v, '')}</p>
              </div>
            ))}
          </div>
          {can('materials.manage') && (
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-primary btn-sm" onClick={() => openOp({ kind: 'purchase', materialId: material.id })}>Purchase</button>
              <button className="btn-secondary btn-sm" onClick={() => openOp({ kind: 'transfer', materialId: material.id })}>Transfer</button>
              <button className="btn-secondary btn-sm" onClick={() => openOp({ kind: 'consume', materialId: material.id })}>Record usage</button>
              <button className="btn-secondary btn-sm" onClick={() => openOp({ kind: 'adjust', materialId: material.id })}>Adjust stock</button>
            </div>
          )}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Where it is</p>
            {!locs ? <Spinner /> : (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
                {locs.map((l) => (
                  <li key={l.projectId ?? 'store'} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className={l.projectId ? '' : 'font-medium'}>{l.location}</span>
                    <span className={`tabular-nums ${l.quantity <= 0 ? 'text-slate-400' : 'font-semibold'}`}>{qty(l.quantity, material.unit)}</span>
                  </li>
                ))}
                {locs.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">No stock anywhere yet.</li>}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Recent activity</p>
            {!moves ? <Spinner /> : moves.length === 0 ? <p className="text-sm text-slate-400">No movements yet.</p> : (
              <ul className="space-y-1.5">
                {moves.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate">{TYPE_LABEL[m.type] || m.type} · {m.location}</span>
                      <span className="block text-xs text-slate-400">{formatDate(m.date)}{m.vendorName ? ` · ${m.vendorName}` : ''}</span>
                    </span>
                    <span className={`shrink-0 font-semibold tabular-nums ${Number(m.quantity) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{Number(m.quantity) > 0 ? '+' : ''}{qty(m.quantity, '')}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {can('materials.manage') && (
          <div className="border-t border-slate-200 px-5 py-3 dark:border-slate-700">
            <button className="btn-secondary w-full" onClick={() => onEdit(material)}><Icon name="edit" className="h-4 w-4" /> Edit material</button>
          </div>
        )}
      </aside>
    </div>
  );
}

function InventoryTab({ lookups, openOp, refreshKey }) {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [location, setLocation] = useState('all'); // all | store | <projectId>
  const [siteRows, setSiteRows] = useState(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);
  const [panel, setPanel] = useState(null);
  const [edit, setEdit] = useState(null);

  useEffect(() => {
    if (location === 'all' || location === 'store') { setSiteRows(null); return; }
    setSiteRows(undefined);
    api.getStock({ projectId: location, all: 'true' }).then(setSiteRows).catch(() => setSiteRows([]));
  }, [location, refreshKey]);

  const categories = [...new Set(lookups.materials.map((m) => m.category).filter(Boolean))].sort();
  const siteQty = new Map((siteRows || []).map((r) => [r.materialId, r.quantity]));
  const q = search.trim().toLowerCase();
  const list = lookups.materials
    .filter((m) => (!q || m.name.toLowerCase().includes(q)) && (!category || m.category === category) && (!onlyLow || m.low || Number(m.total) <= 0))
    .filter((m) => location === 'all' || location === 'store' || siteQty.get(m.id));
  const current = panel ? lookups.materials.find((m) => m.id === panel) : null;

  const save = async () => {
    if (!edit.name.trim()) { toast.error('Enter a name'); return; }
    const body = { name: edit.name.trim(), unit: edit.unit || 'nos', category: edit.category || null, reorderLevel: Number(edit.reorderLevel) || 0, notes: edit.notes || null };
    try {
      if (edit.id) await api.updateItem(edit.id, body); else await api.createItem(body);
      toast.success(edit.id ? 'Material updated' : 'Material added');
      setEdit(null);
      lookups.reloadMaterials();
    } catch (e) { toast.error(errorMessage(e)); }
  };
  const remove = async (m) => {
    if (!(await confirm({ title: 'Delete material?', message: `Remove ${m.name}. Stock history is kept.`, confirmLabel: 'Delete' }))) return;
    try { await api.deleteItem(m.id); setEdit(null); setPanel(null); lookups.reloadMaterials(); } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input className="input pl-9" placeholder="Search materials…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select className="input w-auto" value={location} onChange={(e) => setLocation(e.target.value)}>
          <option value="all">All locations</option>
          <option value="store">Central store</option>
          <optgroup label="Sites">{lookups.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>
        </Select>
        {categories.length > 0 && (
          <Select className="input w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        )}
        <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800">
          <input type="checkbox" className="accent-brand-600" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} /> Low / out only
        </label>
        {can('materials.manage') && <button className="btn-secondary" onClick={() => setEdit({ name: '', unit: 'nos', category: '', reorderLevel: '', notes: '' })}><Icon name="add" className="h-4 w-4" /> Add material</button>}
      </div>
      <div className="card overflow-hidden">
        {siteRows === undefined ? <div className="flex justify-center p-10"><Spinner /></div> : lookups.materials.length === 0 ? (
          <div className="p-6"><EmptyState title="No materials yet" hint={can('materials.manage') ? 'Add cement, steel, sand, bricks… then record purchases.' : undefined} /></div>
        ) : list.length === 0 ? (
          <div className="p-6"><EmptyState title="Nothing matches" hint={location !== 'all' && location !== 'store' ? 'No stock at this site yet — transfer from the store or record a delivery.' : 'Try another search or filter.'} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Material</th>
                  {location === 'all' && <><th className="text-right">Store</th><th className="text-right">At sites</th><th className="text-right">Total</th></>}
                  {location === 'store' && <th className="text-right">In store</th>}
                  {location !== 'all' && location !== 'store' && <th className="text-right">At this site</th>}
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((m) => {
                  const st = stockState(m);
                  const site = location !== 'all' && location !== 'store';
                  return (
                    <tr key={m.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60" onClick={() => setPanel(m.id)}>
                      <td>
                        <p className="font-medium text-slate-800 dark:text-slate-100">{m.name}</p>
                        <p className="text-xs text-slate-400">{m.category || '—'} · {m.unit}</p>
                      </td>
                      {location === 'all' && <><td className="text-right tabular-nums">{qty(m.inStore, '')}</td><td className="text-right tabular-nums">{qty(m.atSites, '')}</td><td className="text-right font-semibold tabular-nums">{qty(m.total, m.unit)}</td></>}
                      {location === 'store' && <td className="text-right font-semibold tabular-nums">{qty(m.inStore, m.unit)}</td>}
                      {site && <td className="text-right font-semibold tabular-nums">{qty(siteQty.get(m.id) || 0, m.unit)}</td>}
                      <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {can('materials.manage') && <button className="btn-ghost btn-sm" onClick={() => openOp({ kind: 'purchase', materialId: m.id, projectId: site ? location : '' })}>Purchase</button>}
                          {can('materials.manage') && <button className="btn-ghost btn-sm" onClick={() => openOp({ kind: 'transfer', materialId: m.id, projectId: site ? location : '' })}>Transfer</button>}
                          {(can('materials.request') || can('materials.manage')) && site && <button className="btn-ghost btn-sm" onClick={() => openOp({ kind: 'consume', materialId: m.id, projectId: location })}>Use</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {current && <MaterialPanel material={current} onClose={() => setPanel(null)} openOp={openOp} onEdit={(m) => setEdit({ ...m, reorderLevel: Number(m.reorderLevel) || '' })} />}
      {edit && (
        <Modal open onClose={() => setEdit(null)} title={edit.id ? 'Edit material' : 'Add material'} footer={<>{edit.id && <button className="btn-ghost mr-auto text-red-600 hover:bg-red-50" onClick={() => remove(edit)}>Delete</button>}<button className="btn-secondary" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" onClick={save}>Save</button></>}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">Name</label><input className="input" autoFocus placeholder="e.g. Cement OPC 53" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
            <div><label className="label">Unit</label><input className="input" list="mat-units" placeholder="bags, kg, cft, nos…" value={edit.unit} onChange={(e) => setEdit({ ...edit, unit: e.target.value })} /><datalist id="mat-units">{['nos', 'bags', 'kg', 'tonne', 'cft', 'cum', 'sqft', 'rft', 'litre', 'brass', 'trip'].map((u) => <option key={u} value={u} />)}</datalist></div>
            <div><label className="label">Category</label><input className="input" list="mat-cats" value={edit.category || ''} onChange={(e) => setEdit({ ...edit, category: e.target.value })} /><datalist id="mat-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist></div>
            <div className="col-span-2"><label className="label">Reorder level (central store)</label><input type="number" min="0" className="input" placeholder="Warn when store stock falls to this" value={edit.reorderLevel} onChange={(e) => setEdit({ ...edit, reorderLevel: e.target.value })} /></div>
          </div>
        </Modal>
      )}
    </>
  );
}

function MovementsTab({ lookups, refreshKey }) {
  const [filters, setFilters] = useState({ page: 1, materialId: '', projectId: '', type: '' });
  const [res, setRes] = useState(null);
  useEffect(() => {
    const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
    api.listMovements(clean).then(setRes).catch(() => setRes({ items: [], meta: null }));
  }, [filters, refreshKey]);
  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v, page: k === 'page' ? v : 1 }));
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-3">
        <Select className="input w-auto" value={filters.materialId} onChange={(e) => set('materialId', e.target.value)}><option value="">All materials</option>{lookups.materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select>
        <Select className="input w-auto" value={filters.projectId} onChange={(e) => set('projectId', e.target.value)}><option value="">All locations</option><option value="store">Central Store</option>{lookups.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        <Select className="input w-auto" value={filters.type} onChange={(e) => set('type', e.target.value)}><option value="">All types</option>{Object.entries(TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
      </div>
      <Card className="!p-0 overflow-hidden">
        {!res ? <div className="flex justify-center p-10"><Spinner /></div> : res.items.length === 0 ? <div className="p-6"><EmptyState title="No movements" /></div> : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th className="px-4 py-3">Date</th><th className="px-3 py-3">Material</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Location</th><th className="px-3 py-3 text-right">Qty</th><th className="px-3 py-3">Vendor / Notes</th></tr></thead>
              <tbody>
                {res.items.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-2">{formatDate(m.date)}</td>
                    <td className="px-3 py-2 font-medium">{m.materialName}</td>
                    <td className="px-3 py-2">{TYPE_LABEL[m.type] || m.type}</td>
                    <td className="px-3 py-2 text-slate-500">{m.location}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${Number(m.quantity) < 0 ? 'text-red-600' : 'text-green-600'}`}>{Number(m.quantity) > 0 ? '+' : ''}{qty(m.quantity, m.unit)}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{[m.vendorName, m.rate ? `@ ${Number(m.rate)}` : null, m.notes].filter(Boolean).join(' · ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Pagination meta={res?.meta} onPage={(p) => set('page', p)} />
    </>
  );
}

function ConsumptionTab({ lookups }) {
  const [month, setMonth] = useState(localMonth());
  const [projectId, setProjectId] = useState('');
  const [rows, setRows] = useState(null);
  useEffect(() => {
    setRows(null);
    api.getConsumption({ ...(month ? { month } : {}), ...(projectId ? { projectId } : {}) }).then(setRows).catch(() => setRows([]));
  }, [month, projectId]);
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-3">
        <input type="month" className="input w-auto" value={month} onChange={(e) => setMonth(e.target.value)} />
        {month && <button className="btn-secondary" onClick={() => setMonth('')}>All time</button>}
        <Select className="input w-auto" value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">All sites</option>{lookups.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
      </div>
      <Card className="!p-0 overflow-hidden">
        {!rows ? <div className="flex justify-center p-10"><Spinner /></div> : rows.length === 0 ? <div className="p-6"><EmptyState title="No consumption recorded" /></div> : (
          <table className="table-base">
            <thead><tr><th className="px-4 py-3">Site</th><th className="px-3 py-3">Material</th><th className="px-3 py-3 text-right">Consumed</th></tr></thead>
            <tbody>
              {rows.map((r) => <tr key={`${r.projectId}-${r.materialId}`}><td className="px-4 py-2.5">{r.projectName}</td><td className="px-3 py-2.5 font-medium">{r.materialName}</td><td className="px-3 py-2.5 text-right font-semibold">{qty(r.quantity, r.unit)}</td></tr>)}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}

export default function MaterialsPage() {
  const { can, bootstrap } = useAuth();
  const lookups = useLookups();
  const [tab, setTab] = useState('inventory');
  const [op, setOp] = useState(null);
  const [newRequest, setNewRequest] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [stats, setStats] = useState(null);
  const refresh = () => { setRefreshKey((k) => k + 1); lookups.reloadMaterials(); api.matAnalytics().then(setStats).catch(() => {}); };
  useEffect(() => { api.matAnalytics().then(setStats).catch(() => {}); }, []);
  const manage = can('materials.manage');
  const canRequest = can('materials.request') || manage;

  return (
    <div>
      <PageHeader
        title="Materials"
        subtitle="Stock in the store and at each site, requests from sites, purchases and usage"
        actions={
          <>
            {canRequest && <button className={manage ? 'btn-secondary' : 'btn-primary'} onClick={() => { setTab('requests'); setNewRequest((n) => n + 1); }}><Icon name="add" className="h-4 w-4" /> Request material</button>}
            {manage && <button className="btn-secondary" onClick={() => setOp({ kind: 'transfer' })}>Transfer</button>}
            {manage && <button className="btn-primary" onClick={() => setOp({ kind: 'purchase' })}><Icon name="add" className="h-4 w-4" /> Purchase</button>}
          </>
        }
      />
      {stats && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Materials" value={stats.materials} />
          <Stat label="Low / out of stock" value={stats.lowStock} tone={stats.lowStock ? 'danger' : 'neutral'} hint="Below reorder level in store" />
          <Stat label="Requests pending" value={stats.pendingRequests} tone={stats.pendingRequests ? 'warning' : 'neutral'} onClick={() => setTab('requests')} hint="Awaiting approval" />
          <Stat label="Purchases this month" value={formatMoney(stats.purchaseValueThisMonth, bootstrap?.company?.currency || 'INR')} />
        </div>
      )}
      <Tabs
        tabs={[
          { key: 'inventory', label: 'Inventory' },
          { key: 'requests', label: 'Site requests', count: stats?.pendingRequests },
          { key: 'movements', label: 'Purchases & movements' },
          { key: 'consumption', label: 'Site usage' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'inventory' && <InventoryTab lookups={lookups} openOp={setOp} refreshKey={refreshKey} />}
      {tab === 'requests' && <RequestsTab lookups={lookups} onChanged={refresh} openNew={newRequest} />}
      {tab === 'movements' && <MovementsTab lookups={lookups} refreshKey={refreshKey} />}
      {tab === 'consumption' && <ConsumptionTab lookups={lookups} />}
      {op && <StockOpModal op={op} lookups={lookups} onClose={() => setOp(null)} onDone={refresh} />}
    </div>
  );
}
