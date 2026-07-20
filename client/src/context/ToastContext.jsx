import { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext(null);

let idSeq = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const push = useCallback(
    (type, message, ttl = 3500) => {
      const id = ++idSeq;
      setToasts((t) => [...t, { id, type, message }]);
      timers.current[id] = setTimeout(() => dismiss(id), ttl);
      return id;
    },
    [dismiss],
  );

  const api = {
    success: (m) => push('success', m),
    error: (m) => push('error', m, 5000),
    info: (m) => push('info', m),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg ${
              t.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-800'
                : t.type === 'error'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-brand-200 bg-brand-50 text-brand-800'
            }`}
          >
            <span className="mt-0.5 text-sm font-medium">
              {t.type === 'success' ? '✓' : t.type === 'error' ? '!' : 'i'}
            </span>
            <p className="flex-1 text-sm">{t.message}</p>
            <button className="text-slate-400 hover:text-slate-600" onClick={() => dismiss(t.id)}>
              &times;
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
