import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getVendorLedger } from './api';
import { useAuth } from '../../context/AuthContext';
import { errorMessage } from '../../lib/api';
import { formatMoney, formatDate } from '../../lib/format';
import { PageHeader, Card, FullPageLoader, Alert } from '../../components/ui';
import Attachments from '../../components/Attachments';
import StarRating from '../../components/StarRating';
import api, { unwrap } from '../../lib/api';
import Icon from '../../components/Icon';

const PAY_BADGE = {
  PAID: 'bg-green-100 text-green-700',
  PARTIAL: 'bg-amber-100 text-amber-700',
  CREDIT: 'bg-red-100 text-red-600',
};

function Stat({ label, value, accent }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-2xl font-semibold ${accent || 'text-slate-800 dark:text-slate-100'}`}>{value}</span>
    </Card>
  );
}

function VendorPurchases({ vendorId }) {
  const { bootstrap } = useAuth();
  const money = (v) => formatMoney(v, bootstrap?.company?.currency || 'INR');
  const [data, setData] = useState(null);
  useEffect(() => { unwrap(api.get(`/vendors/${vendorId}/purchases`)).then(setData).catch(() => setData({ items: [], totalValue: 0 })); }, [vendorId]);
  if (!data || !data.items.length) return null;
  return (
    <Card className="mt-6 !p-0 overflow-hidden">
      <div className="flex items-center justify-between border-b border-cream-300 px-5 py-3 dark:border-slate-700">
        <span className="font-semibold text-slate-700 dark:text-slate-200">Material Purchase History</span>
        <span className="text-sm font-semibold text-brand-600">{money(data.totalValue)}</span>
      </div>
      <div className="max-h-80 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-cream-100 text-left text-xs text-slate-500 dark:bg-slate-800"><tr><th className="px-4 py-2">Date</th><th className="px-3 py-2">Material</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Rate</th><th className="px-3 py-2 text-right">Value</th><th className="px-3 py-2">Delivered to</th></tr></thead>
          <tbody className="divide-y divide-cream-200 dark:divide-slate-700">
            {data.items.map((i) => (
              <tr key={i.id}><td className="px-4 py-2">{formatDate(i.date)}</td><td className="px-3 py-2 font-medium">{i.materialName}</td><td className="px-3 py-2 text-right">{i.quantity} {i.unit}</td><td className="px-3 py-2 text-right">{i.rate != null ? money(i.rate) : '—'}</td><td className="px-3 py-2 text-right">{i.value != null ? money(i.value) : '—'}</td><td className="px-3 py-2 text-slate-500">{i.location}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function VendorLedgerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { bootstrap, can } = useAuth();
  const currency = bootstrap?.company?.currency || 'INR';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getVendorLedger(id).then(setData).catch((err) => setError(errorMessage(err)));
  }, [id]);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <FullPageLoader />;

  const v = data.vendor;

  return (
    <div>
      <PageHeader
        title={v.name}
        subtitle={[v.contactPerson, v.phone, v.gstNumber, v.address].filter(Boolean).join(' · ') || 'Vendor ledger'}
        actions={
          <div className="flex items-center gap-3">
          {v.rating ? <span title={v.ratingNote || ''}><StarRating value={v.rating} size="text-xl" /></span> : null}
          <button className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-brand-900 hover:bg-brand-400" onClick={() => navigate('/vendors')} aria-label="Back">
            <Icon name="arrowLeft" className="h-4 w-4" />
          </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Total Purchase" value={formatMoney(data.totals.purchase, currency)} />
        <Stat label="Total Paid" value={formatMoney(data.totals.paid, currency)} accent="text-green-600" />
        <Stat label="Outstanding" value={formatMoney(data.totals.outstanding, currency)} accent="text-red-600" />
      </div>

      <VendorPurchases vendorId={Number(id)} />
      <Card className="mt-6"><Attachments entityType="vendor_bill" entityId={Number(id)} canUpload={can('vendors.update')} label="Bills & invoices" capture /></Card>

      <Card className="mt-6 !p-0 overflow-hidden">
        <div className="border-b border-cream-300 px-5 py-3 font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
          Expense &amp; Payment History
        </div>
        {data.expenses.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">No expenses recorded for this vendor.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream-100 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Project</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Paid</th>
                  <th className="px-4 py-3 font-medium">Balance</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {data.expenses.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-3 text-slate-500">{formatDate(e.date)}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {e.projectId ? (
                        <Link to={`/projects/${e.projectId}`} className="text-brand-600 hover:underline">{e.projectName || `#${e.projectId}`}</Link>
                      ) : (
                        'Company'
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{e.category}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{formatMoney(e.amount, currency)}</td>
                    <td className="px-4 py-3 text-green-700">{formatMoney(e.amountPaid, currency)}</td>
                    <td className="px-4 py-3 text-red-600">{formatMoney(e.remaining, currency)}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${PAY_BADGE[e.paymentStatus] || 'bg-cream-200 text-slate-600'}`}>{e.paymentStatus}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
