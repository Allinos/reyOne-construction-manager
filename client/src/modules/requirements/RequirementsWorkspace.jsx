import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import Icon from '../../components/Icon';
import TextTab from './TextTab';
import FormTab from './FormTab';
import TableTab from './TableTab';
import PhotoTab from './PhotoTab';

const TABS = [
  { key: 'req_text', label: 'Text Requirements', Comp: TextTab },
  { key: 'req_forms', label: 'Custom Forms', Comp: FormTab },
  { key: 'req_table', label: 'Excel Table', Comp: TableTab },
  { key: 'photo_upload', label: 'Photos', Comp: PhotoTab },
];

// Large, full-screen-capable workspace launched from a Project Detail page.
// Each tab is an independently toggleable sub-module (req_text, req_forms,
// req_table, photo_upload) — only enabled ones appear.
function Workspace({ projectId, onClose }) {
  const { bootstrap, can } = useAuth();
  const canEdit = can('requirements.update');
  const enabled = useMemo(() => new Set((bootstrap?.modules || []).map((m) => m.key)), [bootstrap]);
  const tabs = useMemo(() => TABS.filter((t) => enabled.has(t.key)), [enabled]);
  const [active, setActive] = useState(tabs[0]?.key || null);
  const [full, setFull] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const ActiveComp = tabs.find((t) => t.key === active)?.Comp;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={`relative flex flex-col bg-white shadow-xl dark:bg-slate-900 ${
          full
            ? 'h-screen w-screen rounded-none'
            : 'mt-0 h-screen w-full rounded-none sm:mt-6 sm:h-[85vh] sm:max-w-5xl sm:rounded-xl'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-cream-300 px-5 py-3 dark:border-slate-700">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Requirements &amp; Details</h3>
          <div className="flex items-center gap-1">
            <button className="btn-ghost px-2" title={full ? 'Exit full screen' : 'Full screen'} onClick={() => setFull((f) => !f)}>
              <Icon name="fullscreen" className="h-5 w-5" />
            </button>
            <button className="btn-ghost px-2 text-xl leading-none text-slate-400" onClick={onClose} aria-label="Close">&times;</button>
          </div>
        </div>

        {tabs.length === 0 ? (
          <div className="p-8 text-sm text-slate-400">No requirement sections are enabled. Enable them in the Module Manager.</div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-1 overflow-x-auto border-b border-cream-300 px-3 dark:border-slate-700">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium ${
                    active === t.key
                      ? 'border-brand-500 text-brand-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                  onClick={() => setActive(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {ActiveComp && <ActiveComp key={active} projectId={projectId} canEdit={canEdit} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Button + modal wrapper dropped into the Project Detail page.
export default function RequirementsButton({ projectId }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-secondary" onClick={() => setOpen(true)}>
        <span className="mr-1.5 inline-flex align-middle"><Icon name="modules" className="h-4 w-4" /></span>
        Requirements &amp; Details
      </button>
      {open && <Workspace projectId={projectId} onClose={() => setOpen(false)} />}
    </>
  );
}
