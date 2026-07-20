import { useEffect, useState } from 'react';
import { getProjectSummary, projectOptions } from './api';
import { useAuth } from '../../context/AuthContext';
import { errorMessage } from '../../lib/api';
import { formatMoney, formatDate } from '../../lib/format';
import { PageHeader, Card, Spinner, EmptyState, Alert } from '../../components/ui';

function Stat({ label, value, accent }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-xl font-semibold ${accent || 'text-slate-800'}`}>{value}</span>
    </Card>
  );
}

export default function ProjectFinancePage() {
  const { bootstrap } = useAuth();
  const currency = bootstrap?.company?.currency || 'INR';
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState('');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    projectOptions().then(setProjects).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) {
      setSummary(null);
      return;
    }
    setLoading(true);
    setError('');
    getProjectSummary(selected)
      .then(setSummary)
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [selected]);

  return (
    <div>
      <PageHeader title="Project Finance" subtitle="Per-project financial records" />

      <Card className="mb-4">
        <label className="label">Select a project</label>
        <select className="input md:w-96" value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Choose…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.referenceNumber} — {p.name}
            </option>
          ))}
        </select>
      </Card>

      {error && <Alert>{error}</Alert>}
      {loading && <div className="flex justify-center p-10"><Spinner /></div>}

      {!selected && !loading && <EmptyState title="Pick a project to view its finance summary" />}

      {summary && !loading && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Total Amount" value={formatMoney(summary.totalAmount, currency)} />
            <Stat label="Received" value={formatMoney(summary.receivedAmount, currency)} accent="text-green-600" />
            <Stat label="Balance" value={formatMoney(summary.balanceAmount, currency)} accent="text-red-600" />
            <Stat label="Advance" value={formatMoney(summary.advanceAmount, currency)} />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="mb-3 font-semibold text-slate-700">Phase-wise Payments</h2>
              {summary.phaseWise.length ? (
                <ul className="divide-y divide-cream-200">
                  {summary.phaseWise.map((p, i) => (
                    <li key={i} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-slate-600">{p.phaseName}</span>
                      <span className="font-medium text-slate-800">{formatMoney(p.received, currency)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400">No phase-wise payments.</p>
              )}
            </Card>

            <Card>
              <h2 className="mb-3 font-semibold text-slate-700">Payment History</h2>
              {summary.payments.length ? (
                <ul className="divide-y divide-cream-200">
                  {summary.payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-slate-600">
                        {formatDate(p.date)} · <span className="text-slate-400">{p.method}</span>
                      </span>
                      <span className="font-medium text-green-700">{formatMoney(p.amount, currency)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400">No payments recorded.</p>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
