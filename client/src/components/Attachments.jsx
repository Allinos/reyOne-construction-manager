import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { errorMessage } from '../lib/api';
import { listFiles, uploadFile, deleteFile, readFileAsDataUrl, openFile } from '../lib/files';
import { readPhotoDate } from '../lib/exif';
import { formatDateTime } from '../lib/format';
import Icon from './Icon';

/**
 * Upload + list attachments for any entity. Images show as thumbnails;
 * other files as chips. With `capture`, two buttons are offered — Camera
 * (opens the phone camera) and Gallery (pick existing photos). The original
 * capture time is read from the photo's EXIF data when present.
 */
export default function Attachments({ entityType, entityId, canUpload = true, label = 'Attachments', accept = 'image/*,application/pdf', capture = false, onChange }) {
  const { user } = useAuth();
  const toast = useToast();
  const inputRef = useRef(null);
  const cameraRef = useRef(null);
  const [files, setFiles] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!entityId) return;
    listFiles(entityType, entityId, true).then(setFiles).catch(() => setFiles([]));
  }, [entityType, entityId]);
  useEffect(() => { load(); }, [load]);

  const onPick = async (e) => {
    const picked = [...(e.target.files || [])];
    e.target.value = '';
    if (!picked.length) return;
    setBusy(true);
    try {
      for (const f of picked) {
        // eslint-disable-next-line no-await-in-loop
        const takenAt = await readPhotoDate(f);
        // eslint-disable-next-line no-await-in-loop
        const { data, mimeType } = await readFileAsDataUrl(f);
        // eslint-disable-next-line no-await-in-loop
        await uploadFile({ entityType, entityId, name: f.name, mimeType, data, ...(takenAt ? { takenAt } : {}) });
      }
      toast.success(`${picked.length} file(s) uploaded`);
      load();
      onChange?.();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (f) => {
    try { await deleteFile(f.id); load(); onChange?.(); } catch (err) { toast.error(errorMessage(err)); }
  };

  const images = (files || []).filter((f) => f.mimeType?.startsWith('image/'));
  const others = (files || []).filter((f) => !f.mimeType?.startsWith('image/'));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}{files ? ` (${files.length})` : ''}</p>
        {canUpload && (
          <div className="flex gap-1.5">
            {capture && (
              <>
                <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => cameraRef.current?.click()}>
                  <Icon name="photo" className="h-3.5 w-3.5" /> Camera
                </button>
                <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
              </>
            )}
            <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => inputRef.current?.click()}>
              <Icon name={capture ? 'download' : 'add'} className="h-3.5 w-3.5" />{busy ? 'Uploading…' : capture ? 'Gallery' : 'Add'}
            </button>
            <input ref={inputRef} type="file" multiple accept={accept} className="hidden" onChange={onPick} />
          </div>
        )}
      </div>
      {!files ? <p className="text-xs text-slate-400">Loading…</p> : files.length === 0 ? <p className="text-xs text-slate-400">Nothing attached yet.</p> : (
        <>
          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {images.map((f) => (
                <div key={f.id} className="group relative overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                  <button type="button" className="block w-full" onClick={() => openFile(f.id)} title={f.takenAt ? `Taken ${formatDateTime(f.takenAt)}` : `Uploaded ${formatDateTime(f.createdAt)}`}>
                    <img src={f.data} alt={f.name || ''} className="h-20 w-full object-cover" />
                    <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 py-0.5 text-left text-[10px] text-white">
                      {f.takenAt ? `📷 ${formatDateTime(f.takenAt)}` : `↑ ${formatDateTime(f.createdAt)}`}
                    </span>
                  </button>
                  {(canUpload || f.uploadedById === user?.id) && (
                    <button type="button" className="absolute right-1 top-1 hidden rounded bg-black/60 px-1.5 text-xs text-white group-hover:block" onClick={() => remove(f)}>×</button>
                  )}
                </div>
              ))}
            </div>
          )}
          {others.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {others.map((f) => (
                <span key={f.id} className="badge bg-cream-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                  <button type="button" className="hover:underline" onClick={() => openFile(f.id)}>{f.name || `File ${f.id}`}</button>
                  {(canUpload || f.uploadedById === user?.id) && <button type="button" className="ml-1 text-slate-400 hover:text-red-500" onClick={() => remove(f)}>×</button>}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
