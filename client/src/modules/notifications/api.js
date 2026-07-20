import api, { unwrap } from '../../lib/api';

export const listNotifications = (params) =>
  api.get('/notifications', { params }).then((r) => ({ items: r.data.data, meta: r.data.meta }));
export const unreadCount = () => unwrap(api.get('/notifications/unread-count'));
export const markRead = (id) => unwrap(api.patch(`/notifications/${id}/read`));
export const markAllRead = () => unwrap(api.post('/notifications/read-all'));
export const deleteNotification = (id) => unwrap(api.delete(`/notifications/${id}`));
