import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { visibleModules } from '../../app/modules';
import Icon from '../Icon';

export default function Sidebar({ onNavigate }) {
  const { bootstrap, can } = useAuth();
  const enabledKeys = (bootstrap?.modules || []).map((m) => m.key);
  const items = visibleModules(enabledKeys, can);
  const company = bootstrap?.company;

  return (
    <aside className="flex h-full w-64 flex-col border-r border-cream-300 bg-white">
      <div className="flex items-center gap-2 border-b border-cream-300 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-white">
          <Icon name="building" className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-800">{company?.name || 'reyOne'}</p>
          <p className="text-xs text-slate-400">Construction Manager</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((m) => (
          <NavLink
            key={m.key}
            to={m.path}
            end={m.path === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-cream-200'
              }`
            }
          >
            <Icon name={m.icon} className="h-5 w-5" />
            {m.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
