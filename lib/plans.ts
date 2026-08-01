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
    desc: 'Para negocios que solo quieren fidelizar clientes con tarjeta digital.',
    features: [
      'Clientes ilimitados',
      'Fidelización (wallet)',
      'Menú QR digital',
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
    desc: 'Ideal para cafeterías y negocios pequeños.',
    features: [
      'Todo lo del plan Lite',
      'POS (mesas y cobro)',
      'Facturación CFDI',
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
    desc: 'Para restaurantes que necesitan más control.',
    features: [
      'Todo lo del plan Básico',
      'POS ilimitado',
      'KDS cocina + barra',
      'Inventario y recetas',
      '25+ reportes',
      'Soporte prioritario',
      'Delivery integrado',
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
 * what's actually enforced. Add an id here + a `planAllows` rule when a new
 * pro-only (or basic-and-up) capability ships.
 */
export type FeatureId = 'pos' | 'inventory' | 'kds' | 'reports';

/** Features NOT included in Básico (Profesional only). */
const PRO_ONLY: ReadonlySet<FeatureId> = new Set(['inventory', 'kds', 'reports']);

/** Whether a given plan tier includes a feature. Pure — no subscription state
 *  here; trial/grandfathering semantics live in lib/subscription.ts. */
export function planAllows(plan: PlanId, feature: FeatureId): boolean {
  if (plan === 'lite') return false; // Lite is customers + loyalty only — no gateable feature applies.
  if (plan === 'basic') return !PRO_ONLY.has(feature);
  return true; // pro includes everything gateable today
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
