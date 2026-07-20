import api from '../../lib/api';

export const listActivity = (params) =>
  api.get('/activity', { params }).then((r) => ({ items: r.data.data, meta: r.data.meta }));
