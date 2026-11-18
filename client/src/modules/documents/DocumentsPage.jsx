import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { errorMessage } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { PageHeader, Card, Spinner, EmptyState, Pagination, Alert } from '../../components/ui';
import Icon from '../../components/Icon';
import {
  getCatalog, previewDocument, listDocuments, renderDocument, deleteDocument,
} from './api';
import { printHtml } from './print';
import DocumentFormModal from './DocumentFormModal';

export default function DocumentsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [tab, setTab] = useState('templates');
  const [catalog, setCatalog] = useState({ categories: [], templates: [] });
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [form, setForm] = useState(null); // { templateKey, docId }

  const [docs, setDocs] = useState({ items: [], meta: null });
  const [docFilters, setDocFilters] = useState({ search: '', page: 1 });
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [error, setError] = useState('');

  const canCreate = can('documents.create');

  useEffect(() => {
    getCatalog().then(setCatalog).catch((err) => setError(errorMessage(err)));
  }, []);

  const loadDocs = useCallback(async (params) => {
    setLoadingDocs(true);
    try {
      const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null));
      setDocs(await listDocuments(clean));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'documents') loadDocs(docFilters);
  }, [tab, docFilters, loadDocs]);

  const catLabel = (key) => catalog.categories.find((c) => c.key === key)?.label || key;

  const filteredTemplates = catalog.templates.filter((t) => {
    if (category && t.category !== category) return false;
    if (search) {
      const q = search.toLowerCase();
      return t.name.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q);
    }
    return true;
  });
  const grouped = catalog.categories
    .map((c) => ({ ...c, items: filteredTemplates.filter((t) => t.category === c.key) }))
    .filter((c) => c.items.length);

  const previewTemplate = async (key) => {
    try {
      const { html } = await previewDocument(key, {});
      printHtml(html);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const printDoc = async (row) => {
    try {
      const { html } = await renderDocument(row.id);
      printHtml(html);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const removeDoc = async (row) => {
    const ok = await confirm({ title: 'Delete document?', message: `Remove "${row.title}".`, confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      await deleteDocument(row.id);
      toast.success('Deleted');
      loadDocs(docFilters);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader title="Documents" subtitle="Template library & generated documents" />

      {/* Tabs */}
      <div className="mb-4 flex gap-2 border-b border-cream-300 dark:border-slate-700">
        {[
          { key: 'templates', label: 'Template Library' },
          { key: 'documents', label: 'My Documents' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === t.key ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <Alert>{error}</Alert>}

      {tab === 'templates' && (
        <>
          <Card className="mb-4">
            <div className="flex flex-wrap gap-3">
              <input
                className="input min-w-[200px] flex-1"
                placeholder="Search templates…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select className="input w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">All categories</option>
                {catalog.categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
          </Card>

          {catalog.templates.length === 0 ? (
            <div className="flex justify-center p-10"><Spinner /></div>
          ) : grouped.length === 0 ? (
            <EmptyState title="No templates match" hint="Try a different search or category." />
          ) : (
            grouped.map((c) => (
              <div key={c.key} className="mb-6">
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{c.label}</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {c.items.map((t) => (
                    <div key={t.key} className="card flex flex-col p-4">
                      <div className="mb-2 flex items-start gap-2">
                        <span className="mt-0.5 text-brand-500"><Icon name="documents" className="h-5 w-5" /></span>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 dark:text-slate-100">{t.name}</p>
                          <p className="text-xs text-slate-500">{t.description}</p>
                        </div>
                      </div>
                      <div className="mt-auto flex gap-2 pt-2">
                        <button className="btn-secondary flex-1 py-1 text-xs" onClick={() => previewTemplate(t.key)}>Preview</button>
                        {canCreate && (
                          <button className="btn-primary flex-1 py-1 text-xs" onClick={() => setForm({ templateKey: t.key })}>Use</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </>
      )}

      {tab === 'documents' && (
        <>
          <Card className="mb-4">
            <input
              className="input"
              placeholder="Search documents by title or reference…"
              value={docFilters.search}
              onChange={(e) => setDocFilters((f) => ({ ...f, search: e.target.value, page: 1 }))}
            />
          </Card>

          <Card className="!p-0 overflow-hidden">
            {loadingDocs ? (
              <div className="flex justify-center p-10"><Spinner /></div>
            ) : docs.items.length === 0 ? (
              <div className="p-6"><EmptyState title="No documents yet" hint="Create one from the Template Library." /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-cream-100 text-left text-slate-500 dark:bg-slate-800">
                    <tr>
                      <th className="px-4 py-3 font-medium">Title</th>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium">Reference</th>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-200 dark:divide-slate-700">
                    {docs.items.map((d) => (
                      <tr key={d.id} className="hover:bg-cream-100 dark:hover:bg-slate-800">
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{d.title}</td>
                        <td className="px-4 py-3 text-slate-500">{catLabel(d.category)}</td>
                        <td className="px-4 py-3 text-slate-500">{d.reference || '—'}</td>
                        <td className="px-4 py-3 text-slate-500">{formatDate(d.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button className="pill bg-brand-50 text-brand-700 hover:bg-brand-100" onClick={() => printDoc(d)}>Print / PDF</button>
                            {can('documents.update') && (
                              <button className="pill bg-cream-200 text-slate-600 hover:bg-cream-300" onClick={() => setForm({ templateKey: d.templateKey, docId: d.id })}>Edit</button>
                            )}
                            {can('documents.delete') && (
                              <button className="pill bg-red-50 text-red-600 hover:bg-red-100" onClick={() => removeDoc(d)}>Delete</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <Pagination meta={docs.meta} onPage={(page) => setDocFilters((f) => ({ ...f, page }))} />
        </>
      )}

      <DocumentFormModal
        open={Boolean(form)}
        templateKey={form?.templateKey}
        docId={form?.docId}
        onClose={() => setForm(null)}
        onSaved={() => { if (tab === 'documents') loadDocs(docFilters); }}
      />
    </div>
  );
}
