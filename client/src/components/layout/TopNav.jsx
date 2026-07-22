import { Link } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../../modules/notifications/NotificationBell';
import Icon from '../Icon';

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      className="rounded-lg p-2 text-slate-500 hover:bg-cream-200 dark:text-slate-300"
      onClick={toggle}
      aria-label="Toggle theme"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? (
        // sun
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        // moon
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

export default function TopNav({ onMenu }) {
  const { bootstrap, can } = useAuth();
  const invoicesEnabled = (bootstrap?.modules || []).some((m) => m.key === 'invoices') && can('invoices.read');

  return (
    <header className="flex items-center justify-between border-b border-cream-300 bg-white px-4 py-2 dark:border-slate-700 dark:bg-slate-800">
      <button className="btn-ghost md:invisible" onClick={onMenu} aria-label="Open menu">
        <Icon name="menu" />
      </button>
      <div className="flex items-center gap-1">
        {invoicesEnabled && (
          <Link
            to="/invoices"
            className="rounded-lg p-2 text-slate-500 hover:bg-cream-200 dark:text-slate-300"
            title="Invoices & Quotations"
            aria-label="Invoices & Quotations"
          >
            <Icon name="invoice" className="h-5 w-5" />
          </Link>
        )}
        <ThemeToggle />
        <NotificationBell />
      </div>
    </header>
  );
}
