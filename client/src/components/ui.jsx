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
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
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

export function StatusBadge({ status, label }) {
  return <span className={`badge ${statusBadgeClass(status)}`}>{label || status}</span>;
}

// Underline tabs used by every multi-view page. Items: { key, label, count?, hidden? }.
export function Tabs({ tabs, value, onChange, right, className = 'mb-4' }) {
  return (
    <div className={`flex items-end justify-between gap-2 border-b border-slate-200 dark:border-slate-700 ${className}`}>
      <div className="scroll-thin -mb-px flex gap-1 overflow-x-auto">
        {tabs.filter((t) => !t.hidden).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              value === t.key
                ? 'border-brand-500 text-brand-600 dark:text-brand-300'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {t.label}
            {t.count != null && t.count !== 0 && (
              <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold ${value === t.key ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2 pb-1.5">{right}</div>}
    </div>
  );
}

// Compact progress bar: thin track + inline percentage.
export function Progress({ value = 0, color, className = '', showLabel = true, size = 'sm' }) {
  const v = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  const h = size === 'xs' ? 'h-1' : size === 'md' ? 'h-2' : 'h-1.5';
  const tone = color || (v >= 100 ? '#10b981' : '#CC6E02');
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`${h} min-w-[3rem] flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700`}>
        <div className={`${h} rounded-full transition-all`} style={{ width: `${v}%`, backgroundColor: tone }} />
      </div>
      {showLabel && <span className="w-9 shrink-0 text-right text-xs font-medium tabular-nums text-slate-600 dark:text-slate-300">{v}%</span>}
    </div>
  );
}

// Compact KPI tile. tone: neutral | success | danger | warning | info | brand
const TONES = {
  neutral: 'text-slate-900 dark:text-white',
  success: 'text-emerald-600 dark:text-emerald-400',
  danger: 'text-red-600 dark:text-red-400',
  warning: 'text-amber-600 dark:text-amber-400',
  info: 'text-blue-600 dark:text-blue-400',
  brand: 'text-brand-600 dark:text-brand-300',
};
export function Stat({ label, value, hint, tone = 'neutral', onClick }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp onClick={onClick} className={`card px-4 py-3 text-left ${onClick ? 'transition hover:border-brand-300 hover:shadow' : ''}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-0.5 truncate text-lg font-semibold tabular-nums ${TONES[tone] || TONES.neutral}`}>{value}</p>
      {hint && <p className="truncate text-xs text-slate-400">{hint}</p>}
    </Comp>
  );
}
