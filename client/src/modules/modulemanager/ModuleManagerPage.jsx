import { useEffect, useState } from 'react';
import { listModules, toggleModule } from './api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { errorMessage } from '../../lib/api';
import { Spinner, Alert } from '../../components/ui';
import { Switch } from '../settings/editors';

// Which group each toggleable module is listed under.
const GROUPS = [
  { key: 'core', label: 'Main', keys: ['dashboard', 'projects', 'clients', 'documents'] },
  { key: 'site', label: 'Site operations', keys: ['attendance', 'materials', 'inspections', 'queries'] },
  { key: 'finance', label: 'Finance & people', keys: ['finance', 'vendors', 'payroll', 'workforce'] },
  { key: 'project_extras', label: 'Project workspace', keys: ['requirements', 'req_text', 'req_forms', 'req_table', 'photo_upload'] },
  { key: 'other', label: 'Other', keys: ['custom_module', 'mobile_app'] },
];
const HIDDEN = new Set(['invoices']); // retired

export default function ModuleManagerPage({ embedded = false }) {
  const { can, reloadBootstrap } = useAuth();
  const toast = useToast();
  const canManage = can('modules.update');
  const [modules, setModules] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = () => listModules().then(setModules).catch((err) => setError(errorMessage(err)));
  useEffect(() => { load(); }, []);

  const onToggle = async (mod, enabled) => {
    setBusy(mod.key);
    try {
      const res = await toggleModule(mod.key, enabled);
      await load();
      await reloadBootstrap();
      toast.success(`${mod.name} ${enabled ? 'enabled' : 'disabled'}${res.requiresRestart ? ' — restart the server to apply API changes' : ''}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy('');
    }
  };

  if (error && !modules) return <Alert>{error}</Alert>;
  if (!modules) return <div className="flex justify-center p-10"><Spinner /></div>;

  const byKey = Object.fromEntries(modules.map((m) => [m.key, m]));
  const listed = new Set(GROUPS.flatMap((g) => g.keys));
  const extras = modules.filter((m) => !m.isCore && !listed.has(m.key) && !HIDDEN.has(m.key));
  const groups = GROUPS.map((g) => ({ ...g, items: g.keys.map((k) => byKey[k]).filter(Boolean) }));
  if (extras.length) groups[groups.length - 1].items.push(...extras);
  const core = modules.filter((m) => m.isCore);

  return (
    <div className="space-y-4">
      {!embedded && <h2 className="text-lg font-semibold">Modules</h2>}
      <p className="text-sm text-slate-500">Turn features on or off for this company. Disabled modules disappear from the menu, the mobile app and the API.</p>
      {groups.filter((g) => g.items.length).map((g) => (
        <section key={g.key} className="card">
          <div className="section-head"><span className="section-title">{g.label}</span></div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {g.items.map((m) => (
              <li key={m.key} className={`flex items-center justify-between gap-4 px-4 py-2.5 ${m.dependsOn?.includes('requirements') ? 'pl-8' : ''}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{m.name}</span>
                    {!m.hasCode && <span className="badge bg-amber-50 text-amber-700">coming soon</span>}
                  </div>
                  <p className="truncate text-xs text-slate-500">{m.description}</p>
                </div>
                <Switch
                  label={m.name}
                  checked={m.enabled}
                  disabled={!canManage || !m.hasCode || busy === m.key}
                  onChange={(v) => onToggle(m, v)}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-xs text-slate-400">Always on: {core.map((m) => m.name).join(', ')}.</p>
    </div>
  );
}
