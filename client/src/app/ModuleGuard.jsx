import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/Icon';

// Renders a module page only when the module is enabled for this company and
// the signed-in user holds its permission; otherwise a clear "no access" view
// instead of a half-loaded page full of failed requests.
export default function ModuleGuard({ def, children }) {
  const { bootstrap, can } = useAuth();
  const enabled = (bootstrap?.modules || []).some((m) => m.key === (def.moduleKey || def.key));
  const allowed = !def.permission || can(def.permission);
  if (enabled && allowed) return children;
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700">
        <Icon name="lock" className="h-6 w-6" />
      </div>
      <h1 className="text-lg font-semibold text-slate-900 dark:text-white">{enabled ? "You don't have access to this page" : 'This module is turned off'}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {enabled
          ? `Your role doesn't include ${def.label}. Ask an administrator if you need it.`
          : `${def.label} isn't enabled for this company. An administrator can turn it on in Settings → Modules.`}
      </p>
      <Link to="/" className="btn-primary mt-5">Go to dashboard</Link>
    </div>
  );
}
