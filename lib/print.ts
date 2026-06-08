/**
 * Print an HTML document without opening a visible window.
 *
 * Uses a hidden, off-screen <iframe> in the current page: we set its `srcdoc`,
 * wait for it to load, then call print() on its content window. This avoids the
 * popup window (and popup blockers) that `window.open` triggers. The iframe is
 * removed shortly after the print dialog is dismissed.
 */
export function printHtml(html: string): void {
  if (typeof document === 'undefined') return;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';

  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) {
      iframe.remove();
      return;
    }
    win.focus();
    win.print();
    // Give the print dialog time to open before removing the iframe.
    setTimeout(() => iframe.remove(), 1000);
  };

  // `srcdoc` makes the load event fire reliably once the content is parsed.
  iframe.srcdoc = html;
  document.body.appendChild(iframe);
}
