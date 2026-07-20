import { useEffect, useState } from 'react';
import { getAllSettings } from './api';
import { StringListEditor, ObjectListEditor } from './editors';
import { Spinner, Alert } from '../../components/ui';
import { errorMessage } from '../../lib/api';

export default function ConfigurationPage() {
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getAllSettings().then(setSettings).catch((err) => setError(errorMessage(err)));
  }, []);

  if (error) return <Alert>{error}</Alert>;
  if (!settings) return <div className="flex justify-center p-10"><Spinner /></div>;

  const p = settings.projects || {};
  const f = settings.finance || {};
  const u = settings.users || {};

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Projects</h2>
        <div className="space-y-4">
          <StringListEditor title="Project Categories" group="projects" settingKey="categories" initial={p.categories} />
          <StringListEditor title="Phase Templates" group="projects" settingKey="phase_templates" initial={p.phase_templates} />
          <ObjectListEditor
            title="Project Statuses"
            group="projects"
            settingKey="statuses"
            initial={p.statuses}
            columns={[{ key: 'key', label: 'key' }, { key: 'label', label: 'Label' }]}
          />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Finance</h2>
        <div className="space-y-4">
          <StringListEditor title="Payment Methods" group="finance" settingKey="payment_methods" initial={f.payment_methods} />
          <StringListEditor title="Expense Categories" group="finance" settingKey="expense_categories" initial={f.expense_categories} />
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
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Users</h2>
        <StringListEditor title="Designations" group="users" settingKey="designations" initial={u.designations} />
      </div>
    </div>
  );
}
