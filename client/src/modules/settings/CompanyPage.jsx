import { useEffect, useState } from 'react';
import { getCompany, updateCompany } from './api';
import { useAuth } from '../../context/AuthContext';
import { errorMessage } from '../../lib/api';
import { Card, Spinner, Alert } from '../../components/ui';

const fields = [
  { key: 'name', label: 'Company Name', required: true },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'logoUrl', label: 'Logo URL' },
  { key: 'currency', label: 'Currency (e.g. INR)' },
  { key: 'timezone', label: 'Timezone' },
];

export default function CompanyPage() {
  const { reloadBootstrap } = useAuth();
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
    } catch (err) {
      setState({ saving: false, error: errorMessage(err), saved: false });
    }
  };

  return (
    <form onSubmit={save} className="max-w-2xl">
      {state.error && <Alert>{state.error}</Alert>}
      {state.saved && <Alert type="success">Company profile saved.</Alert>}
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
            {state.saving ? <Spinner className="h-4 w-4" /> : 'Save Changes'}
          </button>
        </div>
      </Card>
    </form>
  );
}
