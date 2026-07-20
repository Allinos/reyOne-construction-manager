import { useEffect, useState, useCallback } from 'react';
import { listNotifications, unreadCount, markRead, markAllRead, deleteNotification } from './api';
import { formatDateTime } from '../../lib/format';
import { Spinner } from '../../components/ui';
import Icon from '../../components/Icon';

const TYPE_DOT = {
  'project.assigned': 'bg-blue-500',
  'project.status': 'bg-amber-500',
  'payment.received': 'bg-green-500',
  'expense.added': 'bg-red-500',
  deadline: 'bg-purple-500',
  system: 'bg-slate-400',
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState(null);

  const refreshCount = useCallback(() => {
    unreadCount().then((r) => setCount(r.count)).catch(() => {});
  }, []);

  useEffect(() => {
    refreshCount();
    const t = setInterval(refreshCount, 60000);
    return () => clearInterval(t);
  }, [refreshCount]);

  const loadList = useCallback(() => {
    setItems(null);
    listNotifications({ limit: 30 })
      .then((r) => setItems(r.items))
      .catch(() => setItems([]));
  }, []);

  const openPanel = () => {
    setOpen(true);
    loadList();
  };

  const onRead = async (n) => {
    if (n.readAt) return;
    await markRead(n.id);
    setItems((list) => list.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
    refreshCount();
  };

  const onDelete = async (id) => {
    await deleteNotification(id);
    setItems((list) => list.filter((x) => x.id !== id));
    refreshCount();
  };

  const onReadAll = async () => {
    await markAllRead();
    setItems((list) => list.map((x) => ({ ...x, readAt: x.readAt || new Date().toISOString() })));
    refreshCount();
  };

  return (
    <>
      <button className="relative rounded-lg p-2 text-slate-500 hover:bg-cream-200 dark:text-slate-300" onClick={openPanel} aria-label="Notifications">
        <Icon name="bell" className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[90]">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col bg-white shadow-xl dark:bg-slate-800">
            <div className="flex items-center justify-between border-b border-cream-300 px-4 py-3 dark:border-slate-700">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Notifications</h3>
              <div className="flex items-center gap-2">
                <button className="text-xs text-brand-600 hover:underline" onClick={onReadAll}>
                  Mark all read
                </button>
                <button className="btn-ghost px-2" onClick={() => setOpen(false)} aria-label="Close">
                  <Icon name="close" className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {items === null ? (
                <div className="flex justify-center p-10"><Spinner /></div>
              ) : items.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-400">No notifications available</div>
              ) : (
                <ul className="divide-y divide-cream-200 dark:divide-slate-700">
                  {items.map((n) => (
                    <li
                      key={n.id}
                      className={`flex gap-3 px-4 py-3 ${n.readAt ? '' : 'bg-brand-50/60 dark:bg-slate-700/40'}`}
                      onClick={() => onRead(n)}
                      role="button"
                    >
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TYPE_DOT[n.type] || 'bg-slate-400'}`} />
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm ${n.readAt ? 'text-slate-600 dark:text-slate-300' : 'font-medium text-slate-800 dark:text-slate-100'}`}>
                          {n.title}
                        </p>
                        {n.message && <p className="mt-0.5 text-xs text-slate-500">{n.message}</p>}
                        <p className="mt-1 text-[11px] text-slate-400">{formatDateTime(n.createdAt)}</p>
                      </div>
                      <button
                        className="text-slate-300 hover:text-red-500"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(n.id);
                        }}
                        aria-label="Delete"
                      >
                        <Icon name="trash" className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
