import { useEffect } from 'react';
import Icon from './Icon';

export default function Modal({ open, onClose, title, children, footer, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative mt-10 w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-xl bg-white shadow-xl`}>
        <div className="flex items-center justify-between border-b border-cream-300 px-5 py-3">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <button className="btn-ghost -mr-2 px-2" onClick={onClose} aria-label="Close">
            <Icon name="menu" className="hidden" />
            <span className="text-xl leading-none text-slate-400">&times;</span>
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-cream-300 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
