import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { errorMessage } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { PageHeader, Spinner, EmptyState, Pagination, Alert } from '../../components/ui';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import SearchSelect from '../../components/SearchSelect';
import Select from '../../components/Select';
import {
  getCatalog, getTemplate, previewDocument, listDocuments, renderDocument, deleteDocument,
  listProjectsForDocs, listClientsForDocs,
} from './api';
import { printHtml } from './print';
import DocumentFormModal from './DocumentFormModal';
import PreviewModal, { sampleData } from './PreviewModal';

const CAT_COLORS = ['bg-blue-50 text-blue-700', 'bg-emerald-50 text-emerald-700', 'bg-violet-50 text-violet-700', 'bg-amber-50 text-amber-700', 'bg-rose-50 text-rose-700', 'bg-cyan-50 text-cyan-700', 'bg-slate-100 text-slate-700'];

// Full-screen template library rendered in the main content area.
function TemplateLibrary({ catalog, canCreate, onClose, onUse, onPreview }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const q = search.trim().toLowerCase();
  const list = catalog.templates.filter((t) =>
    (!category || t.category === category) && (!q || `${t.name} ${t.description || ''}`.toLowerCase().includes(q)));
  const catIdx = (key) => Math.max(0, catalog.categories.findIndex((c) => c.key === key));
  const count = (key) => catalog.templates.filter((t) => !key || t.category === key).length;

  return (
    <div className="-m-4 flex min-h-[calc(100vh-3.5rem)] flex-col bg-cream md:-m-6 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 md:px-6 dark:border-slate-700 dark:bg-slate-800">
        <button className="btn-ghost px-2" onClick={onClose} aria-label="Back to documents"><Icon name="arrowLeft" className="h-4 w-4" /></button>
        <div className="mr-auto">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Template Library</h1>
          <p className="text-xs text-slate-500">{catalog.templates.length} ready-to-use construction documents</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Icon name="search" className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input className="input pl-9" placeholder="Search templates…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="shrink-0 border-b border-slate-200 bg-white p-3 md:w-56 md:border-b-0 md:border-r dark:border-slate-700 dark:bg-slate-800">
          <div className="scroll-thin flex gap-1 overflow-x-auto md:flex-col">
            {[{ key: '', label: 'All templates' }, ...catalog.categories].map((c) => (
              <button
                key={c.key || 'all'}
                onClick={() => setCategory(c.key)}
                className={`flex items-center justify-between gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-sm ${category === c.key ? 'bg-brand-50 font-medium text-brand-700' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'}`}
              >
                {c.label}
                <span className="text-xs text-slate-400">{count(c.key)}</span>
              </button>
            ))}
          </div>
        </aside>
        <div className="flex-1 p-4 md:p-6">
          {list.length === 0 ? (
            <EmptyState title="No templates match" hint="Try a different search or category." />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {list.map((t) => (
                <div key={t.key} className="card group flex flex-col p-4 transition hover:border-brand-200 hover:shadow-md">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-slate-700 dark:text-brand-300">
                      <Icon name="documents" className="h-5 w-5" />
                    </span>
                    <span className={`badge ${CAT_COLORS[catIdx(t.category) % CAT_COLORS.length]}`}>
                      {catalog.categories.find((c) => c.key === t.category)?.label || t.category}
                    </span>
                  </div>
                  <p className="font-medium text-slate-900 dark:text-white">{t.name}</p>
                  <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-xs leading-5 text-slate-500">{t.description}</p>
                  <div className="mt-3 flex gap-2">
                    <button className="btn-secondary btn-sm flex-1" onClick={() => onPreview(t)}>
                      <Icon name="eye" className="h-3.5 w-3.5" /> Preview
                    </button>
                    {canCreate && (
                      <button className="btn-primary btn-sm flex-1" onClick={() => onUse(t)}>Use this template</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// "Create Document" — pick who it's for (project or client) and a template.
function CreateDocumentModal({ open, catalog, onClose, onContinue, preset }) {
  const [forType, setForType] = useState('project');
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [clientId, setClientId] = useState('');
  const [templateKey, setTemplateKey] = useState('');

  useEffect(() => {
    if (!open) return;
    listProjectsForDocs().then(setProjects);
    listClientsForDocs().then(setClients);
    setProjectId('');
    setClientId('');
    setTemplateKey(preset?.templateKey || '');
    setForType('project');
  }, [open, preset]);

  const ready = templateKey && (forType === 'none' || (forType === 'project' ? projectId : clientId));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create document"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={!ready}
            onClick={() => onContinue({
              templateKey,
              projectId: forType === 'project' ? projectId : '',
              clientId: forType === 'client' ? clientId : '',
            })}
          >
            Continue
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label">Document for</label>
          <div className="grid grid-cols-3 gap-2">
            {[{ k: 'project', l: 'A project' }, { k: 'client', l: 'A client' }, { k: 'none', l: 'General' }].map((o) => (
              <button
                key={o.k}
                type="button"
                onClick={() => setForType(o.k)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${forType === o.k ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300'}`}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>
        {forType === 'project' && (
          <div>
            <label className="label">Project</label>
            <SearchSelect
              options={projects}
              value={projectId}
              onChange={setProjectId}
              getLabel={(p) => p.name}
              getSub={(p) => [p.referenceNumber, p.clientName].filter(Boolean).join(' · ')}
              placeholder="Search projects…"
            />
          </div>
        )}
        {forType === 'client' && (
          <div>
            <label className="label">Client</label>
            <SearchSelect
              options={clients}
              value={clientId}
              onChange={setClientId}
              getLabel={(c) => c.name}
              getSub={(c) => c.phone || c.contactPerson}
              placeholder="Search clients…"
            />
          </div>
        )}
        <div>
          <label className="label">Template</label>
          <Select className="input" value={templateKey} onChange={(e) => setTemplateKey(e.target.value)} placeholder="Choose a template…" searchable>
            <option value="">Choose a template…</option>
            {catalog.categories.map((c) => (
              <optgroup key={c.key} label={c.label}>
                {catalog.templates.filter((t) => t.category === c.key).map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
              </optgroup>
            ))}
          </Select>
          {templateKey && <p className="mt-1 text-xs text-slate-500">{catalog.templates.find((t) => t.key === templateKey)?.description}</p>}
        </div>
      </div>
    </Modal>
  );
}

export default function DocumentsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [view, setView] = useState('list'); // list | library
  const [catalog, setCatalog] = useState({ categories: [], templates: [] });
  const [form, setForm] = useState(null); // { templateKey, docId, projectId, clientId }
  const [createOpen, setCreateOpen] = useState(null); // null | { templateKey? }
  const [preview, setPreview] = useState(null); // { title, load, template? }

  const [docs, setDocs] = useState({ items: [], meta: null });
  const [filters, setFilters] = useState({ search: '', category: '', page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const canCreate = can('documents.create');

  useEffect(() => {
    getCatalog().then(setCatalog).catch((err) => setError(errorMessage(err)));
  }, []);

  const loadDocs = useCallback(async (params) => {
    setLoading(true);
    try {
      const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null));
      setDocs(await listDocuments(clean));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDocs(filters); }, [filters, loadDocs]);

  const catLabel = (key) => catalog.categories.find((c) => c.key === key)?.label || key;
  const tplName = useMemo(() => Object.fromEntries(catalog.templates.map((t) => [t.key, t.name])), [catalog]);

  const previewTemplate = (t) => setPreview({
    title: `Preview · ${t.name}`,
    template: t,
    load: async () => previewDocument(t.key, sampleData(await getTemplate(t.key))),
  });
  const previewDoc = (row) => setPreview({ title: row.title, load: () => renderDocument(row.id), doc: row });

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
      loadDocs(filters);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const useTemplate = (t) => { setPreview(null); setCreateOpen({ templateKey: t.key }); };

  return (
    <div>
      {view === 'library' ? (
        <TemplateLibrary
          catalog={catalog}
          canCreate={canCreate}
          onClose={() => setView('list')}
          onUse={useTemplate}
          onPreview={previewTemplate}
        />
      ) : (
        <>
          <PageHeader
            title="Documents"
            subtitle="Quotations, agreements, site forms and more — generated from templates"
            actions={
              <>
                <button className="btn-secondary" onClick={() => setView('library')}>
                  <Icon name="modules" className="h-4 w-4" /> Templates
                </button>
                {canCreate && (
                  <button className="btn-primary" onClick={() => setCreateOpen({})}>
                    <Icon name="add" className="h-4 w-4" /> Create Document
                  </button>
                )}
              </>
            }
          />

          {error && <div className="mb-3"><Alert>{error}</Alert></div>}

          <div className="mb-3 flex flex-wrap gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Icon name="search" className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                className="input pl-9"
                placeholder="Search by title or reference…"
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))}
              />
            </div>
            <Select className="input w-auto" value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value, page: 1 }))}>
              <option value="">All categories</option>
              {catalog.categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </Select>
          </div>

          <div className="card overflow-hidden">
            {loading ? (
              <div className="flex justify-center p-10"><Spinner /></div>
            ) : docs.items.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title={filters.search || filters.category ? 'No documents match' : 'No documents yet'}
                  hint={canCreate ? 'Click "Create Document" or browse the Templates to get started.' : undefined}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>For</th>
                      <th>Category</th>
                      <th>Date</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.items.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <td>
                          <button className="text-left font-medium text-slate-800 hover:text-brand-600 dark:text-slate-100" onClick={() => previewDoc(d)}>{d.title}</button>
                          <p className="text-xs text-slate-400">{tplName[d.templateKey] || d.templateKey}{d.reference ? ` · ${d.reference}` : ''}</p>
                        </td>
                        <td className="text-slate-600 dark:text-slate-300">
                          {d.projectName || d.clientName ? (
                            <>
                              <p>{d.projectName || d.clientName}</p>
                              {d.projectName && d.clientName && <p className="text-xs text-slate-400">{d.clientName}</p>}
                            </>
                          ) : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="text-slate-500">{catLabel(d.category)}</td>
                        <td className="whitespace-nowrap text-slate-500">{formatDate(d.createdAt)}</td>
                        <td>
                          <div className="flex justify-end gap-1">
                            <button className="btn-ghost btn-sm" onClick={() => previewDoc(d)} title="Preview"><Icon name="eye" className="h-4 w-4" /></button>
                            <button className="btn-ghost btn-sm" onClick={() => printDoc(d)} title="Print / PDF"><Icon name="print" className="h-4 w-4" /></button>
                            {can('documents.update') && (
                              <button className="btn-ghost btn-sm" onClick={() => setForm({ templateKey: d.templateKey, docId: d.id })} title="Edit"><Icon name="edit" className="h-4 w-4" /></button>
                            )}
                            {can('documents.delete') && (
                              <button className="btn-ghost btn-sm text-red-600 hover:bg-red-50" onClick={() => removeDoc(d)} title="Delete"><Icon name="trash" className="h-4 w-4" /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <Pagination meta={docs.meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />
        </>
      )}

      <PreviewModal
        open={Boolean(preview)}
        title={preview?.title}
        load={preview?.load || (() => Promise.resolve({ html: '' }))}
        onClose={() => setPreview(null)}
        actions={
          preview?.template && canCreate ? (
            <button className="btn-primary" onClick={() => useTemplate(preview.template)}>Use this template</button>
          ) : preview?.doc && can('documents.update') ? (
            <button className="btn-primary" onClick={() => { setForm({ templateKey: preview.doc.templateKey, docId: preview.doc.id }); setPreview(null); }}>Edit</button>
          ) : null
        }
      />

      <CreateDocumentModal
        open={Boolean(createOpen)}
        preset={createOpen}
        catalog={catalog}
        onClose={() => setCreateOpen(null)}
        onContinue={(sel) => { setCreateOpen(null); setView('list'); setForm(sel); }}
      />

      <DocumentFormModal
        open={Boolean(form)}
        templateKey={form?.templateKey}
        docId={form?.docId}
        presetProjectId={form?.projectId}
        presetClientId={form?.clientId}
        onClose={() => setForm(null)}
        onSaved={() => loadDocs(filters)}
      />
    </div>
  );
}
