import { useEffect, useState } from 'react';
import Icon from './Icon';

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide = false,
  dismissOnBackdrop = true,
  fullscreenable = false,
}) {
  const [full, setFull] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Reset fullscreen whenever the modal is closed.
  useEffect(() => {
    if (!open) setFull(false);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-black/40" onClick={dismissOnBackdrop ? onClose : undefined} />
      <div
        className={`relative bg-white shadow-xl dark:bg-slate-900 ${
          full
            ? 'fixed inset-0 z-50 flex flex-col rounded-none'
            : `mt-10 w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-xl`
        }`}
      >
        <div className="flex items-center justify-between border-b border-cream-300 px-5 py-3 dark:border-slate-700">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
          <div className="flex items-center gap-1">
            {fullscreenable && (
              <button
                className="btn-ghost px-2"
                onClick={() => setFull((f) => !f)}
                title={full ? 'Exit full screen' : 'Full screen'}
                aria-label="Toggle full screen"
              >
                <Icon name="fullscreen" className="h-5 w-5 text-slate-400" />
              </button>
            )}
            <button className="btn-ghost -mr-2 px-2" onClick={onClose} aria-label="Close">
              <span className="text-xl leading-none text-slate-400">&times;</span>
            </button>
          </div>
        </div>
        <div className={`overflow-y-auto p-5 ${full ? 'flex-1' : 'max-h-[70vh]'}`}>{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-cream-300 px-5 py-3 dark:border-slate-700">{footer}</div>}
      </div>
    </div>
  );
}
