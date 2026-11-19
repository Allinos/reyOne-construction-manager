import { useEffect, useState } from 'react';
import { getCompany, updateCompany, updateSetting } from './api';
import api, { unwrap } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { errorMessage } from '../../lib/api';
import { Card, Spinner, Alert } from '../../components/ui';

const fields = [
  { key: 'name', label: 'Company name', required: true },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'logoUrl', label: 'Logo URL (https://…)' },
  { key: 'currency', label: 'Currency code (e.g. INR)' },
  { key: 'timezone', label: 'Timezone' },
];

const TAX_FIELDS = [
  { key: 'gstin', label: 'GSTIN', placeholder: '15-character GST number' },
  { key: 'pan', label: 'PAN', placeholder: 'ABCDE1234F' },
  { key: 'stateName', label: 'State & code', placeholder: 'e.g. Bihar (10)' },
  { key: 'bankName', label: 'Bank name' },
  { key: 'accountHolder', label: 'Account name' },
  { key: 'accountNumber', label: 'Account number' },
  { key: 'ifsc', label: 'IFSC' },
  { key: 'branch', label: 'Branch' },
  { key: 'upiId', label: 'UPI ID' },
  { key: 'signatureUrl', label: 'Signature image URL (optional)' },
];

// GSTIN, PAN and bank details printed on invoices, quotations and other documents.
function TaxBankCard() {
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    unwrap(api.get('/settings/documents')).then((g) => setForm((g && g.branding) || {})).catch(() => setForm({}));
  }, []);
  if (!form) return null;
  const save = async () => {
    setSaving(true);
    try {
      const value = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));
      if (value.gstin) value.gstin = value.gstin.toUpperCase();
      if (value.pan) value.pan = value.pan.toUpperCase();
      if (value.ifsc) value.ifsc = value.ifsc.toUpperCase();
      if (value.gstin && !/^[0-9]{2}[A-Z0-9]{13}$/.test(value.gstin)) { toast.error('GSTIN should be 15 characters, starting with the 2-digit state code'); setSaving(false); return; }
      await updateSetting('documents', 'branding', value);
      toast.success('Tax & bank details saved — they now print on your documents');
    } catch (err) { toast.error(errorMessage(err)); } finally { setSaving(false); }
  };
  return (
    <Card className="mt-4">
      <h3 className="font-semibold text-slate-800 dark:text-slate-100">Tax &amp; bank details</h3>
      <p className="mb-3 text-xs text-slate-500">Printed on tax invoices, quotations, RA bills and other documents.</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {TAX_FIELDS.map((f) => (
          <div key={f.key} className={f.key === 'signatureUrl' ? 'md:col-span-2' : ''}>
            <label className="label">{f.label}</label>
            <input className="input" placeholder={f.placeholder || ''} value={form[f.key] || ''} onChange={(e) => setForm((x) => ({ ...x, [f.key]: e.target.value }))} />
          </div>
        ))}
        <div className="md:col-span-3">
          <label className="label">Document footer (optional)</label>
          <input className="input" placeholder="e.g. Registered office: … | CIN: …" value={form.footer || ''} onChange={(e) => setForm((x) => ({ ...x, footer: e.target.value }))} />
        </div>
      </div>
      <div className="mt-4 flex justify-end"><button type="button" className="btn-primary" disabled={saving} onClick={save}>{saving ? <Spinner className="h-4 w-4" /> : 'Save tax & bank details'}</button></div>
    </Card>
  );
}

export default function CompanyPage() {
  const { reloadBootstrap } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [state, setState] = useState({ saving: false, error: '', saved: false });

  useEffect(() => {
    getCompany().then((c) => setForm(c || {})).catch(() => setForm({}));
  }, []);

  if (!form) return <div className="flex justify-center p-10"><Spinner /></div>;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    setState({ saving: true, error: '', saved: false });
    try {
      const body = {};
      fields.forEach((f) => { body[f.key] = form[f.key] || (f.key === 'name' ? form.name : null); });
      body.address = form.address || null;
      await updateCompany(body);
      await reloadBootstrap(); // refresh branding in the shell
      setState({ saving: false, error: '', saved: true });
      toast.success('Company profile saved');
    } catch (err) {
      setState({ saving: false, error: errorMessage(err), saved: false });
    }
  };

  return (
    <form onSubmit={save} className="max-w-3xl">
      {state.error && <Alert>{state.error}</Alert>}
      <Card>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="label">{f.label}</label>
              <input
                type={f.type || 'text'}
                className="input"
                value={form[f.key] || ''}
                onChange={(e) => set(f.key, e.target.value)}
                required={f.required}
              />
            </div>
          ))}
          <div className="md:col-span-2">
            <label className="label">Address</label>
            <textarea className="input" rows={3} value={form.address || ''} onChange={(e) => set('address', e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button className="btn-primary" disabled={state.saving}>
            {state.saving ? <Spinner className="h-4 w-4" /> : 'Save changes'}
          </button>
        </div>
      </Card>
      <TaxBankCard />
    </form>
  );
}
