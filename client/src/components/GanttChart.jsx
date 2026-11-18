import { statusColor } from '../lib/status';
import { formatDate } from '../lib/format';

// Dependency-free timeline / Gantt. Each phase is a horizontal bar positioned by
// its start → deadline across a shared time axis, tinted by status, with a
// progress fill and a "today" marker. Phases without dates render as faded rows.

const DAY = 86400000;

function toTime(d) {
  if (!d) return null;
  const t = new Date(d).getTime();
  return Number.isNaN(t) ? null : t;
}

export default function GanttChart({ phases = [], project = {}, statusLabel = (s) => s }) {
  // Gather every known date to size the axis.
  const dates = [];
  for (const p of phases) {
    const s = toTime(p.startDate);
    const e = toTime(p.deadline);
    if (s) dates.push(s);
    if (e) dates.push(e);
  }
  for (const d of [project.startDate, project.endDate, project.agreementDate]) {
    const t = toTime(d);
    if (t) dates.push(t);
  }

  const now = Date.now();
  let min = dates.length ? Math.min(...dates) : now - 30 * DAY;
  let max = dates.length ? Math.max(...dates) : now + 30 * DAY;
  if (max - min < 7 * DAY) {
    // Pad a too-narrow range so bars are visible.
    min -= 7 * DAY;
    max += 7 * DAY;
  }
  const span = max - min;
  const pct = (t) => `${((t - min) / span) * 100}%`;
  const todayInRange = now >= min && now <= max;

  // Build month gridlines across the span.
  const ticks = [];
  const cursor = new Date(min);
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);
  while (cursor.getTime() <= max && ticks.length < 36) {
    const t = cursor.getTime();
    if (t >= min) ticks.push(t);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const monthLabel = (t) =>
    new Date(t).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });

  if (!phases.length) {
    return <p className="text-sm text-slate-400">No stages to show on the timeline.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        {/* Axis header */}
        <div className="relative mb-2 ml-40 h-5 border-b border-cream-300 dark:border-slate-700">
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute -translate-x-1/2 text-[10px] text-slate-400"
              style={{ left: pct(t) }}
            >
              {monthLabel(t)}
            </span>
          ))}
        </div>

        <div className="relative">
          {/* Today marker spanning all rows */}
          {todayInRange && (
            <div
              className="pointer-events-none absolute bottom-0 top-0 z-10 w-px bg-brand-500"
              style={{ left: `calc(10rem + ${pct(now)})` }}
              title={`Today · ${formatDate(now)}`}
            >
              <span className="absolute -top-0.5 -translate-x-1/2 rounded-sm bg-brand-500 px-1 text-[8px] font-medium text-white">
                Today
              </span>
            </div>
          )}

          {phases.map((phase) => {
            const s = toTime(phase.startDate) ?? toTime(project.startDate);
            const e = toTime(phase.deadline) ?? toTime(project.endDate);
            const hasRange = s != null && e != null && e >= s;
            const color = statusColor(phase.status);
            const prog = Math.max(0, Math.min(100, phase.progress ?? 0));
            return (
              <div key={phase.id} className="flex items-center gap-2 py-1.5">
                <div className="w-40 shrink-0 truncate pr-2 text-xs font-medium text-slate-600 dark:text-slate-300" title={phase.name}>
                  {phase.name}
                </div>
                <div className="relative h-5 flex-1 rounded bg-cream-100 dark:bg-slate-800">
                  {hasRange ? (
                    <div
                      className="absolute top-0 flex h-5 items-center rounded"
                      style={{
                        left: pct(s),
                        width: `max(1.5rem, ${((e - s) / span) * 100}%)`,
                        backgroundColor: `${color}33`,
                        border: `1px solid ${color}`,
                      }}
                      title={`${phase.name} · ${formatDate(phase.startDate) || '—'} → ${formatDate(phase.deadline) || '—'} · ${prog}%`}
                    >
                      {/* progress fill */}
                      <div
                        className="h-full rounded-l"
                        style={{ width: `${prog}%`, backgroundColor: color, opacity: 0.85 }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold text-slate-700 dark:text-slate-100">
                        {prog}%
                      </span>
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center pl-2 text-[9px] text-slate-400">
                      No dates set
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="ml-40 mt-2 flex flex-wrap gap-3 text-[10px] text-slate-400">
          <span>{formatDate(min)}</span>
          <span className="ml-auto">{formatDate(max)}</span>
        </div>
      </div>
    </div>
  );
}
