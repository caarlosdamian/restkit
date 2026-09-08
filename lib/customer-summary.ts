import { loyaltyConfig, stampState, cashbackRedeemable, maxCashbackFor } from './loyalty';
import type { IBusiness } from '@/models/Business';

/**
 * What a staff member needs to see about a customer, in one shape.
 *
 * The till (phone lookup) and the scanner return the same thing on purpose:
 * they are two ways of identifying the same person, and two summary shapes
 * would drift the first time either grew a field.
 */

export interface CustomerSummary {
  id: string;
  name: string;
  phone?: string;
  mechanic: 'sellos' | 'cashback';
  stamps: number;
  required: number;
  rewardsPending: number;
  rewardDescription: string;
  unitPlural: string;
  cashbackBalance: number;
  cashbackRedeemable: boolean;
  cashbackThreshold: number;
  maxCashback: number;
}

interface CustomerLike {
  _id: unknown;
  name: string;
  phone?: string;
  stats: { currentVisits: number; cashbackBalance?: number };
}

export function summariseCustomer(
  customer: CustomerLike,
  business: Partial<IBusiness> | null,
  orderTotal = 0
): CustomerSummary {
  const config = loyaltyConfig(business);
  const state = stampState(customer.stats.currentVisits, config.sellos.required);
  const balance = customer.stats.cashbackBalance ?? 0;

  return {
    id: String(customer._id),
    name: customer.name,
    phone: customer.phone,
    mechanic: config.mechanic,
    // Staff see progress, not just a name: "le falta 1 sello" is what turns a
    // lookup into a reason to mention it at the counter.
    stamps: state.stamps,
    required: config.sellos.required,
    rewardsPending: state.rewardsPending,
    rewardDescription: config.sellos.rewardDescription,
    unitPlural: config.sellos.unitPlural,
    cashbackBalance: balance,
    cashbackRedeemable: cashbackRedeemable(balance, config),
    cashbackThreshold: config.cashback.threshold,
    maxCashback: maxCashbackFor(balance, orderTotal, config),
  };
}
