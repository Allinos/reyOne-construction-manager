import api, { unwrap } from './api';

export const listFiles = (entityType, entityId, withData = false) =>
  unwrap(api.get('/files', { params: { entityType, entityId, ...(withData ? { withData: 'true' } : {}) } }));
export const getFile = (id) => unwrap(api.get(`/files/${id}`));
export const uploadFile = (body) => unwrap(api.post('/files', body));
export const deleteFile = (id) => unwrap(api.delete(`/files/${id}`));
export const listDirectory = () => unwrap(api.get('/users/directory')).catch(() => []);

// Read a File as a data URL; images are downscaled (max 1600px, JPEG ~0.8) so
// site photos from phones stay small.
export function readFileAsDataUrl(file, { maxDim = 1600, quality = 0.8 } = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = () => {
      const url = reader.result;
      if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
        resolve({ data: url, mimeType: file.type || 'application/octet-stream' });
        return;
      }
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({ data: canvas.toDataURL('image/jpeg', quality), mimeType: 'image/jpeg' });
      };
      img.onerror = () => resolve({ data: url, mimeType: file.type });
      img.src = url;
    };
    reader.readAsDataURL(file);
  });
}

// Open/download a stored file.
export async function openFile(id) {
  const f = await getFile(id);
  const a = document.createElement('a');
  a.href = f.data;
  a.download = f.name || `file-${id}`;
  if (f.mimeType?.startsWith('image/') || f.mimeType === 'application/pdf') {
    const w = window.open();
    if (w) { w.document.write(`<title>${f.name || 'File'}</title><body style="margin:0;background:#111;display:flex;justify-content:center"><${f.mimeType === 'application/pdf' ? 'iframe style="width:100vw;height:100vh;border:0"' : 'img style="max-width:100%;max-height:100vh"'} src="${f.data}"></body>`); return; }
  }
  a.click();
}
