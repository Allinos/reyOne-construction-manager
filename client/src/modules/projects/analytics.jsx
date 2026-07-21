import { useEffect, useState } from 'react';
import { projectAnalytics } from './api';
import { useAuth } from '../../context/AuthContext';
import { errorMessage } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import { Spinner, Alert, Card } from '../../components/ui';
import { HBars } from '../../components/charts';
import { statusColor } from '../../lib/status';

export function ProjectAnalytics({ open }) {
  const { bootstrap } = useAuth();
  const currency = bootstrap?.company?.currency || 'INR';
  const statuses = bootstrap?.settings?.projects?.statuses || [];
  const statusLabel = (key) => statuses.find((s) => s.key === key)?.label || key;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setData(null);
    setError('');
    projectAnalytics().then(setData).catch((err) => setError(errorMessage(err)));
  }, [open]);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <div className="flex justify-center p-6"><Spinner /></div>;

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-cream-300 bg-cream-100 px-4 py-3">
          <p className="text-xs text-slate-500">Total Projects</p>
          <p className="text-lg font-semibold text-slate-800">{data.totalProjects}</p>
        </div>
        <div className="rounded-lg border border-cream-300 bg-cream-100 px-4 py-3">
          <p className="text-xs text-slate-500">Total Project Value</p>
          <p className="text-lg font-semibold text-brand-600">{formatMoney(data.totalValue, currency)}</p>
        </div>
      </div>
      <Card>
        <h3 className="mb-3 font-semibold text-slate-700">Projects by Status</h3>
        <HBars items={data.byStatus.map((s) => ({ label: statusLabel(s.label), value: s.value, color: statusColor(s.label) }))} />
      </Card>
      <Card>
        <h3 className="mb-3 font-semibold text-slate-700">Projects by Category</h3>
        <HBars items={data.byCategory} color="#0ea5e9" />
      </Card>
    </>
  );
}
