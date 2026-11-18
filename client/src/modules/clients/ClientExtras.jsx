import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { unwrap, errorMessage } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatMoney, formatDate, formatDateTime } from '../../lib/format';
import { Card, Spinner } from '../../components/ui';
import Attachments from '../../components/Attachments';
import InstallmentStatus from '../finance/InstallmentStatus';
import { getReceipt } from '../finance/accountsApi';
import { printHtml } from '../documents/print';
import Select from '../../components/Select';

const NOTE_TYPES = { note: 'Note', call: 'Call', meeting: 'Meeting', email: 'Email', site_visit: 'Site visit', whatsapp: 'WhatsApp' };
const NOTE_DOT = { note: 'bg-slate-400', call: 'bg-green-500', meeting: 'bg-purple-500', email: 'bg-sky-500', site_visit: 'bg-orange-500', whatsapp: 'bg-emerald-500' };

export function ClientAccount({ clientId }) {
  const { bootstrap, can } = useAuth();
  const navigate = useNavigate();
  const money = (v) => formatMoney(v, bootstrap?.company?.currency || 'INR');
  const [data, setData] = useState(null);
  useEffect(() => { unwrap(api.get(`/clients/${clientId}/account`)).then(setData).catch(() => setData({ restricted: true })); }, [clientId]);
  if (!can('finance.read')) return null;
  if (!data) return <div className="flex justify-center p-6"><Spinner /></div>;
  if (data.restricted) return null;
  const receipt = async (id) => { try { const { html } = await getReceipt(id); printHtml(html); } catch (e) { alert(errorMessage(e)); } };

  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="card px-4 py-3"><p className="text-xs text-slate-500">Total contract value</p><p className="text-lg font-semibold">{money(data.totals.value)}</p></div>
        <div className="card px-4 py-3"><p className="text-xs text-slate-500">Collected</p><p className="text-lg font-semibold text-green-600">{money(data.totals.received)}</p></div>
        <div className="card px-4 py-3"><p className="text-xs text-slate-500">Outstanding</p><p className="text-lg font-semibold text-red-600">{money(data.totals.outstanding)}</p></div>
        <div className="card px-4 py-3"><p className="text-xs text-slate-500">Overdue</p><p className={`text-lg font-semibold ${data.totals.overdue ? 'text-red-700' : ''}`}>{money(data.totals.overdue)}</p></div>
      </div>

      {data.projects.some((p) => p.installments.length) && (
        <Card className="mt-6 !p-0 overflow-hidden">
          <div className="border-b border-cream-300 px-5 py-3 font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Payment Schedule</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream-100 text-left text-xs text-slate-500 dark:bg-slate-800"><tr><th className="px-4 py-2">Project</th><th className="px-3 py-2">Installment</th><th className="px-3 py-2">Due</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-right">Balance</th><th className="px-3 py-2">Status</th></tr></thead>
              <tbody className="divide-y divide-cream-200 dark:divide-slate-700">
                {data.projects.flatMap((p) => p.installments.map((i) => (
                  <tr key={i.id} className="cursor-pointer hover:bg-cream-50 dark:hover:bg-slate-800/60" onClick={() => navigate(`/finance/project?projectId=${p.projectId}`)}>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{p.projectName}</td>
                    <td className="px-3 py-2 font-medium">{i.title}</td>
                    <td className="px-3 py-2">{formatDate(i.dueDate)}</td>
                    <td className="px-3 py-2 text-right">{money(i.amount)}</td>
                    <td className={`px-3 py-2 text-right ${i.balance > 0 ? 'font-medium' : 'text-slate-400'}`}>{money(i.balance)}</td>
                    <td className="px-3 py-2"><InstallmentStatus status={i.status} /></td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="mt-6 !p-0 overflow-hidden">
        <div className="border-b border-cream-300 px-5 py-3 font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Collection History</div>
        {data.payments.length === 0 ? <p className="p-5 text-sm text-slate-400">No payments received yet.</p> : (
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-cream-100 text-left text-xs text-slate-500 dark:bg-slate-800"><tr><th className="px-4 py-2">Date</th><th className="px-3 py-2">Project</th><th className="px-3 py-2">Method</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2" /></tr></thead>
              <tbody className="divide-y divide-cream-200 dark:divide-slate-700">
                {data.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2">{formatDate(p.date)}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{p.projectName}{p.notes ? <span className="block text-xs text-slate-400">{p.notes}</span> : null}</td>
                    <td className="px-3 py-2 text-slate-500">{p.method}</td>
                    <td className="px-3 py-2 text-right font-medium text-green-600">{money(p.amount)}</td>
                    <td className="px-3 py-2 text-right"><button className="pill bg-brand-50 text-brand-700 hover:bg-brand-100" onClick={() => receipt(p.id)}>Receipt</button></td>
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

export function ClientNotes({ clientId }) {
  const { user, can } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [type, setType] = useState('call');
  const [note, setNote] = useState('');
  const load = useCallback(() => unwrap(api.get(`/clients/${clientId}/notes`)).then(setRows).catch(() => setRows([])), [clientId]);
  useEffect(() => { load(); }, [load]);
  const add = async () => {
    if (!note.trim()) return;
    try { await unwrap(api.post(`/clients/${clientId}/notes`, { type, note: note.trim() })); setNote(''); load(); } catch (e) { toast.error(errorMessage(e)); }
  };
  const remove = async (n) => { try { await unwrap(api.delete(`/clients/${clientId}/notes/${n.id}`)); load(); } catch (e) { toast.error(errorMessage(e)); } };

  return (
    <Card className="mt-6">
      <h3 className="mb-3 font-semibold text-slate-700 dark:text-slate-200">Notes &amp; Communication</h3>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Select className="input sm:w-36" value={type} onChange={(e) => setType(e.target.value)}>{Object.entries(NOTE_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
        <textarea className="input flex-1" rows={2} placeholder="What was discussed? Next steps…" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn-primary sm:self-end" onClick={add} disabled={!note.trim()}>Log</button>
      </div>
      {!rows ? <Spinner /> : rows.length === 0 ? <p className="text-sm text-slate-400">No communication logged yet.</p> : (
        <ol className="relative space-y-4 border-l border-cream-300 pl-5 dark:border-slate-700">
          {rows.map((n) => (
            <li key={n.id} className="relative">
              <span className={`absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full ${NOTE_DOT[n.type] || 'bg-slate-400'}`} />
              <p className="text-xs text-slate-400"><span className="font-semibold text-slate-600 dark:text-slate-300">{NOTE_TYPES[n.type] || n.type}</span> · {n.createdByName || '—'} · {formatDateTime(n.createdAt)}
                {(n.createdById === user?.id || can('clients.update')) && <button className="ml-2 text-red-400 hover:underline" onClick={() => remove(n)}>delete</button>}
              </p>
              <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{n.note}</p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export function ClientDocuments({ clientId }) {
  const { can } = useAuth();
  return <Card className="mt-6"><Attachments entityType="client" entityId={clientId} canUpload={can('clients.update')} label="Client documents (agreements, IDs, approvals)" /></Card>;
}
