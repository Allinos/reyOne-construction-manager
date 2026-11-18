// 1–5 star rating; read-only when no onChange is given.
export default function StarRating({ value = 0, onChange, size = 'text-base' }) {
  return (
    <span className={`inline-flex ${size}`} aria-label={`${value || 0} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(value === n ? null : n)}
          className={`leading-none ${n <= (value || 0) ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600'} ${onChange ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
        >
          ★
        </button>
      ))}
    </span>
  );
}
