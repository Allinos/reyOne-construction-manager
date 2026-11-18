import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { buildNav } from '../../app/modules';
import Icon from '../Icon';
import BrandLogo from '../BrandLogo';

const linkClass = ({ isActive }) =>
  `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-brand-500 font-semibold text-brand-900 shadow-sm' : 'text-brand-100/80 hover:bg-white/10 hover:text-white'
  }`;

function ThemeSwitch() {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-brand-100/80 hover:bg-white/10 hover:text-white"
      aria-label="Toggle dark mode"
    >
      <Icon name={dark ? 'sun' : 'moon'} className="h-5 w-5" />
      <span className="flex-1 text-left">{dark ? 'Light mode' : 'Dark mode'}</span>
      <span className={`relative h-5 w-9 rounded-full transition-colors ${dark ? 'bg-brand-500' : 'bg-white/25'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${dark ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

export default function Sidebar({ onNavigate }) {
  const { bootstrap, can } = useAuth();
  const enabledKeys = (bootstrap?.modules || []).map((m) => m.key);
  const labels = { custom_module: bootstrap?.settings?.custom_module?.name };
  const groups = buildNav(enabledKeys, can, labels);
  const company = bootstrap?.company;
  const main = groups.filter((g) => g.key !== 'bottom');
  const bottom = groups.find((g) => g.key === 'bottom')?.items || [];

  return (
    <aside className="flex h-full w-60 flex-col bg-brand-900 text-brand-100 dark:bg-[#251400]">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white">
          <BrandLogo className="h-7 w-7" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{company?.name || 'reyOne'}</p>
          <p className="text-[11px] text-brand-200/70">Construction Manager</p>
        </div>
      </div>

      <nav className="scroll-thin flex-1 overflow-y-auto px-3 pb-3">
        {main.map((group) => (
          <div key={group.key} className="mb-3">
            {group.label && <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-brand-300/70">{group.label}</p>}
            <div className="space-y-0.5">
              {group.items.map((m) => (
                <NavLink key={m.key} to={m.path} end={m.path === '/'} onClick={onNavigate} className={linkClass}>
                  <Icon name={m.icon} className="h-[18px] w-[18px]" />
                  <span className="truncate">{m.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-0.5 border-t border-white/15 p-3">
        {bottom.map((m) => (
          <NavLink key={m.key} to={m.path} onClick={onNavigate} className={linkClass}>
            <Icon name={m.icon} className="h-[18px] w-[18px]" />
            <span className="truncate">{m.label}</span>
          </NavLink>
        ))}
        <ThemeSwitch />
      </div>
    </aside>
  );
}
