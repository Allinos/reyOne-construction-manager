import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { errorMessage } from '../../lib/api';
import { formatMoney, formatDate } from '../../lib/format';
import { PageHeader, Card, Spinner, EmptyState, Alert, Pagination } from '../../components/ui';
import Modal from '../../components/Modal';
import { Tabs } from '../attendance/AttendancePage';
import * as api from './api';

const today = () => new Date().toISOString().slice(0, 10);
const qty = (n, unit) => `${Number(n).toLocaleString(undefined, { maximumFractionDigits: 3 })} ${unit || ''}`;
const REQ_STATUS = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  approved: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  partially_fulfilled: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  fulfilled: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};
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
      <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        {includeStore && <option value="">Central Store</option>}
        {!includeStore && <option value="">— Select site —</option>}
        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
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
  const titles = { purchase: 'Purchase / Receive Material', transfer: 'Transfer Material', consume: 'Record Site Consumption', adjust: 'Stock Adjustment' };

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
          <select className="input" value={f.materialId} onChange={(e) => set('materialId', e.target.value)}>
            <option value="">— Select —</option>
            {materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.unit}) · store {qty(m.inStore, '')}</option>)}
          </select>
        </div>
        <div><label className="label">Quantity {mat ? `(${mat.unit})` : ''}</label><input type="number" min="0" step="any" className="input" value={f.quantity} onChange={(e) => set('quantity', e.target.value)} /></div>
        {op.kind !== 'adjust' && <div><label className="label">Date</label><input type="date" className="input" value={f.date} onChange={(e) => set('date', e.target.value)} /></div>}
        {op.kind === 'purchase' && (
          <>
            <div><label className="label">Rate (per unit)</label><input type="number" min="0" className="input" value={f.rate} onChange={(e) => set('rate', e.target.value)} /></div>
            <div><label className="label">Vendor</label><select className="input" value={f.vendorId} onChange={(e) => set('vendorId', e.target.value)}><option value="">—</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
            <LocationSelect label="Deliver to" value={f.projectId} onChange={(v) => set('projectId', v)} projects={projects} />
            <div><label className="label">Payment</label><select className="input" value={f.paymentStatus} onChange={(e) => set('paymentStatus', e.target.value)}><option value="PAID">Paid</option><option value="CREDIT">On credit</option></select></div>
            <div><label className="label">Method</label><select className="input" value={f.method} onChange={(e) => set('method', e.target.value)}>{methods.map((m) => <option key={m}>{m}</option>)}</select></div>
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
            <div><label className="label">Direction</label><select className="input" value={f.direction} onChange={(e) => set('direction', e.target.value)}><option value="add">Add (+)</option><option value="remove">Remove (−)</option></select></div>
            <LocationSelect label="Location" value={f.projectId} onChange={(v) => set('projectId', v)} projects={projects} />
          </>
        )}
        <div className="col-span-2"><label className="label">Notes</label><input className="input" value={f.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      </div>
    </Modal>
  );
}

function StockTab({ lookups, openOp, refreshKey }) {
  const { can } = useAuth();
  const [location, setLocation] = useState('');
  const [rows, setRows] = useState(null);
  const [search, setSearch] = useState('');
  useEffect(() => {
    setRows(null);
    api.getStock(location ? { projectId: location, all: 'true' } : {}).then(setRows).catch(() => setRows([]));
  }, [location, refreshKey]);
  const list = (rows || []).filter((r) => !search || r.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-64"><LocationSelect label="Location" value={location} onChange={setLocation} projects={lookups.projects} /></div>
        <input className="input min-w-[160px] flex-1" placeholder="Search material…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          {can('materials.manage') && <button className="btn-primary" onClick={() => openOp({ kind: 'purchase', projectId: location })}>+ Purchase</button>}
          {can('materials.manage') && <button className="btn-secondary" onClick={() => openOp({ kind: 'transfer', projectId: location })}>Transfer</button>}
          {location && (can('materials.request') || can('materials.manage')) && <button className="btn-secondary" onClick={() => openOp({ kind: 'consume', projectId: location })}>Record Consumption</button>}
        </div>
      </div>
      <Card className="!p-0 overflow-hidden">
        {!rows ? <div className="flex justify-center p-10"><Spinner /></div> : list.length === 0 ? <div className="p-6"><EmptyState title="No stock here yet" hint={location ? 'Transfer materials from the store or record a purchase delivered to this site.' : 'Add materials and record purchases.'} /></div> : (
          <table className="w-full text-sm">
            <thead className="bg-cream-100 text-left text-slate-500 dark:bg-slate-800"><tr><th className="px-4 py-3">Material</th><th className="px-3 py-3">Category</th><th className="px-3 py-3 text-right">In stock</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-cream-200 dark:divide-slate-700">
              {list.map((r) => (
                <tr key={r.materialId}>
                  <td className="px-4 py-2.5 font-medium">{r.name}{r.low && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">LOW</span>}</td>
                  <td className="px-3 py-2.5 text-slate-500">{r.category || '—'}</td>
                  <td className={`px-3 py-2.5 text-right font-semibold ${r.quantity <= 0 ? 'text-slate-400' : ''}`}>{qty(r.quantity, r.unit)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1.5">
                      {can('materials.manage') && <button className="pill bg-brand-50 text-brand-700 hover:bg-brand-100" onClick={() => openOp({ kind: 'transfer', materialId: r.materialId, projectId: location })}>Transfer</button>}
                      {location && (can('materials.request') || can('materials.manage')) && <button className="pill bg-cream-200 text-slate-600" onClick={() => openOp({ kind: 'consume', materialId: r.materialId, projectId: location })}>Use</button>}
                      {can('materials.manage') && <button className="pill bg-cream-200 text-slate-600" onClick={() => openOp({ kind: 'adjust', materialId: r.materialId, projectId: location })}>Adjust</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}

function RequestsTab({ lookups, onChanged }) {
  const { can } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState(null);
  const [create, setCreate] = useState(null);
  const [decide, setDecide] = useState(null);
  const load = useCallback(() => api.listRequests(status ? { status } : {}).then(setRows).catch((e) => toast.error(errorMessage(e))), [status, toast]);
  useEffect(() => { setRows(null); load(); }, [load]);

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
      <div className="mb-4 flex flex-wrap gap-3">
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>{Object.keys(REQ_STATUS).map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        {(can('materials.request') || can('materials.manage')) && (
          <button className="btn-primary ml-auto" onClick={() => setCreate({ projectId: '', priority: 'normal', neededBy: '', notes: '', items: [{ materialId: '', quantity: '' }] })}>+ New Request</button>
        )}
      </div>
      {!rows ? <div className="flex justify-center p-10"><Spinner /></div> : rows.length === 0 ? <Card><EmptyState title="No material requests" /></Card> : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-800 dark:text-slate-100">#{r.id} · {r.projectName}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${REQ_STATUS[r.status]}`}>{r.status.replace('_', ' ')}</span>
                {r.priority !== 'normal' && <span className="text-xs font-semibold uppercase text-red-600">{r.priority}</span>}
                <span className="ml-auto text-xs text-slate-400">By {r.requestedByName} · {formatDate(r.createdAt)}{r.neededBy ? ` · needed by ${formatDate(r.neededBy)}` : ''}</span>
              </div>
              <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                {r.items.map((i) => (
                  <li key={i.materialId} className="flex justify-between rounded bg-cream-100 px-2 py-1 dark:bg-slate-800">
                    <span>{i.name}</span>
                    <span className="text-slate-600 dark:text-slate-300">
                      {qty(i.quantity, i.unit)}{i.approvedQty != null && i.approvedQty !== i.quantity ? ` → ${qty(i.approvedQty, '')}` : ''}{Number(i.fulfilledQty) > 0 ? ` · sent ${qty(i.fulfilledQty, '')}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
              {(r.notes || r.decisionNote) && <p className="mt-2 text-xs text-slate-500">{r.notes}{r.decisionNote ? ` · Decision: ${r.decisionNote}` : ''}</p>}
              <div className="mt-3 flex gap-2">
                {r.status === 'pending' && can('materials.approve') && <button className="btn-secondary py-1 text-sm" onClick={() => setDecide({ ...r, note: '', items: r.items.map((i) => ({ ...i, approvedQty: i.quantity })) })}>Review</button>}
                {['approved', 'partially_fulfilled'].includes(r.status) && can('materials.manage') && <button className="btn-primary py-1 text-sm" onClick={() => fulfill(r)}>Dispatch from store</button>}
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
            <div><label className="label">Priority</label><select className="input" value={create.priority} onChange={(e) => setCreate({ ...create, priority: e.target.value })}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
            <div><label className="label">Needed by</label><input type="date" className="input" value={create.neededBy} onChange={(e) => setCreate({ ...create, neededBy: e.target.value })} /></div>
          </div>
          <p className="label mt-4">Materials</p>
          <div className="space-y-2">
            {create.items.map((it, i) => (
              <div key={i} className="flex gap-2">
                <select className="input flex-1" value={it.materialId} onChange={(e) => setCreate({ ...create, items: create.items.map((x, j) => (j === i ? { ...x, materialId: e.target.value } : x)) })}>
                  <option value="">— Material —</option>{lookups.materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
                </select>
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

function CatalogTab({ lookups }) {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [edit, setEdit] = useState(null);
  const save = async () => {
    const body = { name: edit.name, unit: edit.unit || 'nos', category: edit.category || null, reorderLevel: Number(edit.reorderLevel) || 0, notes: edit.notes || null };
    try {
      if (edit.id) await api.updateItem(edit.id, body); else await api.createItem(body);
      toast.success('Saved');
      setEdit(null);
      lookups.reloadMaterials();
    } catch (e) { toast.error(errorMessage(e)); }
  };
  const remove = async (m) => {
    if (!(await confirm({ title: 'Delete material?', message: `Remove ${m.name}. Stock history is kept.`, confirmLabel: 'Delete' }))) return;
    try { await api.deleteItem(m.id); lookups.reloadMaterials(); } catch (e) { toast.error(errorMessage(e)); }
  };
  return (
    <>
      {can('materials.manage') && <div className="mb-4 flex justify-end"><button className="btn-primary" onClick={() => setEdit({ name: '', unit: 'nos', category: '', reorderLevel: '', notes: '' })}>+ Add Material</button></div>}
      <Card className="!p-0 overflow-hidden">
        {lookups.materials.length === 0 ? <div className="p-6"><EmptyState title="No materials yet" hint="Add cement, steel, sand, bricks…" /></div> : (
          <table className="w-full text-sm">
            <thead className="bg-cream-100 text-left text-slate-500 dark:bg-slate-800"><tr><th className="px-4 py-3">Material</th><th className="px-3 py-3">Unit</th><th className="px-3 py-3">Category</th><th className="px-3 py-3 text-right">Store</th><th className="px-3 py-3 text-right">At sites</th><th className="px-3 py-3 text-right">Reorder at</th><th className="px-4 py-3" /></tr></thead>
            <tbody className="divide-y divide-cream-200 dark:divide-slate-700">
              {lookups.materials.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-2.5 font-medium">{m.name}{m.low && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">LOW</span>}</td>
                  <td className="px-3 py-2.5">{m.unit}</td>
                  <td className="px-3 py-2.5 text-slate-500">{m.category || '—'}</td>
                  <td className="px-3 py-2.5 text-right">{qty(m.inStore, '')}</td>
                  <td className="px-3 py-2.5 text-right">{qty(m.atSites, '')}</td>
                  <td className="px-3 py-2.5 text-right text-slate-500">{Number(m.reorderLevel) || '—'}</td>
                  <td className="px-4 py-2.5 text-right">{can('materials.manage') && <><button className="mr-3 text-xs text-brand-600 hover:underline" onClick={() => setEdit({ ...m, reorderLevel: Number(m.reorderLevel) })}>Edit</button><button className="text-xs text-red-500 hover:underline" onClick={() => remove(m)}>Delete</button></>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {edit && (
        <Modal open onClose={() => setEdit(null)} title={edit.id ? 'Edit Material' : 'Add Material'} footer={<><button className="btn-secondary" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" onClick={save}>Save</button></>}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">Name</label><input className="input" autoFocus value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
            <div><label className="label">Unit</label><input className="input" placeholder="bags, kg, cft, nos…" value={edit.unit} onChange={(e) => setEdit({ ...edit, unit: e.target.value })} /></div>
            <div><label className="label">Category</label><input className="input" value={edit.category || ''} onChange={(e) => setEdit({ ...edit, category: e.target.value })} /></div>
            <div><label className="label">Reorder level (store)</label><input type="number" min="0" className="input" value={edit.reorderLevel} onChange={(e) => setEdit({ ...edit, reorderLevel: e.target.value })} /></div>
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
        <select className="input w-auto" value={filters.materialId} onChange={(e) => set('materialId', e.target.value)}><option value="">All materials</option>{lookups.materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
        <select className="input w-auto" value={filters.projectId} onChange={(e) => set('projectId', e.target.value)}><option value="">All locations</option><option value="store">Central Store</option>{lookups.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select className="input w-auto" value={filters.type} onChange={(e) => set('type', e.target.value)}><option value="">All types</option>{Object.entries(TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      </div>
      <Card className="!p-0 overflow-hidden">
        {!res ? <div className="flex justify-center p-10"><Spinner /></div> : res.items.length === 0 ? <div className="p-6"><EmptyState title="No movements" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream-100 text-left text-slate-500 dark:bg-slate-800"><tr><th className="px-4 py-3">Date</th><th className="px-3 py-3">Material</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Location</th><th className="px-3 py-3 text-right">Qty</th><th className="px-3 py-3">Vendor / Notes</th></tr></thead>
              <tbody className="divide-y divide-cream-200 dark:divide-slate-700">
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
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
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
        <select className="input w-auto" value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">All sites</option>{lookups.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      </div>
      <Card className="!p-0 overflow-hidden">
        {!rows ? <div className="flex justify-center p-10"><Spinner /></div> : rows.length === 0 ? <div className="p-6"><EmptyState title="No consumption recorded" /></div> : (
          <table className="w-full text-sm">
            <thead className="bg-cream-100 text-left text-slate-500 dark:bg-slate-800"><tr><th className="px-4 py-3">Site</th><th className="px-3 py-3">Material</th><th className="px-3 py-3 text-right">Consumed</th></tr></thead>
            <tbody className="divide-y divide-cream-200 dark:divide-slate-700">
              {rows.map((r) => <tr key={`${r.projectId}-${r.materialId}`}><td className="px-4 py-2.5">{r.projectName}</td><td className="px-3 py-2.5 font-medium">{r.materialName}</td><td className="px-3 py-2.5 text-right font-semibold">{qty(r.quantity, r.unit)}</td></tr>)}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}

export default function MaterialsPage() {
  const lookups = useLookups();
  const [tab, setTab] = useState('stock');
  const [op, setOp] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [stats, setStats] = useState(null);
  const refresh = () => { setRefreshKey((k) => k + 1); lookups.reloadMaterials(); api.matAnalytics().then(setStats).catch(() => {}); };
  useEffect(() => { api.matAnalytics().then(setStats).catch(() => {}); }, []);

  return (
    <div>
      <PageHeader title="Materials & Inventory" subtitle="Requests, approvals, purchases, stock, transfers and site consumption" />
      {stats && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="card px-4 py-3"><p className="text-xs text-slate-500">Materials</p><p className="text-lg font-semibold">{stats.materials}</p></div>
          <div className="card px-4 py-3"><p className="text-xs text-slate-500">Low stock</p><p className={`text-lg font-semibold ${stats.lowStock ? 'text-red-600' : ''}`}>{stats.lowStock}</p></div>
          <div className="card px-4 py-3"><p className="text-xs text-slate-500">Pending requests</p><p className={`text-lg font-semibold ${stats.pendingRequests ? 'text-amber-600' : ''}`}>{stats.pendingRequests}</p></div>
          <MoneyStat value={stats.purchaseValueThisMonth} />
        </div>
      )}
      <Tabs
        tabs={[{ key: 'stock', label: 'Stock' }, { key: 'requests', label: 'Requests' }, { key: 'catalog', label: 'Materials' }, { key: 'movements', label: 'Movements' }, { key: 'consumption', label: 'Site Consumption' }]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'stock' && <StockTab lookups={lookups} openOp={setOp} refreshKey={refreshKey} />}
      {tab === 'requests' && <RequestsTab lookups={lookups} onChanged={refresh} />}
      {tab === 'catalog' && <CatalogTab lookups={lookups} />}
      {tab === 'movements' && <MovementsTab lookups={lookups} refreshKey={refreshKey} />}
      {tab === 'consumption' && <ConsumptionTab lookups={lookups} />}
      {op && <StockOpModal op={op} lookups={lookups} onClose={() => setOp(null)} onDone={refresh} />}
    </div>
  );
}

function MoneyStat({ value }) {
  const { bootstrap } = useAuth();
  return <div className="card px-4 py-3"><p className="text-xs text-slate-500">Purchases this month</p><p className="text-lg font-semibold text-brand-600">{formatMoney(value, bootstrap?.company?.currency || 'INR')}</p></div>;
}
