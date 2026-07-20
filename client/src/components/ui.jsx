// Small shared UI building blocks reused across every module.

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
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = '' }) {
  return <div className={`card p-5 ${className}`}>{children}</div>;
}

// Card with an orange section-header bar (dot + title + optional actions).
export function SectionCard({ title, actions, children, className = '', bodyClassName = 'p-4' }) {
  return (
    <div className={`card overflow-hidden ${className}`}>
      <div className="section-head">
        <span className="section-title">
          <span className="h-2 w-2 rounded-full bg-brand-500" />
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
    <div className="rounded-xl border border-dashed border-cream-300 bg-cream-100 p-10 text-center">
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
    error: 'bg-red-50 text-red-600',
    success: 'bg-green-50 text-green-700',
    info: 'bg-blue-50 text-blue-700',
  };
  return <div className={`rounded-lg px-3 py-2 text-sm ${styles[type]}`}>{children}</div>;
}

const STATUS_STYLES = {
  completed: 'bg-green-100 text-green-700',
  in_progress: 'bg-blue-100 text-blue-700',
  pending: 'bg-amber-100 text-amber-700',
  on_hold: 'bg-slate-200 text-slate-600',
};

export function StatusBadge({ status, label }) {
  const cls = STATUS_STYLES[status] || 'bg-cream-200 text-slate-600';
  return <span className={`badge ${cls}`}>{label || status}</span>;
}
