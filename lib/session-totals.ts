import { round2 } from './loyalty';

/**
 * Splits a shift's paid orders into what each payment method actually took.
 *
 * The distinction that matters: `order.total` is the gross bill, but cashback
 * spent against it never reached the drawer. Counting the gross as cash makes
 * every redemption look like a shortfall at cash-up, and a manager who sees a
 * phantom $128 missing stops trusting the register.
 */

export interface PayableOrder {
  paymentMethod?: string | null;
  total: number;
  cashbackApplied?: number | null;
}

export interface SessionTotals {
  /** Gross value of everything sold. */
  totalSales: number;
  /** Money actually collected, by method. */
  cashSales: number;
  cardSales: number;
  transferSales: number;
  /** Balance spent instead of money — the bridge between gross and collected. */
  cashbackRedeemed: number;
  totalOrders: number;
}

export function sessionTotals(orders: PayableOrder[]): SessionTotals {
  const t: SessionTotals = {
    totalSales: 0,
    cashSales: 0,
    cardSales: 0,
    transferSales: 0,
    cashbackRedeemed: 0,
    totalOrders: orders.length,
  };

  for (const order of orders) {
    const redeemed = order.cashbackApplied ?? 0;
    const collected = Math.max(0, order.total - redeemed);

    t.totalSales += order.total;
    t.cashbackRedeemed += redeemed;

    if (order.paymentMethod === 'CASH') t.cashSales += collected;
    else if (order.paymentMethod === 'CARD') t.cardSales += collected;
    else if (order.paymentMethod === 'TRANSFER') t.transferSales += collected;
  }

  t.totalSales = round2(t.totalSales);
  t.cashSales = round2(t.cashSales);
  t.cardSales = round2(t.cardSales);
  t.transferSales = round2(t.transferSales);
  t.cashbackRedeemed = round2(t.cashbackRedeemed);
  return t;
}

/** What should be in the drawer: opening float plus cash actually taken. */
export function expectedCashFor(openingBalance: number, totals: SessionTotals): number {
  return round2(openingBalance + totals.cashSales);
}
