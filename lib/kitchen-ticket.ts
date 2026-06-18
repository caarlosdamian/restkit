import { printHtml } from './print';

export interface KitchenTicketData {
  tableName: string;
  staffName?: string;
  /** When the comanda was sent. */
  sentAt: Date;
  /** Items being sent to the kitchen in this round (no prices). */
  items: Array<{ name: string; quantity: number; notes?: string }>;
  /** Round number — 1 on the first send, increments on each "enviar N más". */
  round?: number;
  /** Order-level note (allergies, "para llevar", etc.). */
  orderNotes?: string;
}

// Word-wrap a string to a max char width (for long item names / notes).
function wrap(text: string, width: number): string[] {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let line = '';
  for (const w of words) {
    if (line && (line + ' ' + w).length > width) {
      out.push(line);
      line = w;
    } else {
      line = line ? `${line} ${w}` : w;
    }
  }
  if (line) out.push(line);
  return out.length ? out : [''];
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function generateKitchenTicketHtml(data: KitchenTicketData): string {
  const date = new Date(data.sentAt);
  const dateStr = date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const timeStr = date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
  const firstName = data.staffName ? data.staffName.split(' ')[0] : '';
  const totalUnits = data.items.reduce((s, i) => s + i.quantity, 0);

  const itemRows = data.items
    .map((item) => {
      const nameLines = wrap(esc(item.name), 22)
        .map((ln, idx) =>
          idx === 0
            ? `<div class="item"><span class="qty">${item.quantity}×</span> ${ln}</div>`
            : `<div class="item-cont">${ln}</div>`
        )
        .join('');
      const noteLines = item.notes
        ? wrap(esc(item.notes), 26)
            .map((ln) => `<div class="note">↳ ${ln}</div>`)
            .join('')
        : '';
      return nameLines + noteLines;
    })
    .join('');

  const orderNote = data.orderNotes
    ? `<div class="ordernote">${wrap(esc(data.orderNotes), 28).join('<br/>')}</div>`
    : '';

  const roundBadge = data.round && data.round > 1 ? ` · RONDA ${data.round}` : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Comanda — ${esc(data.tableName)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      width: 80mm;
      padding: 6mm 3mm;
      background: #fff;
      color: #000;
    }
    .head { text-align: center; font-size: 16px; font-weight: 700; letter-spacing: 1px; }
    .table { text-align: center; font-size: 30px; font-weight: 700; margin: 4px 0; }
    .meta { text-align: center; font-size: 13px; margin-bottom: 6px; }
    .div { border-top: 2px dashed #000; margin: 6px 0; }
    .item { font-size: 19px; font-weight: 700; line-height: 1.35; margin-top: 4px; }
    .item-cont { font-size: 19px; font-weight: 700; line-height: 1.35; padding-left: 28px; }
    .qty { display: inline-block; min-width: 28px; }
    .note { font-size: 15px; font-weight: 700; padding-left: 28px; line-height: 1.3; }
    .ordernote { font-size: 15px; font-weight: 700; text-align: center; margin: 4px 0; }
    .foot { text-align: center; font-size: 13px; margin-top: 6px; }
    @media print {
      @page { margin: 0; size: 80mm auto; }
      html, body { width: 80mm; }
    }
  </style>
</head>
<body>
  <div class="head">*** COCINA${roundBadge} ***</div>
  <div class="table">${esc(data.tableName)}</div>
  <div class="meta">${dateStr} ${timeStr}${firstName ? ` · ${esc(firstName)}` : ''}</div>
  ${orderNote ? `<div class="div"></div>${orderNote}` : ''}
  <div class="div"></div>
  ${itemRows}
  <div class="div"></div>
  <div class="foot">${totalUnits} producto${totalUnits !== 1 ? 's' : ''}</div>
</body>
</html>`;
}

export function printKitchenTicket(data: KitchenTicketData): void {
  printHtml(generateKitchenTicketHtml(data));
}
