import { describe, it, expect } from 'vitest';
import { generateReceiptHtml, ReceiptData } from '@/lib/receipt-html';

// The receipt encodes spaces as &nbsp; for the fixed-width layout; normalize
// back so assertions can use plain strings.
function renderText(data: ReceiptData): string {
  return generateReceiptHtml(data).replace(/&nbsp;/g, ' ');
}

function baseReceipt(overrides: Partial<ReceiptData> = {}): ReceiptData {
  return {
    ticketNumber: 'ABC123',
    businessName: 'Taquería Test',
    tableName: 'Mesa 5',
    staffName: 'Ana García',
    items: [{ name: 'Tacos al pastor', quantity: 1, price: 116 }],
    total: 116,
    paymentMethod: 'CASH',
    amountReceived: 200,
    change: 84,
    closedAt: new Date('2026-07-12T14:30:00'),
    ...overrides,
  };
}

describe('generateReceiptHtml', () => {
  it('breaks out IVA at the default 16% (prices IVA-inclusive)', () => {
    const text = renderText(baseReceipt({ total: 116 }));
    // 116 / 1.16 = 100.00 subtotal, 16.00 IVA
    expect(text).toContain('Subtotal:');
    expect(text).toContain('$100.00');
    expect(text).toContain('IVA 16%:');
    expect(text).toContain('$16.00');
    expect(text).toContain('IVA incluido en el precio');
  });

  it('uses a custom IVA rate when provided', () => {
    const text = renderText(baseReceipt({ iva: 8, total: 108 }));
    expect(text).toContain('IVA 8%:');
    expect(text).toContain('$100.00'); // 108 / 1.08
  });

  it('hides the IVA block entirely when iva is 0', () => {
    const text = renderText(baseReceipt({ iva: 0 }));
    expect(text).not.toContain('Subtotal:');
    expect(text).not.toContain('IVA');
  });

  it('shows amount received and change for CASH payments', () => {
    const text = renderText(baseReceipt());
    expect(text).toContain('Forma de pago:');
    expect(text).toContain('Efectivo');
    expect(text).toContain('Recibido:');
    expect(text).toContain('$200.00');
    expect(text).toContain('Cambio:');
    expect(text).toContain('$84.00');
  });

  it('omits received/change for CARD payments', () => {
    const text = renderText(
      baseReceipt({ paymentMethod: 'CARD', amountReceived: undefined, change: undefined })
    );
    expect(text).toContain('Tarjeta');
    expect(text).not.toContain('Recibido:');
    expect(text).not.toContain('Cambio:');
  });

  it('renders a pre-bill (cuenta): no ticket number, no payment, marked as not a receipt', () => {
    const text = renderText(baseReceipt({ preliminary: true }));
    expect(text).toContain('CUENTA');
    expect(text).toContain('no es comprobante de pago');
    expect(text).not.toContain('Ticket: #');
    expect(text).not.toContain('Forma de pago:');
    expect(text).not.toContain('Comprobante no fiscal');
  });

  it('shows unit price only when quantity > 1', () => {
    const multi = renderText(
      baseReceipt({ items: [{ name: 'Café', quantity: 3, price: 30 }], total: 90 })
    );
    expect(multi).toContain('3x Café');
    expect(multi).toContain('@$30.00 c/u');
    expect(multi).toContain('$90.00');

    const single = renderText(
      baseReceipt({ items: [{ name: 'Café', quantity: 1, price: 30 }], total: 30 })
    );
    expect(single).not.toContain('c/u');
  });

  it('includes item notes (allergies etc.)', () => {
    const text = renderText(
      baseReceipt({ items: [{ name: 'Torta', quantity: 1, price: 50, notes: 'sin cebolla' }] })
    );
    expect(text).toContain('* sin cebolla');
  });

  it('prints fiscal header fields when configured', () => {
    const text = renderText(
      baseReceipt({
        fiscalName: 'Taquería Test S.A. de C.V.',
        rfc: 'TTE200101ABC',
        phone: '55 1234 5678',
        website: 'taqueria.mx',
      })
    );
    expect(text).toContain('Taquería Test S.A. de C.V.');
    expect(text).toContain('RFC: TTE200101ABC');
    expect(text).toContain('Tel: 55 1234 5678');
    expect(text).toContain('taqueria.mx');
  });

  it('uses the custom footer message, defaulting to gracias', () => {
    expect(renderText(baseReceipt({ footerMessage: 'Síguenos @test' }))).toContain(
      'Síguenos @test'
    );
    expect(renderText(baseReceipt())).toContain('¡Gracias por su visita!');
  });

  it('targets 80mm thermal paper', () => {
    const html = generateReceiptHtml(baseReceipt());
    expect(html).toContain('size: 80mm auto');
  });
});
