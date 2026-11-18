'use strict';

/**
 * Document template library for the Documents module. Template bodies live here
 * in code; only filled values are stored per generated document. A body is an
 * HTML fragment with {{placeholders}} resolved from:
 *   - the document's own field values (by field key)
 *   - company branding: {{company.name|address|phone|email|logo}}
 *   - {{today}}, {{reference}}, {{title}}
 *   - {{itemsTable}} — expands to a professional line-items table + totals when
 *     the template has an `items` field.
 *
 * Field types: text | textarea | date | number | money | select | items.
 * `source` pre-fills the field on the client: company.* / project.* / client.* /
 * today. Required fields are enforced before a document can be finalised.
 */

const CATEGORIES = [
  { key: 'financial', label: 'Financial' },
  { key: 'agreements', label: 'Agreements & Contracts' },
  { key: 'orders', label: 'Orders & Procurement' },
  { key: 'site', label: 'Site & Project' },
  { key: 'hr', label: 'HR & Labour' },
  { key: 'letters', label: 'Letters & General' },
];

// Common reusable field definitions ---------------------------------------
const F = {
  ref: { key: 'reference', label: 'Document No.', type: 'text', placeholder: 'e.g. 2026-001' },
  date: { key: 'date', label: 'Date', type: 'date', source: 'today', required: true },
  project: { key: 'projectName', label: 'Project', type: 'text', source: 'project.name' },
  site: { key: 'siteAddress', label: 'Site / Location', type: 'textarea', source: 'project.address' },
  toName: { key: 'recipientName', label: 'To (Name)', type: 'text', required: true },
  toAddr: { key: 'recipientAddress', label: 'To (Address)', type: 'textarea' },
  items: { key: 'items', label: 'Line Items', type: 'items' },
  tax: { key: 'taxPercent', label: 'Tax %', type: 'number', placeholder: 'e.g. 18' },
  notes: { key: 'notes', label: 'Notes', type: 'textarea' },
  terms: { key: 'terms', label: 'Terms & Conditions', type: 'textarea' },
};

// A compact way to declare templates. Signature defaults to "Authorized Signatory".
function t(key, category, name, description, fields, body, extra = {}) {
  return { key, category, name, description, fields, body, ...extra };
}

const TEMPLATES = [
  // --- Financial ---------------------------------------------------------
  t('invoice', 'financial', 'Tax Invoice', 'Itemised invoice with totals & tax.',
    [F.ref, F.date, F.toName, F.toAddr, F.project, F.items, F.tax,
     { key: 'dueDate', label: 'Due Date', type: 'date' }, F.notes, F.terms],
    `<div class="parties"><div class="party"><h4>Bill To</h4><strong>{{recipientName}}</strong><div class="muted">{{recipientAddress}}</div></div>
     <div class="party r"><h4>Project</h4>{{projectName}}{{#dueDate}}<div class="muted">Due: {{dueDate}}</div>{{/dueDate}}</div></div>
     {{itemsTable}}
     {{#notes}}<div class="note"><h4>Notes</h4>{{notes}}</div>{{/notes}}
     {{#terms}}<div class="terms"><strong>Terms &amp; Conditions</strong><br>{{terms}}</div>{{/terms}}`),

  t('quotation', 'financial', 'Quotation / Estimate', 'Priced quotation for a client.',
    [F.ref, F.date, F.toName, F.toAddr, F.project, F.items, F.tax,
     { key: 'validUntil', label: 'Valid Until', type: 'date' }, F.notes, F.terms],
    `<div class="parties"><div class="party"><h4>Prepared For</h4><strong>{{recipientName}}</strong><div class="muted">{{recipientAddress}}</div></div>
     <div class="party r"><h4>Project</h4>{{projectName}}{{#validUntil}}<div class="muted">Valid until: {{validUntil}}</div>{{/validUntil}}</div></div>
     {{itemsTable}}
     {{#notes}}<div class="note"><h4>Scope / Notes</h4>{{notes}}</div>{{/notes}}
     {{#terms}}<div class="terms"><strong>Terms &amp; Conditions</strong><br>{{terms}}</div>{{/terms}}`),

  t('proforma_invoice', 'financial', 'Proforma Invoice', 'Advance/proforma invoice before supply.',
    [F.ref, F.date, F.toName, F.toAddr, F.project, F.items, F.tax, F.notes],
    `<div class="parties"><div class="party"><h4>Bill To</h4><strong>{{recipientName}}</strong><div class="muted">{{recipientAddress}}</div></div>
     <div class="party r"><h4>Project</h4>{{projectName}}</div></div>
     {{itemsTable}}
     {{#notes}}<div class="note">{{notes}}</div>{{/notes}}`),

  t('receipt', 'financial', 'Payment Receipt', 'Acknowledge a payment received.',
    [F.ref, F.date, { key: 'receivedFrom', label: 'Received From', type: 'text', required: true, source: 'client.name' },
     { key: 'amount', label: 'Amount', type: 'money', required: true },
     { key: 'amountWords', label: 'Amount in Words', type: 'text' },
     { key: 'towards', label: 'Towards', type: 'text', source: 'project.name' },
     { key: 'mode', label: 'Payment Mode', type: 'select', options: ['Cash', 'Bank Transfer', 'Cheque', 'UPI', 'Card'] }],
    `<table class="kv"><tr><td>Received with thanks from</td><td><strong>{{receivedFrom}}</strong></td></tr>
     <tr><td>The sum of</td><td><strong>{{amount}}</strong> {{#amountWords}}({{amountWords}}){{/amountWords}}</td></tr>
     <tr><td>Towards</td><td>{{towards}}</td></tr>
     <tr><td>Payment mode</td><td>{{mode}}</td></tr></table>`),

  t('credit_note', 'financial', 'Credit Note', 'Credit issued against an invoice.',
    [F.ref, F.date, F.toName, { key: 'againstInvoice', label: 'Against Invoice No.', type: 'text' }, F.items, F.tax, { key: 'reason', label: 'Reason', type: 'textarea' }],
    `<div class="parties"><div class="party"><h4>Credit To</h4><strong>{{recipientName}}</strong></div>
     <div class="party r"><h4>Against Invoice</h4>{{againstInvoice}}</div></div>
     {{itemsTable}}
     {{#reason}}<div class="note"><h4>Reason</h4>{{reason}}</div>{{/reason}}`),

  t('payment_reminder', 'financial', 'Payment Reminder', 'Polite reminder for an outstanding amount.',
    [F.date, F.toName, { key: 'invoiceNo', label: 'Invoice No.', type: 'text' },
     { key: 'amountDue', label: 'Amount Due', type: 'money', required: true },
     { key: 'dueSince', label: 'Due Since', type: 'date' }],
    `<p>Dear {{recipientName}},</p>
     <p>This is a gentle reminder that an amount of <strong>{{amountDue}}</strong> against invoice <strong>{{invoiceNo}}</strong> {{#dueSince}}(due since {{dueSince}}){{/dueSince}} remains outstanding.</p>
     <p>We request you to kindly arrange the payment at the earliest. Please ignore this notice if payment has already been made.</p>`),

  t('account_statement', 'financial', 'Statement of Account', 'Running account ledger for a client.',
    [F.ref, F.date, { key: 'clientName', label: 'Client', type: 'text', source: 'client.name', required: true },
     { key: 'period', label: 'Period', type: 'text' }, F.items,
     { key: 'balance', label: 'Closing Balance', type: 'money' }],
    `<div class="parties"><div class="party"><h4>Account Of</h4><strong>{{clientName}}</strong></div>
     <div class="party r"><h4>Period</h4>{{period}}</div></div>
     {{itemsTable}}
     {{#balance}}<div class="totals"><div class="grand"><span>Closing Balance</span><span>{{balance}}</span></div></div>{{/balance}}`),

  // --- Agreements --------------------------------------------------------
  t('construction_agreement', 'agreements', 'Construction Agreement', 'Main works agreement between owner & contractor.',
    [F.date, { key: 'owner', label: 'Owner / Client', type: 'text', required: true, source: 'client.name' },
     { key: 'contractor', label: 'Contractor', type: 'text', source: 'company.name' }, F.site,
     { key: 'scope', label: 'Scope of Work', type: 'textarea', required: true },
     { key: 'value', label: 'Contract Value', type: 'money' },
     { key: 'duration', label: 'Completion Period', type: 'text' }, F.terms],
    `<p>This Agreement is made on {{date}} between <strong>{{owner}}</strong> ("Owner") and <strong>{{contractor}}</strong> ("Contractor").</p>
     <h4>1. Site</h4><p>{{siteAddress}}</p>
     <h4>2. Scope of Work</h4><p>{{scope}}</p>
     <h4>3. Contract Value</h4><p>{{value}}</p>
     <h4>4. Completion Period</h4><p>{{duration}}</p>
     {{#terms}}<h4>5. Terms &amp; Conditions</h4><p>{{terms}}</p>{{/terms}}`,
    { signatures: ['Owner', 'Contractor'] }),

  t('subcontractor_agreement', 'agreements', 'Subcontractor Agreement', 'Agreement with a subcontractor.',
    [F.date, { key: 'subcontractor', label: 'Subcontractor', type: 'text', required: true }, F.project,
     { key: 'workScope', label: 'Work / Trade', type: 'textarea', required: true },
     { key: 'rate', label: 'Rate / Value', type: 'text' }, { key: 'duration', label: 'Duration', type: 'text' }, F.terms],
    `<p>This Subcontract Agreement dated {{date}} is between {{company.name}} ("Main Contractor") and <strong>{{subcontractor}}</strong> ("Subcontractor") for the project {{projectName}}.</p>
     <h4>Scope</h4><p>{{workScope}}</p><h4>Rate</h4><p>{{rate}}</p><h4>Duration</h4><p>{{duration}}</p>
     {{#terms}}<h4>Terms</h4><p>{{terms}}</p>{{/terms}}`,
    { signatures: ['Main Contractor', 'Subcontractor'] }),

  t('labour_contract', 'agreements', 'Labour Contract', 'Contract with a labour contractor/gang.',
    [F.date, { key: 'contractor', label: 'Labour Contractor', type: 'text', required: true }, F.site,
     { key: 'work', label: 'Nature of Work', type: 'textarea', required: true },
     { key: 'rate', label: 'Rate (per unit/day)', type: 'text' }, { key: 'headcount', label: 'No. of Workers', type: 'number' }, F.terms],
    `<p>Agreement dated {{date}} between {{company.name}} and <strong>{{contractor}}</strong> for labour supply at {{siteAddress}}.</p>
     <h4>Work</h4><p>{{work}}</p><h4>Rate</h4><p>{{rate}}</p><h4>Workers</h4><p>{{headcount}}</p>
     {{#terms}}<h4>Terms</h4><p>{{terms}}</p>{{/terms}}`,
    { signatures: ['Contractor', 'For ' + '{{company.name}}'] }),

  t('nda', 'agreements', 'Non-Disclosure Agreement', 'Mutual confidentiality agreement.',
    [F.date, { key: 'party', label: 'Other Party', type: 'text', required: true },
     { key: 'purpose', label: 'Purpose', type: 'textarea' }, { key: 'term', label: 'Term', type: 'text', placeholder: 'e.g. 2 years' }],
    `<p>This Non-Disclosure Agreement is entered into on {{date}} between {{company.name}} and <strong>{{party}}</strong>.</p>
     <h4>Purpose</h4><p>{{purpose}}</p>
     <p>Both parties agree to keep confidential all proprietary information exchanged for the above purpose, for a period of {{term}}, and to use it solely for that purpose.</p>`,
    { signatures: ['{{company.name}}', '{{party}}'] }),

  t('equipment_rental', 'agreements', 'Equipment Rental Agreement', 'Hire of plant/equipment.',
    [F.date, { key: 'party', label: 'Hirer / Owner', type: 'text', required: true },
     { key: 'equipment', label: 'Equipment', type: 'textarea', required: true },
     { key: 'rate', label: 'Rental Rate', type: 'text' }, { key: 'period', label: 'Rental Period', type: 'text' }, F.terms],
    `<p>Rental agreement dated {{date}} for the hire of equipment between {{company.name}} and <strong>{{party}}</strong>.</p>
     <h4>Equipment</h4><p>{{equipment}}</p><h4>Rate</h4><p>{{rate}}</p><h4>Period</h4><p>{{period}}</p>
     {{#terms}}<h4>Terms</h4><p>{{terms}}</p>{{/terms}}`,
    { signatures: ['Owner', 'Hirer'] }),

  t('consultancy_agreement', 'agreements', 'Consultancy Agreement', 'Engagement of a consultant/architect.',
    [F.date, { key: 'consultant', label: 'Consultant', type: 'text', required: true }, F.project,
     { key: 'services', label: 'Services', type: 'textarea', required: true }, { key: 'fee', label: 'Fee', type: 'text' }, F.terms],
    `<p>This Consultancy Agreement dated {{date}} is between {{company.name}} and <strong>{{consultant}}</strong> for {{projectName}}.</p>
     <h4>Services</h4><p>{{services}}</p><h4>Fee</h4><p>{{fee}}</p>
     {{#terms}}<h4>Terms</h4><p>{{terms}}</p>{{/terms}}`,
    { signatures: ['Consultant', 'Client'] }),

  // --- Orders & Procurement ---------------------------------------------
  t('purchase_order', 'orders', 'Purchase Order', 'Order materials/goods from a vendor.',
    [F.ref, F.date, { key: 'vendor', label: 'Vendor', type: 'text', required: true }, { key: 'vendorAddress', label: 'Vendor Address', type: 'textarea' },
     F.project, { key: 'deliverTo', label: 'Deliver To', type: 'textarea', source: 'project.address' }, F.items, F.tax, F.terms],
    `<div class="parties"><div class="party"><h4>Vendor</h4><strong>{{vendor}}</strong><div class="muted">{{vendorAddress}}</div></div>
     <div class="party r"><h4>Deliver To</h4><div class="muted">{{deliverTo}}</div></div></div>
     {{itemsTable}}
     {{#terms}}<div class="terms"><strong>Terms</strong><br>{{terms}}</div>{{/terms}}`),

  t('work_order', 'orders', 'Work Order', 'Authorise work to a contractor/team.',
    [F.ref, F.date, { key: 'contractor', label: 'Contractor / Team', type: 'text', required: true }, F.project, F.site,
     { key: 'work', label: 'Work Description', type: 'textarea', required: true }, { key: 'value', label: 'Order Value', type: 'money' },
     { key: 'startDate', label: 'Start Date', type: 'date' }, { key: 'endDate', label: 'Complete By', type: 'date' }, F.terms],
    `<div class="parties"><div class="party"><h4>Issued To</h4><strong>{{contractor}}</strong></div>
     <div class="party r"><h4>Project</h4>{{projectName}}</div></div>
     <h4>Work</h4><p>{{work}}</p>
     <table class="kv"><tr><td>Site</td><td>{{siteAddress}}</td></tr><tr><td>Value</td><td>{{value}}</td></tr>
     <tr><td>Start</td><td>{{startDate}}</td></tr><tr><td>Complete by</td><td>{{endDate}}</td></tr></table>
     {{#terms}}<div class="terms">{{terms}}</div>{{/terms}}`),

  t('change_order', 'orders', 'Change Order / Variation', 'Record a scope/cost variation.',
    [F.ref, F.date, F.project, { key: 'description', label: 'Change Description', type: 'textarea', required: true },
     { key: 'reason', label: 'Reason', type: 'textarea' }, { key: 'costImpact', label: 'Cost Impact', type: 'money' },
     { key: 'timeImpact', label: 'Time Impact', type: 'text' }],
    `<div class="parties"><div class="party"><h4>Project</h4><strong>{{projectName}}</strong></div></div>
     <h4>Change Description</h4><p>{{description}}</p>{{#reason}}<h4>Reason</h4><p>{{reason}}</p>{{/reason}}
     <table class="kv"><tr><td>Cost Impact</td><td>{{costImpact}}</td></tr><tr><td>Time Impact</td><td>{{timeImpact}}</td></tr></table>`,
    { signatures: ['Requested By', 'Approved By'] }),

  t('material_requisition', 'orders', 'Material Requisition', 'Request materials from store/office.',
    [F.ref, F.date, F.project, { key: 'requestedBy', label: 'Requested By', type: 'text' },
     { key: 'requiredBy', label: 'Required By', type: 'date' }, F.items],
    `<div class="parties"><div class="party"><h4>Project</h4><strong>{{projectName}}</strong></div>
     <div class="party r"><h4>Required By</h4>{{requiredBy}}</div></div>
     {{itemsTable}}`,
    { signatures: ['Requested By', 'Approved By'], hideTotals: true }),

  t('delivery_challan', 'orders', 'Delivery Challan', 'Goods dispatch note (no pricing).',
    [F.ref, F.date, { key: 'deliverTo', label: 'Deliver To', type: 'text', required: true }, { key: 'address', label: 'Address', type: 'textarea' },
     F.project, F.items, { key: 'vehicle', label: 'Vehicle No.', type: 'text' }],
    `<div class="parties"><div class="party"><h4>Deliver To</h4><strong>{{deliverTo}}</strong><div class="muted">{{address}}</div></div>
     <div class="party r"><h4>Project</h4>{{projectName}}{{#vehicle}}<div class="muted">Vehicle: {{vehicle}}</div>{{/vehicle}}</div></div>
     {{itemsTable}}`,
    { signatures: ['Dispatched By', 'Received By'], hideTotals: true }),

  t('goods_received_note', 'orders', 'Goods Received Note', 'Acknowledge materials received at site.',
    [F.ref, F.date, { key: 'vendor', label: 'Supplier', type: 'text' }, F.project, { key: 'poNo', label: 'Against PO No.', type: 'text' }, F.items,
     { key: 'remarks', label: 'Remarks', type: 'textarea' }],
    `<div class="parties"><div class="party"><h4>Supplier</h4><strong>{{vendor}}</strong></div>
     <div class="party r"><h4>PO No.</h4>{{poNo}}</div></div>
     {{itemsTable}}
     {{#remarks}}<div class="note"><h4>Remarks</h4>{{remarks}}</div>{{/remarks}}`,
    { signatures: ['Received By', 'Store In-charge'], hideTotals: true }),

  // --- Site & Project ----------------------------------------------------
  t('site_instruction', 'site', 'Site Instruction', 'Instruction to the site team/contractor.',
    [F.ref, F.date, F.project, { key: 'to', label: 'To', type: 'text', required: true },
     { key: 'instruction', label: 'Instruction', type: 'textarea', required: true }, { key: 'actionBy', label: 'Action By', type: 'date' }],
    `<div class="parties"><div class="party"><h4>To</h4><strong>{{to}}</strong></div>
     <div class="party r"><h4>Project</h4>{{projectName}}</div></div>
     <h4>Instruction</h4><p>{{instruction}}</p>{{#actionBy}}<p class="muted">Action required by: {{actionBy}}</p>{{/actionBy}}`,
    { signatures: ['Issued By'] }),

  t('daily_progress_report', 'site', 'Daily Progress Report', 'Daily site activity & manpower.',
    [F.date, F.project, { key: 'weather', label: 'Weather', type: 'text' }, { key: 'manpower', label: 'Manpower (count/trade)', type: 'textarea' },
     { key: 'workDone', label: 'Work Done Today', type: 'textarea', required: true }, { key: 'materials', label: 'Materials Received', type: 'textarea' },
     { key: 'issues', label: 'Issues / Delays', type: 'textarea' }, { key: 'planned', label: 'Planned for Tomorrow', type: 'textarea' }],
    `<div class="parties"><div class="party"><h4>Project</h4><strong>{{projectName}}</strong></div>
     <div class="party r"><h4>Weather</h4>{{weather}}</div></div>
     <h4>Work Done</h4><p>{{workDone}}</p><h4>Manpower</h4><p>{{manpower}}</p>
     {{#materials}}<h4>Materials Received</h4><p>{{materials}}</p>{{/materials}}
     {{#issues}}<h4>Issues / Delays</h4><p>{{issues}}</p>{{/issues}}
     {{#planned}}<h4>Planned Tomorrow</h4><p>{{planned}}</p>{{/planned}}`,
    { signatures: ['Site Engineer'] }),

  t('inspection_report', 'site', 'Inspection Report', 'Quality/work inspection record.',
    [F.ref, F.date, F.project, { key: 'inspectedItem', label: 'Item Inspected', type: 'text', required: true },
     { key: 'observations', label: 'Observations', type: 'textarea', required: true },
     { key: 'result', label: 'Result', type: 'select', options: ['Approved', 'Approved with comments', 'Rejected'] },
     { key: 'actions', label: 'Corrective Actions', type: 'textarea' }],
    `<div class="parties"><div class="party"><h4>Project</h4><strong>{{projectName}}</strong></div>
     <div class="party r"><h4>Result</h4>{{result}}</div></div>
     <h4>Item Inspected</h4><p>{{inspectedItem}}</p><h4>Observations</h4><p>{{observations}}</p>
     {{#actions}}<h4>Corrective Actions</h4><p>{{actions}}</p>{{/actions}}`,
    { signatures: ['Inspected By', 'Approved By'] }),

  t('completion_certificate', 'site', 'Work Completion Certificate', 'Certify completion of work/phase.',
    [F.ref, F.date, F.project, { key: 'client', label: 'Client', type: 'text', source: 'client.name' },
     { key: 'workScope', label: 'Work Completed', type: 'textarea', required: true }, { key: 'completionDate', label: 'Completion Date', type: 'date' }],
    `<p>This is to certify that the work described below for the project <strong>{{projectName}}</strong> has been completed satisfactorily.</p>
     <h4>Work Completed</h4><p>{{workScope}}</p>
     <table class="kv"><tr><td>Client</td><td>{{client}}</td></tr><tr><td>Completion Date</td><td>{{completionDate}}</td></tr></table>`,
    { signatures: ['For ' + '{{company.name}}', 'Client Acceptance'] }),

  t('handover_certificate', 'site', 'Handover Certificate', 'Hand over project/unit to the client.',
    [F.ref, F.date, F.project, { key: 'client', label: 'Handed Over To', type: 'text', required: true, source: 'client.name' },
     { key: 'items', label: 'Items / Keys Handed Over', type: 'textarea' }, { key: 'remarks', label: 'Remarks', type: 'textarea' }],
    `<p>The project <strong>{{projectName}}</strong> is hereby handed over to <strong>{{client}}</strong> on {{date}}.</p>
     {{#items}}<h4>Items Handed Over</h4><p>{{items}}</p>{{/items}}{{#remarks}}<h4>Remarks</h4><p>{{remarks}}</p>{{/remarks}}`,
    { signatures: ['Handed Over By', 'Received By'] }),

  t('snag_list', 'site', 'Snag / Punch List', 'List of defects to rectify before handover.',
    [F.ref, F.date, F.project, { key: 'area', label: 'Area / Unit', type: 'text' }, F.items],
    `<div class="parties"><div class="party"><h4>Project</h4><strong>{{projectName}}</strong></div>
     <div class="party r"><h4>Area</h4>{{area}}</div></div>
     {{itemsTable}}`,
    { signatures: ['Prepared By', 'Reviewed By'], hideTotals: true }),

  t('material_approval', 'site', 'Material Approval Request', 'Submit a material/sample for approval.',
    [F.ref, F.date, F.project, { key: 'material', label: 'Material / Make', type: 'text', required: true },
     { key: 'specification', label: 'Specification', type: 'textarea' }, { key: 'proposedUse', label: 'Proposed Use', type: 'text' }],
    `<div class="parties"><div class="party"><h4>Project</h4><strong>{{projectName}}</strong></div></div>
     <h4>Material</h4><p>{{material}}</p>{{#specification}}<h4>Specification</h4><p>{{specification}}</p>{{/specification}}
     {{#proposedUse}}<h4>Proposed Use</h4><p>{{proposedUse}}</p>{{/proposedUse}}`,
    { signatures: ['Submitted By', 'Approved By'] }),

  // --- HR & Labour -------------------------------------------------------
  t('offer_letter', 'hr', 'Job Offer Letter', 'Offer of employment.',
    [F.date, { key: 'candidate', label: 'Candidate Name', type: 'text', required: true }, { key: 'position', label: 'Position', type: 'text', required: true },
     { key: 'salary', label: 'Salary (CTC)', type: 'text' }, { key: 'joinDate', label: 'Joining Date', type: 'date' }],
    `<p>Dear {{candidate}},</p>
     <p>We are pleased to offer you the position of <strong>{{position}}</strong> at {{company.name}}.</p>
     <table class="kv"><tr><td>Compensation</td><td>{{salary}}</td></tr><tr><td>Joining Date</td><td>{{joinDate}}</td></tr></table>
     <p>We look forward to welcoming you to our team.</p>`,
    { signatures: ['For ' + '{{company.name}}'] }),

  t('appointment_letter', 'hr', 'Appointment Letter', 'Confirm appointment & terms.',
    [F.date, { key: 'employee', label: 'Employee Name', type: 'text', required: true }, { key: 'position', label: 'Designation', type: 'text', required: true },
     { key: 'salary', label: 'Salary', type: 'text' }, { key: 'joinDate', label: 'Date of Joining', type: 'date' }, F.terms],
    `<p>Dear {{employee}},</p>
     <p>With reference to your application, we are pleased to appoint you as <strong>{{position}}</strong> with effect from {{joinDate}}.</p>
     <table class="kv"><tr><td>Salary</td><td>{{salary}}</td></tr></table>
     {{#terms}}<h4>Terms of Employment</h4><p>{{terms}}</p>{{/terms}}`,
    { signatures: ['For ' + '{{company.name}}', 'Employee'] }),

  t('experience_certificate', 'hr', 'Experience Certificate', 'Certify an employee\'s tenure.',
    [F.date, { key: 'employee', label: 'Employee Name', type: 'text', required: true }, { key: 'position', label: 'Designation', type: 'text' },
     { key: 'from', label: 'From', type: 'date' }, { key: 'to', label: 'To', type: 'date' }, { key: 'remarks', label: 'Remarks', type: 'textarea' }],
    `<p>This is to certify that <strong>{{employee}}</strong> was employed with {{company.name}} as {{position}} from {{from}} to {{to}}.</p>
     {{#remarks}}<p>{{remarks}}</p>{{/remarks}}<p>We wish them success in their future endeavours.</p>`,
    { signatures: ['For ' + '{{company.name}}'] }),

  t('salary_slip', 'hr', 'Salary Slip', 'Monthly pay slip.',
    [{ key: 'month', label: 'Month', type: 'text', required: true }, { key: 'employee', label: 'Employee', type: 'text', required: true },
     { key: 'designation', label: 'Designation', type: 'text' }, F.items,
     { key: 'deductions', label: 'Deductions', type: 'money' }, { key: 'netPay', label: 'Net Pay', type: 'money' }],
    `<div class="parties"><div class="party"><h4>Employee</h4><strong>{{employee}}</strong><div class="muted">{{designation}}</div></div>
     <div class="party r"><h4>Month</h4>{{month}}</div></div>
     {{itemsTable}}
     <table class="kv"><tr><td>Deductions</td><td>{{deductions}}</td></tr><tr><td><strong>Net Pay</strong></td><td><strong>{{netPay}}</strong></td></tr></table>`,
    { signatures: ['For ' + '{{company.name}}'] }),

  t('warning_letter', 'hr', 'Warning Letter', 'Formal warning to an employee.',
    [F.date, { key: 'employee', label: 'Employee', type: 'text', required: true }, { key: 'subject', label: 'Subject', type: 'text' },
     { key: 'details', label: 'Details', type: 'textarea', required: true }],
    `<p>Dear {{employee}},</p><p><strong>Subject: {{subject}}</strong></p><p>{{details}}</p>
     <p>You are advised to take this as a formal warning and ensure such instances do not recur.</p>`,
    { signatures: ['For ' + '{{company.name}}'] }),

  // --- Letters & General -------------------------------------------------
  t('letterhead', 'letters', 'Company Letterhead', 'Blank letterhead for free-form content.',
    [{ key: 'content', label: 'Content', type: 'textarea', required: true }],
    `<div class="freeform">{{content}}</div>`,
    { signatures: ['For ' + '{{company.name}}'] }),

  t('cover_letter', 'letters', 'Cover / Forwarding Letter', 'Forward documents or a submission.',
    [F.date, F.toName, F.toAddr, { key: 'subject', label: 'Subject', type: 'text' }, { key: 'body', label: 'Body', type: 'textarea', required: true }],
    `<p>To,<br><strong>{{recipientName}}</strong><br><span class="muted">{{recipientAddress}}</span></p>
     {{#subject}}<p><strong>Subject: {{subject}}</strong></p>{{/subject}}<p>{{body}}</p>`,
    { signatures: ['For ' + '{{company.name}}'] }),

  t('notice', 'letters', 'Notice', 'General notice/circular.',
    [F.date, { key: 'subject', label: 'Subject', type: 'text', required: true }, { key: 'body', label: 'Notice', type: 'textarea', required: true }],
    `<h3 style="text-align:center">NOTICE</h3><p><strong>{{subject}}</strong></p><p>{{body}}</p>`,
    { signatures: ['For ' + '{{company.name}}'] }),

  t('authorization_letter', 'letters', 'Authorization Letter', 'Authorise a person to act on behalf.',
    [F.date, { key: 'authorized', label: 'Authorized Person', type: 'text', required: true }, { key: 'idProof', label: 'ID / Reference', type: 'text' },
     { key: 'purpose', label: 'Purpose', type: 'textarea', required: true }],
    `<p>To Whomsoever It May Concern,</p>
     <p>This is to authorise <strong>{{authorized}}</strong> {{#idProof}}({{idProof}}){{/idProof}} to act on behalf of {{company.name}} for the following purpose:</p>
     <p>{{purpose}}</p>`,
    { signatures: ['For ' + '{{company.name}}'] }),

  t('noc', 'letters', 'No Objection Certificate', 'Issue an NOC.',
    [F.date, { key: 'party', label: 'Issued To', type: 'text', required: true }, { key: 'subject', label: 'Regarding', type: 'text', required: true },
     { key: 'details', label: 'Details', type: 'textarea' }],
    `<h3 style="text-align:center">NO OBJECTION CERTIFICATE</h3>
     <p>This is to certify that {{company.name}} has no objection to <strong>{{party}}</strong> with respect to <strong>{{subject}}</strong>.</p>
     {{#details}}<p>{{details}}</p>{{/details}}`,
    { signatures: ['For ' + '{{company.name}}'] }),
];

const BY_KEY = new Map(TEMPLATES.map((tpl) => [tpl.key, tpl]));

// --- rendering --------------------------------------------------------------

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
// Escape but keep user newlines as <br>.
function escMultiline(s) {
  return esc(s).replace(/\n/g, '<br>');
}

function formatMoney(value, currency = 'INR') {
  const n = Number(value);
  if (Number.isNaN(n)) return esc(value);
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}
function fmtDate(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return esc(v);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

// Build the line-items table + totals for templates with an `items` field.
function itemsTableHtml(template, data, currency, opts = {}) {
  const field = template.fields.find((f) => f.type === 'items');
  if (!field) return '';
  const rows = Array.isArray(data[field.key]) ? data[field.key] : [];
  const money = opts.hideTotals ? null : (v) => formatMoney(v, currency);
  let subtotal = 0;
  const body = rows
    .map((r, i) => {
      const qty = Number(r.qty) || 0;
      const rate = Number(r.rate) || 0;
      const amount = qty * rate;
      subtotal += amount;
      return `<tr><td>${i + 1}</td><td>${esc(r.description || '')}</td><td class="r">${r.qty != null && r.qty !== '' ? esc(r.qty) : ''}</td>${
        opts.hideTotals ? '' : `<td class="r">${rate ? money(rate) : ''}</td><td class="r">${amount ? money(amount) : ''}</td>`
      }</tr>`;
    })
    .join('');

  const head = opts.hideTotals
    ? '<tr><th>#</th><th>Description</th><th class="r">Qty</th></tr>'
    : '<tr><th>#</th><th>Description</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr>';

  let totals = '';
  if (!opts.hideTotals) {
    const taxPct = Number(data.taxPercent) || 0;
    const tax = (subtotal * taxPct) / 100;
    const grand = subtotal + tax;
    totals = `<div class="totals"><div><span>Subtotal</span><span>${money(subtotal)}</span></div>${
      taxPct ? `<div><span>Tax (${taxPct}%)</span><span>${money(tax)}</span></div>` : ''
    }<div class="grand"><span>Total</span><span>${money(grand)}</span></div></div>`;
  }
  return `<table class="items"><thead>${head}</thead><tbody>${body || '<tr><td colspan="5" class="muted">No items</td></tr>'}</tbody></table>${totals}`;
}

// Resolve {{placeholders}} and {{#key}}...{{/key}} conditionals against a flat map.
function interpolate(html, map) {
  // Conditionals: show block only when the value is truthy/non-empty.
  let out = html.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, inner) => {
    const v = map[key];
    return v != null && String(v).trim() !== '' ? inner : '';
  });
  // Simple placeholders, including dotted company.* keys.
  out = out.replace(/\{\{([\w.]+)\}\}/g, (_, key) => (map[key] != null ? map[key] : ''));
  return out;
}

/**
 * Render a full, print-ready HTML document.
 * @param {object} template
 * @param {object} data       filled field values
 * @param {object} company    { name, address, phone, email, logoUrl, currency }
 * @param {object} branding   optional { signatureUrl, footer }
 */
function renderDocument(template, data = {}, company = {}, branding = {}) {
  const currency = company.currency || 'INR';

  // Build the interpolation map from field values (type-aware) + company + meta.
  const map = {};
  for (const f of template.fields) {
    const v = data[f.key];
    if (f.type === 'items') continue; // handled by itemsTable
    if (f.type === 'money') map[f.key] = v != null && v !== '' ? esc(formatMoney(v, currency)) : '';
    else if (f.type === 'date') map[f.key] = fmtDate(v);
    else if (f.type === 'textarea') map[f.key] = escMultiline(v);
    else map[f.key] = esc(v);
  }
  map['company.name'] = esc(company.name || 'Company');
  map['company.address'] = escMultiline(company.address || '');
  map['company.phone'] = esc(company.phone || '');
  map['company.email'] = esc(company.email || '');
  map.today = todayStr();
  map.date = map.date || todayStr();
  map.reference = esc(data.reference || '');
  map.title = esc(template.name);
  // Precompute the items table so the {{itemsTable}} placeholder resolves in the
  // same interpolation pass (raw HTML, not escaped).
  map.itemsTable = itemsTableHtml(template, data, currency, { hideTotals: template.hideTotals });

  const body = interpolate(template.body, map);

  // Signature columns (labels may contain {{company.name}}).
  const sigLabels = (template.signatures || ['Authorized Signatory']).map((l) => interpolate(l, map));
  const sigs = sigLabels
    .map(
      (label) =>
        `<div class="sig">${branding.signatureUrl && sigLabels.length === 1 ? `<img src="${esc(branding.signatureUrl)}" alt=""/>` : ''}<div class="sigline">${label}</div></div>`,
    )
    .join('');

  const metaBits = [
    data.reference ? `<div><strong>${esc(data.reference)}</strong></div>` : '',
    `<div>Date: ${map.date}</div>`,
  ].join('');

  const contact = [company.phone, company.email].filter(Boolean).map(esc).join(' &nbsp;|&nbsp; ');

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(template.name)}${data.reference ? ' · ' + esc(data.reference) : ''}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1f2937;margin:0;padding:36px;font-size:13px;line-height:1.55}
  .doc{max-width:820px;margin:0 auto}
  .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #F97316;padding-bottom:16px}
  .brand{display:flex;gap:14px;align-items:center}
  .brand img{max-height:64px;max-width:170px;object-fit:contain}
  .cname{font-size:20px;font-weight:700;color:#0f172a}
  .muted{color:#6b7280;font-size:12px;line-height:1.5}
  .title-wrap{text-align:right}
  .title-wrap h1{margin:0;font-size:24px;letter-spacing:1px;color:#F97316;text-transform:uppercase}
  .title-wrap .meta{margin-top:6px;font-size:12px;color:#374151}
  h3{margin:18px 0 4px}
  h4{margin:16px 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:.6px;color:#9a3412}
  p{margin:6px 0}
  .parties{display:flex;justify-content:space-between;gap:24px;margin:20px 0}
  .party h4{margin-top:0}
  .party.r{text-align:right}
  table.items{width:100%;border-collapse:collapse;margin:14px 0}
  table.items thead th{background:#FFF7ED;color:#9a3412;text-align:left;padding:8px 10px;font-size:11px;text-transform:uppercase;letter-spacing:.4px}
  table.items tbody td{padding:8px 10px;border-bottom:1px solid #f1f5f9}
  .r{text-align:right}
  .totals{margin-left:auto;width:280px;margin-top:10px}
  .totals div{display:flex;justify-content:space-between;padding:4px 0}
  .totals .grand{border-top:2px solid #F97316;margin-top:6px;padding-top:8px;font-size:16px;font-weight:700;color:#0f172a}
  table.kv{border-collapse:collapse;margin:12px 0;width:100%;max-width:460px}
  table.kv td{padding:5px 8px;border-bottom:1px solid #f1f5f9}
  table.kv td:first-child{color:#6b7280;width:45%}
  .note,.terms{margin-top:16px;font-size:12px;color:#374151}
  .terms{border-top:1px solid #f1f5f9;padding-top:10px;color:#6b7280;white-space:pre-wrap}
  .freeform{white-space:pre-wrap;margin-top:12px}
  .sigs{display:flex;justify-content:space-between;gap:40px;margin-top:56px}
  .sig{flex:1;text-align:center}
  .sig img{max-height:58px;margin-bottom:2px}
  .sigline{border-top:1px solid #9ca3af;padding-top:5px;font-size:12px;color:#374151;margin-top:34px}
  .foot{margin-top:28px;border-top:1px solid #f1f5f9;padding-top:8px;text-align:center;color:#9ca3af;font-size:11px}
  @media print{body{padding:0}.doc{max-width:none}}
</style></head>
<body>
  <div class="doc">
    <div class="top">
      <div class="brand">
        ${company.logoUrl ? `<img src="${esc(company.logoUrl)}" alt="logo"/>` : ''}
        <div>
          <div class="cname">${esc(company.name || 'Company')}</div>
          <div class="muted">${escMultiline(company.address || '')}</div>
          ${contact ? `<div class="muted">${contact}</div>` : ''}
        </div>
      </div>
      <div class="title-wrap">
        <h1>${esc(template.name)}</h1>
        <div class="meta">${metaBits}</div>
      </div>
    </div>
    ${body}
    <div class="sigs">${sigs}</div>
    ${branding.footer ? `<div class="foot">${esc(branding.footer)}</div>` : ''}
  </div>
</body></html>`;
}

// Public metadata (no bodies) for the template gallery.
function listTemplates() {
  return TEMPLATES.map((tpl) => ({
    key: tpl.key,
    name: tpl.name,
    category: tpl.category,
    description: tpl.description,
  }));
}

function getTemplate(key) {
  return BY_KEY.get(key) || null;
}

module.exports = { CATEGORIES, TEMPLATES, listTemplates, getTemplate, renderDocument };
