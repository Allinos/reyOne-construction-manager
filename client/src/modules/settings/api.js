import api, { unwrap } from '../../lib/api';

export const getCompany = () => unwrap(api.get('/settings/company'));
export const updateCompany = (body) => unwrap(api.put('/settings/company', body));

export const getAllSettings = () => unwrap(api.get('/settings'));
export const updateSetting = (group, key, value) => unwrap(api.put(`/settings/${group}/${key}`, { value }));

// Downloads the SQL backup as a file.
export async function downloadBackup() {
  const res = await api.get('/settings/backup', { responseType: 'blob' });
  const disposition = res.headers['content-disposition'] || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : 'backup.sql';
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
