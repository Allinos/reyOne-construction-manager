import { useEffect, useState } from 'react';
import { getConfig, updateConfig } from './api';
import { useToast } from '../../context/ToastContext';
import { errorMessage } from '../../lib/api';
import Modal from '../../components/Modal';
import { Spinner, Alert } from '../../components/ui';

const TEXT_FIELDS = [
  ['companyName', 'Company Name', 'e.g., reyOne Construction Pvt Ltd'],
  ['address', 'Address', 'e.g., 12 MG Road, Patna, Bihar 800001'],
  ['email', 'Email', 'e.g., accounts@reyone.com'],
  ['phone', 'Phone', 'e.g., +91 98765 43210'],
  ['website', 'Website', 'e.g., www.reyone.com'],
  ['gstNumber', 'GST / VAT Number', 'e.g., 22AAAAA0000A1Z5'],
  ['registrationNumber', 'Registration Number', 'e.g., U45200BR2020PTC012345'],
  ['bankName', 'Bank Name', 'e.g., HDFC Bank'],
  ['accountHolder', 'Account Holder Name', 'e.g., reyOne Construction Pvt Ltd'],
  ['accountNumber', 'Account Number', 'e.g., 50100123456789'],
  ['ifsc', 'IFSC / SWIFT Code', 'e.g., HDFC0001234'],
  ['branch', 'Branch Name', 'e.g., MG Road Branch'],
  ['upiId', 'UPI ID (optional)', 'e.g., reyone@hdfcbank'],
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
            {TEXT_FIELDS.map(([key, label, placeholder]) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input className="input" placeholder={placeholder} value={cfg[key] || ''} onChange={(e) => set(key, e.target.value)} />
              </div>
            ))}
          </div>

          <div>
            <label className="label">Terms &amp; Conditions</label>
            <textarea className="input" rows={3} placeholder="e.g., Payment due within 15 days. Goods once sold will not be taken back." value={cfg.terms || ''} onChange={(e) => set('terms', e.target.value)} />
          </div>
          <div>
            <label className="label">Default Notes</label>
            <textarea className="input" rows={2} placeholder="e.g., Thank you for your business." value={cfg.defaultNotes || ''} onChange={(e) => set('defaultNotes', e.target.value)} />
          </div>
        </div>
      )}
    </Modal>
  );
}
