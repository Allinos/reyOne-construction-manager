// Single source of truth for project/phase status colors, used everywhere a
// status is shown (lists, detail, dashboard, analytics).
export const STATUS_META = {
  pending: { badge: 'bg-amber-100 text-amber-700', color: '#f59e0b' },
  in_progress: { badge: 'bg-blue-100 text-blue-700', color: '#3b82f6' },
  on_hold: { badge: 'bg-slate-200 text-slate-600', color: '#94a3b8' },
  completed: { badge: 'bg-green-100 text-green-700', color: '#16a34a' },
};

export const statusBadgeClass = (key) => STATUS_META[key]?.badge || 'bg-cream-200 text-slate-600';
export const statusColor = (key) => STATUS_META[key]?.color || '#F97316';
