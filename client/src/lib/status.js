// Single source of truth for project/phase status colors, used everywhere a
// status is shown (lists, detail, dashboard, analytics).
export const STATUS_META = {
  pending: { badge: 'bg-amber-100 text-amber-700', color: '#f59e0b', select: 'border-amber-300 bg-amber-50 text-amber-700' },
  in_progress: { badge: 'bg-blue-100 text-blue-700', color: '#3b82f6', select: 'border-blue-300 bg-blue-50 text-blue-700' },
  on_hold: { badge: 'bg-slate-200 text-slate-600', color: '#94a3b8', select: 'border-slate-300 bg-slate-100 text-slate-600' },
  completed: { badge: 'bg-green-100 text-green-700', color: '#16a34a', select: 'border-green-300 bg-green-50 text-green-700' },
};

export const statusBadgeClass = (key) => STATUS_META[key]?.badge || 'bg-cream-200 text-slate-600';
export const statusColor = (key) => STATUS_META[key]?.color || '#F97316';
export const statusSelectClass = (key) => STATUS_META[key]?.select || '';
