import { useEffect, useState } from 'react';
import Icon from '../../components/Icon';

// A modal that opens on top of the Requirements workspace to show a single
// item's full content. Full-screen capable and responsive; sized to stay
// compact on large displays so inputs don't stretch edge-to-edge.
export default function ItemModal({ title, onClose, footer, children }) {
  const [full, setFull] = useState(false);

  useEffect(() => {
    // Capture-phase + stopPropagation so Escape closes only this modal, not the
    // Requirements workspace underneath it.
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className={`relative flex flex-col bg-white shadow-2xl dark:bg-slate-900 ${
          full
            ? 'h-screen w-screen rounded-none'
            : 'mt-0 h-screen w-full rounded-none sm:mt-6 sm:h-[85vh] sm:max-w-4xl sm:rounded-xl'
        }`}
      >
        <div className="flex items-center justify-between border-b border-cream-300 px-5 py-3 dark:border-slate-700">
          <h3 className="truncate pr-3 font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
          <div className="flex items-center gap-1">
            <button className="btn-ghost px-2" title={full ? 'Exit full screen' : 'Full screen'} onClick={() => setFull((f) => !f)}>
              <Icon name="fullscreen" className="h-5 w-5" />
            </button>
            <button className="btn-ghost px-2 text-xl leading-none text-slate-400" onClick={onClose} aria-label="Close">&times;</button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-cream-300 px-5 py-3 dark:border-slate-700">{footer}</div>}
      </div>
    </div>
  );
}
