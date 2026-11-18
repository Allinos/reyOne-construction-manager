import DashboardPage from '../modules/dashboard/DashboardPage';
import ProjectsModule from '../modules/projects/ProjectsModule';
import FinanceModule from '../modules/finance/FinanceModule';
import ExpensesPage from '../modules/finance/ExpensesPage';
import UsersPage from '../modules/users/UsersPage';
import RolesPage from '../modules/roles/RolesPage';
import SettingsModule from '../modules/settings/SettingsModule';
import ModuleManagerPage from '../modules/modulemanager/ModuleManagerPage';
import ActivityPage from '../modules/activity/ActivityPage';
import DocumentsModule from '../modules/documents/DocumentsModule';
import VendorsModule from '../modules/vendors/VendorsModule';
import ClientsModule from '../modules/clients/ClientsModule';
import WorkforcePage from '../modules/workforce/WorkforcePage';
import CustomModulePage from '../modules/custom_module/CustomModulePage';
import AttendancePage from '../modules/attendance/AttendancePage';
import PayrollPage from '../modules/payroll/PayrollPage';
import MaterialsPage from '../modules/materials/MaterialsPage';
import InspectionsModule from '../modules/inspections/InspectionsModule';
import QueriesPage from '../modules/queries/QueriesPage';

// Frontend module registry — mirrors the backend modules. `section` groups the
// item in the sidebar; `hidden` keeps a routed module out of the nav (used for
// admin screens that live inside Settings). The sidebar shows an item only when
// the backend reports its module enabled AND the user holds the permission.
export const MODULE_DEFS = [
  { key: 'dashboard', section: 'main', label: 'Dashboard', path: '/', icon: 'dashboard', permission: 'dashboard.read', element: <DashboardPage /> },
  { key: 'projects', section: 'main', label: 'Projects', path: '/projects', icon: 'projects', permission: 'projects.read', element: <ProjectsModule /> },
  { key: 'clients', section: 'main', label: 'Clients', path: '/clients', icon: 'clients', permission: 'clients.read', element: <ClientsModule /> },
  { key: 'documents', section: 'main', label: 'Documents', path: '/documents', icon: 'documents', permission: 'documents.read', element: <DocumentsModule /> },
  { key: 'attendance', section: 'operations', label: 'Attendance', path: '/attendance', icon: 'attendance', permission: 'attendance.read', element: <AttendancePage /> },
  { key: 'materials', section: 'operations', label: 'Materials', path: '/materials', icon: 'materials', permission: 'materials.read', element: <MaterialsPage /> },
  { key: 'inspections', section: 'operations', label: 'Site Inspection', path: '/inspections', icon: 'inspection', element: <InspectionsModule /> },
  { key: 'queries', section: 'operations', label: 'Queries', path: '/queries', icon: 'queries', permission: 'queries.read', element: <QueriesPage /> },
  { key: 'finance', section: 'finance', label: 'Finance', path: '/finance', icon: 'finance', permission: 'finance.read', element: <FinanceModule /> },
  { key: 'expenses', section: 'finance', label: 'Expenses', path: '/expenses', icon: 'expenses', permission: 'finance.read', element: <ExpensesPage />, moduleKey: 'finance' },
  { key: 'vendors', section: 'finance', label: 'Vendors', path: '/vendors', icon: 'vendors', permission: 'vendors.read', element: <VendorsModule /> },
  { key: 'payroll', section: 'finance', label: 'Salary & Payroll', path: '/payroll', icon: 'payroll', permission: 'payroll.read', element: <PayrollPage /> },
  { key: 'workforce', section: 'finance', label: 'Workforce', path: '/workforce', icon: 'workforce', permission: 'workforce.read', element: <WorkforcePage /> },
  { key: 'custom_module', section: 'finance', label: 'Custom Module', path: '/custom-module', icon: 'modules', permission: 'custom_module.read', element: <CustomModulePage /> },
  { key: 'users', section: 'profile', label: 'User Manager', path: '/users', icon: 'users', permission: 'users.read', element: <UsersPage /> },
  { key: 'settings', section: 'profile', label: 'Settings', path: '/settings', icon: 'settings', permission: 'settings.read', element: <SettingsModule /> },

  // Admin screens — routed but hidden from the sidebar (reachable via Settings).
  { key: 'roles', section: null, hidden: true, label: 'Roles', path: '/roles', icon: 'roles', permission: 'roles.read', element: <RolesPage /> },
  { key: 'activity', section: null, hidden: true, label: 'Activity', path: '/activity', icon: 'activity', permission: 'activity.read', element: <ActivityPage /> },
  { key: 'modules', section: null, hidden: true, label: 'Modules', path: '/modules', icon: 'modules', permission: 'modules.read', element: <ModuleManagerPage /> },
];

// Nav-only links (not routed modules of their own).
const EXTRA_NAV = [
  { key: 'add-project', section: 'main', label: 'Add Project', path: '/projects/new', icon: 'add', permission: 'projects.create', moduleKey: 'projects' },
];

export const SECTIONS = [
  { key: 'main', label: 'Dashboard' },
  { key: 'operations', label: 'Site Operations' },
  { key: 'finance', label: 'Finance' },
  { key: 'profile', label: 'Profile' },
];

// Builds the grouped, filtered nav for the sidebar. `labels` optionally overrides
// a module's display label by key (used for the configurable Custom Module name).
export function buildNav(enabledKeys, can, labels = {}) {
  const enabled = new Set(enabledKeys);
  const navItems = [
    ...MODULE_DEFS.filter((m) => !m.hidden && m.section).map((m) => ({ ...m, moduleKey: m.moduleKey || m.key, label: labels[m.key] || m.label })),
    ...EXTRA_NAV,
  ].filter((m) => enabled.has(m.moduleKey) && (!m.permission || can(m.permission)));

  return SECTIONS.map((s) => ({
    ...s,
    items: navItems.filter((i) => i.section === s.key),
  })).filter((s) => s.items.length > 0);
}
