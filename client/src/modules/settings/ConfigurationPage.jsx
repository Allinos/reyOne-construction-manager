import { useEffect, useMemo, useState } from 'react';
import { getAllSettings } from './api';
import { StringListEditor, ObjectListEditor } from './editors';
import { Spinner, Alert } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import RolesPage from '../roles/RolesPage';
import ActivityPage from '../activity/ActivityPage';
import ModuleManagerPage from '../modulemanager/ModuleManagerPage';

// Left-nav sections inside Configuration. Each shows only its own settings.
const SECTIONS = [
  { key: 'projects', label: 'Projects', perm: 'settings.read' },
  { key: 'finance', label: 'Finance', perm: 'settings.read' },
  { key: 'expenses', label: 'Expense Categories', perm: 'settings.read' },
  { key: 'workforce', label: 'Workforce', perm: 'settings.read' },
  { key: 'roles', label: 'Roles', perm: 'roles.read' },
  { key: 'activities', label: 'Activities', perm: 'activity.read' },
  { key: 'modules', label: 'Modules', perm: 'modules.read' },
  { key: 'other', label: 'Other Settings', perm: 'settings.read' },
];

// Categories may be stored as legacy strings or as { name, color } objects.
// Normalise to objects so the editor always has both fields.
const normalizeCategories = (list) =>
  (list || []).map((c) => (typeof c === 'string' ? { name: c, color: '#f97316' } : { name: c.name || '', color: c.color || '#f97316' }));

export default function ConfigurationPage() {
  const { can } = useAuth();
  const available = useMemo(() => SECTIONS.filter((s) => can(s.perm)), [can]);
  const [active, setActive] = useState(available[0]?.key || 'projects');
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getAllSettings().then(setSettings).catch((err) => setError(errorMessage(err)));
  }, []);

  const renderSection = () => {
    // Embedded admin screens manage their own data.
    if (active === 'roles') return <RolesPage />;
    if (active === 'activities') return <ActivityPage />;
    if (active === 'modules') return <ModuleManagerPage />;

    if (!settings) return <div className="flex justify-center p-10"><Spinner /></div>;
    const p = settings.projects || {};
    const f = settings.finance || {};
    const u = settings.users || {};
    const w = settings.workforce || {};

    switch (active) {
      case 'projects':
        return (
          <div className="space-y-4">
            <StringListEditor title="Project Categories" group="projects" settingKey="categories" initial={p.categories} />
            <StringListEditor title="Project Phases" group="projects" settingKey="phase_templates" initial={p.phase_templates} />
            <StringListEditor title="Task Management (master tasks)" group="projects" settingKey="task_templates" initial={p.task_templates} />
            <ObjectListEditor
              title="Project Statuses"
              group="projects"
              settingKey="statuses"
              initial={p.statuses}
              columns={[{ key: 'key', label: 'key' }, { key: 'label', label: 'Label' }]}
            />
          </div>
        );
      case 'finance':
        return (
          <div className="space-y-4">
            <StringListEditor title="Payment Methods" group="finance" settingKey="payment_methods" initial={f.payment_methods} />
            <ObjectListEditor
              title="Accounts"
              group="finance"
              settingKey="accounts"
              initial={f.accounts}
              columns={[
                { key: 'key', label: 'key' },
                { key: 'name', label: 'Name' },
                { key: 'type', label: 'type (cash/bank/…)' },
                { key: 'openingBalance', label: 'Opening balance' },
              ]}
            />
          </div>
        );
      case 'expenses':
        return (
          <div className="space-y-4">
            <StringListEditor title="Project Expense Categories" group="finance" settingKey="project_expense_categories" initial={f.project_expense_categories} />
            <StringListEditor title="Company Expense Categories" group="finance" settingKey="company_expense_categories" initial={f.company_expense_categories} />
          </div>
        );
      case 'workforce':
        return (
          <ObjectListEditor
            title="Workforce Categories"
            group="workforce"
            settingKey="categories"
            initial={normalizeCategories(w.categories)}
            columns={[
              { key: 'name', label: 'Category name' },
              { key: 'color', label: 'Colour', type: 'color' },
            ]}
          />
        );
      case 'other':
        return <StringListEditor title="Designations" group="users" settingKey="designations" initial={u.designations} />;
      default:
        return null;
    }
  };

  if (error) return <Alert>{error}</Alert>;

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <nav className="shrink-0 md:w-52">
        <div className="flex gap-1 overflow-x-auto md:flex-col">
          {available.map((s) => (
            <button
              key={s.key}
              onClick={() => setActive(s.key)}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                active === s.key ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-cream-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </nav>
      <div className="min-w-0 flex-1">{renderSection()}</div>
    </div>
  );
}
