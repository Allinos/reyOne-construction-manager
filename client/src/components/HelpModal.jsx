import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const DEFAULT_SECTIONS = [
  { key: 'tutorial', title: 'Tutorial', enabled: true, html: '', url: '' },
  { key: 'support', title: 'Support & Contact', enabled: true, html: '', url: '' },
  { key: 'faqs', title: 'FAQs', enabled: true, html: '', url: '' },
];

// Help centre popup. Shows only the sections enabled in Settings → System → Help.
// A section renders an external URL (in an iframe) when one is set, otherwise its
// configured HTML content.
export default function HelpModal({ open, onClose }) {
  const { bootstrap } = useAuth();
  const configured = bootstrap?.settings?.help?.sections || DEFAULT_SECTIONS;
  const sections = configured.filter((s) => s.enabled);
  const [active, setActive] = useState(sections[0]?.key || null);

  useEffect(() => {
    if (open) setActive((prev) => (sections.some((s) => s.key === prev) ? prev : sections[0]?.key || null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const current = sections.find((s) => s.key === active);

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex h-screen w-full flex-col bg-white shadow-2xl dark:bg-slate-900 sm:mt-8 sm:h-[80vh] sm:max-w-3xl sm:rounded-xl">
        <div className="flex items-center justify-between border-b border-cream-300 px-5 py-3 dark:border-slate-700">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Help Centre</h3>
          <button className="btn-ghost px-2 text-xl leading-none text-slate-400" onClick={onClose} aria-label="Close">&times;</button>
        </div>

        {sections.length === 0 ? (
          <div className="p-8 text-sm text-slate-400">No help content is enabled. An admin can configure it in Settings → System → Help.</div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
            {/* Section nav */}
            <nav className="flex gap-1 overflow-x-auto border-b border-cream-300 p-2 dark:border-slate-700 sm:w-48 sm:flex-col sm:overflow-x-visible sm:border-b-0 sm:border-r">
              {sections.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setActive(s.key)}
                  className={`whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                    active === s.key ? 'bg-brand-50 text-brand-700 dark:bg-slate-700' : 'text-slate-600 hover:bg-cream-200 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {s.title}
                </button>
              ))}
            </nav>

            {/* Content */}
            <div className="min-h-0 flex-1 overflow-auto">
              {!current ? null : current.url ? (
                <iframe title={current.title} src={current.url} className="h-full w-full border-0" />
              ) : (
                <div
                  className="help-content p-5 text-slate-700 dark:text-slate-200"
                  // Admin-configured content only.
                  dangerouslySetInnerHTML={{ __html: current.html || '<p style="color:#94a3b8">No content yet.</p>' }}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
