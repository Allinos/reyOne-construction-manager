import api, { unwrap } from '../../lib/api';

export const listModules = () => unwrap(api.get('/modules'));
export const toggleModule = (key, enabled) => unwrap(api.patch(`/modules/${key}`, { enabled }));
