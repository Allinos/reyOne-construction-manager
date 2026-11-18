import { useEffect, useMemo, useState } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { PageHeader, Spinner, Alert } from '../../components/ui';
import Icon from '../../components/Icon';
import { useAuth } from '../../context/AuthContext';
import { errorMessage } from '../../lib/api';
import { getAllSettings } from './api';
import CompanyPage from './CompanyPage';
import { HelpSettings, BackupCard } from './SystemPage';
import MobileAppPage from './MobileAppPage';
import RolesPage from '../roles/RolesPage';
import ActivityPage from '../activity/ActivityPage';
import ModuleManagerPage from '../modulemanager/ModuleManagerPage';
import { StringListEditor, ObjectListEditor, TextSettingEditor, ToggleGroupEditor, ChecklistTemplatesEditor } from './editors';

const colorList = (list) =>
  (list || []).map((c) => (typeof c === 'string' ? { name: c, color: '#cc6e02' } : { name: c.name || '', color: c.color || '#cc6e02' }));

// Grouped settings navigation. `perm` gates visibility; `module` hides a page
// when its module is switched off.
const NAV = [
  {
    label: 'General',
    items: [
      { path: '', label: 'Company profile', icon: 'building', perm: 'settings.read' },
      { path: 'mobile', label: 'Mobile app', icon: 'phone', perm: 'settings.read' },
      { path: 'modules', label: 'Modules', icon: 'modules', perm: 'modules.read' },
    ],
  },
  {
    label: 'Access & security',
    items: [
      { path: 'roles', label: 'Roles & permissions', icon: 'lock', perm: 'roles.read' },
      { path: 'activity', label: 'Activity log', icon: 'activity', perm: 'activity.read' },
    ],
  },
  {
    label: 'Module settings',
    items: [
      { path: 'projects', label: 'Projects', icon: 'projects', perm: 'settings.read', module: 'projects' },
      { path: 'finance', label: 'Finance & expenses', icon: 'finance', perm: 'settings.read', module: 'finance' },
      { path: 'people', label: 'People & workforce', icon: 'users', perm: 'settings.read' },
      { path: 'inspections', label: 'Site inspection', icon: 'inspection', perm: 'settings.read', module: 'inspections' },
      { path: 'queries', label: 'Queries', icon: 'queries', perm: 'settings.read', module: 'queries' },
      { path: 'photos', label: 'Photos & documents', icon: 'photo', perm: 'settings.read', module: 'photo_upload' },
      { path: 'custom-module', label: 'Custom module', icon: 'form', perm: 'settings.read', module: 'custom_module' },
    ],
  },
  {
    label: 'System',
    items: [
      { path: 'help', label: 'Help centre', icon: 'help', perm: 'settings.update' },
      { path: 'backup', label: 'Backup', icon: 'download', perm: 'settings.read' },
    ],
  },
];

function Section({ title, description, children }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>
      {children}
    </div>
  );
}

// Loads all settings once and renders a section with them.
function WithSettings({ render }) {
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { getAllSettings().then(setSettings).catch((e) => setError(errorMessage(e))); }, []);
  if (error) return <Alert>{error}</Alert>;
  if (!settings) return <div className="flex justify-center p-10"><Spinner /></div>;
  return render(settings);
}

const pages = {
  projects: (s) => {
    const p = s.projects || {};
    return (
      <Section title="Projects" description="Lists and options used when creating and tracking projects.">
        <ToggleGroupEditor
          title="Project page sections"
          description="Show or hide sections on every project's detail page."
          group="projects"
          settingKey="detail_sections"
          initial={p.detail_sections}
          options={[
            { key: 'approvals', label: 'Approvals & requests', hint: 'Stage sign-offs, budget and material approvals' },
            { key: 'timeline', label: 'Timeline (Gantt chart)', hint: 'Stage schedule on a calendar' },
          ]}
        />
        <div className="grid gap-4 xl:grid-cols-2">
          <StringListEditor title="Categories" description="e.g. Residential, Commercial" group="projects" settingKey="categories" initial={p.categories} />
          <StringListEditor title="Default stages" description="Added automatically to every new project" group="projects" settingKey="phase_templates" initial={p.phase_templates} />
          <StringListEditor title="Master task list" description="Quick-pick tasks when adding tasks to a stage" group="projects" settingKey="task_templates" initial={p.task_templates} />
          <TextSettingEditor title="Reference number prefix" group="projects" settingKey="reference_prefix" initial={p.reference_prefix || 'PRJ-'} hint="New projects are numbered PREFIX-0001, PREFIX-0002…" />
        </div>
        <ObjectListEditor title="Statuses" description="Key is stored internally — change only the label for existing statuses." group="projects" settingKey="statuses" initial={p.statuses} columns={[{ key: 'key', label: 'key' }, { key: 'label', label: 'Label' }]} />
      </Section>
    );
  },
  finance: (s) => {
    const f = s.finance || {};
    return (
      <Section title="Finance & expenses" description="Accounts, payment methods and expense categories.">
        <ObjectListEditor
          title="Accounts"
          description="Cash and bank accounts payments are received into and paid from."
          group="finance"
          settingKey="accounts"
          initial={f.accounts}
          columns={[{ key: 'key', label: 'key' }, { key: 'name', label: 'Name' }, { key: 'type', label: 'type (cash/bank)' }, { key: 'openingBalance', label: 'Opening balance' }]}
        />
        <div className="grid gap-4 xl:grid-cols-2">
          <StringListEditor title="Payment methods" group="finance" settingKey="payment_methods" initial={f.payment_methods} />
          <StringListEditor title="Project expense categories" group="finance" settingKey="project_expense_categories" initial={f.project_expense_categories} />
          <StringListEditor title="Company expense categories" group="finance" settingKey="company_expense_categories" initial={f.company_expense_categories} />
        </div>
      </Section>
    );
  },
  people: (s) => (
    <Section title="People & workforce" description="Designations for staff and categories for labour and contractors.">
      <div className="grid gap-4 xl:grid-cols-2">
        <StringListEditor title="Designations" description="Suggested job titles in User Management" group="users" settingKey="designations" initial={(s.users || {}).designations} />
        <ObjectListEditor title="Workforce categories" description="e.g. Mason, Helper, Electrician, Contractor" group="workforce" settingKey="categories" initial={colorList((s.workforce || {}).categories)} columns={[{ key: 'name', label: 'Category name' }, { key: 'color', label: 'Colour', type: 'color' }]} />
      </div>
    </Section>
  ),
  inspections: (s) => (
    <Section title="Site inspection" description="Checklist templates used when assigning inspections.">
      <ChecklistTemplatesEditor initial={(s.inspections || {}).checklists} />
    </Section>
  ),
  queries: (s) => (
    <Section title="Queries" description="Categories people choose when raising a query.">
      <StringListEditor title="Query categories" group="queries" settingKey="categories" initial={(s.queries || {}).categories} />
    </Section>
  ),
  photos: (s) => (
    <Section title="Photos & documents" description="Folders for project photos and uploaded documents.">
      <ObjectListEditor title="Categories" group="photos" settingKey="categories" initial={colorList((s.photos || {}).categories)} columns={[{ key: 'name', label: 'Category name' }, { key: 'color', label: 'Colour', type: 'color' }]} />
    </Section>
  ),
  'custom-module': (s) => (
    <Section title="Custom module" description="A configurable page for anything else you track.">
      <TextSettingEditor title="Module name" group="custom_module" settingKey="name" initial={(s.custom_module || {}).name || 'Custom Module'} placeholder="e.g., Inventory, Site Log, Assets" hint="Shown in the sidebar and on the page. Build its form with the Configure button on the page itself." />
    </Section>
  ),
};

export default function SettingsModule() {
  const { can, bootstrap } = useAuth();
  const location = useLocation();
  const enabled = useMemo(() => new Set((bootstrap?.modules || []).map((m) => m.key)), [bootstrap]);
  const nav = NAV.map((g) => ({ ...g, items: g.items.filter((i) => can(i.perm) && (!i.module || enabled.has(i.module))) })).filter((g) => g.items.length);

  return (
    <div>
      <PageHeader title="Settings" subtitle="Company, access, modules and configuration" />
      <div className="flex flex-col gap-6 md:flex-row">
        <nav className="shrink-0 md:w-56" aria-label="Settings sections">
          <div className="scroll-thin flex gap-4 overflow-x-auto md:sticky md:top-0 md:flex-col md:gap-3">
            {nav.map((g) => (
              <div key={g.label} className="flex shrink-0 gap-1 md:flex-col">
                <p className="hidden px-3 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 md:block">{g.label}</p>
                {g.items.map((i) => (
                  <NavLink
                    key={i.path}
                    to={i.path ? `/settings/${i.path}` : '/settings'}
                    end
                    className={({ isActive }) => `flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${isActive ? 'bg-white text-brand-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-brand-300 dark:ring-slate-700' : 'text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                  >
                    <Icon name={i.icon} className="h-4 w-4 shrink-0 opacity-70" />
                    {i.label}
                  </NavLink>
                ))}
              </div>
            ))}
          </div>
        </nav>
        <div className="min-w-0 flex-1" key={location.pathname}>
          <Routes>
            <Route index element={<Section title="Company profile" description="Name, contact details and branding used on documents and receipts."><CompanyPage /></Section>} />
            <Route path="mobile" element={<Section title="Mobile app" description="Activate the reyOne Site app and connect phones with a QR code."><MobileAppPage /></Section>} />
            <Route path="modules" element={<Section title="Modules"><ModuleManagerPage embedded /></Section>} />
            <Route path="roles" element={<RolesPage />} />
            <Route path="activity" element={<ActivityPage />} />
            <Route path="help" element={<Section title="Help centre" description="Content shown when people click the Help icon."><HelpSettings /></Section>} />
            <Route path="backup" element={<Section title="Backup" description="Download a copy of all company data."><BackupCard /></Section>} />
            {Object.entries(pages).map(([k, render]) => (
              <Route key={k} path={k} element={<WithSettings render={render} />} />
            ))}
            {/* Old URLs */}
            <Route path="configuration" element={<Navigate to="/settings/projects" replace />} />
            <Route path="system" element={<Navigate to="/settings/backup" replace />} />
            <Route path="*" element={<Navigate to="/settings" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
