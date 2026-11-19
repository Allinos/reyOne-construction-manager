// Single source of truth for project/phase status colors, used everywhere a
// status is shown (lists, detail, dashboard, analytics).
export const STATUS_META = {
  pending: { badge: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', color: '#F2A900', select: 'border-amber-300 bg-amber-50 text-amber-700' },
  in_progress: { badge: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', color: '#1D4ED8', select: 'border-blue-300 bg-blue-50 text-blue-700' },
  on_hold: { badge: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300', color: '#9A8B78', select: 'border-slate-300 bg-slate-100 text-slate-600' },
  completed: { badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', color: '#15803D', select: 'border-green-300 bg-green-50 text-green-700' },
};

export const statusBadgeClass = (key) => STATUS_META[key]?.badge || 'bg-cream-200 text-slate-600';
export const statusColor = (key) => STATUS_META[key]?.color || '#64748b';
export const statusSelectClass = (key) => STATUS_META[key]?.select || '';
