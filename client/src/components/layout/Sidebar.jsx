import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { buildNav } from '../../app/modules';
import Icon from '../Icon';
import BrandLogo from '../BrandLogo';

export default function Sidebar({ onNavigate }) {
  const { bootstrap, user, logout, can } = useAuth();
  const enabledKeys = (bootstrap?.modules || []).map((m) => m.key);
  const groups = buildNav(enabledKeys, can);
  const company = bootstrap?.company;

  const initials = (user?.name || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <aside className="flex h-full w-64 flex-col border-r border-cream-300 bg-white">
      {/* Brand */}
      <div className="flex items-center gap-2 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white ring-1 ring-cream-300 dark:bg-slate-800 dark:ring-slate-700">
          <BrandLogo className="h-7 w-7" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-800">{company?.name || 'reyOne'}</p>
          <p className="text-xs text-slate-400">Construction Manager</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {groups.map((group) => (
          <div key={group.key} className="mb-4">
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group.label}</p>
            <div className="space-y-1">
              {group.items.map((m) => (
                <NavLink
                  key={m.key}
                  to={m.path}
                  end={m.path === '/' || m.path === '/projects/new'}
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
            </div>
          </div>
        ))}
      </nav>

      {/* Profile + logout (bottom-left) */}
      <div className="border-t border-cream-300 p-3">
        <div className="mb-2 flex items-center gap-3 rounded-lg bg-cream-100 px-3 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-800">{user?.name}</p>
            <p className="truncate text-xs text-slate-400">
              {user?.role?.name}
              {user?.license ? ` · ${user.license}` : ''}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-cream-200"
        >
          <Icon name="logout" className="h-5 w-5" />
          Log Out
        </button>
      </div>
    </aside>
  );
}
