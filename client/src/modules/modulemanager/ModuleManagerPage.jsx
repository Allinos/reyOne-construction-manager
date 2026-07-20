import { useEffect, useState } from 'react';
import { listModules, toggleModule } from './api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { errorMessage } from '../../lib/api';
import { PageHeader, Card, Spinner, Alert } from '../../components/ui';

function Toggle({ checked, disabled, onChange }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors ${
        checked ? 'bg-brand-500' : 'bg-slate-300'
      } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

export default function ModuleManagerPage() {
  const { can, reloadBootstrap } = useAuth();
  const toast = useToast();
  const canManage = can('modules.update');
  const [modules, setModules] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = () => listModules().then(setModules).catch((err) => setError(errorMessage(err)));
  useEffect(() => {
    load();
  }, []);

  const onToggle = async (mod, enabled) => {
    setError('');
    setNotice('');
    try {
      const res = await toggleModule(mod.key, enabled);
      await load();
      await reloadBootstrap(); // reflect nav changes immediately
      toast.success(`${mod.name} ${enabled ? 'enabled' : 'disabled'}`);
      if (res.requiresRestart) {
        setNotice('Saved. Restart the server (pm2 restart) for API routes to fully apply.');
      }
    } catch (err) {
      setError(errorMessage(err));
      toast.error(errorMessage(err));
    }
  };

  if (error && !modules) return <Alert>{error}</Alert>;
  if (!modules) return <div className="flex justify-center p-10"><Spinner /></div>;

  return (
    <div>
      <PageHeader title="Module Manager" subtitle="Enable or disable features for this client" />
      {error && <Alert>{error}</Alert>}
      {notice && <Alert type="info">{notice}</Alert>}

      <Card className="!p-0 overflow-hidden">
        <ul className="divide-y divide-cream-200">
          {modules.map((m) => (
            <li key={m.key} className="flex items-center justify-between px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800">{m.name}</span>
                  {m.isCore && <span className="badge bg-cream-200 text-slate-500">core</span>}
                  {!m.hasCode && <span className="badge bg-amber-100 text-amber-700">coming soon</span>}
                </div>
                <p className="text-sm text-slate-500">{m.description}</p>
                {m.dependsOn?.length > 0 && (
                  <p className="mt-0.5 text-xs text-slate-400">Depends on: {m.dependsOn.join(', ')}</p>
                )}
              </div>
              <Toggle
                checked={m.enabled}
                disabled={!canManage || m.isCore || !m.hasCode}
                onChange={(v) => onToggle(m, v)}
              />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
