// Frontend-only PDF generation: builds a professional, self-contained HTML
// document and opens the browser print dialog (Save as PDF). No backend call.
import { formatDate } from '../../lib/format';

function money(v, currency = 'INR') {
  const n = Number(v || 0);
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function documentHtml(doc, config = {}, currency = 'INR') {
  const isInvoice = doc.type === 'INVOICE';
  const isGst = doc.template === 'gst';
  const title = isInvoice ? (isGst ? 'TAX INVOICE' : 'INVOICE') : 'QUOTATION';
  const items = doc.items || [];

  const tableHead = isGst
    ? `<tr><th>#</th><th>Item &amp; HSN</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">GST%</th><th class="r">Tax</th><th class="r">Amount</th></tr>`
    : `<tr><th>#</th><th>Description</th><th class="r">Qty</th><th class="r">Unit Price</th><th class="r">Total</th></tr>`;

  const rows = items
    .map((it, i) =>
      isGst
        ? `<tr>
            <td>${i + 1}</td>
            <td>${esc(it.description)}${it.hsnCode ? `<div class="hsn">HSN: ${esc(it.hsnCode)}</div>` : ''}</td>
            <td class="r">${esc(it.quantity)}</td>
            <td class="r">${money(it.unitPrice, currency)}</td>
            <td class="r">${esc(it.gstRate)}%</td>
            <td class="r">${money(it.taxAmount, currency)}</td>
            <td class="r">${money(it.total, currency)}</td>
          </tr>`
        : `<tr>
            <td>${i + 1}</td>
            <td>${esc(it.description)}</td>
            <td class="r">${esc(it.quantity)}</td>
            <td class="r">${money(it.unitPrice, currency)}</td>
            <td class="r">${money(it.total, currency)}</td>
          </tr>`,
    )
    .join('');

  const half = (Number(doc.taxAmount) || 0) / 2;
  const gstTaxRows = doc.gstSplit
    ? `<div><span>CGST</span><span>${money(half, currency)}</span></div>
       <div><span>SGST</span><span>${money(half, currency)}</span></div>`
    : `<div><span>Total GST</span><span>${money(doc.taxAmount, currency)}</span></div>`;

  const totalsRows = isGst
    ? `<div><span>Taxable Value</span><span>${money(doc.subtotal, currency)}</span></div>${gstTaxRows}`
    : `<div><span>Subtotal</span><span>${money(doc.subtotal, currency)}</span></div>
       ${Number(doc.taxRate) > 0 ? `<div><span>Tax (${esc(doc.taxRate)}%)</span><span>${money(doc.taxAmount, currency)}</span></div>` : ''}`;

  const bankRows = [
    ['Bank', config.bankName],
    ['Account Holder', config.accountHolder],
    ['Account No.', config.accountNumber],
    ['IFSC/SWIFT', config.ifsc],
    ['Branch', config.branch],
    ['UPI', config.upiId],
  ]
    .filter(([, v]) => v)
    .map(([k, v]) => `<div><span>${esc(k)}:</span> ${esc(v)}</div>`)
    .join('');

  const companyMeta = [
    config.gstNumber ? `GST/VAT: ${esc(config.gstNumber)}` : '',
    config.registrationNumber ? `Reg No: ${esc(config.registrationNumber)}` : '',
  ]
    .filter(Boolean)
    .join(' &nbsp;|&nbsp; ');

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(doc.number)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; margin: 0; padding: 32px; font-size: 13px; }
  .doc { max-width: 800px; margin: 0 auto; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #F97316; padding-bottom: 16px; }
  .brand { display: flex; gap: 14px; align-items: center; }
  .brand img { max-height: 64px; max-width: 160px; object-fit: contain; }
  .company-name { font-size: 20px; font-weight: 700; color: #0f172a; }
  .muted { color: #6b7280; font-size: 12px; line-height: 1.5; }
  .title { text-align: right; }
  .title h1 { margin: 0; font-size: 28px; letter-spacing: 2px; color: #F97316; }
  .meta { margin-top: 6px; font-size: 12px; color: #374151; }
  .grid2 { display: flex; justify-content: space-between; gap: 24px; margin: 24px 0; }
  .box h3 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  thead th { background: #FFF7ED; color: #9a3412; text-align: left; padding: 9px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  tbody td { padding: 9px 10px; border-bottom: 1px solid #f1f5f9; }
  .r { text-align: right; }
  .hsn { font-size: 10px; color: #9ca3af; }
  .totals { margin-left: auto; width: 280px; margin-top: 12px; }
  .totals div { display: flex; justify-content: space-between; padding: 5px 0; }
  .totals .grand { border-top: 2px solid #F97316; margin-top: 6px; padding-top: 8px; font-size: 16px; font-weight: 700; color: #0f172a; }
  .foot { display: flex; justify-content: space-between; gap: 24px; margin-top: 32px; }
  .foot .box { flex: 1; }
  .bank div { font-size: 12px; padding: 1px 0; }
  .bank span { color: #6b7280; }
  .sign { text-align: center; min-width: 180px; }
  .sign img { max-height: 60px; margin-bottom: 4px; }
  .sign .line { border-top: 1px solid #9ca3af; margin-top: 40px; padding-top: 4px; font-size: 12px; color: #374151; }
  .terms { margin-top: 24px; font-size: 11px; color: #6b7280; border-top: 1px solid #f1f5f9; padding-top: 10px; white-space: pre-wrap; }
  @media print { body { padding: 0; } .doc { max-width: none; } }
</style></head>
<body onload="window.print()">
  <div class="doc">
    <div class="top">
      <div class="brand">
        ${config.logoUrl ? `<img src="${esc(config.logoUrl)}" alt="logo"/>` : ''}
        <div>
          <div class="company-name">${esc(config.companyName || 'Company')}</div>
          <div class="muted">${esc(config.address || '')}</div>
          <div class="muted">${[config.phone, config.email, config.website].filter(Boolean).map(esc).join(' &nbsp;|&nbsp; ')}</div>
          ${companyMeta ? `<div class="muted">${companyMeta}</div>` : ''}
        </div>
      </div>
      <div class="title">
        <h1>${title}</h1>
        <div class="meta"><strong>${esc(doc.number)}</strong></div>
        <div class="meta">Date: ${formatDate(doc.issueDate)}</div>
        ${doc.dueDate ? `<div class="meta">Due: ${formatDate(doc.dueDate)}</div>` : ''}
      </div>
    </div>

    <div class="grid2">
      <div class="box">
        <h3>Bill To</h3>
        <div><strong>${esc(doc.clientName)}</strong></div>
        <div class="muted">${esc(doc.clientAddress || '')}</div>
        <div class="muted">${[doc.clientPhone, doc.clientEmail].filter(Boolean).map(esc).join(' &nbsp;|&nbsp; ')}</div>
      </div>
      <div class="box" style="text-align:right">
        <h3>Status</h3>
        <div style="text-transform:capitalize">${esc(doc.status || '')}</div>
      </div>
    </div>

    <table>
      <thead>${tableHead}</thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="totals">
      ${totalsRows}
      <div class="grand"><span>Grand Total</span><span>${money(doc.total, currency)}</span></div>
    </div>

    <div class="foot">
      <div class="box bank">
        ${bankRows ? `<h3>Bank Details</h3>${bankRows}` : ''}
        ${doc.notes || config.defaultNotes ? `<h3 style="margin-top:12px">Notes</h3><div class="muted">${esc(doc.notes || config.defaultNotes)}</div>` : ''}
      </div>
      <div class="sign">
        ${config.signatureUrl ? `<img src="${esc(config.signatureUrl)}" alt="signature"/>` : ''}
        <div class="line">Authorized Signature</div>
      </div>
    </div>

    ${doc.terms || config.terms ? `<div class="terms"><strong>Terms &amp; Conditions:</strong>\n${esc(doc.terms || config.terms)}</div>` : ''}
  </div>
</body></html>`;
}

export function generateDocumentPdf(doc, config, currency) {
  const w = window.open('', '_blank');
  if (!w) {
    alert('Please allow pop-ups to generate the PDF.');
    return;
  }
  w.document.write(documentHtml(doc, config, currency));
  w.document.close();
}
