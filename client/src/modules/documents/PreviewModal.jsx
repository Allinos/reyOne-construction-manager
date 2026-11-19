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
  const SAMPLE = {
    description: ['M20 RCC for slab incl. shuttering', 'Brickwork in CM 1:6, 230 mm'], hsn: ['995411', '995411'], unit: ['cum', 'sqm'],
    location: ['Ground floor', 'First floor'], agency: ['Ram Constructions', 'Own labour'], supplier: ['ABC Traders', 'Shree Cement'],
    remarks: ['', 'As per drawing'], status: ['Open', 'Done'], responsibility: ['Civil team', 'Painter'], result: ['OK', 'OK'], regNo: ['BR01-1234', ''],
  };
  for (const f of tpl?.fields || []) {
    if (f.legacy) continue;
    if (f.type === 'items') {
      const cols = f.columns || [{ key: 'description' }, { key: 'qty', type: 'number' }, { key: 'rate', type: 'money' }];
      out[f.key] = [0, 1].map((i) => Object.fromEntries(cols.filter((c) => !c.calc).map((c) => {
        if (SAMPLE[c.key]) return [c.key, SAMPLE[c.key][i]];
        if (c.type === 'money') return [c.key, i ? '1250' : '5400'];
        if (c.type === 'number') return [c.key, i ? '4' : '10'];
        if (c.type === 'date') return [c.key, localDate()];
        return [c.key, `${c.label} ${i + 1}`];
      })));
    } else if (f.default != null && f.default !== '') out[f.key] = f.default;
    else if (f.type === 'date') out[f.key] = localDate();
    else if (f.type === 'select') out[f.key] = (f.options || []).find(Boolean) || '';
    else if (f.type === 'number') out[f.key] = f.key === 'taxPercent' ? '18' : '5';
    else if (f.type === 'money') out[f.key] = '10000';
    else out[f.key] = `[${f.label}]`;
  }
  return out;
}
