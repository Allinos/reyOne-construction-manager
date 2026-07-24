import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getClient, updateClient } from './api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { errorMessage } from '../../lib/api';
import { formatMoney, formatDate } from '../../lib/format';
import { PageHeader, Card, FullPageLoader, Alert, StatusBadge } from '../../components/ui';
import Modal from '../../components/Modal';
import Icon from '../../components/Icon';

function Stat({ label, value, accent }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-2xl font-semibold ${accent || 'text-slate-800 dark:text-slate-100'}`}>{value}</span>
    </Card>
  );
}
function Info({ label, value }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-slate-500">{label}:</span>
      <span className="font-medium text-slate-700 dark:text-slate-200">{value || '—'}</span>
    </div>
  );
}

const EDIT_FIELDS = [
  ['contactPerson', 'Contact Person'],
  ['phone', 'Phone'],
  ['email', 'Email'],
  ['gstNumber', 'GST Number'],
  ['address', 'Address'],
];

export default function ClientProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { bootstrap, can } = useAuth();
  const toast = useToast();
  const currency = bootstrap?.company?.currency || 'INR';
  const statuses = bootstrap?.settings?.projects?.statuses || [];
  const statusLabel = (key) => statuses.find((s) => s.key === key)?.label || key;

  const [client, setClient] = useState(null);
  const [error, setError] = useState('');
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    getClient(id).then(setClient).catch((err) => setError(errorMessage(err)));
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateClient(id, edit);
      toast.success('Client updated');
      setEdit(null);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (error) return <Alert>{error}</Alert>;
  if (!client) return <FullPageLoader />;

  return (
    <div>
      <PageHeader
        title={client.name}
        subtitle="Client profile"
        actions={
          <div className="flex gap-2">
            <button className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-white hover:bg-brand-600" onClick={() => navigate('/clients')} aria-label="Back">
              <Icon name="arrowLeft" className="h-4 w-4" />
            </button>
            {can('clients.update') && (
              <button className="btn-secondary" onClick={() => setEdit({ contactPerson: client.contactPerson || '', phone: client.phone || '', email: client.email || '', gstNumber: client.gstNumber || '', address: client.address || '' })}>
                Edit
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Total Projects" value={client.totalProjects} />
        <Stat label="Active Projects" value={client.activeProjects} accent="text-blue-600" />
        <Stat label="Completed" value={client.completedProjects} accent="text-green-600" />
      </div>

      <Card className="mt-6">
        <h3 className="mb-3 font-semibold text-slate-700 dark:text-slate-200">Contact Information</h3>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <Info label="Contact Person" value={client.contactPerson} />
          <Info label="Phone" value={client.phone} />
          <Info label="Email" value={client.email} />
          <Info label="GST Number" value={client.gstNumber} />
          <Info label="Address" value={client.address} />
        </div>
      </Card>

      <Card className="mt-6 !p-0 overflow-hidden">
        <div className="border-b border-cream-300 px-5 py-3 font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Projects</div>
        {client.projects.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">No projects.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream-100 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Reference</th>
                  <th className="px-4 py-3 font-medium">Project</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {client.projects.map((p) => (
                  <tr key={p.id} className="cursor-pointer hover:bg-cream-100" onClick={() => navigate(`/projects/${p.id}`)}>
                    <td className="px-4 py-3 font-medium text-brand-700 dark:text-brand-300">{p.referenceNumber}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{p.name}</td>
                    <td className="px-4 py-3 text-slate-600">{formatMoney(p.projectAmount, currency)}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(p.agreementDate)}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} label={statusLabel(p.status)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={Boolean(edit)}
        onClose={() => setEdit(null)}
        title="Edit Client"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setEdit(null)}>Cancel</button>
            <button className="btn-primary" form="client-form" disabled={saving}>Save</button>
          </>
        }
      >
        {edit && (
          <form id="client-form" onSubmit={save} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {EDIT_FIELDS.map(([key, label]) => (
              <div key={key} className={key === 'address' ? 'sm:col-span-2' : ''}>
                <label className="label">{label}</label>
                <input className="input" value={edit[key]} onChange={(e) => setEdit((s) => ({ ...s, [key]: e.target.value }))} />
              </div>
            ))}
          </form>
        )}
      </Modal>
    </div>
  );
}
