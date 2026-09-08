import { DEFAULT_CARD_FIELDS, defaultCardFields } from './card-fields';
import type { IBusiness, ILoyaltyConfig, LoyaltyMechanic } from '@/models/Business';

/**
 * Every loyalty rule lives here, as pure functions over plain values — no db,
 * no Mongoose documents required. The service layer reads the counters, asks
 * this module what should happen, and writes the result.
 */

export const DEFAULT_LOYALTY: ILoyaltyConfig = {
  mechanic: 'sellos',
  sellos: {
    required: 10,
    rewardDescription: 'Un premio gratis',
    unitSingular: 'visita',
    unitPlural: 'visitas',
  },
  cashback: { rate: 5, threshold: 100 },
  // `filled` by default: the bare stroked icon that came before it was the
  // single biggest reason the card read as thin next to a competitor's.
  card: {
    ground: 'light',
    stampStyle: 'filled',
    stampIcon: 'star',
    photoPlacement: 'background',
    fields: DEFAULT_CARD_FIELDS,
  },
};

/** Tolerates a business document saved before a field existed, and the plain
 *  objects that come back from `.lean()`. */
export function loyaltyConfig(business?: Partial<IBusiness> | null): ILoyaltyConfig {
  const l = business?.settings?.loyalty;
  return {
    mechanic: l?.mechanic ?? DEFAULT_LOYALTY.mechanic,
    sellos: { ...DEFAULT_LOYALTY.sellos, ...(l?.sellos ?? {}) },
    cashback: { ...DEFAULT_LOYALTY.cashback, ...(l?.cashback ?? {}) },
    // Spreading alone is not enough: a stored card object can carry the key
    // with an explicit `undefined`, which overrides the default rather than
    // falling through to it. Every business predates these two fields.
    card: {
      ...DEFAULT_LOYALTY.card,
      ...(l?.card ?? {}),
      ground: l?.card?.ground ?? DEFAULT_LOYALTY.card.ground,
      stampStyle: l?.card?.stampStyle ?? DEFAULT_LOYALTY.card.stampStyle,
      photoPlacement: l?.card?.photoPlacement ?? DEFAULT_LOYALTY.card.photoPlacement,
      // Defaults follow the mechanic: a cashback business that never touched
      // the slot editor should not inherit the sellos card's fields.
      fields: l?.card?.fields ?? defaultCardFields(l?.mechanic ?? DEFAULT_LOYALTY.mechanic),
    },
    location: l?.location,
  };
}

/* ------------------------------------------------------------------ labels */

interface UnitSource {
  settings?: { loyalty?: { sellos?: { unitSingular?: string; unitPlural?: string } } };
}

export function unitSingular(business?: UnitSource | null): string {
  return business?.settings?.loyalty?.sellos?.unitSingular?.trim() || 'visita';
}

export function unitPlural(business?: UnitSource | null): string {
  return business?.settings?.loyalty?.sellos?.unitPlural?.trim() || 'visitas';
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ------------------------------------------------------------- stamp state */

export interface StampState {
  /** Rewards earned and not yet claimed. */
  rewardsPending: number;
  /** Stamps to draw on the card, 0..required. */
  stamps: number;
  /** The row is complete and waiting to be claimed — the loud state. */
  cardFull: boolean;
}

/**
 * `currentVisits` is the only stored number; everything the card shows is
 * derived from it. Letting it run past `required` means a customer who keeps
 * buying before claiming their reward never loses a stamp, and a reversal is
 * always just a subtraction.
 */
export function stampState(currentVisits: number, required: number): StampState {
  const req = Math.max(1, required);
  const total = Math.max(0, currentVisits);
  const rewardsPending = Math.floor(total / req);
  const remainder = total % req;
  // A card sitting exactly on a multiple reads as full, not as freshly empty.
  const cardFull = rewardsPending > 0 && remainder === 0;
  return { rewardsPending, stamps: cardFull ? req : remainder, cardFull };
}

/* ----------------------------------------------------------- earning rules */

export interface AccrualInput {
  total: number;
  /** Accruals this customer already has today, for the daily cap. */
  todayCount?: number;
}

export interface Accrual {
  mechanic: LoyaltyMechanic;
  /** Stamps for 'sellos', MXN for 'cashback'. Always positive. */
  delta: number;
}

/** What a paid order earns, or null when it earns nothing. */
export function accrualFor(order: AccrualInput, config: ILoyaltyConfig): Accrual | null {
  if (order.total <= 0) return null;

  if (config.mechanic === 'cashback') {
    const rate = Math.max(0, config.cashback.rate);
    if (rate === 0) return null;
    return { mechanic: 'cashback', delta: round2((order.total * rate) / 100) };
  }

  // Guards are opt-in: unset means the business doesn't care.
  const { minTicket, maxPerDay } = config.sellos;
  if (minTicket != null && order.total < minTicket) return null;
  if (maxPerDay != null && (order.todayCount ?? 0) >= maxPerDay) return null;

  return { mechanic: 'sellos', delta: 1 };
}

/* -------------------------------------------------------------- redemption */

/** Cashback is invisible until it crosses the threshold — that wait is what
 *  makes the balance feel worth saving instead of pocket change. */
export function cashbackRedeemable(balance: number, config: ILoyaltyConfig): boolean {
  return balance > 0 && balance >= config.cashback.threshold;
}

/** How much of a balance can be put against a bill. Never more than either. */
export function maxCashbackFor(balance: number, orderTotal: number, config: ILoyaltyConfig): number {
  if (!cashbackRedeemable(balance, config)) return 0;
  return round2(Math.min(balance, Math.max(0, orderTotal)));
}

/** Counters floor at zero — a reversal can never push a customer negative. */
export function applyDelta(current: number, delta: number): number {
  return round2(Math.max(0, current + delta));
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatMXN(amount: number): string {
  return `$${amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
