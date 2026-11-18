import { useEffect, useState } from 'react';
import Modal from '../../components/Modal';
import Icon from '../../components/Icon';
import { Spinner } from '../../components/ui';
import { printHtml } from './print';
import { localDate } from '../../lib/format';

// In-place document preview: renders the HTML inside a sandboxed iframe so the
// user never leaves the page. `load` returns a promise of { html }.
export default function PreviewModal({ open, title, load, onClose, actions }) {
  const [html, setHtml] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setHtml(null);
    setError('');
    load()
      .then((r) => !cancelled && setHtml(r.html))
      .catch((e) => !cancelled && setError(e?.response?.data?.message || e.message || 'Could not load preview'));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      wide
      fullscreenable
      footer={
        <>
          <button className="btn-secondary" onClick={() => html && printHtml(html)} disabled={!html}>
            <Icon name="print" className="h-4 w-4" /> Print / PDF
          </button>
          {actions}
        </>
      }
    >
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : html == null ? (
        <div className="flex justify-center p-10"><Spinner /></div>
      ) : (
        <iframe title={title} srcDoc={html} sandbox="allow-same-origin" className="h-[65vh] w-full rounded-lg border border-slate-200 bg-white" />
      )}
    </Modal>
  );
}

// Sample values so an empty template preview shows its structure.
export function sampleData(tpl) {
  const out = {};
  for (const f of tpl?.fields || []) {
    if (f.type === 'items') {
      out[f.key] = [
        { description: 'Sample item 1', qty: '10', rate: '500' },
        { description: 'Sample item 2', qty: '4', rate: '1250' },
      ];
    } else if (f.type === 'date') out[f.key] = localDate();
    else if (f.type === 'number' || f.type === 'money') out[f.key] = '10000';
    else out[f.key] = `[${f.label}]`;
  }
  return out;
}
