// Small shared UI building blocks reused across every module.
import { statusBadgeClass } from '../lib/status';

export function Spinner({ className = 'w-6 h-6' }) {
  return (
    <svg className={`animate-spin text-brand-500 ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
    </svg>
  );
}

export function FullPageLoader() {
  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center">
      <Spinner className="w-8 h-8" />
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13px] text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = '' }) {
  return <div className={`card p-5 ${className}`}>{children}</div>;
}

// Card with a section-header bar (dot + title + optional actions).
export function SectionCard({ title, actions, children, className = '', bodyClassName = 'p-4' }) {
  return (
    <div className={`card overflow-hidden ${className}`}>
      <div className="section-head">
        <span className="section-title">
          {title}
        </span>
        {actions}
      </div>
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

export function EmptyState({ title = 'Nothing here yet', hint }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-8 text-center dark:border-slate-700 dark:bg-slate-800/40">
      <p className="font-medium text-slate-600">{title}</p>
      {hint && <p className="mt-1 text-sm text-slate-400">{hint}</p>}
    </div>
  );
}

export function Pagination({ meta, onPage }) {
  if (!meta || meta.totalPages <= 1) return null;
  const { page, totalPages, total } = meta;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
      <span>{total} total</span>
      <div className="flex items-center gap-2">
        <button className="btn-secondary px-3 py-1" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Prev
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button className="btn-secondary px-3 py-1" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}

export function Alert({ type = 'error', children }) {
  const styles = {
    error: 'border border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:text-red-300',
    success: 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:text-emerald-300',
    warning: 'border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:text-amber-300',
    info: 'border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:text-blue-300',
  };
  return <div className={`rounded-lg px-3 py-2 text-sm ${styles[type]}`}>{children}</div>;
}

export function StatusBadge({ status, label, dot = true }) {
  return <span className={`badge ${statusBadgeClass(status)}`}>{dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}{label || status}</span>;
}

// Underline tabs used by every multi-view page. Items: { key, label, count?, hidden? }.
export function Tabs({ tabs, value, onChange, right, className = 'mb-4' }) {
  return (
    <div className={`flex flex-col-reverse gap-2 border-b border-slate-200 sm:flex-row sm:items-end sm:justify-between dark:border-slate-700 ${className}`}>
      <div className="scroll-thin -mb-px flex min-w-0 gap-5 overflow-x-auto">
        {tabs.filter((t) => !t.hidden).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 py-2.5 text-[13.5px] font-medium transition-colors ${
              value === t.key
                ? 'border-brand-500 text-slate-900 dark:text-white'
                : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {t.label}
            {t.count != null && t.count !== 0 && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-1.5 text-[11px] font-semibold leading-[18px] text-slate-600 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-300">{t.count}</span>
            )}
          </button>
        ))}
      </div>
      {right && <div className="scroll-thin flex shrink-0 items-center gap-2 overflow-x-auto sm:pb-1.5">{right}</div>}
    </div>
  );
}

// Compact progress bar: thin track + inline percentage.
export function Progress({ value = 0, color, className = '', showLabel = true, size = 'sm' }) {
  const v = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  const h = size === 'xs' ? 'h-1' : size === 'md' ? 'h-2' : 'h-1.5';
  const tone = color || (v >= 100 ? '#15803D' : '#F2A900');
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`${h} min-w-[3rem] flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700`}>
        <div className={`${h} rounded-full transition-all`} style={{ width: `${v}%`, backgroundColor: tone }} />
      </div>
      {showLabel && <span className="w-9 shrink-0 text-right text-xs font-medium tabular-nums text-slate-600 dark:text-slate-300">{v}%</span>}
    </div>
  );
}

// KPI tile. tone: neutral | success | danger | warning | info | brand. Optional icon.
const TONES = {
  neutral: 'text-slate-900 dark:text-white',
  success: 'text-emerald-700 dark:text-emerald-400',
  danger: 'text-red-700 dark:text-red-400',
  warning: 'text-amber-700 dark:text-amber-400',
  info: 'text-blue-700 dark:text-blue-400',
  brand: 'text-brand-600 dark:text-brand-300',
};
const ICON_TONES = {
  neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  danger: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  warning: 'bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300',
  info: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  brand: 'bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300',
};
export function Stat({ label, value, hint, tone = 'neutral', onClick, icon, children }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp onClick={onClick} className={`card px-[18px] py-4 text-left ${onClick ? 'transition hover:border-brand-300' : ''}`}>
      <p className="flex items-center gap-2 text-xs font-medium text-slate-400">
        {icon && <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${ICON_TONES[tone] || ICON_TONES.neutral}`}>{icon}</span>}
        {label}
      </p>
      <p className={`mt-1.5 truncate text-[22px] font-bold tabular-nums tracking-tight ${TONES[tone] || TONES.neutral}`}>{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-slate-400">{hint}</p>}
      {children}
    </Comp>
  );
}
