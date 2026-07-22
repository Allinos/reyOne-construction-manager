import { useEffect, useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { listDocuments, getDocument, deleteDocument, getConfig } from './api';
import { generateDocumentPdf } from './pdf';
import DocumentFormModal from './DocumentFormModal';
import ConfigModal from './ConfigModal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { errorMessage } from '../../lib/api';
import { formatMoney, formatDate } from '../../lib/format';
import { PageHeader, Card, Spinner, EmptyState, Pagination, Alert, StatusBadge } from '../../components/ui';
import Icon from '../../components/Icon';

const TABS = [
  { key: 'QUOTATION', label: 'Quotations' },
  { key: 'INVOICE', label: 'Invoices' },
];

export default function InvoicesPage() {
  const { bootstrap, can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const currency = bootstrap?.company?.currency || 'INR';

  const [type, setType] = useState('QUOTATION');
  const [result, setResult] = useState({ items: [], meta: null });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [config, setConfig] = useState({});
  const [form, setForm] = useState(null); // { docId } | { docId: null }
  const [showConfig, setShowConfig] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setResult(await listDocuments(type, { page }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [type, page]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    getConfig().then(setConfig).catch(() => {});
  }, []);

  const downloadPdf = async (row) => {
    try {
      const doc = await getDocument(row.id); // full doc incl items
      generateDocumentPdf(doc, config, currency);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const remove = async (row) => {
    const ok = await confirm({ title: 'Delete?', message: `Remove ${row.number}.`, confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      await deleteDocument(row.id);
      toast.success('Deleted');
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const isInvoice = type === 'INVOICE';

  // Module disabled → not accessible.
  const enabled = (bootstrap?.modules || []).some((m) => m.key === 'invoices');
  if (!enabled) return <Navigate to="/" replace />;

  return (
    <div>
      <PageHeader
        title="Invoices & Quotations"
        subtitle="Create, manage, and generate professional PDFs"
        actions={
          <div className="flex gap-2">
            {can('invoices.update') && (
              <button className="btn-secondary" onClick={() => setShowConfig(true)}>
                <Icon name="settings" className="h-4 w-4" /> Configuration
              </button>
            )}
            {can('invoices.create') && (
              <button className="btn-primary" onClick={() => setForm({ docId: null })}>
                + New {isInvoice ? 'Invoice' : 'Quotation'}
              </button>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div className="mb-5 inline-flex overflow-hidden rounded-lg border border-cream-300 dark:border-slate-700">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`px-5 py-2 text-sm font-medium ${type === t.key ? 'bg-brand-500 text-white' : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}
            onClick={() => { setType(t.key); setPage(1); }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <Alert>{error}</Alert>}

      <Card className="!p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-10"><Spinner /></div>
        ) : result.items.length === 0 ? (
          <div className="p-6"><EmptyState title={`No ${isInvoice ? 'invoices' : 'quotations'} yet`} hint="Create one to get started." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream-100 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">{isInvoice ? 'Invoice' : 'Quotation'} No.</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">{isInvoice ? 'Payment Status' : 'Status'}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {result.items.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-medium text-brand-700 dark:text-brand-300">{row.number}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{row.clientName}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(row.issueDate)}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{formatMoney(row.total, currency)}</td>
                    <td className="px-4 py-3">
                      <span className="badge bg-cream-200 capitalize text-slate-600 dark:bg-slate-700 dark:text-slate-200">{row.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {can('invoices.update') && (
                        <button className="pill-edit" onClick={() => setForm({ docId: row.id })}>Edit</button>
                      )}
                      <button className="pill ml-2 bg-cream-200 text-slate-600 hover:bg-cream-300" onClick={() => downloadPdf(row)}>PDF</button>
                      {can('invoices.delete') && (
                        <button className="pill-delete ml-2" onClick={() => remove(row)}>Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Pagination meta={result.meta} onPage={setPage} />

      {form && (
        <DocumentFormModal
          open
          type={type}
          docId={form.docId}
          config={config}
          onClose={() => setForm(null)}
          onSaved={load}
        />
      )}
      <ConfigModal open={showConfig} onClose={() => setShowConfig(false)} onSaved={setConfig} />
    </div>
  );
}
