import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { formatMoney, formatDate } from '../../lib/format';
import { Card, Spinner, EmptyState } from '../../components/ui';
import InstallmentStatus from './InstallmentStatus';
import { getCollections } from './accountsApi';

export default function CollectionsPage() {
  const { bootstrap } = useAuth();
  const navigate = useNavigate();
  const money = (v) => formatMoney(v, bootstrap?.company?.currency || 'INR');
  const [groupBy, setGroupBy] = useState('project');
  const [onlyDue, setOnlyDue] = useState(false);
  const [data, setData] = useState(null);
  useEffect(() => { setData(null); getCollections({ groupBy }).then(setData).catch(() => setData({ rows: [], totals: {} })); }, [groupBy]);
  const rows = (data?.rows || []).filter((r) => !onlyDue || r.outstanding > 0);

  return (
    <>
      {data && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="card px-4 py-3"><p className="text-xs text-slate-500">Contract value</p><p className="text-lg font-semibold">{money(data.totals.value || 0)}</p></div>
          <div className="card px-4 py-3"><p className="text-xs text-slate-500">Collected</p><p className="text-lg font-semibold text-green-600">{money(data.totals.received || 0)}</p></div>
          <div className="card px-4 py-3"><p className="text-xs text-slate-500">Outstanding</p><p className="text-lg font-semibold text-red-600">{money(data.totals.outstanding || 0)}</p></div>
          <div className="card px-4 py-3"><p className="text-xs text-slate-500">Overdue installments</p><p className="text-lg font-semibold text-red-700">{money(data.totals.overdue || 0)}</p></div>
        </div>
      )}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {[['project', 'Project-wise'], ['client', 'Client-wise']].map(([k, l]) => (
          <button key={k} onClick={() => setGroupBy(k)} className={`rounded-full px-3 py-1.5 text-sm font-medium ${groupBy === k ? 'bg-brand-500 text-brand-900' : 'bg-cream-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>{l}</button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><input type="checkbox" checked={onlyDue} onChange={(e) => setOnlyDue(e.target.checked)} /> Only with outstanding</label>
      </div>
      <Card className="!p-0 overflow-hidden">
        {!data ? <div className="flex justify-center p-10"><Spinner /></div> : rows.length === 0 ? <div className="p-6"><EmptyState title="Nothing to show" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream-100 text-left text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-3">{groupBy === 'client' ? 'Client' : 'Project'}</th>
                  {groupBy === 'client' && <th className="px-3 py-3 text-right">Projects</th>}
                  <th className="px-3 py-3 text-right">Value</th>
                  <th className="px-3 py-3 text-right">Collected</th>
                  <th className="px-3 py-3 text-right">Outstanding</th>
                  <th className="px-3 py-3 text-right">Overdue</th>
                  <th className="px-3 py-3">{groupBy === 'client' ? 'Last payment' : 'Next due'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200 dark:divide-slate-700">
                {rows.map((r) => (
                  <tr key={r.projectId || r.clientName} className={r.projectId ? 'cursor-pointer hover:bg-cream-50 dark:hover:bg-slate-800/60' : ''} onClick={() => r.projectId && navigate(`/finance/project?projectId=${r.projectId}`)}>
                    <td className="px-4 py-2.5"><p className="font-medium">{r.projectName || r.clientName}</p>{r.projectId && <p className="text-xs text-slate-400">{r.clientName}</p>}</td>
                    {groupBy === 'client' && <td className="px-3 py-2.5 text-right">{r.projects}</td>}
                    <td className="px-3 py-2.5 text-right">{money(r.value)}</td>
                    <td className="px-3 py-2.5 text-right text-green-600">{money(r.received)}</td>
                    <td className={`px-3 py-2.5 text-right ${r.outstanding ? 'font-semibold text-red-600' : 'text-slate-400'}`}>{money(r.outstanding)}</td>
                    <td className={`px-3 py-2.5 text-right ${r.overdueAmount ? 'font-semibold text-red-700' : 'text-slate-400'}`}>{money(r.overdueAmount)}</td>
                    <td className="px-3 py-2.5">
                      {groupBy === 'client' ? formatDate(r.lastPaymentDate) : r.nextDue ? <span className="flex items-center gap-2"><InstallmentStatus status={r.nextDue.status} /><span className="text-xs text-slate-500">{formatDate(r.nextDue.dueDate)}</span></span> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
