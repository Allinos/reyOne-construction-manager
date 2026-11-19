import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { errorMessage } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { PageHeader, Spinner, EmptyState, Pagination, Alert, Tabs } from '../../components/ui';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import SearchSelect from '../../components/SearchSelect';
import Select from '../../components/Select';
import {
  getCatalog, getTemplate, previewDocument, listDocuments, renderDocument, deleteDocument,
  listProjectsForDocs, listClientsForDocs, listVendorsForDocs,
} from './api';
import { printHtml } from './print';
import DocumentFormModal from './DocumentFormModal';
import PreviewModal, { sampleData } from './PreviewModal';

// Thumbnail background + accent per category.
const THUMB = [['#FFF4D6', '#CC6E02'], ['#E8EFFE', '#1D4ED8'], ['#E8F6EC', '#15803D'], ['#F3E8FD', '#7E22CE'], ['#FDEDE4', '#C2410C'], ['#ECE6DA', '#4A2700']];

// Template gallery shown in the "New document" tab.
function TemplateGallery({ catalog, canCreate, onUse, onPreview }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const q = search.trim().toLowerCase();
  const list = catalog.templates.filter((t) =>
    (!category || t.category === category) && (!q || `${t.name} ${t.description || ''}`.toLowerCase().includes(q)));
  const catIdx = (key) => Math.max(0, catalog.categories.findIndex((c) => c.key === key));
  const count = (key) => catalog.templates.filter((t) => !key || t.category === key).length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input className="input pl-9" placeholder="Search templates — invoice, work order, DPR…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>
      <div className="scroll-thin mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {[{ key: '', label: 'All' }, ...catalog.categories].map((c) => (
          <button
            key={c.key || 'all'}
            onClick={() => setCategory(c.key)}
            className={`chip shrink-0 ${category === c.key ? 'chip-on' : ''}`}
          >
            {c.label}<span className="opacity-60">{count(c.key)}</span>
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <EmptyState title="No templates match" hint="Try a different search or category." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((t) => (
            <div key={t.key} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-pop">
              <button className="relative grid h-[118px] place-items-center" style={{ background: THUMB[catIdx(t.category) % THUMB.length][0] }} onClick={() => onPreview(t)} title="Preview" aria-label={`Preview ${t.name}`}>
                <span className="mt-6 grid h-[100px] w-[84px] content-start gap-[5px] rounded-t-md bg-white px-2 py-2.5 shadow-[0_4px_14px_rgba(0,0,0,.08)] dark:bg-slate-800">
                  <span className="h-[5px] w-2/5 rounded" style={{ background: THUMB[catIdx(t.category) % THUMB.length][1] }} />
                  <span className="h-[3px] rounded bg-slate-200 dark:bg-slate-600" />
                  <span className="h-[3px] w-[70%] rounded bg-slate-200 dark:bg-slate-600" />
                  <span className="mt-1 h-4 rounded-sm border border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-700" />
                  <span className="ml-auto h-[3px] w-1/2 rounded opacity-60" style={{ background: THUMB[catIdx(t.category) % THUMB.length][1] }} />
                </span>
                <span className="badge absolute left-2.5 top-2.5 bg-white/90 text-slate-600 dark:bg-slate-800/90 dark:text-slate-300">{catalog.categories.find((c) => c.key === t.category)?.label || t.category}</span>
              </button>
              <div className="flex flex-1 flex-col px-3.5 py-3">
                <p className="font-semibold text-slate-900 dark:text-white">{t.name}</p>
                <p className="mt-0.5 line-clamp-2 min-h-[2.25rem] text-xs leading-[1.125rem] text-slate-400">{t.description}</p>
                <div className="mt-2.5 flex gap-2">
                  <button className="btn-secondary btn-sm flex-1" onClick={() => onPreview(t)}><Icon name="eye" className="h-3.5 w-3.5" /> Preview</button>
                  {canCreate && <button className="btn-primary btn-sm flex-1" onClick={() => onUse(t)}>Create</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
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
  const [vendors, setVendors] = useState([]);
  const [vendorId, setVendorId] = useState('');
  const [templateKey, setTemplateKey] = useState('');

  useEffect(() => {
    if (!open) return;
    listProjectsForDocs().then(setProjects);
    listClientsForDocs().then(setClients);
    listVendorsForDocs().then(setVendors);
    setProjectId('');
    setClientId('');
    setVendorId('');
    setTemplateKey(preset?.templateKey || '');
    setForType('project');
  }, [open, preset]);

  const ready = templateKey && (forType === 'none' || { project: projectId, client: clientId, vendor: vendorId }[forType]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={preset?.templateKey ? 'Who is this document for?' : 'Create document'}
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
              vendorId: forType === 'vendor' ? vendorId : '',
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
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[{ k: 'project', l: 'Project' }, { k: 'client', l: 'Client' }, { k: 'vendor', l: 'Vendor / contractor' }, { k: 'none', l: 'General' }].map((o) => (
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
        {forType === 'vendor' && (
          <div>
            <label className="label">Vendor / contractor</label>
            <SearchSelect options={vendors} value={vendorId} onChange={setVendorId} getLabel={(v) => v.name} getSub={(v) => v.category || v.phone} placeholder="Search vendors…" />
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
        {preset?.templateKey ? (
          <div className="rounded-lg bg-cream-100 px-3 py-2 dark:bg-slate-700/50">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{catalog.templates.find((t) => t.key === templateKey)?.name}</p>
            <p className="text-xs text-slate-500">{catalog.templates.find((t) => t.key === templateKey)?.description}</p>
          </div>
        ) : (
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
        )}
      </div>
    </Modal>
  );
}

export default function DocumentsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'documents';
  const setTab = (t) => setParams(t === 'documents' ? {} : { tab: t }, { replace: true });
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
      <PageHeader
        title="Documents"
        subtitle="Invoices, quotations, agreements, work orders, site reports and letters — created from ready templates"
        actions={canCreate && (
          <button className="btn-primary" onClick={() => setTab('templates')}>
            <Icon name="add" className="h-4 w-4" /> New document
          </button>
        )}
      />
      {error && <div className="mb-3"><Alert>{error}</Alert></div>}
      <Tabs
        tabs={[
          { key: 'documents', label: 'My documents', count: docs.meta?.total },
          { key: 'templates', label: 'New document from template', count: catalog.templates.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'templates' ? (
        <TemplateGallery catalog={catalog} canCreate={canCreate} onUse={useTemplate} onPreview={previewTemplate} />
      ) : (
        <>
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
                  hint={canCreate ? 'Open "New document from template", pick a template and fill it in.' : undefined}
                />
                {canCreate && !filters.search && !filters.category && <div className="mt-3 flex justify-center"><button className="btn-primary" onClick={() => setTab('templates')}>Browse templates</button></div>}
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
                          {d.vendorName ? <p>{d.vendorName}<span className="block text-xs text-slate-400">Vendor</span></p> : d.projectName || d.clientName ? (
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
                            <button className="btn-ghost btn-sm" onClick={() => previewDoc(d)} title="Preview" aria-label="Preview"><Icon name="eye" className="h-4 w-4" /></button>
                            <button className="btn-ghost btn-sm" onClick={() => printDoc(d)} title="Print / PDF" aria-label="Print"><Icon name="print" className="h-4 w-4" /></button>
                            {canCreate && <button className="btn-ghost btn-sm" onClick={() => setForm({ templateKey: d.templateKey, copyFrom: d.id })} title="Duplicate" aria-label="Duplicate"><Icon name="copy" className="h-4 w-4" /></button>}
                            {can('documents.update') && (
                              <button className="btn-ghost btn-sm" onClick={() => setForm({ templateKey: d.templateKey, docId: d.id })} title="Edit" aria-label="Edit"><Icon name="edit" className="h-4 w-4" /></button>
                            )}
                            {can('documents.delete') && (
                              <button className="btn-ghost btn-sm text-red-600 hover:bg-red-50" onClick={() => removeDoc(d)} title="Delete" aria-label="Delete"><Icon name="trash" className="h-4 w-4" /></button>
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
        onContinue={(sel) => { setCreateOpen(null); setForm(sel); }}
      />

      <DocumentFormModal
        open={Boolean(form)}
        templateKey={form?.templateKey}
        docId={form?.docId}
        presetProjectId={form?.projectId}
        presetClientId={form?.clientId}
        presetVendorId={form?.vendorId}
        onClose={() => setForm(null)}
        copyFrom={form?.copyFrom}
        onSaved={() => { loadDocs(filters); setTab('documents'); }}
      />
    </div>
  );
}
