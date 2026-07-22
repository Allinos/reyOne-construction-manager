import { useEffect, useState } from 'react';
import { getConfig, updateConfig } from './api';
import { useToast } from '../../context/ToastContext';
import { errorMessage } from '../../lib/api';
import Modal from '../../components/Modal';
import { Spinner, Alert } from '../../components/ui';

const TEXT_FIELDS = [
  ['companyName', 'Company Name'],
  ['address', 'Address'],
  ['email', 'Email'],
  ['phone', 'Phone'],
  ['website', 'Website'],
  ['gstNumber', 'GST / VAT Number'],
  ['registrationNumber', 'Registration Number'],
  ['bankName', 'Bank Name'],
  ['accountHolder', 'Account Holder Name'],
  ['accountNumber', 'Account Number'],
  ['ifsc', 'IFSC / SWIFT Code'],
  ['branch', 'Branch Name'],
  ['upiId', 'UPI ID (optional)'],
];

const readFile = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

export default function ConfigModal({ open, onClose, onSaved }) {
  const toast = useToast();
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    getConfig().then((c) => setCfg(c || {})).catch((err) => setError(errorMessage(err)));
  }, [open]);

  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));

  const onImage = async (key, file) => {
    if (!file) return;
    if (file.size > 500 * 1024) {
      toast.error('Please use an image under 500 KB.');
      return;
    }
    set(key, await readFile(file));
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateConfig(cfg);
      toast.success('Company configuration saved');
      onSaved?.(cfg);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Company Configuration"
      wide
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving || !cfg}>{saving ? <Spinner className="h-4 w-4" /> : 'Save'}</button>
        </>
      }
    >
      {error && <Alert>{error}</Alert>}
      {!cfg ? (
        <div className="flex justify-center p-6"><Spinner /></div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Company Logo</label>
              <div className="flex items-center gap-3">
                {cfg.logoUrl && <img src={cfg.logoUrl} alt="logo" className="h-12 rounded border border-cream-300 object-contain" />}
                <input type="file" accept="image/*" onChange={(e) => onImage('logoUrl', e.target.files[0])} className="text-sm" />
              </div>
            </div>
            <div>
              <label className="label">Signature Image</label>
              <div className="flex items-center gap-3">
                {cfg.signatureUrl && <img src={cfg.signatureUrl} alt="signature" className="h-12 rounded border border-cream-300 object-contain" />}
                <input type="file" accept="image/*" onChange={(e) => onImage('signatureUrl', e.target.files[0])} className="text-sm" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {TEXT_FIELDS.map(([key, label]) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input className="input" value={cfg[key] || ''} onChange={(e) => set(key, e.target.value)} />
              </div>
            ))}
          </div>

          <div>
            <label className="label">Terms &amp; Conditions</label>
            <textarea className="input" rows={3} value={cfg.terms || ''} onChange={(e) => set('terms', e.target.value)} />
          </div>
          <div>
            <label className="label">Default Notes</label>
            <textarea className="input" rows={2} value={cfg.defaultNotes || ''} onChange={(e) => set('defaultNotes', e.target.value)} />
          </div>
        </div>
      )}
    </Modal>
  );
}
