import DashboardPage from '../modules/dashboard/DashboardPage';
import ProjectsModule from '../modules/projects/ProjectsModule';
import FinanceModule from '../modules/finance/FinanceModule';
import Placeholder from '../pages/Placeholder';

// Frontend module registry — mirrors the backend modules. Each entry declares
// its nav label, icon, route, and the permission required to see it. The
// sidebar renders an entry only when the backend reports its module enabled AND
// the user holds the permission, so the UI stays in lockstep with the config.
export const MODULE_DEFS = [
  { key: 'dashboard', label: 'Dashboard', path: '/', icon: 'dashboard', permission: 'dashboard.read', element: <DashboardPage /> },
  { key: 'projects', label: 'Projects', path: '/projects', icon: 'projects', permission: 'projects.read', element: <ProjectsModule /> },
  { key: 'finance', label: 'Finance', path: '/finance', icon: 'finance', permission: 'finance.read', element: <FinanceModule /> },
  { key: 'users', label: 'Users', path: '/users', icon: 'users', permission: 'users.read', element: <Placeholder title="Users" /> },
  { key: 'roles', label: 'Roles', path: '/roles', icon: 'roles', permission: 'roles.read', element: <Placeholder title="Roles & Permissions" /> },
  { key: 'activity', label: 'Activity', path: '/activity', icon: 'activity', permission: 'activity.read', element: <Placeholder title="Activity Logs" /> },
  { key: 'modules', label: 'Modules', path: '/modules', icon: 'modules', permission: 'modules.read', element: <Placeholder title="Module Manager" /> },
  { key: 'settings', label: 'Settings', path: '/settings', icon: 'settings', permission: 'settings.read', element: <Placeholder title="Settings" /> },
];

// The nav items visible to this user given enabled modules + permissions.
export function visibleModules(enabledKeys, can) {
  const enabled = new Set(enabledKeys);
  return MODULE_DEFS.filter((m) => enabled.has(m.key) && (!m.permission || can(m.permission)));
}
