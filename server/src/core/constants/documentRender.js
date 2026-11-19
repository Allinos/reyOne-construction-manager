'use strict';

/**
 * Print-ready HTML renderer for document templates.
 *
 * Template body placeholders:
 *   {{field}}                 a field value (escaped, type-aware)
 *   {{#field}}…{{/field}}     block shown only when the field has a value
 *   {{^field}}…{{/field}}     block shown only when the field is empty
 *   {{itemsTable}}            the main line-item table + totals (GST split,
 *                             deductions for running bills, amount in words)
 *   {{table:key}}             any other table field (with column totals)
 *   {{sum.key.col}}           a column total; {{calc.name}} / {{calc.nameWords}}
 *                             values from a template's compute() hook
 *   {{company.*}}             name, address, phone, email, gstin, pan, state
 *   {{bankBlock}}             company bank details (from Settings → Company)
 *   {{amountWords}}           grand total / net payable in words
 *   {{today}}, {{reference}}, {{title}}
 */

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
const escMultiline = (s) => esc(s).replace(/\n/g, '<br>');

function formatMoney(value, currency = 'INR') {
  const n = Number(value);
  if (value === '' || value == null || Number.isNaN(n)) return '';
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}
const num = (v) => {
  const n = Number(v);
  return v === '' || v == null || Number.isNaN(n) ? null : n;
};
const fmtNum = (n) => (n == null ? '' : String(Math.round(n * 1000) / 1000));

function fmtDate(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return esc(v);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}
const todayStr = () => fmtDate(new Date());

// Indian-system amount in words: "Rupees One Lakh Twenty Thousand and Fifty Paise Only".
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function twoDigits(n) { return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`; }
function threeDigits(n) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : '', r ? twoDigits(r) : ''].filter(Boolean).join(' ');
}
function intToWordsIN(n) {
  if (n === 0) return 'Zero';
  const parts = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(`${intToWordsIN(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (n) parts.push(threeDigits(n));
  return parts.join(' ');
}
function amountInWords(value, currency = 'INR') {
  const v = Math.round(Math.abs(Number(value) || 0) * 100) / 100;
  const rupees = Math.floor(v);
  const paise = Math.round((v - rupees) * 100);
  const unit = currency === 'INR' ? 'Rupees' : currency;
  return `${Number(value) < 0 ? 'Minus ' : ''}${unit} ${intToWordsIN(rupees)}${paise ? ` and ${twoDigits(paise)} Paise` : ''} Only`;
}

// --- tables -------------------------------------------------------------------

const DEFAULT_COLUMNS = [
  { key: 'description', label: 'Description', type: 'text' },
  { key: 'qty', label: 'Qty', type: 'number' },
  { key: 'rate', label: 'Rate', type: 'money' },
  { key: 'amount', label: 'Amount', type: 'money', calc: 'qty*rate', sum: true },
];
const columnsOf = (field) => field.columns || DEFAULT_COLUMNS;

// Computed cells: "qty*rate" or "product:nos,length,breadth,depth" (blank factors are skipped,
// as in a measurement book where area items have no depth).
function calcValue(calc, row) {
  if (!calc) return null;
  if (calc.startsWith('product:')) {
    const vals = calc.slice(8).split(',').map((k) => num(row[k])).filter((v) => v != null);
    return vals.length ? vals.reduce((a, b) => a * b, 1) : null;
  }
  const [a, b] = calc.split('*');
  const x = num(row[a]);
  const y = num(row[b]);
  return x == null || y == null ? null : x * y;
}

function tableHtml(field, rows, currency) {
  const cols = columnsOf(field);
  const sums = {};
  const numeric = (c) => ['number', 'money'].includes(c.type);
  const body = rows.map((r, i) => {
    const cells = cols.map((c) => {
      const raw = c.calc ? calcValue(c.calc, r) : r[c.key];
      if (c.sum && num(raw) != null) sums[c.key] = (sums[c.key] || 0) + Number(raw);
      let out;
      if (c.type === 'money') out = formatMoney(raw, currency);
      else if (c.type === 'number') out = c.calc ? fmtNum(raw) : esc(raw ?? '');
      else if (c.type === 'date') out = fmtDate(raw);
      else out = escMultiline(raw ?? '');
      return `<td class="${numeric(c) ? 'r' : ''}">${out}</td>`;
    }).join('');
    return `<tr><td class="c">${i + 1}</td>${cells}</tr>`;
  }).join('');
  const head = `<tr><th class="c" style="width:34px">S.No.</th>${cols.map((c) => `<th class="${numeric(c) ? 'r' : ''}">${esc(c.label)}</th>`).join('')}</tr>`;
  const hasSum = cols.some((c) => c.sum);
  const foot = hasSum && rows.length
    ? `<tfoot><tr><td></td>${cols.map((c, i) => `<td class="${numeric(c) ? 'r' : ''}">${c.sum ? (c.type === 'money' ? formatMoney(sums[c.key] || 0, currency) : fmtNum(sums[c.key] || 0)) : i === 0 ? '<b>Total</b>' : ''}</td>`).join('')}</tr></tfoot>`
    : '';
  const html = `<table class="items"><thead>${head}</thead><tbody>${body || `<tr><td colspan="${cols.length + 1}" class="muted c">No entries</td></tr>`}</tbody>${foot}</table>`;
  return { html, sums };
}

// Totals for the main priced table: taxable value, GST split, running-bill deductions.
function totalsHtml(template, data, subtotal, currency) {
  const money = (v) => formatMoney(v, currency);
  const rows = [];
  const line = (label, value, cls = '') => rows.push(`<div class="${cls}"><span>${label}</span><span>${value}</span></div>`);
  const taxPct = Number(data.taxPercent) || 0;
  const mode = data.taxMode || (taxPct ? 'CGST + SGST' : 'No GST');
  const tax = mode === 'No GST' ? 0 : (subtotal * taxPct) / 100;
  line(template.billing ? 'Value of work done (cumulative)' : 'Taxable value', money(subtotal));
  if (tax) {
    if (mode === 'IGST') line(`IGST @ ${taxPct}%`, money(tax));
    else { line(`CGST @ ${taxPct / 2}%`, money(tax / 2)); line(`SGST @ ${taxPct / 2}%`, money(tax / 2)); }
  }
  const extra = Number(data.freight) || 0;
  if (extra) line('Freight / other charges', money(extra));
  let grand = subtotal + tax + extra;
  let payable = grand;
  if (template.billing) {
    line('Gross value incl. tax', money(grand), 'sub');
    const prev = Number(data.previousBilled) || 0;
    const thisBill = grand - prev;
    if (prev) { line('Less: previously billed', `− ${money(prev)}`); line('Value of this bill', money(thisBill), 'sub'); }
    const retPct = Number(data.retentionPercent) || 0;
    const retention = (thisBill * retPct) / 100;
    const adv = Number(data.advanceRecovery) || 0;
    const tdsPct = Number(data.tdsPercent) || 0;
    // TDS is deducted on the value excluding GST.
    const tdsBase = tax ? thisBill / (1 + taxPct / 100) : thisBill;
    const tds = (tdsBase * tdsPct) / 100;
    const other = Number(data.otherDeductions) || 0;
    if (retPct) line(`Less: retention @ ${retPct}%`, `− ${money(retention)}`);
    if (adv) line('Less: advance recovery', `− ${money(adv)}`);
    if (tdsPct) line(`Less: TDS @ ${tdsPct}%`, `− ${money(tds)}`);
    if (other) line('Less: other deductions / recoveries', `− ${money(other)}`);
    payable = thisBill - retention - adv - tds - other;
    grand = payable;
  }
  const rounded = Math.round(grand);
  const roundOff = Math.round((rounded - grand) * 100) / 100;
  if (roundOff) line('Round off', money(roundOff));
  line(template.billing ? 'Net amount payable' : 'Grand total', money(rounded), 'grand');
  return { html: `<div class="totals">${rows.join('')}</div><p class="words"><b>Amount in words:</b> ${amountInWords(rounded, currency)}</p>`, grand: rounded };
}

// --- interpolation -------------------------------------------------------------

function interpolate(html, map) {
  // Repeat so blocks nested inside other blocks are resolved too.
  let out = html;
  for (let i = 0; i < 5; i += 1) {
    const next = out.replace(/\{\{([#^])([\w.]+)\}\}([\s\S]*?)\{\{\/\2\}\}/g, (_, kind, key, inner) => {
      const v = map[key];
      const has = v != null && String(v).trim() !== '';
      return (kind === '#' ? has : !has) ? inner : '';
    });
    if (next === out) break;
    out = next;
  }
  out = out.replace(/\{\{([\w.:]+)\}\}/g, (_, key) => (map[key] != null ? map[key] : ''));
  return out;
}

function bankBlock(b) {
  const rows = [['Bank', b.bankName], ['Account name', b.accountHolder], ['Account no.', b.accountNumber], ['IFSC', b.ifsc], ['Branch', b.branch], ['UPI', b.upiId]].filter(([, v]) => v);
  if (!rows.length) return '';
  return `<div class="bank"><h4>Bank details for payment</h4><table class="kv">${rows.map(([k, v]) => `<tr><td>${k}</td><td>${esc(v)}</td></tr>`).join('')}</table></div>`;
}

/**
 * @param {object} template
 * @param {object} data      filled field values
 * @param {object} company   { name, address, phone, email, logoUrl, currency }
 * @param {object} branding  { gstin, pan, stateName, bankName, accountHolder, accountNumber, ifsc, branch, upiId, signatureUrl, footer }
 */
function renderDocument(template, data = {}, company = {}, branding = {}) {
  const currency = company.currency || 'INR';
  const map = {};
  const itemFields = template.fields.filter((f) => f.type === 'items');
  for (const f of template.fields) {
    const v = data[f.key];
    if (f.type === 'items') { map[f.key] = Array.isArray(v) && v.length ? '1' : ''; continue; }
    if (f.type === 'money') map[f.key] = v != null && v !== '' ? esc(formatMoney(v, currency)) : '';
    else if (f.type === 'date') map[f.key] = fmtDate(v);
    else if (f.type === 'textarea') map[f.key] = escMultiline(v);
    else map[f.key] = esc(v);
  }
  // Legacy / free values stored on older documents (fields since removed).
  for (const [k, v] of Object.entries(data)) if (map[k] === undefined && typeof v !== 'object') map[k] = escMultiline(v);

  map['company.name'] = esc(company.name || 'Company');
  map['company.address'] = escMultiline(company.address || '');
  map['company.phone'] = esc(company.phone || '');
  map['company.email'] = esc(company.email || '');
  map['company.gstin'] = esc(branding.gstin || '');
  map['company.pan'] = esc(branding.pan || '');
  map['company.state'] = esc(branding.stateName || '');
  map.today = todayStr();
  map.date = map.date || todayStr();
  map.reference = esc(data.reference || '');
  map.title = esc(template.name);
  map.bankBlock = bankBlock(branding);

  // Tables. The first table marked `totals` (or the first table) drives {{itemsTable}}.
  const sums = {};
  const mainField = itemFields.find((f) => f.totals) || (template.hideTotals ? null : itemFields[0]);
  for (const f of itemFields) {
    const rows = Array.isArray(data[f.key]) ? data[f.key] : [];
    const t = tableHtml(f, rows, currency);
    sums[f.key] = t.sums;
    for (const [col, val] of Object.entries(t.sums)) {
      const c = columnsOf(f).find((x) => x.key === col);
      map[`sum.${f.key}.${col}`] = c?.type === 'money' ? formatMoney(val, currency) : fmtNum(val);
    }
    let html = t.html;
    if (f === mainField) {
      const subtotal = t.sums.amount || 0;
      const tot = totalsHtml(template, data, subtotal, currency);
      html += tot.html;
      map.amountWords = amountInWords(tot.grand, currency);
      map.grandTotal = formatMoney(tot.grand, currency);
    }
    map[`table:${f.key}`] = html;
  }
  const primary = mainField || itemFields[0];
  map.itemsTable = primary ? map[`table:${primary.key}`] : '';
  if (template.compute) {
    const out = template.compute(sums, data) || {};
    for (const [k, v] of Object.entries(out)) {
      map[`calc.${k}`] = formatMoney(v, currency);
      map[`calc.${k}Words`] = amountInWords(v, currency);
    }
  }
  if (!map.amountWords) {
    const main = template.fields.find((f) => f.key === template.wordsFrom);
    if (main && num(data[main.key]) != null) map.amountWords = amountInWords(data[main.key], currency);
  }

  const body = interpolate(template.body, map);
  const sigLabels = (template.signatures || ['For {{company.name}}<br>Authorised Signatory']).map((l) => interpolate(l, map));
  const lastIdx = sigLabels.length - 1;
  const sigs = sigLabels
    .map((label, i) => `<div class="sig">${branding.signatureUrl && i === lastIdx && /company|authori[sz]ed/i.test(label) ? `<img src="${esc(branding.signatureUrl)}" alt=""/>` : ''}<div class="sigline">${label}</div></div>`)
    .join('');

  const metaBits = [
    data.reference ? `<div><b>${esc(template.refLabel || 'No.')}</b> ${esc(data.reference)}</div>` : '',
    `<div><b>Date</b> ${map.date}</div>`,
  ].join('');
  const contact = [company.phone, company.email].filter(Boolean).map(esc).join(' &nbsp;|&nbsp; ');
  const tax = [branding.gstin && `GSTIN: ${esc(branding.gstin)}`, branding.pan && `PAN: ${esc(branding.pan)}`, branding.stateName && `State: ${esc(branding.stateName)}`].filter(Boolean).join(' &nbsp;|&nbsp; ');
  const docTitle = template.printTitle || template.name;

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(docTitle)}${data.reference ? ` · ${esc(data.reference)}` : ''}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1f2937;margin:0;padding:32px;font-size:12.5px;line-height:1.55}
  .doc{max-width:820px;margin:0 auto}
  .top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px solid #CC6E02;padding-bottom:14px}
  .brand{display:flex;gap:14px;align-items:center}
  .brand img{max-height:64px;max-width:170px;object-fit:contain}
  .cname{font-size:19px;font-weight:700;color:#4A2700}
  .muted{color:#6b7280;font-size:11.5px;line-height:1.5}
  .title-wrap{text-align:right;min-width:200px}
  .title-wrap h1{margin:0;font-size:20px;letter-spacing:.8px;color:#CC6E02;text-transform:uppercase}
  .title-wrap .copy{font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.6px}
  .title-wrap .meta{margin-top:6px;font-size:12px;color:#374151}
  h3{margin:16px 0 4px;color:#4A2700}
  h4{margin:14px 0 4px;font-size:11.5px;text-transform:uppercase;letter-spacing:.5px;color:#9a4a00}
  p{margin:5px 0}
  ol.clauses{padding-left:18px;margin:6px 0}ol.clauses li{margin:6px 0}ol.clauses li b{color:#4A2700}
  .parties{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:16px 0}
  .box{border:1px solid #eadfc8;border-radius:6px;padding:9px 11px}
  .box h4{margin-top:0}
  table.items{width:100%;border-collapse:collapse;margin:12px 0;font-size:12px}
  table.items th{background:#FBF1DA;color:#4A2700;text-align:left;padding:6px 8px;font-size:10.5px;text-transform:uppercase;letter-spacing:.3px;border:1px solid #eadfc8}
  table.items td{padding:6px 8px;border:1px solid #eee5d3;vertical-align:top}
  table.items tfoot td{font-weight:700;background:#fdf8ee}
  .r{text-align:right;white-space:nowrap}.c{text-align:center}
  .totals{margin-left:auto;width:330px;margin-top:8px}
  .totals div{display:flex;justify-content:space-between;padding:3px 0}
  .totals .sub{border-top:1px dashed #d6c7a8;margin-top:3px;padding-top:5px;font-weight:600}
  .totals .grand{border-top:2px solid #CC6E02;margin-top:6px;padding-top:7px;font-size:15px;font-weight:700;color:#4A2700}
  .words{margin:8px 0 0;font-size:12px}
  table.kv{border-collapse:collapse;margin:8px 0;width:100%}
  table.kv td{padding:4px 6px;border-bottom:1px solid #f3ede0;vertical-align:top}
  table.kv td:first-child{color:#6b7280;width:42%}
  .note,.terms{margin-top:14px;font-size:11.5px;color:#374151}
  .terms{border-top:1px solid #eee5d3;padding-top:8px}
  .bank{margin-top:14px;max-width:420px}
  .freeform{white-space:pre-wrap;margin-top:12px}
  .declare{margin-top:12px;font-size:11px;color:#4b5563;border:1px dashed #d6c7a8;padding:6px 9px;border-radius:5px}
  .sigs{display:flex;justify-content:space-between;gap:28px;margin-top:52px}
  .sig{flex:1;text-align:center}
  .sig img{max-height:56px;margin-bottom:2px}
  .sigline{border-top:1px solid #9ca3af;padding-top:5px;font-size:11.5px;color:#374151;margin-top:34px}
  .foot{margin-top:24px;border-top:1px solid #eee5d3;padding-top:7px;text-align:center;color:#9ca3af;font-size:10.5px}
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
          ${tax ? `<div class="muted">${tax}</div>` : ''}
        </div>
      </div>
      <div class="title-wrap">
        <h1>${esc(docTitle)}</h1>
        ${template.copyLabel ? `<div class="copy">${esc(template.copyLabel)}</div>` : ''}
        <div class="meta">${metaBits}</div>
      </div>
    </div>
    ${body}
    <div class="sigs">${sigs}</div>
    ${branding.footer ? `<div class="foot">${esc(branding.footer)}</div>` : ''}
  </div>
</body></html>`;
}

module.exports = { renderDocument, amountInWords, formatMoney };
