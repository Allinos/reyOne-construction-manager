// Open a rendered document's HTML in a new window and trigger the browser's
// print / Save-as-PDF dialog. Mirrors the approach used by the old invoices.
export function printHtml(html) {
  const w = window.open('', '_blank');
  if (!w) {
    alert('Please allow pop-ups to print / download the document.');
    return;
  }
  w.document.write(html);
  w.document.close();
  // Give the browser a tick to lay out (and load the logo) before printing.
  const go = () => {
    try {
      w.focus();
      w.print();
    } catch {
      /* ignore */
    }
  };
  if (w.document.readyState === 'complete') setTimeout(go, 300);
  else w.onload = () => setTimeout(go, 300);
}
