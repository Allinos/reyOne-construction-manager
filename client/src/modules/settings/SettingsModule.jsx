import { Routes, Route, NavLink } from 'react-router-dom';
import { PageHeader } from '../../components/ui';
import CompanyPage from './CompanyPage';
import ConfigurationPage from './ConfigurationPage';
import SystemPage from './SystemPage';

const TABS = [
  { to: '/settings', label: 'Company', end: true },
  { to: '/settings/configuration', label: 'Configuration' },
  { to: '/settings/system', label: 'System' },
];

export default function SettingsModule() {
  return (
    <div>
      <PageHeader title="Settings" subtitle="Application configuration" />
      <div className="mb-5 flex gap-1 border-b border-cream-300">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
                isActive ? 'border-brand-500 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </div>
      <Routes>
        <Route index element={<CompanyPage />} />
        <Route path="configuration" element={<ConfigurationPage />} />
        <Route path="system" element={<SystemPage />} />
      </Routes>
    </div>
  );
}
