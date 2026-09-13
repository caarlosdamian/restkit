/**
 * Single source of truth for subscription plans. Imported by both the
 * marketing pricing UI (client) and the billing/checkout routes (server), so
 * this file stays pure data — no Stripe SDK, no secret env reads. The mapping
 * from (plan, period) → Stripe Price ID lives server-side in the checkout
 * route (it reads STRIPE_PRICE_* env vars).
 */

export type PlanId = 'lite' | 'basic' | 'pro';
export type BillingPeriod = 'monthly' | 'annual';

export interface Plan {
  id: PlanId;
  name: string;
  /** MXN per month billed monthly. */
  monthly: number;
  /** MXN per month when billed annually (the discounted rate). */
  annual: number;
  desc: string;
  features: string[];
  highlight: boolean;
  cta: string;
}

/** Annual billing bills 12 months up front at a 20% discount. */
export const ANNUAL_DISCOUNT = 0.2;

export const TRIAL_DAYS = 14;

const annualRate = (monthly: number) => Math.round(monthly * (1 - ANNUAL_DISCOUNT));

export const PLANS: Plan[] = [
  {
    id: 'lite',
    name: 'Lite',
    monthly: 249,
    annual: annualRate(249),
    desc: 'Para cafeterías y negocios pequeños que quieren empezar completo.',
    features: [
      'POS completo — hasta 6 mesas',
      'Fidelización automática al cobrar',
      'Tarjetas en Apple y Google Wallet',
      'Clientes ilimitados',
      '2 usuarios',
      'Soporte por email',
    ],
    highlight: false,
    cta: 'Comenzar gratis',
  },
  {
    id: 'basic',
    name: 'Básico',
    monthly: 599,
    annual: annualRate(599),
    desc: 'Para restaurantes en operación, sin techo de mesas.',
    features: [
      'Todo lo del plan Lite',
      'Mesas ilimitadas, organizadas por secciones',
      '10 usuarios con PIN propio',
      'Soporte por email',
    ],
    highlight: false,
    cta: 'Comenzar gratis',
  },
  {
    id: 'pro',
    name: 'Profesional',
    monthly: 1299,
    annual: annualRate(1299),
    desc: 'Para restaurantes que necesitan control total.',
    features: [
      'Todo lo del plan Básico',
      '50 usuarios',
      'Pantalla de cocina (KDS)',
      'Inventario con recetas y descuento automático',
      'Reporte de ventas por mesero',
      'Soporte prioritario',
    ],
    highlight: true,
    cta: 'Comenzar gratis',
  },
];

export function getPlan(id: string | null | undefined): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

/**
 * Gateable features — the tier differentiators that exist in the product
 * today. The marketing `features` strings above are display-only; THIS is
 * what's actually enforced.
 *
 * POS is deliberately NOT here any more. Loyalty earns automatically at the
 * register, and that's the whole reason to buy RestKit over a standalone
 * loyalty app — locking it out of the cheapest tier removed the differentiator
 * from the exact plan that competes on price. Tiers differ by CAPACITY now
 * (see PLAN_LIMITS): a five-table taquería fits Lite and is happy; a twenty
 * table restaurant meets the ceiling and upgrades without feeling punished.
 */
export type FeatureId = 'inventory' | 'kds' | 'reports';

/** Features NOT included in Básico (Profesional only). */
const PRO_ONLY: ReadonlySet<FeatureId> = new Set(['inventory', 'kds', 'reports']);

/** Whether a given plan tier includes a feature. Pure — no subscription state
 *  here; trial/grandfathering semantics live in lib/subscription.ts. */
export function planAllows(plan: PlanId, feature: FeatureId): boolean {
  if (plan === 'pro') return true;
  // Lite and Básico share the same feature set; they differ by capacity.
  return !PRO_ONLY.has(feature);
}

/* ------------------------------------------------------------- capacity */

/** What a plan can hold. `null` means no ceiling. */
export interface PlanLimits {
  tables: number | null;
  staff: number | null;
}

/**
 * ⚠️ **Profesional has a seat ceiling on purpose — it is NOT "unlimited".**
 *
 * A seat is a user row, a POS PIN and a person who can open the register, so
 * an unbounded count is an unbounded cost with a flat price against it: one
 * account can hand out logins to a whole chain and still pay for a single
 * restaurant. Withdrawing "ilimitado" after somebody has bought it is a repricing
 * conversation with an existing customer; starting with a number is just a number.
 *
 * 50 is chosen to never bite a legitimate single-location restaurant — a large
 * one runs 20–30 staff across all shifts — so in practice it reads as no limit
 * while still being a figure that can be quoted, enforced, and raised later for
 * a multi-sucursal tier that does not exist yet.
 *
 * Tables stay uncapped above Lite: a table costs nothing and the number is a
 * property of the room, not of how much product is being consumed.
 */
export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  lite:  { tables: 6, staff: 2 },
  basic: { tables: null, staff: 10 },
  pro:   { tables: null, staff: 50 },
};

/** The most capacious plan — the one with no plan to upgrade TO. */
export const TOP_PLAN: PlanId = 'pro';

export type LimitId = keyof PlanLimits;

export function limitFor(plan: PlanId, limit: LimitId): number | null {
  return PLAN_LIMITS[plan][limit];
}

/** True when creating one more would cross the plan's ceiling. */
export function wouldExceed(plan: PlanId, limit: LimitId, currentCount: number): boolean {
  const max = limitFor(plan, limit);
  return max !== null && currentCount >= max;
}

/** Per-month price for a plan+period. */
export function priceFor(plan: Plan, period: BillingPeriod): number {
  return period === 'annual' ? plan.annual : plan.monthly;
}

export function formatMXN(amount: number): string {
  return `$${amount.toLocaleString('es-MX')}`;
}

/** Narrow an arbitrary string to a valid PlanId, or null. */
export function toPlanId(value: unknown): PlanId | null {
  const plan = typeof value === 'string' ? getPlan(value) : undefined;
  return plan ? plan.id : null;
}

export function toBillingPeriod(value: unknown): BillingPeriod {
  return value === 'annual' ? 'annual' : 'monthly';
}
