import { useEffect, useState } from 'react';
import { Card, Spinner, Alert } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { useAuth } from '../../context/AuthContext';
import { errorMessage } from '../../lib/api';
import api, { unwrap } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { updateSetting } from './api';
import { Switch } from './editors';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function AttendanceSettings({ settings }) {
  const toast = useToast();
  const { reloadBootstrap } = useAuth();
  const [f, setF] = useState({
    work_start: settings.work_start || '09:30',
    grace_minutes: settings.grace_minutes ?? 15,
    weekly_off: Array.isArray(settings.weekly_off) ? settings.weekly_off : ['Sunday'],
    self_checkin: !!settings.self_checkin,
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await Promise.all([
        updateSetting('attendance', 'work_start', f.work_start),
        updateSetting('attendance', 'grace_minutes', Number(f.grace_minutes) || 0),
        updateSetting('attendance', 'weekly_off', f.weekly_off),
        updateSetting('attendance', 'self_checkin', f.self_checkin),
      ]);
      await reloadBootstrap();
      toast.success('Attendance settings saved');
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };
  const toggleDay = (d) => setF((x) => ({ ...x, weekly_off: x.weekly_off.includes(d) ? x.weekly_off.filter((y) => y !== d) : [...x.weekly_off, d] }));
  return (
    <Card className="max-w-3xl space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Work starts at</label>
          <input type="time" className="input" value={f.work_start} onChange={(e) => setF({ ...f, work_start: e.target.value })} />
        </div>
        <div>
          <label className="label">Grace period (minutes)</label>
          <input type="number" min="0" max="240" className="input" value={f.grace_minutes} onChange={(e) => setF({ ...f, grace_minutes: e.target.value })} />
          <p className="mt-1 text-[11px] text-slate-400">Check-ins after start + grace are marked <b>Late</b>.</p>
        </div>
      </div>
      <div>
        <label className="label">Weekly off</label>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d) => (
            <button key={d} type="button" onClick={() => toggleDay(d)} className={`rounded-full px-3 py-1 text-xs font-medium ${f.weekly_off.includes(d) ? 'bg-brand-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600'}`}>{d.slice(0, 3)}</button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-slate-400">Used for working-day counts in the monthly summary.</p>
      </div>
      <div className="flex items-start justify-between gap-4 border-t border-slate-100 pt-4 dark:border-slate-700">
        <div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Employee self check-in</p>
          <p className="text-xs text-slate-500">Employees can check in / out themselves from the web or the reyOne Site app. Site labour is still marked by the site incharge.</p>
        </div>
        <Switch checked={f.self_checkin} onChange={(v) => setF({ ...f, self_checkin: v })} label="Employee self check-in" />
      </div>
      <div className="flex justify-end"><button className="btn-primary" disabled={saving} onClick={save}>{saving ? <Spinner className="h-4 w-4" /> : 'Save'}</button></div>
    </Card>
  );
}

export function SecuritySettings({ settings }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [f, setF] = useState({ password_min_length: settings.password_min_length ?? 8, password_require_number: !!settings.password_require_number });
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState('');
  const loadSessions = () => unwrap(api.get('/settings/security/sessions')).then(setSessions).catch((e) => setError(errorMessage(e)));
  useEffect(() => { loadSessions(); }, []);
  const save = async () => {
    try {
      await updateSetting('security', 'password_min_length', Math.max(8, Number(f.password_min_length) || 8));
      await updateSetting('security', 'password_require_number', f.password_require_number);
      toast.success('Password policy saved');
    } catch (e) { toast.error(errorMessage(e)); }
  };
  const signOutAll = async () => {
    if (!(await confirm({ title: 'Sign out everyone?', message: 'All other users (web and mobile) will have to sign in again. You stay signed in.', confirmLabel: 'Sign out everyone' }))) return;
    try {
      const r = await unwrap(api.post('/settings/security/sign-out-all'));
      toast.success(`${r.revoked} session(s) ended`);
      loadSessions();
    } catch (e) { toast.error(errorMessage(e)); }
  };
  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">Password policy</h3>
        <p className="mt-0.5 text-xs text-slate-500">Applies to new users, password resets and password changes.</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div><label className="label">Minimum length</label><input type="number" min="8" max="64" className="input" value={f.password_min_length} onChange={(e) => setF({ ...f, password_min_length: e.target.value })} /></div>
          <div className="flex items-end justify-between gap-3 pb-2">
            <span className="text-sm text-slate-700 dark:text-slate-200">Require letters and numbers</span>
            <Switch checked={f.password_require_number} onChange={(v) => setF({ ...f, password_require_number: v })} label="Require letters and numbers" />
          </div>
        </div>
        <div className="mt-3 flex justify-end"><button className="btn-primary" onClick={save}>Save policy</button></div>
      </Card>
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Signed-in sessions</h3>
            <p className="mt-0.5 text-xs text-slate-500">Each browser or phone counts as a session. Deactivating a user or turning off their mobile access ends their sessions.</p>
          </div>
          <button className="btn-danger btn-sm" onClick={signOutAll}>Sign out everyone</button>
        </div>
        {error && <div className="mt-3"><Alert>{error}</Alert></div>}
        {!sessions ? <div className="flex justify-center p-6"><Spinner /></div> : (
          <table className="table-base mt-3">
            <thead><tr><th>User</th><th>Role</th><th className="text-right">Sessions</th><th>Last sign-in</th></tr></thead>
            <tbody>
              {sessions.map((s) => <tr key={s.userId}><td>{s.name}<span className="block text-xs text-slate-400">{s.email}</span></td><td>{s.role}</td><td className="text-right">{s.sessions}</td><td className="text-slate-500">{s.lastLoginAt ? formatDateTime(s.lastLoginAt) : '—'}</td></tr>)}
              {sessions.length === 0 && <tr><td colSpan={4} className="text-slate-400">No active sessions.</td></tr>}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
