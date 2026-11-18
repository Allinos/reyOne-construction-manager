import { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { errorMessage } from '../../lib/api';
import { Tabs, PageHeader, Card, Spinner, EmptyState, Alert } from '../../components/ui';
import { getDay, saveDay, getSummary, listProjectsLite } from './api';
import Select from '../../components/Select';
import { localDate, localMonth } from '../../lib/format';

const today = () => localDate();
const shiftDay = (iso, n) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return localDate(d);
};
const thisMonth = () => localMonth();

export const STATUS_OPTS = [
  { key: 'present', short: 'P', label: 'Present', cls: 'bg-green-600 text-white', idle: 'text-green-700' },
  { key: 'half_day', short: 'H', label: 'Half day', cls: 'bg-amber-500 text-white', idle: 'text-amber-600' },
  { key: 'absent', short: 'A', label: 'Absent', cls: 'bg-red-600 text-white', idle: 'text-red-600' },
  { key: 'leave', short: 'L', label: 'Leave', cls: 'bg-sky-600 text-white', idle: 'text-sky-700' },
];

export { Tabs } from '../../components/ui';

function DailySheet() {
  const { can } = useAuth();
  const toast = useToast();
  const canMark = can('attendance.mark');
  const [date, setDate] = useState(today());
  const [type, setType] = useState('');
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [edits, setEdits] = useState({}); // key -> { status, checkIn, checkOut, notes }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { listProjectsLite().then(setProjects); }, []);

  const load = useCallback(async () => {
    setData(null);
    setEdits({});
    setError('');
    try {
      setData(await getDay({ date, ...(type ? { type } : {}) }));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [date, type]);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.rows
      .map((r) => ({ ...r, ...(edits[r.key] || {}) }))
      .filter((r) => !q || r.name.toLowerCase().includes(q) || (r.detail || '').toLowerCase().includes(q));
  }, [data, edits, search]);

  const patch = (key, p) => setEdits((e) => {
    const base = data?.rows.find((r) => r.key === key);
    const next = { ...(e[key] || {}), ...p };
    // Entering a check-in/out time for someone not yet marked means they came in.
    const status = next.status ?? base?.status;
    if (!status && (p.checkIn || p.checkOut)) next.status = 'present';
    return { ...e, [key]: next };
  });
  // Bulk-mark only the people still unmarked (doesn't overwrite marked ones).
  const markAll = (status) => {
    const next = { ...edits };
    for (const r of rows) if (!r.status) next[r.key] = { ...(next[r.key] || {}), status };
    setEdits(next);
  };

  const dirtyCount = Object.keys(edits).length;
  const counts = useMemo(() => {
    const c = { present: 0, half_day: 0, absent: 0, leave: 0, unmarked: 0 };
    for (const r of data?.rows || []) {
      const s = edits[r.key]?.status ?? r.status;
      if (s) c[s] += 1; else c.unmarked += 1;
    }
    return c;
  }, [data, edits]);

  const save = async () => {
    const byKey = new Map((data?.rows || []).map((r) => [r.key, r]));
    const entries = Object.entries(edits).map(([key, e]) => {
      const base = byKey.get(key);
      return {
        personType: base.personType,
        personId: base.personId,
        status: e.status ?? base.status ?? '',
        checkIn: e.checkIn ?? base.checkIn ?? null,
        checkOut: e.checkOut ?? base.checkOut ?? null,
        notes: e.notes ?? base.notes ?? null,
      };
    });
    setSaving(true);
    try {
      const res = await saveDay({ date, ...(projectId ? { projectId: Number(projectId) } : {}), entries });
      toast.success(`Attendance saved (${res.saved} marked${res.cleared ? `, ${res.cleared} cleared` : ''})`);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card className="mb-4 !p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Date</label>
            <div className="flex items-center gap-1">
              <button type="button" className="btn-secondary px-2" onClick={() => setDate(shiftDay(date, -1))} aria-label="Previous day">‹</button>
              <input type="date" className="input w-auto" value={date} max={today()} onChange={(e) => e.target.value && setDate(e.target.value)} />
              <button type="button" className="btn-secondary px-2" onClick={() => setDate(shiftDay(date, 1))} disabled={date >= today()} aria-label="Next day">›</button>
            </div>
          </div>
          <div>
            <label className="label">People</label>
            <Select className="input w-auto" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All</option>
              <option value="USER">Employees</option>
              <option value="WORKFORCE">Workforce / Labour</option>
            </Select>
          </div>
          <div>
            <label className="label">Site (saved with marks)</label>
            <Select className="input w-auto max-w-[14rem]" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">— None —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>
          <input className="input min-w-[160px] flex-1" placeholder="Search name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {STATUS_OPTS.map((s) => (
            <span key={s.key} className={`rounded-full px-2 py-0.5 font-medium ${s.cls}`}>{s.label}: {counts[s.key]}</span>
          ))}
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">Unmarked: {counts.unmarked}</span>
          {data?.counts?.late > 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800">Late: {data.counts.late}</span>}
          {data?.weeklyOff && <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">Weekly off</span>}
          {canMark && (
            <span className="ml-auto flex gap-2">
              <button className="btn-secondary btn-sm" onClick={() => markAll('present')} title="Marks everyone not yet marked">Mark unmarked present</button>
            </span>
          )}
        </div>
      </Card>

      {error && <Alert>{error}</Alert>}

      <Card className="!p-0 overflow-hidden">
        {!data ? (
          <div className="flex justify-center p-10"><Spinner /></div>
        ) : rows.length === 0 ? (
          <div className="p-6"><EmptyState title="No people found" hint="Add employees in User Manager or labour in Workforce." /></div>
        ) : (
          <ul className="divide-y divide-cream-200 dark:divide-slate-700">
            {rows.map((r) => (
              <li key={r.key} className={`flex flex-wrap items-center gap-3 px-4 py-2 ${edits[r.key] ? 'bg-amber-50/70 dark:bg-slate-800' : ''}`}>
                <div className="min-w-[10rem] flex-1">
                  <p className="font-medium text-slate-800 dark:text-slate-100">{r.name}{r.late && <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">Late</span>}</p>
                  <p className="text-xs text-slate-400">{r.group}{r.detail ? ` · ${r.detail}` : ''}{r.projectName ? ` · ${r.projectName}` : ''}</p>
                </div>
                <div className="flex gap-1">
                  {STATUS_OPTS.map((s) => (
                    <button
                      key={s.key}
                      disabled={!canMark}
                      title={s.label}
                      onClick={() => patch(r.key, { status: r.status === s.key ? '' : s.key })}
                      className={`h-9 w-9 rounded-lg border text-sm font-bold transition ${
                        r.status === s.key ? `${s.cls} border-transparent` : `border-slate-200 bg-white ${s.idle} hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800`
                      }`}
                    >
                      {s.short}
                    </button>
                  ))}
                </div>
                <div className="hidden items-center gap-1 sm:flex">
                  <input type="time" className="input w-[7.5rem] py-1 text-xs" value={r.checkIn || ''} disabled={!canMark} onChange={(e) => patch(r.key, { checkIn: e.target.value })} title="In" aria-label="Check-in time" />
                  <span className="text-xs text-slate-400">–</span>
                  <input type="time" className="input w-[7.5rem] py-1 text-xs" value={r.checkOut || ''} disabled={!canMark} onChange={(e) => patch(r.key, { checkOut: e.target.value })} title="Out" aria-label="Check-out time" />
                  <input className="input w-40 py-1 text-xs" placeholder="Note" value={r.notes || ''} disabled={!canMark} onChange={(e) => patch(r.key, { notes: e.target.value })} aria-label="Note" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {canMark && dirtyCount > 0 && (
        <div className="sticky bottom-4 mt-4 flex justify-end">
          <div className="flex items-center gap-3 rounded-xl border border-cream-300 bg-white px-4 py-2 shadow-lg dark:border-slate-700 dark:bg-slate-800">
            <span className="text-sm text-slate-600 dark:text-slate-300">{dirtyCount} unsaved change{dirtyCount > 1 ? 's' : ''}</span>
            <button className="btn-secondary" onClick={() => setEdits({})} disabled={saving}>Discard</button>
            <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Attendance'}</button>
          </div>
        </div>
      )}
    </>
  );
}

function MonthlySummary() {
  const [month, setMonth] = useState(thisMonth());
  const [type, setType] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    getSummary({ month, ...(type ? { type } : {}) }).then(setData).catch((err) => setError(errorMessage(err)));
  }, [month, type]);

  return (
    <>
      <Card className="mb-4">
        <div className="flex flex-wrap gap-3">
          <input type="month" className="input w-auto" value={month} onChange={(e) => setMonth(e.target.value)} />
          <Select className="input w-auto" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All</option>
            <option value="USER">Employees</option>
            <option value="WORKFORCE">Workforce / Labour</option>
          </Select>
        </div>
      </Card>
      {error && <Alert>{error}</Alert>}
      {data?.workingDays != null && <p className="mb-2 text-xs text-slate-500">{data.workingDays} working day(s) so far this month · weekly off: {(data.rules?.weeklyOff || []).join(', ') || 'none'}</p>}
      <Card className="!p-0 overflow-hidden">
        {!data ? (
          <div className="flex justify-center p-10"><Spinner /></div>
        ) : data.rows.length === 0 ? (
          <div className="p-6"><EmptyState title="No records" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream-100 text-left text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-3 py-3 text-center font-medium text-green-700">Present</th>
                  <th className="px-3 py-3 text-center font-medium text-amber-600">Half</th>
                  <th className="px-3 py-3 text-center font-medium text-red-600">Absent</th>
                  <th className="px-3 py-3 text-center font-medium text-sky-700">Leave</th>
                  <th className="px-3 py-3 text-center font-medium text-amber-700">Late</th>
                  <th className="px-3 py-3 text-center font-medium">Days Worked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200 dark:divide-slate-700">
                {data.rows.map((r) => (
                  <tr key={r.key}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-800 dark:text-slate-100">{r.name}{r.late && <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">Late</span>}</p>
                      <p className="text-xs text-slate-400">{r.group}{r.detail ? ` · ${r.detail}` : ''}</p>
                    </td>
                    <td className="px-3 py-2.5 text-center">{r.present}</td>
                    <td className="px-3 py-2.5 text-center">{r.half_day}</td>
                    <td className="px-3 py-2.5 text-center">{r.absent}</td>
                    <td className="px-3 py-2.5 text-center">{r.leave}</td>
                    <td className="px-3 py-2.5 text-center">{r.late || 0}</td>
                    <td className="px-3 py-2.5 text-center font-semibold text-slate-900 dark:text-white">{r.daysWorked}{data.workingDays ? <span className="font-normal text-slate-400"> / {data.workingDays}</span> : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

export default function AttendancePage() {
  const [tab, setTab] = useState('daily');
  return (
    <div>
      <PageHeader title="Attendance" subtitle="Daily attendance for employees and site labour" />
      <Tabs tabs={[{ key: 'daily', label: 'Daily Sheet' }, { key: 'summary', label: 'Monthly Summary' }]} value={tab} onChange={setTab} />
      {tab === 'daily' ? <DailySheet /> : <MonthlySummary />}
    </div>
  );
}
