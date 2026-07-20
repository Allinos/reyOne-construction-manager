// Lightweight, dependency-free charts (CSS/flex based).

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
            {label.slice(2)}
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
          <div className="h-2 rounded-full bg-cream-200">
            <div className="h-2 rounded-full" style={{ width: `${(Number(it.value) / max) * 100}%`, backgroundColor: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}
