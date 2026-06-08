import { printHtml } from './print';

export interface CashCutData {
  businessName?: string;
  sessionId: string;
  staffName: string;
  startTime: string | Date;
  endTime: string | Date;
  openingBalance: number;
  closingBalance: number;
  totalSales: number;
  totalOrders: number;
  cashSales: number;
  cardSales: number;
  transferSales: number;
  expectedCash: number;
  actualCash: number;
  variance: number;
}

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

function fmtDateTime(d: string | Date): string {
  const date = new Date(d);
  const dateStr = date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const timeStr = date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${dateStr} ${timeStr}`;
}

export function generateCashCutHtml(data: CashCutData): string {
  const lines: string[] = [''];

  // ── Header ──
  if (data.businessName) lines.push(center(data.businessName));
  lines.push(center('CORTE DE CAJA'));
  lines.push('');
  lines.push(row('Cajero:', data.staffName || '—'));
  lines.push(row('Apertura:', fmtDateTime(data.startTime)));
  lines.push(row('Cierre:', fmtDateTime(data.endTime)));
  lines.push(DIV);

  // ── Sales breakdown ──
  lines.push('VENTAS DEL TURNO');
  lines.push(DASH);
  lines.push(row('Efectivo:', `$${data.cashSales.toFixed(2)}`));
  lines.push(row('Tarjeta:', `$${data.cardSales.toFixed(2)}`));
  lines.push(row('Transferencia:', `$${data.transferSales.toFixed(2)}`));
  lines.push(DASH);
  lines.push(row('TOTAL VENTAS:', `$${data.totalSales.toFixed(2)}`));
  lines.push(row('Órdenes:', `${data.totalOrders}`));
  lines.push(DIV);

  // ── Cash reconciliation ──
  lines.push('CONCILIACIÓN DE EFECTIVO');
  lines.push(DASH);
  lines.push(row('Saldo inicial:', `$${data.openingBalance.toFixed(2)}`));
  lines.push(row('+ Ventas efectivo:', `$${data.cashSales.toFixed(2)}`));
  lines.push(row('Efectivo esperado:', `$${data.expectedCash.toFixed(2)}`));
  lines.push(row('Efectivo contado:', `$${data.actualCash.toFixed(2)}`));
  lines.push(DASH);
  const vLabel = data.variance > 0 ? 'Sobrante:' : data.variance < 0 ? 'Faltante:' : 'Diferencia:';
  lines.push(row(vLabel, `$${Math.abs(data.variance).toFixed(2)}`));
  lines.push(DIV);
  lines.push('');
  lines.push(center('Documento de control interno'));
  lines.push('');

  const body = lines
    .map((l) => `<div>${l.replace(/ /g, '&nbsp;').replace(/─/g, '&#x2500;')}</div>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Corte de caja</title>
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

export function printCashCut(data: CashCutData): void {
  printHtml(generateCashCutHtml(data));
}
