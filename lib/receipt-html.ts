import { printHtml } from './print';

export interface ReceiptData {
  ticketNumber?: string;
  businessName: string;
  fiscalName?: string;
  rfc?: string;
  phone?: string;
  address?: string;
  fiscalAddress?: string;
  website?: string;
  footerMessage?: string;
  tableName: string;
  staffName: string;
  items: Array<{ name: string; quantity: number; price: number; notes?: string }>;
  total: number;
  paymentMethod?: string;
  amountReceived?: number;
  change?: number;
  closedAt: Date;
  /** Pre-bill ("cuenta") to hand to the customer before paying — no ticket
   *  number, no payment section, and marked as not a proof of payment. */
  preliminary?: boolean;
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  OTHER: 'Otro',
};

const W = 42; // receipt width in chars

function center(text: string): string {
  const t = text.slice(0, W);
  const pad = Math.max(0, Math.floor((W - t.length) / 2));
  return ' '.repeat(pad) + t;
}

function row(left: string, right: string): string {
  const r = right.slice(0, W - 1);
  const l = left.slice(0, W - r.length - 1);
  const spaces = W - l.length - r.length;
  return l + ' '.repeat(Math.max(1, spaces)) + r;
}

const DIV = '─'.repeat(W);
const DASH = '- '.repeat(W / 2);

// Word-wrap a string to a max width (for multi-line item notes).
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

export function generateReceiptHtml(data: ReceiptData): string {
  const date = new Date(data.closedAt);
  const dateStr = date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const timeStr = date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
  const payLabel = data.paymentMethod ? (PAYMENT_LABELS[data.paymentMethod] ?? data.paymentMethod) : '';
  const footer = data.preliminary
    ? 'CUENTA — no es comprobante de pago'
    : data.footerMessage || '¡Gracias por su visita!';

  const lines: string[] = [''];

  // ── Business header ──
  lines.push(center(data.businessName));
  if (data.fiscalName && data.fiscalName !== data.businessName) {
    lines.push(center(data.fiscalName));
  }
  if (data.rfc)           lines.push(center(`RFC: ${data.rfc}`));
  if (data.address)       lines.push(center(data.address));
  if (data.fiscalAddress && data.fiscalAddress !== data.address) {
    lines.push(center(`Dom. Fiscal: ${data.fiscalAddress}`));
  }
  if (data.phone)         lines.push(center(`Tel: ${data.phone}`));
  if (data.website)       lines.push(center(data.website));
  lines.push(DIV);

  // ── Order info ──
  lines.push(row(`Mesa: ${data.tableName}`, `${dateStr} ${timeStr}`));
  const leftLabel = data.preliminary ? 'CUENTA' : `Ticket: #${data.ticketNumber}`;
  lines.push(row(leftLabel, data.staffName ? `Atendió: ${data.staffName.split(' ')[0]}` : ''));
  lines.push(DIV);

  // ── Items ──
  lines.push('CONSUMO');
  lines.push(DASH);
  for (const item of data.items) {
    const amount = `$${(item.price * item.quantity).toFixed(2)}`;
    const label = `${item.quantity}x ${item.name}`;
    lines.push(row(label, amount));
    // unit price if qty > 1
    if (item.quantity > 1) {
      lines.push(row(`   @$${item.price.toFixed(2)} c/u`, ''));
    }
    // special note (allergies, "sin leche", etc.)
    if (item.notes) {
      for (const noteLine of wrap(`* ${item.notes}`, W - 3)) {
        lines.push(`   ${noteLine}`);
      }
    }
  }
  lines.push(DASH);
  lines.push(row('TOTAL:', `$${data.total.toFixed(2)}`));
  lines.push(DIV);

  // ── Payment (skipped for a pre-bill) ──
  if (!data.preliminary) {
    lines.push(row('Forma de pago:', payLabel));
    if (data.paymentMethod === 'CASH' && data.amountReceived != null) {
      lines.push(row('Recibido:', `$${data.amountReceived.toFixed(2)}`));
      lines.push(row('Cambio:', `$${(data.change ?? 0).toFixed(2)}`));
    }
    lines.push(DIV);
  }
  lines.push('');
  lines.push(center(footer));
  if (!data.preliminary) lines.push(center('Comprobante no fiscal'));
  lines.push('');

  const body = lines
    .map((l) => `<div>${l.replace(/ /g, '&nbsp;').replace(/─/g, '&#x2500;')}</div>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${data.preliminary ? 'Cuenta' : `Ticket #${data.ticketNumber ?? ''}`}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      line-height: 1.5;
      width: 80mm;
      padding: 6mm 3mm;
      background: #fff;
      color: #000;
    }
    div { white-space: pre; }
    @media print {
      @page { margin: 0; size: 80mm auto; }
      html, body { width: 80mm; }
    }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

export function printReceipt(data: ReceiptData): void {
  printHtml(generateReceiptHtml(data));
}
