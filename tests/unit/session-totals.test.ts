import { describe, it, expect } from 'vitest';
import { sessionTotals, expectedCashFor } from '@/lib/session-totals';

describe('sessionTotals', () => {
  it('splits collected money by method', () => {
    const t = sessionTotals([
      { paymentMethod: 'CASH', total: 340 },
      { paymentMethod: 'CARD', total: 120 },
      { paymentMethod: 'TRANSFER', total: 80 },
    ]);
    expect(t).toMatchObject({
      cashSales: 340,
      cardSales: 120,
      transferSales: 80,
      totalSales: 540,
      cashbackRedeemed: 0,
      totalOrders: 3,
    });
  });

  it('counts only what reached the drawer when balance was spent', () => {
    // The bug this exists to prevent: counting the $340 gross as cash when the
    // customer handed over $212 made every redemption look like a shortfall.
    const t = sessionTotals([{ paymentMethod: 'CASH', total: 340, cashbackApplied: 128 }]);

    expect(t.cashSales).toBe(212);
    expect(t.totalSales).toBe(340);
    expect(t.cashbackRedeemed).toBe(128);
  });

  it('leaves the cash-up balanced after a redemption', () => {
    const t = sessionTotals([
      { paymentMethod: 'CASH', total: 340, cashbackApplied: 128 },
      { paymentMethod: 'CASH', total: 100 },
    ]);
    const expected = expectedCashFor(500, t);

    // 500 float + 212 + 100 actually taken.
    expect(expected).toBe(812);
    // The manager counts 812 and the drawer balances — no phantom shortfall.
    expect(expected - (500 + 312)).toBe(0);
  });

  it('never counts a redemption larger than the bill as negative cash', () => {
    const t = sessionTotals([{ paymentMethod: 'CASH', total: 60, cashbackApplied: 128 }]);
    expect(t.cashSales).toBe(0);
  });

  it('keeps centavos exact across many orders', () => {
    const t = sessionTotals(
      Array.from({ length: 3 }, () => ({ paymentMethod: 'CASH', total: 33.33 }))
    );
    expect(t.cashSales).toBe(99.99);
  });

  it('ignores an order with no payment method', () => {
    const t = sessionTotals([{ total: 100 }]);
    expect(t.cashSales).toBe(0);
    expect(t.totalSales).toBe(100);
  });
});
