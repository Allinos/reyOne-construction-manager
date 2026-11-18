import { useEffect, useState, useCallback } from 'react';
import { listWorkforce, createWorkforce, updateWorkforce, deleteWorkforce, getOverview, getWorkforceStats } from './api';
import { saveProfile, createPayment } from '../payroll/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { errorMessage } from '../../lib/api';
import { formatMoney, formatDate, localDate, localMonth } from '../../lib/format';
import { PageHeader, Spinner, EmptyState, Pagination, Alert, Tabs, Stat } from '../../components/ui';
import Modal from '../../components/Modal';
import Select from '../../components/Select';
import Icon from '../../components/Icon';
import ExpenseFormModal from '../finance/ExpenseFormModal';
import { listProjects } from '../projects/api';

const blank = { name: '', category: '', workerType: 'LABOUR', firmName: '', siteProjectId: '', joiningDate: '', phone: '', address: '', notes: '', status: 'ACTIVE' };
const TYPE = { LABOUR: 'Labour', CONTRACTOR: 'Contractor' };
const SORTS = [
  { v: 'name:asc', l: 'Name (A–Z)' },
  { v: 'category:asc', l: 'Category' },
  { v: 'createdAt:desc', l: 'Recently added' },
];

function cleanBody(f) {
  return {
    name: f.name.trim(),
    category: f.category.trim(),
    workerType: f.workerType,
    firmName: f.workerType === 'CONTRACTOR' ? f.firmName?.trim() || null : null,
    siteProjectId: f.siteProjectId ? Number(f.siteProjectId) : null,
    joiningDate: f.joiningDate || null,
    phone: f.phone || null,
    address: f.address || null,
    notes: f.notes || null,
    status: f.status,
  };
}

// Pay wages through Payroll so the dues ledger stays correct.
function PayWagesModal({ member, overview, onClose, onDone }) {
  const { bootstrap } = useAuth();
  const toast = useToast();
  const methods = bootstrap?.settings?.finance?.payment_methods || ['Cash'];
  const pendingMonth = overview?.wages?.months?.find((m) => m.pending > 0);
  const [f, setF] = useState({ period: pendingMonth?.month || localMonth(), amount: pendingMonth?.pending || '', advance: '', date: localDate(), method: methods[0], notes: '' });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!(Number(f.amount) > 0)) { toast.error('Enter the amount'); return; }
    setBusy(true);
    try {
      await createPayment({ personType: 'WORKFORCE', personId: member.id, period: f.period, grossAmount: Number(f.amount), advanceDeduction: Number(f.advance) || 0, date: f.date, method: f.method, notes: f.notes || undefined, addToExpenses: true });
      toast.success('Payment recorded');
      onDone();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`Pay wages · ${member.name}`} footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy} onClick={submit}>Record payment</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">For month</label><input type="month" className="input" value={f.period} onChange={(e) => setF({ ...f, period: e.target.value })} /></div>
        <div><label className="label">Wages settled</label><input type="number" min="0" className="input" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
        {overview?.wages?.totals?.advanceOutstanding > 0 && (
          <div className="col-span-2"><label className="label">Recover from advance (outstanding {formatMoney(overview.wages.totals.advanceOutstanding, bootstrap?.company?.currency)})</label><input type="number" min="0" className="input" value={f.advance} onChange={(e) => setF({ ...f, advance: e.target.value })} /></div>
        )}
        <div><label className="label">Paid on</label><input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
        <div><label className="label">Method</label><Select className="input" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{methods.map((m) => <option key={m}>{m}</option>)}</Select></div>
        <div className="col-span-2"><label className="label">Notes</label><input className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
      </div>
      <p className="mt-3 text-xs text-slate-500">Recorded in Salary &amp; Payroll and added to company expenses.</p>
    </Modal>
  );
}

function WageModal({ member, profile, onClose, onDone }) {
  const toast = useToast();
  const [f, setF] = useState({ payType: profile?.payType || 'daily', rate: profile ? Number(profile.rate) : '' });
  const submit = async () => {
    if (!(Number(f.rate) > 0)) { toast.error('Enter the rate'); return; }
    try {
      await saveProfile({ personType: 'WORKFORCE', personId: member.id, payType: f.payType, rate: Number(f.rate) });
      toast.success('Wage saved');
      onDone();
    } catch (e) { toast.error(errorMessage(e)); }
  };
  return (
    <Modal open onClose={onClose} title={`Wage · ${member.name}`} footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={submit}>Save</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Pay type</label><Select className="input" value={f.payType} onChange={(e) => setF({ ...f, payType: e.target.value })}><option value="daily">Daily wage</option><option value="monthly">Monthly</option></Select></div>
        <div><label className="label">{f.payType === 'daily' ? 'Rate per day' : 'Monthly amount'}</label><input type="number" min="0" className="input" value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} /></div>
      </div>
      <p className="mt-3 text-xs text-slate-500">Daily wages are earned from attendance (half day = 0.5).</p>
    </Modal>
  );
}

function WorkerDrawer({ member, onClose, onEdit, onChanged }) {
  const { can, bootstrap } = useAuth();
  const currency = bootstrap?.company?.currency || 'INR';
  const money = (v) => formatMoney(v, currency);
  const [data, setData] = useState(null);
  const [modal, setModal] = useState(null); // pay | wage | expense
  const load = useCallback(() => getOverview(member.id).then(setData).catch(() => setData({})), [member.id]);
  useEffect(() => { load(); }, [load]);
  const done = () => { setModal(null); load(); onChanged(); };
  const w = data?.wages;
  const p = data?.payments;
  const a = data?.attendance;
  const financeOn = (bootstrap?.modules || []).some((m) => m.key === 'finance');

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-lg flex-col bg-white shadow-2xl dark:bg-slate-800">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-lg font-semibold text-slate-900 dark:text-white">{member.name}</h3>
              <span className={`badge ${member.workerType === 'CONTRACTOR' ? 'bg-brand-100 text-brand-800' : 'bg-slate-100 text-slate-700'}`}>{TYPE[member.workerType] || 'Labour'}</span>
            </div>
            <p className="text-xs text-slate-500">{[member.category, member.firmName, member.phone].filter(Boolean).join(' · ')}</p>
          </div>
          <button className="btn-ghost px-2" onClick={onClose} aria-label="Close"><Icon name="close" className="h-4 w-4" /></button>
        </div>
        {!data ? <div className="flex justify-center p-10"><Spinner /></div> : (
          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-[11px] uppercase tracking-wide text-slate-400">Site</p><p className="font-medium">{data.member?.siteName || '—'}</p></div>
              <div><p className="text-[11px] uppercase tracking-wide text-slate-400">Joined</p><p className="font-medium">{member.joiningDate ? formatDate(member.joiningDate) : '—'}</p></div>
              {member.address && <div className="col-span-2"><p className="text-[11px] uppercase tracking-wide text-slate-400">Address</p><p>{member.address}</p></div>}
              {member.notes && <div className="col-span-2"><p className="text-[11px] uppercase tracking-wide text-slate-400">Notes</p><p className="whitespace-pre-wrap">{member.notes}</p></div>}
            </div>

            {a && (
              <section>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Attendance this month</p>
                <div className="grid grid-cols-4 gap-2 text-center text-sm">
                  {[['Present', a.present, 'text-emerald-600'], ['Half day', a.half_day, 'text-amber-600'], ['Absent', a.absent, 'text-red-600'], ['Days worked', a.daysWorked, 'text-slate-900 dark:text-white']].map(([k, v, c]) => (
                    <div key={k} className="rounded-lg bg-slate-50 py-2 dark:bg-slate-900/40"><p className={`text-base font-semibold ${c}`}>{v}</p><p className="text-[11px] text-slate-500">{k}</p></div>
                  ))}
                </div>
                {a.lastSite && <p className="mt-1 text-xs text-slate-400">Last marked at {a.lastSite.name} on {formatDate(a.lastSite.date)}</p>}
              </section>
            )}

            {w !== null && w !== undefined && (
              <section>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Wages &amp; dues</p>
                  {can('payroll.manage') && <button className="text-xs font-medium text-brand-600 hover:underline" onClick={() => setModal('wage')}>{w.profile ? 'Change wage' : 'Set wage'}</button>}
                </div>
                {!w.profile ? <p className="text-sm text-slate-400">No wage set yet.</p> : (
                  <>
                    <p className="mb-2 text-sm">{w.profile.payType === 'daily' ? `${money(w.profile.rate)} per day` : `${money(w.profile.rate)} per month`}</p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-slate-50 py-2 dark:bg-slate-900/40"><p className="text-sm font-semibold">{money(w.totals.earned)}</p><p className="text-[11px] text-slate-500">Earned</p></div>
                      <div className="rounded-lg bg-slate-50 py-2 dark:bg-slate-900/40"><p className="text-sm font-semibold text-emerald-600">{money(w.totals.netPaidAllTime)}</p><p className="text-[11px] text-slate-500">Paid</p></div>
                      <div className="rounded-lg bg-slate-50 py-2 dark:bg-slate-900/40"><p className={`text-sm font-semibold ${w.totals.pending > 0 ? 'text-red-600' : ''}`}>{money(w.totals.pending)}</p><p className="text-[11px] text-slate-500">Pending</p></div>
                    </div>
                    {w.totals.advanceOutstanding > 0 && <p className="mt-2 text-xs text-amber-700">Advance outstanding: {money(w.totals.advanceOutstanding)}</p>}
                    {w.months?.length > 0 && (
                      <table className="mt-3 w-full text-xs">
                        <thead className="text-left text-slate-400"><tr><th className="py-1">Month</th><th className="text-right">Days</th><th className="text-right">Earned</th><th className="text-right">Settled</th><th className="text-right">Pending</th></tr></thead>
                        <tbody>{w.months.map((m) => <tr key={m.month} className="border-t border-slate-100 dark:border-slate-700"><td className="py-1">{m.month}</td><td className="text-right">{m.days}</td><td className="text-right">{money(m.earned)}</td><td className="text-right">{money(m.settled)}</td><td className={`text-right ${m.pending > 0 ? 'font-medium text-red-600' : ''}`}>{money(m.pending)}</td></tr>)}</tbody>
                      </table>
                    )}
                  </>
                )}
              </section>
            )}

            {p && (
              <section>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payments</p>
                  <span className="text-xs text-slate-500">This month <b className="text-slate-800 dark:text-slate-100">{money(p.paidThisMonth)}</b> · total <b className="text-slate-800 dark:text-slate-100">{money(p.totalPaid)}</b></span>
                </div>
                {p.items.length === 0 ? <p className="text-sm text-slate-400">No payments yet.</p> : (
                  <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
                    {p.items.map((x) => (
                      <li key={x.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                        <span className="min-w-0">
                          <span className="block truncate">{x.category}{x.projectName ? ` · ${x.projectName}` : ''}</span>
                          <span className="block text-xs text-slate-400">{formatDate(x.date)} · {x.method}{x.notes ? ` · ${x.notes}` : ''}</span>
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums">{money(x.amountPaid)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-700">
          {w?.profile && can('payroll.manage') && <button className="btn-primary" onClick={() => setModal('pay')}>Pay wages</button>}
          {financeOn && can('finance.create') && <button className={w?.profile && can('payroll.manage') ? 'btn-secondary' : 'btn-primary'} onClick={() => setModal('expense')}>{member.workerType === 'CONTRACTOR' ? 'Record contractor payment' : 'Record other payment'}</button>}
          {can('workforce.update') && <button className="btn-secondary ml-auto" onClick={() => onEdit(member)}><Icon name="edit" className="h-4 w-4" /> Edit</button>}
        </div>
      </aside>
      {modal === 'pay' && <PayWagesModal member={member} overview={data} onClose={() => setModal(null)} onDone={done} />}
      {modal === 'wage' && <WageModal member={member} profile={w?.profile} onClose={() => setModal(null)} onDone={done} />}
      <ExpenseFormModal
        open={modal === 'expense'}
        scope={member.siteProjectId ? 'PROJECT' : 'COMPANY'}
        presetProjectId={member.siteProjectId || ''}
        presetWorkforceId={member.id}
        onClose={() => setModal(null)}
        onSaved={done}
      />
    </div>
  );
}

export default function WorkforcePage() {
  const { bootstrap, can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const currency = bootstrap?.company?.currency || 'INR';
  const categories = (bootstrap?.settings?.workforce?.categories || []).map((c) =>
    typeof c === 'string' ? { name: c, color: '#cc6e02' } : { name: c.name || '', color: c.color || '#cc6e02' },
  );
  const colorFor = (name) => categories.find((c) => c.name === name)?.color || '#64748b';

  const [type, setType] = useState('');
  const [filters, setFilters] = useState({ search: '', category: '', status: 'ACTIVE', siteProjectId: '', sort: 'name:asc', page: 1 });
  const [result, setResult] = useState({ items: [], meta: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [drawer, setDrawer] = useState(null);
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sortBy, order] = filters.sort.split(':');
      const params = { page: filters.page, sortBy, order };
      for (const k of ['search', 'category', 'status', 'siteProjectId']) if (filters[k]) params[k] = filters[k];
      if (type) params.workerType = type;
      setResult(await listWorkforce(params));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filters, type]);

  const loadStats = useCallback(() => getWorkforceStats().then(setStats).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    loadStats();
    listProjects({ limit: 100 }).then((r) => setProjects(r.items || [])).catch(() => {});
  }, [loadStats]);

  const update = (patch) => setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  const openNew = () => setModal({ editingId: null, form: { ...blank, workerType: type || 'LABOUR' } });
  const openEdit = (m) => setModal({ editingId: m.id, form: { ...blank, ...m, firmName: m.firmName || '', siteProjectId: m.siteProjectId || '', joiningDate: m.joiningDate ? String(m.joiningDate).slice(0, 10) : '', phone: m.phone || '', address: m.address || '', notes: m.notes || '' } });
  const setField = (k, v) => setModal((m) => ({ ...m, form: { ...m.form, [k]: v } }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = cleanBody(modal.form);
      if (modal.editingId) await updateWorkforce(modal.editingId, body);
      else await createWorkforce(body);
      toast.success(modal.editingId ? 'Details updated' : `${TYPE[body.workerType]} added`);
      setModal(null);
      setDrawer(null);
      load();
      loadStats();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (m) => {
    const ok = await confirm({ title: 'Delete member?', message: `Remove ${m.name}. Attendance and payment history are kept.`, confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      await deleteWorkforce(m.id);
      toast.success('Member deleted');
      load();
      loadStats();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const showMoney = result.items.some((m) => m.rate !== undefined);

  return (
    <div>
      <PageHeader
        title="Workforce"
        subtitle="Site labour and contractors — attendance, wages, dues and payments"
        actions={can('workforce.create') && <button className="btn-primary" onClick={openNew}><Icon name="add" className="h-4 w-4" /> Add {type === 'CONTRACTOR' ? 'contractor' : 'worker'}</button>}
      />

      {stats && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="Labour (active)" value={stats.labour} />
          <Stat label="Contractors" value={stats.contractors} />
          <Stat label="Present today" value={stats.presentToday} tone="info" />
          {stats.pendingDues !== null && <Stat label="Wages pending" value={formatMoney(stats.pendingDues, currency)} tone={stats.pendingDues > 0 ? 'danger' : 'neutral'} />}
          {stats.paidThisMonth !== null && <Stat label="Paid this month" value={formatMoney(stats.paidThisMonth, currency)} tone="success" />}
        </div>
      )}

      <Tabs tabs={[{ key: '', label: 'Everyone' }, { key: 'LABOUR', label: 'Labour' }, { key: 'CONTRACTOR', label: 'Contractors' }]} value={type} onChange={(t) => { setType(t); update({}); }} />

      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input className="input pl-9" placeholder="Search name, phone or firm…" value={filters.search} onChange={(e) => update({ search: e.target.value })} />
        </div>
        <Select className="input w-auto" value={filters.category} onChange={(e) => update({ category: e.target.value })}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
        </Select>
        <Select className="input w-auto" value={filters.siteProjectId} onChange={(e) => update({ siteProjectId: e.target.value })}>
          <option value="">All sites</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Select className="input w-auto" value={filters.status} onChange={(e) => update({ status: e.target.value })}>
          <option value="">Active &amp; inactive</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </Select>
        <Select className="input w-auto" value={filters.sort} onChange={(e) => update({ sort: e.target.value })}>
          {SORTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
        </Select>
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-10"><Spinner /></div>
        ) : result.items.length === 0 ? (
          <div className="p-6"><EmptyState title="No one here yet" hint={can('workforce.create') ? 'Add labour and contractors to mark their attendance and track payments.' : undefined} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Site</th>
                  {showMoney && <th className="text-right">Wage</th>}
                  {showMoney && <th className="text-right">Pending dues</th>}
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {result.items.map((m) => (
                  <tr key={m.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60" onClick={() => setDrawer(m)}>
                    <td>
                      <p className="font-medium text-slate-800 dark:text-slate-100">{m.name}</p>
                      <p className="text-xs text-slate-400">{TYPE[m.workerType] || 'Labour'}{m.firmName ? ` · ${m.firmName}` : ''}{m.phone ? ` · ${m.phone}` : ''}</p>
                    </td>
                    <td><span className="badge" style={{ backgroundColor: `${colorFor(m.category)}22`, color: colorFor(m.category) }}>{m.category}</span></td>
                    <td className="text-slate-600 dark:text-slate-300">{m.siteName || '—'}</td>
                    {showMoney && <td className="whitespace-nowrap text-right tabular-nums">{m.rate ? `${formatMoney(m.rate, currency)}/${m.payType === 'daily' ? 'day' : 'mo'}` : <span className="text-slate-400">Not set</span>}</td>}
                    {showMoney && <td className={`text-right tabular-nums ${m.pendingDues > 0 ? 'font-semibold text-red-600' : 'text-slate-400'}`}>{m.pendingDues > 0 ? formatMoney(m.pendingDues, currency) : '—'}</td>}
                    <td><span className={`badge ${m.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{m.status === 'ACTIVE' ? 'Active' : 'Inactive'}</span></td>
                    <td className="whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                      {can('workforce.update') && <button className="btn-ghost btn-sm" onClick={() => openEdit(m)} title="Edit"><Icon name="edit" className="h-4 w-4" /></button>}
                      {can('workforce.delete') && <button className="btn-ghost btn-sm text-red-600 hover:bg-red-50" onClick={() => remove(m)} title="Delete"><Icon name="trash" className="h-4 w-4" /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Pagination meta={result.meta} onPage={(page) => update({ page })} />

      {drawer && <WorkerDrawer member={drawer} onClose={() => setDrawer(null)} onEdit={openEdit} onChanged={() => { load(); loadStats(); }} />}

      <Modal
        open={Boolean(modal)}
        onClose={() => setModal(null)}
        title={modal?.editingId ? 'Edit details' : `Add ${modal?.form.workerType === 'CONTRACTOR' ? 'contractor' : 'worker'}`}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-primary" form="wf-form" disabled={saving}>{saving ? <Spinner className="h-4 w-4" /> : 'Save'}</button>
          </>
        }
      >
        {modal && (
          <form id="wf-form" onSubmit={save} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Type</label>
              <div className="grid grid-cols-2 gap-2">
                {[['LABOUR', 'Labour', 'Daily / monthly wage worker'], ['CONTRACTOR', 'Contractor', 'Paid per job or contract']].map(([k, t, d]) => (
                  <button key={k} type="button" onClick={() => setField('workerType', k)} className={`rounded-lg border px-3 py-2 text-left ${modal.form.workerType === k ? 'border-brand-500 bg-brand-50 dark:bg-slate-700' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-600'}`}>
                    <span className="block text-sm font-medium">{t}</span><span className="block text-xs text-slate-500">{d}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Name <span className="text-red-500">*</span></label>
              <input className="input" placeholder="e.g., Ramesh Kumar" value={modal.form.name} onChange={(e) => setField('name', e.target.value)} required />
            </div>
            <div>
              <label className="label">{modal.form.workerType === 'CONTRACTOR' ? 'Trade' : 'Category'} <span className="text-red-500">*</span></label>
              <input className="input" list="wf-categories" placeholder="e.g., Mason, Electrician" value={modal.form.category} onChange={(e) => setField('category', e.target.value)} required />
              <datalist id="wf-categories">{categories.map((c) => <option key={c.name} value={c.name} />)}</datalist>
            </div>
            {modal.form.workerType === 'CONTRACTOR' && (
              <div className="sm:col-span-2">
                <label className="label">Firm / team name</label>
                <input className="input" placeholder="e.g., Sharma Electricals" value={modal.form.firmName} onChange={(e) => setField('firmName', e.target.value)} />
              </div>
            )}
            <div>
              <label className="label">Phone</label>
              <input className="input" placeholder="e.g., +91 98765 43210" value={modal.form.phone} onChange={(e) => setField('phone', e.target.value)} />
            </div>
            <div>
              <label className="label">Current site</label>
              <Select className="input" value={modal.form.siteProjectId} onChange={(e) => setField('siteProjectId', e.target.value)}>
                <option value="">Not assigned</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </div>
            <div>
              <label className="label">Joining date</label>
              <input type="date" className="input" value={modal.form.joiningDate} onChange={(e) => setField('joiningDate', e.target.value)} />
            </div>
            <div>
              <label className="label">Status</label>
              <Select className="input" value={modal.form.status} onChange={(e) => setField('status', e.target.value)}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Address</label>
              <input className="input" placeholder="e.g., Ward 4, Siwan" value={modal.form.address} onChange={(e) => setField('address', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Notes</label>
              <textarea className="input" rows={2} placeholder="Skills, ID proof, bank details…" value={modal.form.notes} onChange={(e) => setField('notes', e.target.value)} />
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
