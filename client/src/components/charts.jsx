import { useEffect, useState } from 'react';

// Lightweight, dependency-free charts (CSS/flex/SVG based).

// A shared color palette for categorical charts.
export const CHART_COLORS = ['#F97316', '#3b82f6', '#16a34a', '#f59e0b', '#8b5cf6', '#ef4444', '#0ea5e9', '#94a3b8'];

// Animated ring chart. Pass thicknessRatio = 0.5 for a full pie, ~0.32 for a donut.
// (The stroke is centered on radius r = (size - thickness)/2 and extends
// ±thickness/2, so thickness = size/2 fills the disc right to the centre.)
function Ring({ data, size = 180, thicknessRatio = 0.32, centerTop, centerBottom, formatValue = (v) => v }) {
  const total = data.reduce((s, d) => s + Number(d.value || 0), 0);
  const thickness = size * thicknessRatio;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  let offset = 0;
  return (
    <div className="flex flex-wrap items-center justify-center gap-5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={thickness} className="stroke-cream-200 dark:stroke-slate-700" />
          {total > 0 &&
            data.map((d, i) => {
              const len = (Number(d.value || 0) / total) * c;
              const dash = mounted ? `${len} ${c - len}` : `0 ${c}`;
              const el = (
                <circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={d.color}
                  strokeWidth={thickness}
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                  style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1)' }}
                >
                  <title>{`${d.label}: ${formatValue(d.value)}`}</title>
                </circle>
              );
              offset += len;
              return el;
            })}
        </svg>
        {(centerTop || centerBottom) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {centerTop && <span className="text-xl font-semibold text-slate-800 dark:text-slate-100">{centerTop}</span>}
            {centerBottom && <span className="text-xs text-slate-400">{centerBottom}</span>}
          </div>
        )}
      </div>
      <ul className="min-w-[9rem] space-y-1.5">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="text-slate-600 dark:text-slate-300">{d.label}</span>
            <span className="ml-auto pl-3 font-medium text-slate-800 dark:text-slate-100">{formatValue(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DonutChart({ data, size, centerTop, centerBottom, formatValue }) {
  return <Ring data={data} size={size} thicknessRatio={0.32} centerTop={centerTop} centerBottom={centerBottom} formatValue={formatValue} />;
}

export function PieChart({ data, size, formatValue }) {
  return <Ring data={data} size={size} thicknessRatio={0.5} formatValue={formatValue} />;
}


// Turns a 'YYYY-MM' label into a short month like "Aug" (or "Aug '26" in Jan).
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function shortMonth(label) {
  const m = /^(\d{4})-(\d{2})$/.exec(label);
  if (!m) return label;
  const month = MONTHS[Number(m[2]) - 1] || label;
  return m[2] === '01' ? `${month} '${m[1].slice(2)}` : month;
}

// Grouped vertical bar chart. series = [{ name, color, values:number[] }]
export function BarChart({ labels = [], series = [], height = 180, formatValue = (v) => v }) {
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  return (
    <div>
      <div className="flex items-end gap-2" style={{ height }}>
        {labels.map((label, i) => (
          <div key={label} className="flex flex-1 items-end justify-center gap-1" style={{ height: '100%' }}>
            {series.map((s) => {
              const v = s.values[i] || 0;
              return (
                <div
                  key={s.name}
                  className="w-full max-w-[14px] rounded-t"
                  style={{ height: `${(v / max) * 100}%`, backgroundColor: s.color, minHeight: v > 0 ? 2 : 0 }}
                  title={`${label} · ${s.name}: ${formatValue(v)}`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2">
        {labels.map((label) => (
          <div key={label} className="flex-1 text-center text-[9px] text-slate-400">
            {shortMonth(label)}
          </div>
        ))}
      </div>
      {series.length > 1 && (
        <div className="mt-2 flex justify-center gap-4">
          {series.map((s) => (
            <span key={s.name} className="flex items-center gap-1 text-xs text-slate-500">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Horizontal bars for category breakdowns. items = [{ label, value }]
export function HBars({ items = [], color = '#F97316', formatValue = (v) => v }) {
  const max = Math.max(1, ...items.map((i) => Number(i.value) || 0));
  if (items.length === 0) return <p className="text-sm text-slate-400">No data.</p>;
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.label}>
          <div className="mb-0.5 flex justify-between text-xs text-slate-500">
            <span>{it.label}</span>
            <span className="font-medium text-slate-700">{formatValue(it.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-cream-200 dark:bg-slate-700">
            <div className="h-2 rounded-full" style={{ width: `${(Number(it.value) / max) * 100}%`, backgroundColor: it.color || color }} />
          </div>
        </div>
      ))}
    </div>
  );
}
