'use strict';

/**
 * Document template library for the Documents module. Template bodies live here
 * in code; only filled values are stored per generated document.
 *
 * Formats follow common Indian construction practice: GST invoice particulars
 * (Rule 46 — GSTIN, place of supply, HSN/SAC, CGST/SGST or IGST, amount in
 * words), delivery challans (Rule 55), measurement-book layout (Nos × L × B ×
 * D), RA bill abstracts with retention / advance / TDS deductions, and standard
 * agreement clauses (payment, time, variations, defects liability, liquidated
 * damages, statutory compliance, termination, arbitration).
 *
 * Field types: text | textarea | date | number | money | select | items.
 * `items` fields declare `columns` [{ key, label, type, calc?, sum? }].
 * `source` pre-fills a field (company.* / project.* / client.* / vendor.* / today);
 * `default` gives a starting value the user can edit. Field keys of older
 * templates are kept so existing documents still render.
 * See documentRender.js for placeholder syntax.
 */

const { renderDocument } = require('./documentRender');

const CATEGORIES = [
  { key: 'financial', label: 'Billing & Accounts' },
  { key: 'agreements', label: 'Agreements & Contracts' },
  { key: 'orders', label: 'Orders & Procurement' },
  { key: 'site', label: 'Site & Quality' },
  { key: 'hr', label: 'HR & Labour' },
  { key: 'letters', label: 'Letters & General' },
];

// --- columns for line-item tables ------------------------------------------
const col = (key, label, type = 'text', extra = {}) => ({ key, label, type, ...extra });
const COL = {
  desc: col('description', 'Description of work / goods'),
  hsn: col('hsn', 'HSN/SAC'),
  unit: col('unit', 'Unit'),
  qty: col('qty', 'Qty', 'number'),
  rate: col('rate', 'Rate', 'money'),
  amount: col('amount', 'Amount', 'money', { calc: 'qty*rate', sum: true }),
  remarks: col('remarks', 'Remarks'),
};
const PRICED_GST = [COL.desc, COL.hsn, COL.unit, COL.qty, COL.rate, COL.amount];
const PRICED = [COL.desc, COL.unit, COL.qty, COL.rate, COL.amount];

// --- common fields -----------------------------------------------------------
const GST_MODES = ['CGST + SGST', 'IGST', 'No GST'];
const F = {
  ref: { key: 'reference', label: 'Document No.', type: 'text', placeholder: 'e.g. 2026-27/001' },
  date: { key: 'date', label: 'Date', type: 'date', source: 'today', required: true },
  project: { key: 'projectName', label: 'Project', type: 'text', source: 'project.name' },
  site: { key: 'siteAddress', label: 'Site address', type: 'textarea', source: 'project.address' },
  toName: { key: 'recipientName', label: 'Client / Bill to (name)', type: 'text', required: true, source: 'client.name' },
  toAddr: { key: 'recipientAddress', label: 'Client address', type: 'textarea', source: 'client.address' },
  toGstin: { key: 'recipientGstin', label: 'Client GSTIN', type: 'text', placeholder: '15-character GSTIN (if registered)' },
  pos: { key: 'placeOfSupply', label: 'Place of supply (state)', type: 'text', placeholder: 'e.g. Bihar (10)' },
  taxMode: { key: 'taxMode', label: 'GST type', type: 'select', options: GST_MODES, default: 'CGST + SGST' },
  tax: { key: 'taxPercent', label: 'GST rate %', type: 'number', placeholder: 'e.g. 18', default: '18' },
  notes: { key: 'notes', label: 'Notes', type: 'textarea' },
  terms: { key: 'terms', label: 'Terms & conditions', type: 'textarea' },
  payTerms: { key: 'paymentTerms', label: 'Payment terms', type: 'textarea' },
  jurisdiction: { key: 'jurisdiction', label: 'Courts / arbitration seat (city)', type: 'text', placeholder: 'e.g. Patna' },
};
const items = (key, label, columns, extra = {}) => ({ key, label, type: 'items', columns, ...extra });

const FOR_CO = 'For {{company.name}}<br>Authorised Signatory';
const PARTY_TO = `<div class="box"><h4>Bill to</h4><strong>{{recipientName}}</strong><div class="muted">{{recipientAddress}}</div>{{#recipientGstin}}<div class="muted">GSTIN: {{recipientGstin}}</div>{{/recipientGstin}}</div>`;

function t(key, category, name, description, fields, body, extra = {}) {
  return { key, category, name, description, fields, body, ...extra };
}

const TEMPLATES = [
  // ===== Billing & Accounts ================================================
  t('invoice', 'financial', 'Tax Invoice', 'GST tax invoice with HSN/SAC, CGST/SGST or IGST, amount in words and bank details.',
    [{ ...F.ref, label: 'Invoice No.', required: true }, F.date, { key: 'dueDate', label: 'Payment due date', type: 'date' },
     F.toName, F.toAddr, F.toGstin, F.pos, F.project, { ...F.site, label: 'Site / ship-to address' },
     { key: 'poRef', label: 'Client PO / Work Order ref.', type: 'text' },
     { key: 'reverseCharge', label: 'Tax payable on reverse charge', type: 'select', options: ['No', 'Yes'], default: 'No' },
     items('items', 'Line items', PRICED_GST, { totals: true }), F.taxMode, F.tax, F.notes,
     { ...F.terms, default: '1. Payment due by the due date shown above.\n2. Interest @ 18% p.a. may be charged on overdue amounts.\n3. Subject to the jurisdiction of our registered office.' }],
    `<div class="parties">${PARTY_TO}
     <div class="box"><table class="kv"><tr><td>Invoice no.</td><td><b>{{reference}}</b></td></tr><tr><td>Invoice date</td><td>{{date}}</td></tr>{{#dueDate}}<tr><td>Due date</td><td>{{dueDate}}</td></tr>{{/dueDate}}<tr><td>Place of supply</td><td>{{placeOfSupply}}</td></tr>{{#poRef}}<tr><td>PO / WO ref.</td><td>{{poRef}}</td></tr>{{/poRef}}<tr><td>Reverse charge</td><td>{{reverseCharge}}</td></tr></table></div></div>
     {{#projectName}}<p><b>Project:</b> {{projectName}}{{#siteAddress}} — <span class="muted">{{siteAddress}}</span>{{/siteAddress}}</p>{{/projectName}}
     {{itemsTable}}
     {{bankBlock}}
     {{#notes}}<div class="note"><h4>Notes</h4>{{notes}}</div>{{/notes}}
     {{#terms}}<div class="terms"><h4>Terms &amp; conditions</h4>{{terms}}</div>{{/terms}}
     <p class="declare">Declaration: We declare that this invoice shows the actual price of the goods / services described and that all particulars are true and correct.</p>`,
    { refLabel: 'Invoice No.', printTitle: 'Tax Invoice', copyLabel: 'Original for recipient', signatures: ["Receiver's signature", FOR_CO] }),

  t('quotation', 'financial', 'Quotation / Estimate', 'Priced quotation with scope, inclusions, exclusions, payment terms and validity.',
    [{ ...F.ref, label: 'Quotation No.' }, F.date, { key: 'validUntil', label: 'Valid until', type: 'date' },
     F.toName, F.toAddr, { key: 'kindAttn', label: 'Kind attention', type: 'text' }, F.project, F.site,
     { key: 'subject', label: 'Subject', type: 'text', placeholder: 'e.g. Quotation for civil works of G+2 residence' },
     items('items', 'Items / BOQ', PRICED, { totals: true }), F.taxMode, F.tax,
     { key: 'inclusions', label: 'Scope / inclusions', type: 'textarea' },
     { key: 'exclusions', label: 'Exclusions', type: 'textarea', default: 'Statutory approvals and fees, electricity and water for construction, items not mentioned above.' },
     { ...F.payTerms, default: '10% advance with work order; balance against stage-wise running bills within 7 days of submission.' },
     { key: 'completionPeriod', label: 'Completion period', type: 'text', placeholder: 'e.g. 6 months from start' }, F.terms],
    `<div class="parties"><div class="box"><h4>To</h4><strong>{{recipientName}}</strong><div class="muted">{{recipientAddress}}</div>{{#kindAttn}}<div class="muted">Kind attn: {{kindAttn}}</div>{{/kindAttn}}</div>
     <div class="box"><table class="kv"><tr><td>Quotation no.</td><td><b>{{reference}}</b></td></tr><tr><td>Date</td><td>{{date}}</td></tr>{{#validUntil}}<tr><td>Valid until</td><td>{{validUntil}}</td></tr>{{/validUntil}}{{#projectName}}<tr><td>Project</td><td>{{projectName}}</td></tr>{{/projectName}}</table></div></div>
     {{#subject}}<p><b>Subject: {{subject}}</b></p>{{/subject}}
     <p>Dear Sir / Madam,</p><p>With reference to your enquiry, we are pleased to submit our quotation for the work described below{{#siteAddress}} at {{siteAddress}}{{/siteAddress}}.</p>
     {{itemsTable}}
     {{#inclusions}}<h4>Scope / inclusions</h4><p>{{inclusions}}</p>{{/inclusions}}
     {{#exclusions}}<h4>Exclusions</h4><p>{{exclusions}}</p>{{/exclusions}}
     {{#paymentTerms}}<h4>Payment terms</h4><p>{{paymentTerms}}</p>{{/paymentTerms}}
     {{#completionPeriod}}<h4>Completion period</h4><p>{{completionPeriod}}</p>{{/completionPeriod}}
     {{#terms}}<div class="terms"><h4>Terms &amp; conditions</h4>{{terms}}</div>{{/terms}}
     <p>We trust our offer meets your requirements and look forward to your valued order.</p>`,
    { refLabel: 'Quotation No.', signatures: [FOR_CO] }),

  t('proforma_invoice', 'financial', 'Proforma Invoice', 'Advance request before supply / work — not a tax invoice.',
    [{ ...F.ref, label: 'Proforma No.' }, F.date, F.toName, F.toAddr, F.toGstin, F.pos, F.project,
     items('items', 'Line items', PRICED_GST, { totals: true }), F.taxMode, F.tax,
     { key: 'advanceRequired', label: 'Advance required', type: 'money' }, F.payTerms, F.notes],
    `<div class="parties">${PARTY_TO}<div class="box"><table class="kv"><tr><td>Proforma no.</td><td><b>{{reference}}</b></td></tr><tr><td>Date</td><td>{{date}}</td></tr><tr><td>Place of supply</td><td>{{placeOfSupply}}</td></tr>{{#projectName}}<tr><td>Project</td><td>{{projectName}}</td></tr>{{/projectName}}</table></div></div>
     {{itemsTable}}
     {{#advanceRequired}}<p><b>Advance required:</b> {{advanceRequired}}</p>{{/advanceRequired}}
     {{#paymentTerms}}<h4>Payment terms</h4><p>{{paymentTerms}}</p>{{/paymentTerms}}
     {{bankBlock}}
     {{#notes}}<div class="note">{{notes}}</div>{{/notes}}
     <p class="declare">This is a proforma invoice issued for advance payment only. A tax invoice will be issued on supply / completion.</p>`,
    { refLabel: 'Proforma No.', signatures: [FOR_CO] }),

  t('receipt', 'financial', 'Payment Receipt', 'Acknowledge money received, with mode, cheque/UTR reference and amount in words.',
    [{ ...F.ref, label: 'Receipt No.' }, F.date, { key: 'receivedFrom', label: 'Received from', type: 'text', required: true, source: 'client.name' },
     { key: 'amount', label: 'Amount received', type: 'money', required: true },
     { key: 'mode', label: 'Payment mode', type: 'select', options: ['Bank transfer (NEFT/RTGS/IMPS)', 'UPI', 'Cheque', 'Demand draft', 'Cash', 'Card'] },
     { key: 'instrumentRef', label: 'Cheque / UTR / transaction no.', type: 'text' }, { key: 'instrumentDate', label: 'Instrument date', type: 'date' },
     { key: 'bankName', label: 'Drawn on bank', type: 'text' },
     { key: 'towards', label: 'Towards', type: 'text', source: 'project.name', placeholder: 'e.g. RA Bill 03 / advance for project' },
     { key: 'againstInvoice', label: 'Against invoice no.', type: 'text' }, { key: 'balanceDue', label: 'Balance outstanding (optional)', type: 'money' }],
    `<table class="kv" style="max-width:none"><tr><td>Received with thanks from</td><td><b>{{receivedFrom}}</b></td></tr>
     <tr><td>The sum of</td><td><b>{{amount}}</b><div class="muted">({{amountWords}})</div></td></tr>
     <tr><td>By</td><td>{{mode}}{{#instrumentRef}} — No. {{instrumentRef}}{{/instrumentRef}}{{#instrumentDate}} dated {{instrumentDate}}{{/instrumentDate}}{{#bankName}}, {{bankName}}{{/bankName}}</td></tr>
     <tr><td>Towards</td><td>{{towards}}{{#againstInvoice}} (against invoice {{againstInvoice}}){{/againstInvoice}}</td></tr>
     {{#balanceDue}}<tr><td>Balance outstanding</td><td>{{balanceDue}}</td></tr>{{/balanceDue}}</table>
     {{#instrumentRef}}<p class="muted">Cheque / DD payments are subject to realisation.</p>{{/instrumentRef}}`,
    { refLabel: 'Receipt No.', wordsFrom: 'amount', signatures: [FOR_CO] }),

  t('credit_note', 'financial', 'Credit Note', 'GST credit note against an earlier invoice (rate revision, returns, short supply).',
    [{ ...F.ref, label: 'Credit Note No.' }, F.date, F.toName, F.toAddr, F.toGstin, F.pos,
     { key: 'againstInvoice', label: 'Original invoice no.', type: 'text', required: true }, { key: 'invoiceDate', label: 'Original invoice date', type: 'date' },
     items('items', 'Credited items', PRICED_GST, { totals: true }), F.taxMode, F.tax, { key: 'reason', label: 'Reason for credit', type: 'textarea', required: true }],
    `<div class="parties">${PARTY_TO.replace('Bill to', 'Issued to')}<div class="box"><table class="kv"><tr><td>Credit note no.</td><td><b>{{reference}}</b></td></tr><tr><td>Date</td><td>{{date}}</td></tr><tr><td>Against invoice</td><td>{{againstInvoice}}{{#invoiceDate}} dt. {{invoiceDate}}{{/invoiceDate}}</td></tr><tr><td>Place of supply</td><td>{{placeOfSupply}}</td></tr></table></div></div>
     {{itemsTable}}
     <h4>Reason</h4><p>{{reason}}</p>`,
    { refLabel: 'Credit Note No.', signatures: [FOR_CO] }),

  t('payment_reminder', 'financial', 'Payment Reminder', 'Reminder letter listing outstanding invoices.',
    [F.ref, F.date, F.toName, F.toAddr,
     items('items', 'Outstanding invoices', [col('description', 'Invoice no.'), col('invoiceDate', 'Invoice date', 'date'), col('dueDate', 'Due date', 'date'), col('amount', 'Amount due', 'money', { sum: true })]),
     { key: 'invoiceNo', label: 'Invoice no. (single invoice)', type: 'text' }, { key: 'amountDue', label: 'Amount due (single invoice)', type: 'money' },
     { key: 'dueSince', label: 'Due since', type: 'date' }, { key: 'payWithin', label: 'Please pay within', type: 'text', default: '7 days' }],
    `<p>To,<br><b>{{recipientName}}</b><br><span class="muted">{{recipientAddress}}</span></p>
     <p><b>Subject: Reminder for outstanding payment</b></p>
     <p>Dear Sir / Madam,</p>
     <p>This is a gentle reminder that the following amount{{#items}}s{{/items}} remain{{^items}}s{{/items}} outstanding in our books{{#dueSince}} since {{dueSince}}{{/dueSince}}:</p>
     {{#items}}{{table:items}}<p><b>Total outstanding: {{sum.items.amount}}</b></p>{{/items}}
     {{^items}}<p>Invoice <b>{{invoiceNo}}</b> — amount due <b>{{amountDue}}</b>.</p>{{/items}}
     <p>We request you to kindly arrange the payment within {{payWithin}}. Please ignore this letter if the payment has already been made, and share the transaction reference for our records.</p>
     {{bankBlock}}`,
    { signatures: [FOR_CO], hideTotals: true }),

  t('account_statement', 'financial', 'Statement of Account', 'Ledger of bills and receipts for a client with closing balance.',
    [F.ref, F.date, { key: 'clientName', label: 'Client', type: 'text', source: 'client.name', required: true },
     { key: 'period', label: 'Period', type: 'text', placeholder: 'e.g. 01-04-2026 to 30-09-2026' }, { key: 'openingBalance', label: 'Opening balance', type: 'money' },
     items('items', 'Entries', [col('entryDate', 'Date', 'date'), col('description', 'Particulars'), col('debit', 'Billed (Dr)', 'money', { sum: true }), col('credit', 'Received (Cr)', 'money', { sum: true })])],
    `<div class="parties"><div class="box"><h4>Account of</h4><strong>{{clientName}}</strong></div><div class="box"><h4>Period</h4>{{period}}{{#openingBalance}}<div class="muted">Opening balance: {{openingBalance}}</div>{{/openingBalance}}</div></div>
     {{itemsTable}}
     <div class="totals"><div class="grand"><span>Closing balance due</span><span>{{calc.closing}}</span></div></div>`,
    { hideTotals: true, compute: (s, d) => ({ closing: (Number(d.openingBalance) || 0) + (s.items?.debit || 0) - (s.items?.credit || 0) }) }),

  t('ra_bill', 'financial', 'Running Account (RA) Bill', 'Interim progress bill: cumulative work done, less previous bills, retention and advance recovery.',
    [{ ...F.ref, label: 'Bill No.' }, F.date, F.toName, F.toAddr, F.toGstin, F.project,
     { key: 'billNo', label: 'RA bill no.', type: 'text', placeholder: 'e.g. RA-03' }, { key: 'agreementRef', label: 'Agreement / work order ref.', type: 'text' },
     { key: 'periodFrom', label: 'Work from', type: 'date' }, { key: 'periodTo', label: 'Work up to', type: 'date' },
     items('items', 'Abstract of work done (cumulative quantities)', [COL.desc, COL.unit, col('contractQty', 'Contract qty', 'number'), col('qty', 'Executed (cumulative)', 'number'), COL.rate, COL.amount], { totals: true }),
     F.taxMode, F.tax, { key: 'previousBilled', label: 'Previously billed (incl. GST)', type: 'money' },
     { key: 'retentionPercent', label: 'Retention %', type: 'number', placeholder: 'e.g. 5' }, { key: 'advanceRecovery', label: 'Mobilisation advance recovery', type: 'money' },
     { key: 'otherDeductions', label: 'Other recoveries (material issued, etc.)', type: 'money' }, F.notes],
    `<div class="parties">${PARTY_TO}<div class="box"><table class="kv"><tr><td>RA bill no.</td><td><b>{{billNo}}</b></td></tr><tr><td>Project</td><td>{{projectName}}</td></tr>{{#agreementRef}}<tr><td>Agreement / WO</td><td>{{agreementRef}}</td></tr>{{/agreementRef}}<tr><td>Period</td><td>{{periodFrom}} – {{periodTo}}</td></tr></table></div></div>
     {{itemsTable}}
     {{bankBlock}}
     {{#notes}}<div class="note"><h4>Notes</h4>{{notes}}</div>{{/notes}}
     <p class="declare">Certified that the quantities above have been jointly measured and recorded, and the work has been executed as per the agreement and specifications.</p>`,
    { refLabel: 'Bill No.', signatures: ['Prepared by', 'Site Engineer', 'Client / Consultant (certified)'], billing: true }),

  t('contractor_bill', 'financial', 'Contractor Bill & Payment Statement', "Measure a subcontractor / labour contractor's work and compute net payable after retention, advance and TDS.",
    [F.ref, F.date, { key: 'contractor', label: 'Contractor / subcontractor', type: 'text', required: true, source: 'vendor.name' },
     { key: 'contractorPan', label: 'Contractor PAN', type: 'text' }, { key: 'workOrderRef', label: 'Work order ref.', type: 'text' }, F.project,
     { key: 'periodTo', label: 'Measured up to', type: 'date' },
     items('items', 'Work measured (cumulative)', [COL.desc, COL.unit, col('qty', 'Qty (cumulative)', 'number'), COL.rate, COL.amount], { totals: true }),
     { ...F.taxMode, default: 'No GST' }, { ...F.tax, default: '' }, { key: 'previousBilled', label: 'Previously billed / paid', type: 'money' },
     { key: 'retentionPercent', label: 'Retention %', type: 'number' }, { key: 'advanceRecovery', label: 'Advance recovery', type: 'money' },
     { key: 'tdsPercent', label: 'TDS % (Sec. 194C)', type: 'number', placeholder: '1 (individual/HUF) or 2 (others)' },
     { key: 'otherDeductions', label: 'Other deductions (material, penalties)', type: 'money' }, F.notes],
    `<div class="parties"><div class="box"><h4>Contractor</h4><strong>{{contractor}}</strong>{{#contractorPan}}<div class="muted">PAN: {{contractorPan}}</div>{{/contractorPan}}{{#workOrderRef}}<div class="muted">Work order: {{workOrderRef}}</div>{{/workOrderRef}}</div>
     <div class="box"><h4>Project</h4>{{projectName}}{{#periodTo}}<div class="muted">Measured up to {{periodTo}}</div>{{/periodTo}}</div></div>
     {{itemsTable}}
     {{#notes}}<div class="note"><h4>Remarks</h4>{{notes}}</div>{{/notes}}`,
    { signatures: ['Measured by', 'Checked by', 'Contractor', 'Approved for payment'], billing: true }),

  t('boq', 'financial', 'Bill of Quantities (BOQ)', 'Itemised quantities, units and rates for tendering or estimating.',
    [F.ref, F.date, F.toName, F.project, F.site, items('items', 'BOQ items', [col('itemNo', 'Item no.'), COL.desc, COL.unit, COL.qty, COL.rate, COL.amount], { totals: true }),
     F.taxMode, F.tax, { ...F.notes, label: 'Specifications / notes', default: 'Rates include material, labour, tools, scaffolding, curing and cleaning unless stated otherwise. Quantities are approximate; payment on actual measured quantities.' }, F.terms],
    `<div class="parties"><div class="box"><h4>Prepared for</h4><strong>{{recipientName}}</strong></div><div class="box"><h4>Project</h4>{{projectName}}<div class="muted">{{siteAddress}}</div></div></div>
     {{itemsTable}}
     {{#notes}}<div class="note"><h4>Specifications / notes</h4>{{notes}}</div>{{/notes}}
     {{#terms}}<div class="terms"><h4>Conditions</h4>{{terms}}</div>{{/terms}}`,
    { signatures: ['Prepared by', 'Checked by'] }),

  // ===== Agreements & Contracts ==========================================
  t('construction_agreement', 'agreements', 'Construction Agreement', 'Owner–contractor works agreement: price, payment, time, variations, defects liability, LD, termination and arbitration.',
    [F.date, { key: 'place', label: 'Executed at (city)', type: 'text' },
     { key: 'owner', label: 'Owner / client', type: 'text', required: true, source: 'client.name' }, { key: 'ownerAddress', label: 'Owner address', type: 'textarea', source: 'client.address' },
     { key: 'contractor', label: 'Contractor', type: 'text', source: 'company.name' }, { key: 'contractorAddress', label: 'Contractor address', type: 'textarea', source: 'company.address' },
     F.project, F.site, { key: 'scope', label: 'Scope of work', type: 'textarea', required: true },
     { key: 'drawingsRef', label: 'Drawings / specifications / BOQ forming part of contract', type: 'textarea' },
     { key: 'value', label: 'Contract price', type: 'money', required: true }, { key: 'priceBasis', label: 'Price basis', type: 'select', options: ['Lump sum (fixed price)', 'Item rate (BOQ, on measurement)', 'Cost plus fee'], default: 'Item rate (BOQ, on measurement)' },
     { ...F.payTerms, label: 'Payment schedule', default: '(a) 10% mobilisation advance on signing, recovered proportionately from running bills.\n(b) Monthly running bills on measured work, payable within 7 days of certification.\n(c) Final bill within 30 days of completion, after joint measurement.' },
     { key: 'retentionPercent', label: 'Retention %', type: 'number', default: '5' },
     { key: 'startDate', label: 'Start date', type: 'date' }, { key: 'duration', label: 'Completion period', type: 'text', placeholder: 'e.g. 12 months from start date' },
     { key: 'ldRate', label: 'Liquidated damages', type: 'text', default: '0.5% of contract price per week of delay, maximum 5%' },
     { key: 'dlpMonths', label: 'Defects liability period', type: 'text', default: '12 months from completion' },
     { key: 'materialsBy', label: 'Materials supplied by', type: 'select', options: ['Contractor (all materials)', 'Owner supplies cement & steel', 'Owner supplies all materials (labour contract)'], default: 'Contractor (all materials)' },
     F.jurisdiction, { ...F.terms, label: 'Additional terms' }],
    `<p>This Construction Agreement is made on <b>{{date}}</b>{{#place}} at {{place}}{{/place}} between <b>{{owner}}</b>{{#ownerAddress}}, {{ownerAddress}}{{/ownerAddress}} (hereinafter "the Owner") and <b>{{contractor}}</b>{{#contractorAddress}}, {{contractorAddress}}{{/contractorAddress}} (hereinafter "the Contractor").</p>
     <p>The Owner wishes to have the works described below executed{{#projectName}} for the project <b>{{projectName}}</b>{{/projectName}} at {{siteAddress}}, and the Contractor has agreed to execute them on the following terms:</p>
     <ol class="clauses">
      <li><b>Scope of work.</b> {{scope}}</li>
      {{#drawingsRef}}<li><b>Contract documents.</b> The following form part of this agreement: {{drawingsRef}}. In case of conflict, specifications prevail over drawings and figured dimensions over scaled ones.</li>{{/drawingsRef}}
      <li><b>Contract price.</b> {{value}} ({{priceBasis}}), exclusive of GST which shall be paid extra at the applicable rate.</li>
      <li><b>Payment.</b> {{paymentTerms}}</li>
      <li><b>Retention.</b> {{retentionPercent}}% of each running bill shall be retained and released on expiry of the defects liability period, or earlier against a bank guarantee of equal value.</li>
      <li><b>Time for completion.</b> Work shall start on {{startDate}} and be completed within {{duration}}. Extension of time shall be granted for delays caused by the Owner, approved variations or force majeure, if claimed in writing within 14 days of the event.</li>
      <li><b>Liquidated damages.</b> For delay attributable to the Contractor, liquidated damages of {{ldRate}} shall be payable.</li>
      <li><b>Variations.</b> No change to scope shall be executed without a written change order signed by the Owner stating the cost and time effect. Varied items are valued at contract rates, or at mutually agreed rates where none apply.</li>
      <li><b>Materials &amp; workmanship.</b> {{materialsBy}}. All materials and workmanship shall conform to the specifications and relevant IS codes; rejected work shall be rectified at the Contractor's cost.</li>
      <li><b>Safety, labour &amp; statutory compliance.</b> The Contractor shall provide safe working conditions and PPE, comply with labour laws (minimum wages, EPF, ESI, BOCW) and keep workers insured under a workmen's compensation policy.</li>
      <li><b>Defects liability.</b> The Contractor shall rectify any defect arising from faulty material or workmanship notified within {{dlpMonths}}, at its own cost.</li>
      <li><b>Termination.</b> Either party may terminate by 15 days' written notice if the other commits a material breach and fails to remedy it within that period. On termination the Contractor shall be paid for work properly executed up to that date, less amounts due to the Owner.</li>
      <li><b>Force majeure.</b> Neither party is liable for delay caused by events beyond its reasonable control (natural calamity, war, government orders), provided prompt notice is given.</li>
      <li><b>Disputes.</b> Disputes shall first be resolved amicably; failing which they shall be referred to a sole arbitrator under the Arbitration and Conciliation Act, 1996{{#jurisdiction}}, with the seat at {{jurisdiction}}; courts at {{jurisdiction}} shall have exclusive jurisdiction{{/jurisdiction}}.</li>
      {{#terms}}<li><b>Additional terms.</b> {{terms}}</li>{{/terms}}
     </ol>
     <p>IN WITNESS WHEREOF the parties have signed this agreement on the date first written above.</p>
     <div class="parties" style="margin-top:28px"><div class="muted">Witness 1: ____________________<br>Name &amp; address</div><div class="muted">Witness 2: ____________________<br>Name &amp; address</div></div>`,
    { signatures: ['Owner', 'For {{contractor}}<br>Contractor'] }),

  t('subcontractor_agreement', 'agreements', 'Subcontractor Agreement', 'Back-to-back subcontract: scope, rates, RA billing, retention, TDS, compliance, LD and termination.',
    [F.date, { key: 'subcontractor', label: 'Subcontractor', type: 'text', required: true, source: 'vendor.name' },
     { key: 'subAddress', label: 'Subcontractor address / GSTIN', type: 'textarea', source: 'vendor.address' }, { key: 'subPan', label: 'Subcontractor PAN', type: 'text' },
     F.project, F.site, { key: 'workScope', label: 'Work / trade', type: 'textarea', required: true },
     items('items', 'Rates (optional)', [COL.desc, COL.unit, COL.qty, COL.rate, COL.amount]),
     { key: 'rate', label: 'Contract value / rate basis', type: 'text', placeholder: 'e.g. ₹12,50,000 item-rate as per schedule' },
     { key: 'duration', label: 'Duration', type: 'text' },
     { ...F.payTerms, default: 'Monthly running bills on jointly measured work, paid within 15 days of certification, less retention, advance recovery and TDS under Section 194C.' },
     { key: 'retentionPercent', label: 'Retention %', type: 'number', default: '5' },
     { key: 'ldRate', label: 'Liquidated damages', type: 'text', default: '0.5% of contract value per week of delay, maximum 5%' }, F.jurisdiction, F.terms],
    `<p>This Subcontract Agreement is made on <b>{{date}}</b> between <b>{{company.name}}</b> ("the Main Contractor") and <b>{{subcontractor}}</b>{{#subAddress}}, {{subAddress}}{{/subAddress}}{{#subPan}} (PAN {{subPan}}){{/subPan}} ("the Subcontractor") for the project <b>{{projectName}}</b>{{#siteAddress}} at {{siteAddress}}{{/siteAddress}}.</p>
     <ol class="clauses">
      <li><b>Scope.</b> {{workScope}}</li>
      <li><b>Rates &amp; value.</b> {{rate}}{{#items}} as per the schedule below.{{/items}}</li>
     </ol>
     {{#items}}{{table:items}}{{/items}}
     <ol class="clauses" start="3">
      <li><b>Payment.</b> {{paymentTerms}}</li>
      <li><b>Retention.</b> {{retentionPercent}}% of each bill, released after the defects liability period of the main contract.</li>
      <li><b>Programme.</b> The work shall be completed within {{duration}} in step with the Main Contractor's programme. Liquidated damages: {{ldRate}}.</li>
      <li><b>Quality.</b> Work shall meet the main contract specifications; defective work shall be rectified at the Subcontractor's cost.</li>
      <li><b>Labour &amp; compliance.</b> The Subcontractor is the employer of its workers and shall hold the required labour licence, pay at least minimum wages, deposit EPF/ESI, provide PPE and follow site safety rules, and indemnify the Main Contractor against claims arising from its workers.</li>
      <li><b>Materials &amp; tools.</b> Material issued by the Main Contractor shall be accounted for; excess wastage beyond agreed limits will be recovered at cost.</li>
      <li><b>Termination.</b> The Main Contractor may terminate on 7 days' notice for slow progress, poor quality or breach, and complete the balance at the Subcontractor's risk and cost.</li>
      <li><b>Disputes.</b> Referred to arbitration under the Arbitration and Conciliation Act, 1996{{#jurisdiction}}; seat and courts at {{jurisdiction}}{{/jurisdiction}}.</li>
      {{#terms}}<li><b>Other terms.</b> {{terms}}</li>{{/terms}}
     </ol>`,
    { signatures: ['For {{company.name}}<br>Main Contractor', 'Subcontractor'] }),

  t('labour_contract', 'agreements', 'Labour Contract', 'Labour supply / piece-rate contract with wages, compliance (CLRA, EPF, ESI, BOCW) and safety.',
    [F.date, { key: 'contractor', label: 'Labour contractor', type: 'text', required: true, source: 'vendor.name' },
     { key: 'contractorAddress', label: 'Address', type: 'textarea', source: 'vendor.address' }, { key: 'licenceNo', label: 'Labour licence no. (if any)', type: 'text' },
     F.site, { key: 'work', label: 'Nature of work', type: 'textarea', required: true },
     items('items', 'Rates', [col('description', 'Category / item of work'), COL.unit, col('rate', 'Rate', 'money')]),
     { key: 'rate', label: 'Rate basis (if not tabled)', type: 'text' }, { key: 'headcount', label: 'Minimum workers to deploy', type: 'number' },
     { key: 'hours', label: 'Working hours', type: 'text', default: '9:00 am – 6:00 pm with 1 hour break; 6 days a week' },
     { ...F.payTerms, default: 'Weekly / fortnightly on measured work, less advances. Wages to workers shall be paid by the contractor before the 7th of each month.' }, F.terms],
    `<p>This Labour Contract is made on <b>{{date}}</b> between <b>{{company.name}}</b> ("the Company") and <b>{{contractor}}</b>{{#contractorAddress}}, {{contractorAddress}}{{/contractorAddress}}{{#licenceNo}} (licence {{licenceNo}}){{/licenceNo}} ("the Contractor") for labour at {{siteAddress}}.</p>
     <ol class="clauses">
      <li><b>Work.</b> {{work}}</li>
      <li><b>Rates.</b> {{#rate}}{{rate}}{{/rate}}{{#items}} As per the table below.{{/items}}</li>
     </ol>
     {{#items}}{{table:items}}{{/items}}
     <ol class="clauses" start="3">
      <li><b>Manpower.</b> The Contractor shall deploy at least {{headcount}} skilled / unskilled workers as required by the site engineer. Working hours: {{hours}}.</li>
      <li><b>Payment.</b> {{paymentTerms}}</li>
      <li><b>Statutory compliance.</b> The Contractor shall comply with the Contract Labour (R&amp;A) Act, Minimum Wages, EPF, ESI and BOCW laws, keep attendance and wage registers, and shall not engage child labour.</li>
      <li><b>Safety.</b> Workers shall use helmets, shoes, harnesses and other PPE and follow site safety instructions. Accidents shall be reported immediately.</li>
      <li><b>Quality &amp; wastage.</b> Defective work shall be redone free of cost; material wastage beyond normal limits may be recovered.</li>
      <li><b>Termination.</b> Either party may end this contract by 7 days' notice after settling dues for work done.</li>
      {{#terms}}<li><b>Other terms.</b> {{terms}}</li>{{/terms}}
     </ol>`,
    { signatures: ['Contractor', FOR_CO] }),

  t('nda', 'agreements', 'Non-Disclosure Agreement', 'Mutual confidentiality agreement for drawings, pricing and project information.',
    [F.date, { key: 'party', label: 'Other party', type: 'text', required: true }, { key: 'partyAddress', label: 'Other party address', type: 'textarea' },
     { key: 'purpose', label: 'Purpose of disclosure', type: 'textarea', required: true }, { key: 'term', label: 'Confidentiality period', type: 'text', default: '2 years' }, F.jurisdiction],
    `<p>This Mutual Non-Disclosure Agreement is made on <b>{{date}}</b> between <b>{{company.name}}</b> and <b>{{party}}</b>{{#partyAddress}}, {{partyAddress}}{{/partyAddress}} (each a "Party").</p>
     <ol class="clauses">
      <li><b>Purpose.</b> {{purpose}}</li>
      <li><b>Confidential information</b> means drawings, designs, estimates, pricing, client and vendor details, and any other business information disclosed in any form, marked or reasonably understood to be confidential.</li>
      <li><b>Obligations.</b> The receiving Party shall use the information only for the Purpose, protect it with reasonable care, and disclose it only to employees and advisers who need to know and are bound by similar duties.</li>
      <li><b>Exclusions.</b> Information that is public, already known, independently developed or lawfully received from a third party, or that must be disclosed by law.</li>
      <li><b>Term.</b> Obligations continue for {{term}} from the date of disclosure.</li>
      <li><b>Return.</b> On request, all confidential information and copies shall be returned or destroyed.</li>
      <li><b>No licence.</b> No right or licence is granted except as stated here.</li>
      <li><b>Remedies &amp; law.</b> Breach may be restrained by injunction in addition to damages. Governed by Indian law{{#jurisdiction}}; courts at {{jurisdiction}}{{/jurisdiction}}.</li>
     </ol>`,
    { signatures: [FOR_CO, '{{party}}'] }),

  t('equipment_rental', 'agreements', 'Equipment Rental Agreement', 'Hire of plant / machinery with rates, minimum billing, operator, fuel, deposit and damage terms.',
    [F.date, { key: 'party', label: 'Equipment owner (lessor)', type: 'text', required: true, source: 'vendor.name' }, { key: 'partyAddress', label: 'Lessor address / GSTIN', type: 'textarea', source: 'vendor.address' },
     F.site, items('items', 'Equipment', [col('description', 'Equipment / model'), col('regNo', 'Reg. / serial no.'), COL.qty, col('unit', 'Rate per (hour/day/month)'), COL.rate]),
     { key: 'equipment', label: 'Equipment (if not tabled)', type: 'textarea' }, { key: 'rate', label: 'Rental rate (if not tabled)', type: 'text' },
     { key: 'period', label: 'Rental period', type: 'text', placeholder: 'e.g. 3 months from mobilisation' }, { key: 'minBilling', label: 'Minimum billing', type: 'text', default: '200 hours per month' },
     { key: 'operatorFuel', label: 'Operator & fuel', type: 'select', options: ['By lessor (included in rate)', 'Operator by lessor, fuel by hirer', 'Both by hirer'], default: 'Operator by lessor, fuel by hirer' },
     { key: 'mobilisation', label: 'Mobilisation / demobilisation charges', type: 'text' }, { key: 'deposit', label: 'Security deposit', type: 'money' }, F.payTerms, F.terms],
    `<p>This Equipment Rental Agreement is made on <b>{{date}}</b> between <b>{{party}}</b>{{#partyAddress}}, {{partyAddress}}{{/partyAddress}} ("the Lessor") and <b>{{company.name}}</b> ("the Hirer") for use at {{siteAddress}}.</p>
     {{#items}}{{table:items}}{{/items}}{{#equipment}}<h4>Equipment</h4><p>{{equipment}}</p>{{/equipment}}
     <ol class="clauses">
      {{#rate}}<li><b>Rate.</b> {{rate}}</li>{{/rate}}
      <li><b>Period.</b> {{period}}. Minimum billing: {{minBilling}}. Hours are recorded daily in the log book signed by both parties.</li>
      <li><b>Operator &amp; fuel.</b> {{operatorFuel}}.</li>
      {{#mobilisation}}<li><b>Mobilisation.</b> {{mobilisation}}</li>{{/mobilisation}}
      {{#deposit}}<li><b>Security deposit.</b> {{deposit}}, refundable on return of the equipment in good condition.</li>{{/deposit}}
      <li><b>Maintenance &amp; breakdown.</b> Routine maintenance is the Lessor's responsibility; breakdown periods beyond 24 hours shall not be charged.</li>
      <li><b>Insurance &amp; damage.</b> The Lessor shall keep the equipment insured. The Hirer is liable for damage caused by misuse, excluding normal wear and tear.</li>
      {{#paymentTerms}}<li><b>Payment.</b> {{paymentTerms}}</li>{{/paymentTerms}}
      {{#terms}}<li><b>Other terms.</b> {{terms}}</li>{{/terms}}
     </ol>`,
    { signatures: ['Lessor', FOR_CO] }),

  t('consultancy_agreement', 'agreements', 'Consultancy Agreement', 'Engagement of an architect / structural / MEP consultant: services, deliverables, fee stages and liability.',
    [F.date, { key: 'consultant', label: 'Consultant', type: 'text', required: true, source: 'vendor.name' }, { key: 'consultantAddress', label: 'Consultant address', type: 'textarea', source: 'vendor.address' },
     F.project, F.site, { key: 'services', label: 'Scope of services', type: 'textarea', required: true },
     { key: 'deliverables', label: 'Deliverables & timeline', type: 'textarea' },
     { key: 'fee', label: 'Professional fee', type: 'text', placeholder: 'e.g. ₹4,00,000 lump sum + GST, or 3% of project cost' },
     { ...F.payTerms, label: 'Fee payment stages', default: '20% on concept approval, 30% on working drawings, 40% in stages during construction, 10% on completion.' }, F.jurisdiction, F.terms],
    `<p>This Consultancy Agreement is made on <b>{{date}}</b> between <b>{{company.name}}</b> ("the Client") and <b>{{consultant}}</b>{{#consultantAddress}}, {{consultantAddress}}{{/consultantAddress}} ("the Consultant") for <b>{{projectName}}</b>{{#siteAddress}} at {{siteAddress}}{{/siteAddress}}.</p>
     <ol class="clauses">
      <li><b>Services.</b> {{services}}</li>
      {{#deliverables}}<li><b>Deliverables &amp; timeline.</b> {{deliverables}}</li>{{/deliverables}}
      <li><b>Fee.</b> {{fee}}. GST extra as applicable.</li>
      <li><b>Payment.</b> {{paymentTerms}}</li>
      <li><b>Client obligations.</b> The Client shall provide site information, surveys and timely decisions needed for the services.</li>
      <li><b>Drawings &amp; copyright.</b> The Client may use the drawings for this project; copyright remains with the Consultant.</li>
      <li><b>Liability.</b> The Consultant shall exercise reasonable skill and care and shall rectify errors in its drawings at no extra cost.</li>
      <li><b>Termination.</b> Either party may terminate by 30 days' notice; fees for services rendered up to termination shall be paid.</li>
      <li><b>Disputes.</b> Arbitration under the Arbitration and Conciliation Act, 1996{{#jurisdiction}}; seat at {{jurisdiction}}{{/jurisdiction}}.</li>
      {{#terms}}<li><b>Other terms.</b> {{terms}}</li>{{/terms}}
     </ol>`,
    { signatures: ['Consultant', FOR_CO] }),

  // ===== Orders & Procurement ============================================
  t('purchase_order', 'orders', 'Purchase Order', 'Order materials from a vendor with HSN, GST, delivery schedule and standard purchase terms.',
    [{ ...F.ref, label: 'PO No.', required: true }, F.date, { key: 'vendor', label: 'Vendor', type: 'text', required: true, source: 'vendor.name' },
     { key: 'vendorAddress', label: 'Vendor address / GSTIN', type: 'textarea', source: 'vendor.address' }, { key: 'quotationRef', label: 'Vendor quotation ref.', type: 'text' },
     F.project, { key: 'deliverTo', label: 'Deliver to (site address)', type: 'textarea', source: 'project.address' }, { key: 'deliveryDate', label: 'Delivery by', type: 'date' },
     { key: 'siteContact', label: 'Site contact (name / phone)', type: 'text' },
     items('items', 'Items', PRICED_GST, { totals: true }), F.taxMode, F.tax, { key: 'freight', label: 'Freight / unloading (if extra)', type: 'money' },
     { ...F.payTerms, default: '30 days from receipt of material and correct invoice.' },
     { ...F.terms, default: '1. Quote this PO number on all challans and invoices.\n2. Material is subject to inspection at site; rejected material will be returned at the vendor\'s cost.\n3. Test certificates / brand invoices to accompany cement, steel and RMC.\n4. Prices are firm until completion of supply.\n5. Unloading at site by vendor unless stated.' }],
    `<div class="parties"><div class="box"><h4>Vendor</h4><strong>{{vendor}}</strong><div class="muted">{{vendorAddress}}</div></div>
     <div class="box"><table class="kv"><tr><td>PO no.</td><td><b>{{reference}}</b></td></tr><tr><td>PO date</td><td>{{date}}</td></tr>{{#quotationRef}}<tr><td>Your quotation</td><td>{{quotationRef}}</td></tr>{{/quotationRef}}{{#deliveryDate}}<tr><td>Delivery by</td><td><b>{{deliveryDate}}</b></td></tr>{{/deliveryDate}}{{#projectName}}<tr><td>Project</td><td>{{projectName}}</td></tr>{{/projectName}}</table></div></div>
     <p><b>Deliver to:</b> {{deliverTo}}{{#siteContact}} — contact {{siteContact}}{{/siteContact}}</p>
     {{itemsTable}}
     {{#paymentTerms}}<h4>Payment terms</h4><p>{{paymentTerms}}</p>{{/paymentTerms}}
     {{#terms}}<div class="terms"><h4>Terms &amp; conditions</h4>{{terms}}</div>{{/terms}}`,
    { refLabel: 'PO No.', signatures: ['Prepared by', FOR_CO, 'Accepted by vendor'] }),

  t('work_order', 'orders', 'Work Order', 'Award work to a contractor: scope, rates, schedule, payment, retention and conditions.',
    [{ ...F.ref, label: 'Work Order No.' }, F.date, { key: 'contractor', label: 'Contractor / team', type: 'text', required: true, source: 'vendor.name' },
     { key: 'contractorAddress', label: 'Contractor address', type: 'textarea', source: 'vendor.address' }, F.project, F.site,
     { key: 'work', label: 'Scope of work', type: 'textarea', required: true },
     items('items', 'Rates / BOQ', PRICED, { totals: true }), { key: 'value', label: 'Order value (if no BOQ)', type: 'money' },
     { ...F.taxMode, default: 'No GST' }, { ...F.tax, default: '' },
     { key: 'startDate', label: 'Start date', type: 'date' }, { key: 'endDate', label: 'Complete by', type: 'date' },
     { ...F.payTerms, default: 'Running bills on measured work every 15 days, paid within 7 days of certification, less 5% retention and TDS as applicable.' },
     { ...F.terms, default: '1. Work as per drawings, specifications and site engineer\'s instructions.\n2. Contractor to provide tools, tackles and PPE, and comply with labour laws.\n3. Defective work to be rectified free of cost.\n4. Delay penalty: 0.5% of order value per week, max 5%.' }],
    `<div class="parties"><div class="box"><h4>Issued to</h4><strong>{{contractor}}</strong><div class="muted">{{contractorAddress}}</div></div>
     <div class="box"><table class="kv"><tr><td>Work order no.</td><td><b>{{reference}}</b></td></tr><tr><td>Project</td><td>{{projectName}}</td></tr><tr><td>Start</td><td>{{startDate}}</td></tr><tr><td>Complete by</td><td><b>{{endDate}}</b></td></tr></table></div></div>
     <p>We are pleased to award you the following work at {{siteAddress}} on the terms below.</p>
     <h4>Scope of work</h4><p>{{work}}</p>
     {{#items}}{{itemsTable}}{{/items}}{{^items}}{{#value}}<p><b>Order value:</b> {{value}}</p>{{/value}}{{/items}}
     {{#paymentTerms}}<h4>Payment terms</h4><p>{{paymentTerms}}</p>{{/paymentTerms}}
     {{#terms}}<div class="terms"><h4>Conditions</h4>{{terms}}</div>{{/terms}}
     <p>Please sign and return a copy as acceptance.</p>`,
    { refLabel: 'WO No.', signatures: [FOR_CO, 'Accepted by contractor'] }),

  t('change_order', 'orders', 'Change Order / Variation', 'Record a scope change with cost and time impact and the revised contract sum.',
    [{ ...F.ref, label: 'Change Order No.' }, F.date, F.project, { key: 'client', label: 'Client', type: 'text', source: 'client.name' },
     { key: 'contractRef', label: 'Contract / agreement ref.', type: 'text' },
     { key: 'origin', label: 'Reason', type: 'select', options: ['Client request', 'Design change', 'Unforeseen site condition', 'Statutory requirement', 'Other'] },
     { key: 'description', label: 'Description of change', type: 'textarea', required: true }, { key: 'reason', label: 'Details / justification', type: 'textarea' },
     items('items', 'Additions / omissions (use negative qty for omissions)', PRICED),
     { key: 'originalValue', label: 'Original contract sum', type: 'money' }, { key: 'previousChanges', label: 'Previous approved changes', type: 'money' },
     { key: 'costImpact', label: 'Cost of this change (if no items)', type: 'money' },
     { key: 'timeImpact', label: 'Time extension', type: 'text', placeholder: 'e.g. 10 days' }, { key: 'revisedCompletion', label: 'Revised completion date', type: 'date' }],
    `<div class="parties"><div class="box"><h4>Project</h4><strong>{{projectName}}</strong><div class="muted">Client: {{client}}</div>{{#contractRef}}<div class="muted">Contract: {{contractRef}}</div>{{/contractRef}}</div>
     <div class="box"><table class="kv"><tr><td>Change order no.</td><td><b>{{reference}}</b></td></tr><tr><td>Reason</td><td>{{origin}}</td></tr></table></div></div>
     <h4>Description of change</h4><p>{{description}}</p>{{#reason}}<p class="muted">{{reason}}</p>{{/reason}}
     {{#items}}{{table:items}}{{/items}}
     <table class="kv" style="max-width:460px;margin-left:auto"><tr><td>Original contract sum</td><td class="r">{{originalValue}}</td></tr><tr><td>Previous approved changes</td><td class="r">{{previousChanges}}</td></tr><tr><td>This change</td><td class="r"><b>{{calc.change}}</b></td></tr><tr><td><b>Revised contract sum</b></td><td class="r"><b>{{calc.revised}}</b></td></tr>{{#timeImpact}}<tr><td>Time extension</td><td class="r">{{timeImpact}}</td></tr>{{/timeImpact}}{{#revisedCompletion}}<tr><td>Revised completion</td><td class="r">{{revisedCompletion}}</td></tr>{{/revisedCompletion}}</table>
     <p class="declare">Work under this change order shall proceed only after it is signed by the client. All other terms of the contract remain unchanged.</p>`,
    { refLabel: 'CO No.', hideTotals: true, signatures: ['Prepared by', FOR_CO, 'Approved by client'],
      compute: (s, d) => {
        const change = s.items?.amount != null ? s.items.amount : Number(d.costImpact) || 0;
        return { change, revised: (Number(d.originalValue) || 0) + (Number(d.previousChanges) || 0) + change };
      } }),

  t('material_requisition', 'orders', 'Material Requisition', 'Site request for materials from store / purchase, with stock at site and required date.',
    [{ ...F.ref, label: 'MR No.' }, F.date, F.project, { key: 'location', label: 'Required at (site / floor)', type: 'text' },
     { key: 'requestedBy', label: 'Requested by', type: 'text' }, { key: 'requiredBy', label: 'Required by', type: 'date' },
     { key: 'priority', label: 'Priority', type: 'select', options: ['Normal', 'Urgent'], default: 'Normal' },
     items('items', 'Materials', [col('description', 'Material / specification'), COL.unit, col('qty', 'Qty required', 'number'), col('stock', 'Stock at site', 'number'), col('purpose', 'Purpose / location of use')]), F.notes],
    `<div class="parties"><div class="box"><h4>Project</h4><strong>{{projectName}}</strong><div class="muted">{{location}}</div></div>
     <div class="box"><table class="kv"><tr><td>Requested by</td><td>{{requestedBy}}</td></tr><tr><td>Required by</td><td><b>{{requiredBy}}</b></td></tr><tr><td>Priority</td><td>{{priority}}</td></tr></table></div></div>
     {{itemsTable}}{{#notes}}<div class="note">{{notes}}</div>{{/notes}}`,
    { refLabel: 'MR No.', signatures: ['Requested by (site)', 'Approved by', 'Store / purchase'], hideTotals: true }),

  t('delivery_challan', 'orders', 'Delivery Challan', 'GST delivery challan for moving goods without a sale (site transfer, job work, approval).',
    [{ ...F.ref, label: 'Challan No.', required: true }, F.date, { key: 'deliverTo', label: 'Consignee', type: 'text', required: true },
     { key: 'address', label: 'Consignee address', type: 'textarea' }, { key: 'consigneeGstin', label: 'Consignee GSTIN', type: 'text' }, F.pos,
     { key: 'reasonType', label: 'Purpose of transport', type: 'select', options: ['Transfer between own sites', 'Job work', 'Supply on approval', 'Return of material', 'Other'], default: 'Transfer between own sites' },
     F.project, items('items', 'Goods', [COL.desc, COL.hsn, COL.unit, COL.qty, col('value', 'Approx. value', 'money', { sum: true })]),
     { key: 'vehicle', label: 'Vehicle no.', type: 'text' }, { key: 'transporter', label: 'Transporter / driver', type: 'text' }, { key: 'ewayBill', label: 'E-way bill no.', type: 'text' }],
    `<div class="parties"><div class="box"><h4>Consignee</h4><strong>{{deliverTo}}</strong><div class="muted">{{address}}</div>{{#consigneeGstin}}<div class="muted">GSTIN: {{consigneeGstin}}</div>{{/consigneeGstin}}</div>
     <div class="box"><table class="kv"><tr><td>Challan no.</td><td><b>{{reference}}</b></td></tr><tr><td>Purpose</td><td>{{reasonType}}</td></tr>{{#placeOfSupply}}<tr><td>Place of supply</td><td>{{placeOfSupply}}</td></tr>{{/placeOfSupply}}{{#vehicle}}<tr><td>Vehicle</td><td>{{vehicle}}</td></tr>{{/vehicle}}{{#transporter}}<tr><td>Transporter</td><td>{{transporter}}</td></tr>{{/transporter}}{{#ewayBill}}<tr><td>E-way bill</td><td>{{ewayBill}}</td></tr>{{/ewayBill}}</table></div></div>
     {{#projectName}}<p><b>Project:</b> {{projectName}}</p>{{/projectName}}
     {{itemsTable}}
     <p class="declare">Goods are sent for the purpose stated above and not for sale. Received the above goods in good condition.</p>`,
    { refLabel: 'Challan No.', signatures: ['Dispatched by', 'Driver', 'Received by (name, date)'], hideTotals: true }),

  t('goods_received_note', 'orders', 'Goods Received Note (GRN)', 'Record material received at site against a PO: ordered, received, accepted and rejected quantities.',
    [{ ...F.ref, label: 'GRN No.' }, F.date, { key: 'vendor', label: 'Supplier', type: 'text', source: 'vendor.name' }, F.project,
     { key: 'poNo', label: 'Against PO no.', type: 'text' }, { key: 'challanNo', label: 'Supplier challan / invoice no.', type: 'text' }, { key: 'vehicle', label: 'Vehicle no.', type: 'text' },
     items('items', 'Material received', [col('description', 'Material'), COL.unit, col('ordered', 'Ordered', 'number'), col('qty', 'Received', 'number'), col('accepted', 'Accepted', 'number'), col('rejected', 'Rejected', 'number'), COL.remarks]),
     { key: 'remarks', label: 'Quality / remarks', type: 'textarea' }],
    `<div class="parties"><div class="box"><h4>Supplier</h4><strong>{{vendor}}</strong>{{#challanNo}}<div class="muted">Challan / invoice: {{challanNo}}</div>{{/challanNo}}{{#vehicle}}<div class="muted">Vehicle: {{vehicle}}</div>{{/vehicle}}</div>
     <div class="box"><table class="kv"><tr><td>GRN no.</td><td><b>{{reference}}</b></td></tr><tr><td>PO no.</td><td>{{poNo}}</td></tr><tr><td>Project / store</td><td>{{projectName}}</td></tr></table></div></div>
     {{itemsTable}}
     {{#remarks}}<div class="note"><h4>Quality / remarks</h4>{{remarks}}</div>{{/remarks}}`,
    { refLabel: 'GRN No.', signatures: ['Received by', 'Checked by (QC)', 'Store in-charge'], hideTotals: true }),

  // ===== Site & Quality ======================================================
  t('site_instruction', 'site', 'Site Instruction', 'Formal instruction to the contractor with location, reason, deadline and cost implication.',
    [{ ...F.ref, label: 'SI No.' }, F.date, F.project, { key: 'to', label: 'To (contractor / engineer)', type: 'text', required: true },
     { key: 'location', label: 'Location / grid / floor', type: 'text' }, { key: 'instruction', label: 'Instruction', type: 'textarea', required: true },
     { key: 'reasonRef', label: 'Reason / drawing reference', type: 'textarea' }, { key: 'actionBy', label: 'Action by', type: 'date' },
     { key: 'costEffect', label: 'Cost / time effect', type: 'select', options: ['None', 'Variation to follow', 'At contractor\'s cost'], default: 'None' }],
    `<div class="parties"><div class="box"><h4>To</h4><strong>{{to}}</strong></div><div class="box"><table class="kv"><tr><td>SI no.</td><td><b>{{reference}}</b></td></tr><tr><td>Project</td><td>{{projectName}}</td></tr>{{#location}}<tr><td>Location</td><td>{{location}}</td></tr>{{/location}}</table></div></div>
     <h4>Instruction</h4><p>{{instruction}}</p>{{#reasonRef}}<h4>Reason / reference</h4><p>{{reasonRef}}</p>{{/reasonRef}}
     <table class="kv"><tr><td>Action required by</td><td><b>{{actionBy}}</b></td></tr><tr><td>Cost / time effect</td><td>{{costEffect}}</td></tr></table>`,
    { refLabel: 'SI No.', signatures: ['Issued by', 'Received by (contractor)'] }),

  t('daily_progress_report', 'site', 'Daily Progress Report (DPR)', 'Daily site record: weather, manpower by trade, work done, materials, equipment, hindrances and next-day plan.',
    [{ ...F.ref, label: 'DPR No.' }, F.date, F.project,
     { key: 'weather', label: 'Weather', type: 'select', options: ['Clear', 'Cloudy', 'Light rain', 'Heavy rain (work affected)', 'Very hot', 'Fog / cold'] },
     { key: 'workingHours', label: 'Working hours', type: 'text', default: '9:00 am – 6:00 pm' },
     items('manpowerTable', 'Manpower', [col('description', 'Trade'), col('agency', 'Agency / contractor'), col('qty', 'Nos.', 'number', { sum: true })]),
     items('workTable', 'Work done today', [col('description', 'Activity'), col('location', 'Location'), COL.unit, col('qty', 'Qty done', 'number'), COL.remarks]),
     items('materialsTable', 'Materials received', [col('description', 'Material'), col('supplier', 'Supplier'), COL.unit, COL.qty]),
     items('equipmentTable', 'Equipment on site', [col('description', 'Equipment'), col('qty', 'Nos.', 'number'), col('hours', 'Hours worked', 'number')]),
     { key: 'issues', label: 'Hindrances / delays', type: 'textarea' }, { key: 'safety', label: 'Safety observations / incidents', type: 'textarea', default: 'No incident.' },
     { key: 'visitors', label: 'Visitors / instructions received', type: 'textarea' }, { key: 'planned', label: 'Plan for tomorrow', type: 'textarea' },
     { key: 'workDone', label: 'Summary (optional)', type: 'textarea' }],
    `<div class="parties"><div class="box"><h4>Project</h4><strong>{{projectName}}</strong></div><div class="box"><table class="kv"><tr><td>Weather</td><td>{{weather}}</td></tr><tr><td>Working hours</td><td>{{workingHours}}</td></tr>{{#manpowerTable}}<tr><td>Total manpower</td><td><b>{{sum.manpowerTable.qty}}</b></td></tr>{{/manpowerTable}}</table></div></div>
     {{#workDone}}<h4>Summary</h4><p>{{workDone}}</p>{{/workDone}}
     <h4>Manpower</h4>{{#manpowerTable}}{{table:manpowerTable}}{{/manpowerTable}}{{^manpowerTable}}<p>{{manpower}}</p>{{/manpowerTable}}
     <h4>Work done today</h4>{{table:workTable}}
     {{#materialsTable}}<h4>Materials received</h4>{{table:materialsTable}}{{/materialsTable}}{{#materials}}<h4>Materials received</h4><p>{{materials}}</p>{{/materials}}
     {{#equipmentTable}}<h4>Equipment</h4>{{table:equipmentTable}}{{/equipmentTable}}
     {{#issues}}<h4>Hindrances / delays</h4><p>{{issues}}</p>{{/issues}}
     {{#safety}}<h4>Safety</h4><p>{{safety}}</p>{{/safety}}
     {{#visitors}}<h4>Visitors / instructions</h4><p>{{visitors}}</p>{{/visitors}}
     {{#planned}}<h4>Plan for tomorrow</h4><p>{{planned}}</p>{{/planned}}`,
    { refLabel: 'DPR No.', hideTotals: true, signatures: ['Site Engineer', 'Project Manager'] }),

  t('inspection_report', 'site', 'Inspection Request & Report', 'Inspection request / checklist for a hold point (e.g. pre-pour) with results and sign-off.',
    [{ ...F.ref, label: 'IR No.' }, F.date, F.project, { key: 'inspectedItem', label: 'Activity / element inspected', type: 'text', required: true, placeholder: 'e.g. Slab reinforcement, 2nd floor' },
     { key: 'location', label: 'Location / grid', type: 'text' }, { key: 'drawingRef', label: 'Drawing / specification ref.', type: 'text' },
     items('checks', 'Checklist', [col('description', 'Check'), col('result', 'Result (OK / Not OK / NA)'), COL.remarks]),
     { key: 'observations', label: 'Observations', type: 'textarea', required: true },
     { key: 'result', label: 'Decision', type: 'select', options: ['Approved — proceed', 'Approved with comments', 'Rejected — re-inspect'] },
     { key: 'actions', label: 'Corrective actions', type: 'textarea' }],
    `<div class="parties"><div class="box"><h4>Project</h4><strong>{{projectName}}</strong>{{#location}}<div class="muted">{{location}}</div>{{/location}}</div><div class="box"><table class="kv"><tr><td>IR no.</td><td><b>{{reference}}</b></td></tr><tr><td>Element</td><td>{{inspectedItem}}</td></tr>{{#drawingRef}}<tr><td>Drawing ref.</td><td>{{drawingRef}}</td></tr>{{/drawingRef}}<tr><td>Decision</td><td><b>{{result}}</b></td></tr></table></div></div>
     {{#checks}}{{table:checks}}{{/checks}}
     <h4>Observations</h4><p>{{observations}}</p>{{#actions}}<h4>Corrective actions</h4><p>{{actions}}</p>{{/actions}}`,
    { refLabel: 'IR No.', hideTotals: true, signatures: ['Contractor (requested)', 'Inspected by', 'Approved by (client / consultant)'] }),

  t('completion_certificate', 'site', 'Work Completion Certificate', 'Certify completion of a work package or project, with defects liability start date.',
    [F.ref, F.date, F.project, { key: 'client', label: 'Client', type: 'text', source: 'client.name' }, { key: 'contractRef', label: 'Contract / work order ref.', type: 'text' },
     { key: 'workScope', label: 'Work completed', type: 'textarea', required: true }, { key: 'completionDate', label: 'Date of completion', type: 'date' },
     { key: 'pending', label: 'Minor pending items (if any)', type: 'textarea' }, { key: 'dlpMonths', label: 'Defects liability period', type: 'text', default: '12 months' }],
    `<p>This is to certify that the following work{{#contractRef}} under contract / work order {{contractRef}}{{/contractRef}} for the project <b>{{projectName}}</b> of <b>{{client}}</b> has been completed in accordance with the contract on <b>{{completionDate}}</b>.</p>
     <h4>Work completed</h4><p>{{workScope}}</p>
     {{#pending}}<h4>Minor pending items (to be completed)</h4><p>{{pending}}</p>{{/pending}}
     <p>The defects liability period of {{dlpMonths}} commences from the date of completion stated above.</p>`,
    { signatures: [FOR_CO, 'Client acceptance'] }),

  t('handover_certificate', 'site', 'Handover Certificate', 'Hand over a building / unit to the client with keys, documents and meter readings.',
    [F.ref, F.date, F.project, { key: 'client', label: 'Handed over to', type: 'text', required: true, source: 'client.name' }, F.site,
     items('handoverTable', 'Items handed over', [col('description', 'Item (keys, documents, warranties, manuals)'), col('qty', 'Nos.', 'number'), COL.remarks]),
     { key: 'meterReadings', label: 'Meter readings (electricity / water)', type: 'text' },
     { key: 'items', label: 'Other items handed over', type: 'textarea' }, { key: 'remarks', label: 'Remarks / snags pending', type: 'textarea' }],
    `<p>The project <b>{{projectName}}</b>{{#siteAddress}} at {{siteAddress}}{{/siteAddress}} is hereby handed over to <b>{{client}}</b> on <b>{{date}}</b>, who has inspected the premises and accepted possession.</p>
     {{#handoverTable}}{{table:handoverTable}}{{/handoverTable}}
     {{#meterReadings}}<p><b>Meter readings:</b> {{meterReadings}}</p>{{/meterReadings}}
     {{#items}}<h4>Other items handed over</h4><p>{{items}}</p>{{/items}}{{#remarks}}<h4>Remarks</h4><p>{{remarks}}</p>{{/remarks}}
     <p class="declare">From the date of handover, the client is responsible for security, maintenance and utilities of the premises. Defects arising from workmanship will be attended to during the defects liability period.</p>`,
    { hideTotals: true, signatures: ['Handed over by', 'Received by (client)'] }),

  t('measurement_sheet', 'site', 'Measurement Sheet (MB)', 'Measurement-book style record: Nos × Length × Breadth × Depth = Quantity.',
    [{ ...F.ref, label: 'MB / Sheet No.' }, F.date, F.project, { key: 'contractor', label: 'Contractor / agency', type: 'text', source: 'vendor.name' },
     { key: 'location', label: 'Location / floor', type: 'text' }, { key: 'boqItem', label: 'BOQ item no. / description', type: 'text' },
     items('items', 'Measurements', [col('description', 'Description / location'), col('nos', 'Nos.', 'number'), col('length', 'L (m)', 'number'), col('breadth', 'B (m)', 'number'), col('depth', 'D/H (m)', 'number'), col('qty', 'Quantity', 'number', { calc: 'product:nos,length,breadth,depth', sum: true }), COL.unit]), F.notes],
    `<div class="parties"><div class="box"><h4>Agency</h4><strong>{{contractor}}</strong></div><div class="box"><table class="kv"><tr><td>Project</td><td>{{projectName}}</td></tr>{{#location}}<tr><td>Location</td><td>{{location}}</td></tr>{{/location}}{{#boqItem}}<tr><td>BOQ item</td><td>{{boqItem}}</td></tr>{{/boqItem}}</table></div></div>
     {{itemsTable}}
     {{#notes}}<div class="note">{{notes}}</div>{{/notes}}
     <p class="declare">Measured jointly at site. Quantities above are accepted for billing.</p>`,
    { refLabel: 'MB No.', signatures: ['Measured by', 'Contractor', 'Checked by'], hideTotals: true }),

  t('snag_list', 'site', 'Snag / Punch List', 'Defects to rectify before handover: location, defect, responsibility, target date and status.',
    [F.ref, F.date, F.project, { key: 'area', label: 'Area / unit', type: 'text' },
     items('items', 'Snags', [col('location', 'Location / room'), col('description', 'Defect'), col('responsibility', 'Responsible'), col('targetDate', 'Target date', 'date'), col('status', 'Status')])],
    `<div class="parties"><div class="box"><h4>Project</h4><strong>{{projectName}}</strong></div><div class="box"><h4>Area / unit</h4>{{area}}</div></div>
     {{itemsTable}}`,
    { signatures: ['Prepared by', 'Contractor', 'Client'], hideTotals: true }),

  t('material_approval', 'site', 'Material Approval Request', 'Submit a material / sample with make, specification and compliance for consultant approval.',
    [{ ...F.ref, label: 'MAR No.' }, F.date, F.project, { key: 'material', label: 'Material', type: 'text', required: true },
     { key: 'make', label: 'Make / brand / supplier', type: 'text' }, { key: 'specification', label: 'Specification required', type: 'textarea' },
     { key: 'compliance', label: 'Compliance / test certificates attached', type: 'textarea' }, { key: 'proposedUse', label: 'Proposed use / location', type: 'text' },
     { key: 'decision', label: 'Decision', type: 'select', options: ['', 'Approved', 'Approved with comments', 'Rejected — resubmit'] }, { key: 'comments', label: 'Reviewer comments', type: 'textarea' }],
    `<div class="parties"><div class="box"><h4>Project</h4><strong>{{projectName}}</strong></div><div class="box"><table class="kv"><tr><td>Material</td><td><b>{{material}}</b></td></tr>{{#make}}<tr><td>Make / brand</td><td>{{make}}</td></tr>{{/make}}{{#proposedUse}}<tr><td>Use</td><td>{{proposedUse}}</td></tr>{{/proposedUse}}</table></div></div>
     {{#specification}}<h4>Specification required</h4><p>{{specification}}</p>{{/specification}}
     {{#compliance}}<h4>Compliance / attachments</h4><p>{{compliance}}</p>{{/compliance}}
     <h4>Decision</h4><p><b>{{decision}}</b>{{^decision}}☐ Approved &nbsp; ☐ Approved with comments &nbsp; ☐ Rejected{{/decision}}</p>{{#comments}}<p>{{comments}}</p>{{/comments}}`,
    { refLabel: 'MAR No.', signatures: ['Submitted by (contractor)', 'Reviewed by (consultant)'] }),

  // ===== HR & Labour ===========================================================
  t('offer_letter', 'hr', 'Job Offer Letter', 'Offer of employment with designation, CTC, location, joining date and acceptance.',
    [F.ref, F.date, { key: 'candidate', label: 'Candidate name', type: 'text', required: true }, { key: 'candidateAddress', label: 'Candidate address', type: 'textarea' },
     { key: 'position', label: 'Designation', type: 'text', required: true }, { key: 'location', label: 'Place of posting', type: 'text', placeholder: 'Head office / project sites' },
     { key: 'salary', label: 'Annual CTC', type: 'text', placeholder: 'e.g. ₹4,20,000 per annum' }, { key: 'joinDate', label: 'Joining date', type: 'date' },
     { key: 'probation', label: 'Probation', type: 'text', default: '6 months' }, { key: 'acceptBy', label: 'Accept offer by', type: 'date' }],
    `<p>To,<br><b>{{candidate}}</b><br><span class="muted">{{candidateAddress}}</span></p>
     <p><b>Subject: Offer of employment — {{position}}</b></p>
     <p>Dear {{candidate}},</p>
     <p>We are pleased to offer you the position of <b>{{position}}</b> with {{company.name}} on the following terms:</p>
     <table class="kv"><tr><td>Designation</td><td>{{position}}</td></tr><tr><td>Place of posting</td><td>{{location}}</td></tr><tr><td>Annual CTC</td><td>{{salary}}</td></tr><tr><td>Date of joining</td><td>{{joinDate}}</td></tr><tr><td>Probation</td><td>{{probation}}</td></tr></table>
     <p>A detailed appointment letter will be issued on joining. Please bring your ID / address proof, PAN, bank details, educational certificates and relieving letter from your previous employer.</p>
     <p>Kindly sign and return a copy of this letter as acceptance{{#acceptBy}} by {{acceptBy}}{{/acceptBy}}. We look forward to you joining our team.</p>`,
    { signatures: [FOR_CO, 'Accepted by candidate'] }),

  t('appointment_letter', 'hr', 'Appointment Letter', 'Appointment with salary, probation, working hours, leave, notice period and conduct.',
    [F.ref, F.date, { key: 'employee', label: 'Employee name', type: 'text', required: true }, { key: 'position', label: 'Designation', type: 'text', required: true },
     { key: 'joinDate', label: 'Date of joining', type: 'date' }, { key: 'location', label: 'Place of posting', type: 'text' },
     { key: 'salary', label: 'Salary (monthly gross / CTC)', type: 'text' }, { key: 'probation', label: 'Probation', type: 'text', default: '6 months' },
     { key: 'hours', label: 'Working hours', type: 'text', default: '9:00 am – 6:00 pm, Monday to Saturday (site timings may vary)' },
     { key: 'notice', label: 'Notice period', type: 'text', default: '30 days on either side (15 days during probation)' }, F.terms],
    `<p>Dear {{employee}},</p>
     <p>With reference to your application and subsequent interview, we are pleased to appoint you as <b>{{position}}</b> with effect from <b>{{joinDate}}</b> on the following terms:</p>
     <ol class="clauses">
      <li><b>Posting.</b> {{location}}. You may be transferred to any project site or office of the company.</li>
      <li><b>Salary.</b> {{salary}}, subject to statutory deductions (EPF, ESI, professional tax, TDS) as applicable.</li>
      <li><b>Probation.</b> {{probation}}, after which your services will be confirmed in writing based on performance.</li>
      <li><b>Working hours.</b> {{hours}}.</li>
      <li><b>Leave.</b> As per company leave policy and applicable law.</li>
      <li><b>Notice.</b> {{notice}}, or salary in lieu.</li>
      <li><b>Conduct.</b> You will follow company rules, site safety requirements and keep company information confidential.</li>
      {{#terms}}<li><b>Other terms.</b> {{terms}}</li>{{/terms}}
     </ol>
     <p>Please sign the duplicate copy as acceptance of these terms.</p>`,
    { signatures: [FOR_CO, 'Employee acceptance'] }),

  t('experience_certificate', 'hr', 'Experience Certificate', "Certify an employee's tenure, designation and conduct.",
    [F.ref, F.date, { key: 'employee', label: 'Employee name', type: 'text', required: true }, { key: 'position', label: 'Last designation', type: 'text' },
     { key: 'from', label: 'Employed from', type: 'date' }, { key: 'to', label: 'Employed to', type: 'date' },
     { key: 'remarks', label: 'Role / projects handled', type: 'textarea' }],
    `<h3 style="text-align:center">TO WHOMSOEVER IT MAY CONCERN</h3>
     <p>This is to certify that <b>{{employee}}</b> was employed with {{company.name}} from <b>{{from}}</b> to <b>{{to}}</b>, and was last designated as <b>{{position}}</b>.</p>
     {{#remarks}}<p>During this period, {{remarks}}</p>{{/remarks}}
     <p>Their conduct during the period of employment was good. We wish them success in their future endeavours.</p>`,
    { signatures: [FOR_CO] }),

  t('salary_slip', 'hr', 'Salary Slip', 'Monthly pay slip: attendance, earnings, deductions (EPF, ESI, PT, TDS, advance) and net pay.',
    [{ key: 'month', label: 'Pay month', type: 'text', required: true, placeholder: 'e.g. October 2026' }, { key: 'employee', label: 'Employee', type: 'text', required: true },
     { key: 'designation', label: 'Designation', type: 'text' }, { key: 'empCode', label: 'Employee code', type: 'text' },
     { key: 'uan', label: 'UAN / ESI no.', type: 'text' }, { key: 'bankAccount', label: 'Bank A/c (last 4 digits)', type: 'text' },
     { key: 'daysPayable', label: 'Paid days / month days', type: 'text', placeholder: 'e.g. 26 / 30' },
     items('earnings', 'Earnings', [col('description', 'Earning'), col('amount', 'Amount', 'money', { sum: true })]),
     items('deductionsTable', 'Deductions', [col('description', 'Deduction'), col('amount', 'Amount', 'money', { sum: true })]),
     items('items', 'Earnings (older format)', [COL.desc, COL.qty, COL.rate, COL.amount], { legacy: true }), { key: 'deductions', label: 'Total deductions (older format)', type: 'money', legacy: true }],
    `<div class="parties"><div class="box"><h4>Employee</h4><strong>{{employee}}</strong><div class="muted">{{designation}}{{#empCode}} · {{empCode}}{{/empCode}}</div>{{#uan}}<div class="muted">UAN / ESI: {{uan}}</div>{{/uan}}</div>
     <div class="box"><table class="kv"><tr><td>Pay month</td><td><b>{{month}}</b></td></tr>{{#daysPayable}}<tr><td>Paid days</td><td>{{daysPayable}}</td></tr>{{/daysPayable}}{{#bankAccount}}<tr><td>Bank A/c</td><td>XXXX{{bankAccount}}</td></tr>{{/bankAccount}}</table></div></div>
     {{#earnings}}<div class="parties"><div>{{table:earnings}}</div><div>{{table:deductionsTable}}</div></div>{{/earnings}}
     {{^earnings}}{{table:items}}{{#deductions}}<p>Total deductions: {{deductions}}</p>{{/deductions}}{{/earnings}}
     <div class="totals"><div class="grand"><span>Net pay</span><span>{{calc.netPay}}</span></div></div>
     <p class="words"><b>In words:</b> {{calc.netPayWords}}</p>
     <p class="muted">This is a computer-generated pay slip.</p>`,
    { hideTotals: true, signatures: [FOR_CO],
      compute: (s, d) => {
        const earn = s.earnings?.amount != null ? s.earnings.amount : s.items?.amount || 0;
        const ded = s.deductionsTable?.amount != null ? s.deductionsTable.amount : Number(d.deductions) || 0;
        return { netPay: earn - ded };
      } }),

  t('warning_letter', 'hr', 'Warning Letter', 'Formal warning describing the incident, rule breached and expected correction.',
    [F.ref, F.date, { key: 'employee', label: 'Employee', type: 'text', required: true }, { key: 'designation', label: 'Designation', type: 'text' },
     { key: 'subject', label: 'Subject', type: 'text', default: 'Warning for misconduct' }, { key: 'incidentDate', label: 'Date of incident', type: 'date' },
     { key: 'details', label: 'Details of incident', type: 'textarea', required: true }, { key: 'replyWithin', label: 'Reply within', type: 'text', default: '3 days' }],
    `<p>To,<br><b>{{employee}}</b>{{#designation}}<br>{{designation}}{{/designation}}</p>
     <p><b>Subject: {{subject}}</b></p>
     <p>Dear {{employee}},</p>
     <p>It has been brought to our notice that{{#incidentDate}} on {{incidentDate}}{{/incidentDate}}:</p><p>{{details}}</p>
     <p>This conduct is against company rules. You are hereby warned to correct it immediately. Any recurrence will lead to stricter disciplinary action. You may submit your explanation in writing within {{replyWithin}}.</p>`,
    { signatures: [FOR_CO, 'Received by employee'] }),

  // ===== Letters & General ====================================================
  t('letterhead', 'letters', 'Company Letterhead', 'Blank letterhead for free-form content.',
    [F.ref, F.date, { key: 'content', label: 'Content', type: 'textarea', required: true }],
    `<div class="freeform">{{content}}</div>`,
    { signatures: [FOR_CO] }),

  t('cover_letter', 'letters', 'Cover / Forwarding Letter', 'Forward bills, drawings or documents with an enclosure list.',
    [F.ref, F.date, F.toName, F.toAddr, { key: 'kindAttn', label: 'Kind attention', type: 'text' }, { key: 'subject', label: 'Subject', type: 'text', required: true },
     { key: 'body', label: 'Body', type: 'textarea', required: true }, { key: 'enclosures', label: 'Enclosures (one per line)', type: 'textarea' }],
    `<p>To,<br><b>{{recipientName}}</b><br><span class="muted">{{recipientAddress}}</span></p>
     {{#kindAttn}}<p>Kind attention: {{kindAttn}}</p>{{/kindAttn}}
     <p><b>Subject: {{subject}}</b></p><p>Dear Sir / Madam,</p><p>{{body}}</p>
     <p>Kindly acknowledge receipt.</p>
     {{#enclosures}}<h4>Enclosures</h4><p>{{enclosures}}</p>{{/enclosures}}`,
    { signatures: [FOR_CO] }),

  t('notice', 'letters', 'Notice', 'General notice / circular to staff, workers or residents.',
    [F.ref, F.date, { key: 'subject', label: 'Subject', type: 'text', required: true }, { key: 'body', label: 'Notice', type: 'textarea', required: true },
     { key: 'effectiveFrom', label: 'Effective from', type: 'date' }],
    `<h3 style="text-align:center">NOTICE</h3><p style="text-align:center"><b>{{subject}}</b></p><p>{{body}}</p>{{#effectiveFrom}}<p>This comes into effect from <b>{{effectiveFrom}}</b>.</p>{{/effectiveFrom}}`,
    { signatures: [FOR_CO] }),

  t('authorization_letter', 'letters', 'Authorization Letter', 'Authorise a person to act on the company\'s behalf, with ID and validity.',
    [F.ref, F.date, { key: 'authorized', label: 'Authorised person', type: 'text', required: true }, { key: 'designation', label: 'Designation', type: 'text' },
     { key: 'idProof', label: 'ID proof (type & number)', type: 'text' }, { key: 'purpose', label: 'Purpose / scope of authority', type: 'textarea', required: true },
     { key: 'validTill', label: 'Valid till', type: 'date' }],
    `<h3 style="text-align:center">LETTER OF AUTHORISATION</h3>
     <p>To whomsoever it may concern,</p>
     <p>We, {{company.name}}, hereby authorise <b>{{authorized}}</b>{{#designation}}, {{designation}}{{/designation}}{{#idProof}} ({{idProof}}){{/idProof}}, to act on our behalf for the following purpose:</p>
     <p>{{purpose}}</p>
     {{#validTill}}<p>This authorisation is valid till <b>{{validTill}}</b>.</p>{{/validTill}}
     <p>Specimen signature of the authorised person: ______________________</p>`,
    { signatures: [FOR_CO] }),

  t('noc', 'letters', 'No Objection Certificate', 'Issue an NOC for a stated purpose.',
    [F.ref, F.date, { key: 'party', label: 'Issued to', type: 'text', required: true }, { key: 'subject', label: 'Regarding', type: 'text', required: true },
     { key: 'details', label: 'Details / conditions', type: 'textarea' }],
    `<h3 style="text-align:center">NO OBJECTION CERTIFICATE</h3>
     <p>This is to certify that {{company.name}} has no objection to <b>{{party}}</b> regarding <b>{{subject}}</b>.</p>
     {{#details}}<p>{{details}}</p>{{/details}}
     <p>This certificate is issued on request for the above purpose only.</p>`,
    { signatures: [FOR_CO] }),
];

const BY_KEY = new Map(TEMPLATES.map((tpl) => [tpl.key, tpl]));

// Public metadata (no bodies) for the template gallery.
function listTemplates() {
  return TEMPLATES.map((tpl) => ({ key: tpl.key, name: tpl.name, category: tpl.category, description: tpl.description }));
}

function getTemplate(key) {
  return BY_KEY.get(key) || null;
}

module.exports = { CATEGORIES, TEMPLATES, listTemplates, getTemplate, renderDocument };
