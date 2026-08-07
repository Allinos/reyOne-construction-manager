import { useEffect, useState, useCallback, useRef } from 'react';
import { listPhotos, createPhoto, updatePhoto, deletePhoto } from './api';
import { useAuth } from '../../context/AuthContext';
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

// Photo & document upload — multi-file, categorised, with subtle colour badges.
export default function PhotoTab({ projectId, canEdit }) {
  const { bootstrap } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const fileRef = useRef(null);
  const [photos, setPhotos] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadCat, setUploadCat] = useState('');
  const [filterCat, setFilterCat] = useState('');

  // Categories may be legacy strings or { name, color } objects.
  const categories = (bootstrap?.settings?.photos?.categories || []).map((c) =>
    typeof c === 'string' ? { name: c, color: '#64748b' } : { name: c.name || '', color: c.color || '#64748b' },
  );
  const colorFor = (name) => categories.find((c) => c.name === name)?.color || '#94a3b8';

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
        const photo = await createPhoto({ projectId, name: file.name, mimeType: file.type, category: uploadCat || undefined, data });
        setPhotos((list) => [photo, ...(list || [])]);
      }
      toast.success(`${files.length} file(s) uploaded`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const changeCategory = async (p, category) => {
    setPhotos((list) => list.map((x) => (x.id === p.id ? { ...x, category } : x))); // optimistic
    try {
      await updatePhoto(p.id, { category: category || null });
    } catch (e) {
      toast.error(errorMessage(e));
      load();
    }
  };

  const remove = async (p) => {
    const ok = await confirm({ title: 'Delete file?', message: 'This item will be removed.', confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      await deletePhoto(p.id);
      setPhotos((list) => list.filter((x) => x.id !== p.id));
    } catch (e) { toast.error(errorMessage(e)); }
  };

  if (photos === null) return <div className="flex justify-center p-8"><Spinner /></div>;

  const visible = filterCat ? photos.filter((p) => (p.category || '') === filterCat) : photos;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {canEdit && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
              multiple
              hidden
              onChange={onFiles}
            />
            <select className="input w-auto" value={uploadCat} onChange={(e) => setUploadCat(e.target.value)} title="Category for new uploads">
              <option value="">Uncategorised</option>
              {categories.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
            <button className="btn-secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Spinner className="h-4 w-4" /> : '+ Upload Photos & Docs'}
            </button>
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs text-slate-500">Filter</label>
          <select className="input w-auto" value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-slate-400">No files{filterCat ? ' in this category' : ' uploaded yet'}.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {visible.map((p) => {
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
                {/* Subtle category badge */}
                {p.category && (
                  <span
                    className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                    style={{ backgroundColor: `${colorFor(p.category)}26`, color: colorFor(p.category) }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colorFor(p.category) }} />
                    {p.category}
                  </span>
                )}
                {canEdit && (
                  <button
                    className="absolute right-1 top-1 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white opacity-0 transition group-hover:opacity-100"
                    onClick={() => remove(p)}
                  >
                    &times;
                  </button>
                )}
                <div className="flex items-center gap-1 px-2 py-1">
                  {p.name && <span className="min-w-0 flex-1 truncate text-xs text-slate-500">{p.name}</span>}
                  {canEdit && (
                    <select
                      className="max-w-[92px] shrink-0 rounded border border-cream-300 bg-transparent px-1 py-0.5 text-[10px] text-slate-500 outline-none dark:border-slate-600"
                      value={p.category || ''}
                      onChange={(e) => changeCategory(p, e.target.value)}
                      title="Change category"
                    >
                      <option value="">Uncat.</option>
                      {categories.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
