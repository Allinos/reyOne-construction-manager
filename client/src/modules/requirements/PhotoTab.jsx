import { useEffect, useState, useCallback, useRef } from 'react';
import { listPhotos, createPhoto, deletePhoto } from './api';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { errorMessage } from '../../lib/api';
import { Spinner } from '../../components/ui';
import Icon from '../../components/Icon';

const readAsDataURL = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// Photo Upload — independent, toggleable module. Upload multiple images from the
// gallery, preview them in a grid, and delete individually.
export default function PhotoTab({ projectId, canEdit }) {
  const toast = useToast();
  const confirm = useConfirm();
  const fileRef = useRef(null);
  const [photos, setPhotos] = useState(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(() => {
    listPhotos(projectId).then(setPhotos).catch((e) => toast.error(errorMessage(e)));
  }, [projectId, toast]);
  useEffect(() => { load(); }, [load]);

  const onFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        // eslint-disable-next-line no-await-in-loop
        const data = await readAsDataURL(file);
        // eslint-disable-next-line no-await-in-loop
        const photo = await createPhoto({ projectId, name: file.name, mimeType: file.type, data });
        setPhotos((list) => [photo, ...(list || [])]);
      }
      toast.success(`${files.length} photo(s) uploaded`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const remove = async (p) => {
    const ok = await confirm({ title: 'Delete photo?', message: 'This image will be removed.', confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      await deletePhoto(p.id);
      setPhotos((list) => list.filter((x) => x.id !== p.id));
    } catch (e) { toast.error(errorMessage(e)); }
  };

  if (photos === null) return <div className="flex justify-center p-8"><Spinner /></div>;

  return (
    <div className="space-y-4">
      {canEdit && (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
            multiple
            hidden
            onChange={onFiles}
          />
          <button className="btn-secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Spinner className="h-4 w-4" /> : '+ Upload Photos & Docs'}
          </button>
        </div>
      )}
      {photos.length === 0 ? (
        <p className="text-sm text-slate-400">No photos or documents uploaded yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((p) => {
            const isImage = (p.mimeType || '').startsWith('image/');
            return (
              <div key={p.id} className="group relative overflow-hidden rounded-lg border border-cream-300 dark:border-slate-700">
                <a href={p.data} target="_blank" rel="noreferrer" download={p.name || undefined}>
                  {isImage ? (
                    <img src={p.data} alt={p.name || 'photo'} className="h-32 w-full object-cover" />
                  ) : (
                    <div className="flex h-32 w-full flex-col items-center justify-center gap-2 bg-cream-100 text-slate-400 dark:bg-slate-800">
                      <Icon name="invoice" className="h-8 w-8" />
                      <span className="px-2 text-center text-xs">Open document</span>
                    </div>
                  )}
                </a>
                {canEdit && (
                  <button
                    className="absolute right-1 top-1 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white opacity-0 transition group-hover:opacity-100"
                    onClick={() => remove(p)}
                  >
                    &times;
                  </button>
                )}
                {p.name && <div className="truncate px-2 py-1 text-xs text-slate-500">{p.name}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
