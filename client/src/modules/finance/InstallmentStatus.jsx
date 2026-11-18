export const INST_STATUS = {
  paid: { label: 'Paid', cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  partial: { label: 'Part paid', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  overdue: { label: 'Overdue', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  due_soon: { label: 'Due soon', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  upcoming: { label: 'Upcoming', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
};

export default function InstallmentStatus({ status }) {
  const s = INST_STATUS[status] || INST_STATUS.upcoming;
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}
