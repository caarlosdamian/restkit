/**
 * Single source of truth for subscription plans. Imported by both the
 * marketing pricing UI (client) and the billing/checkout routes (server), so
 * this file stays pure data — no Stripe SDK, no secret env reads. The mapping
 * from (plan, period) → Stripe Price ID lives server-side in the checkout
 * route (it reads STRIPE_PRICE_* env vars).
 */

export type PlanId = 'basic' | 'pro' | 'enterprise';
export type BillingPeriod = 'monthly' | 'annual';

export interface Plan {
  id: PlanId;
  name: string;
  /** MXN per month billed monthly. null = quote-only (enterprise). */
  monthly: number | null;
  /** MXN per month when billed annually (the discounted rate). */
  annual: number | null;
  desc: string;
  features: string[];
  highlight: boolean;
  /** false = "contact sales" instead of self-serve Stripe checkout. */
  selfServe: boolean;
  cta: string;
}

/** Annual billing bills 12 months up front at a 20% discount. */
export const ANNUAL_DISCOUNT = 0.2;

export const TRIAL_DAYS = 14;

export const SALES_EMAIL = 'ventas@restkit.mx';

const annualRate = (monthly: number) => Math.round(monthly * (1 - ANNUAL_DISCOUNT));

export const PLANS: Plan[] = [
  {
    id: 'basic',
    name: 'Básico',
    monthly: 599,
    annual: annualRate(599),
    desc: 'Ideal para cafeterías y negocios pequeños.',
    features: [
      'POS en 1 dispositivo',
      'Menú QR digital',
      'Fidelización (wallet)',
      'Facturación CFDI',
      'Soporte por email',
    ],
    highlight: false,
    selfServe: true,
    cta: 'Comenzar gratis',
  },
  {
    id: 'pro',
    name: 'Profesional',
    monthly: 1299,
    annual: annualRate(1299),
    desc: 'Para restaurantes que necesitan más control.',
    features: [
      'POS ilimitado',
      'KDS cocina + barra',
      'Inventario y recetas',
      '25+ reportes',
      'Soporte prioritario',
      'Delivery integrado',
    ],
    highlight: true,
    selfServe: true,
    cta: 'Comenzar gratis',
  },
  {
    id: 'enterprise',
    name: 'Empresa',
    monthly: null,
    annual: null,
    desc: 'Para cadenas y franquicias con múltiples sucursales.',
    features: [
      'Sucursales ilimitadas',
      'API & webhooks',
      'Manager central',
      'Reportes consolidados',
      'Onboarding dedicado',
      'SLA garantizado',
    ],
    highlight: false,
    selfServe: false,
    cta: 'Hablar con ventas',
  },
];

export function getPlan(id: string | null | undefined): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

/**
 * Gateable features — the tier differentiators that exist in the product
 * today. The marketing `features` strings above are display-only; THIS is
 * what's actually enforced. Add an id here + a `planAllows` rule when a new
 * pro-only capability ships.
 */
export type FeatureId = 'inventory' | 'kds' | 'reports';

/** Features NOT included in the Básico plan (Profesional and up only). */
const PRO_ONLY: ReadonlySet<FeatureId> = new Set(['inventory', 'kds', 'reports']);

/** Whether a given plan tier includes a feature. Pure — no subscription state
 *  here; trial/grandfathering semantics live in lib/subscription.ts. */
export function planAllows(plan: PlanId, feature: FeatureId): boolean {
  if (plan === 'basic') return !PRO_ONLY.has(feature);
  return true; // pro & enterprise include everything gateable today
}

/** Per-month price for a plan+period, or null for quote-only plans. */
export function priceFor(plan: Plan, period: BillingPeriod): number | null {
  return period === 'annual' ? plan.annual : plan.monthly;
}

export function formatMXN(amount: number): string {
  return `$${amount.toLocaleString('es-MX')}`;
}

/** Narrow an arbitrary string to a valid self-serve PlanId, or null. */
export function toSelfServePlanId(value: unknown): PlanId | null {
  const plan = typeof value === 'string' ? getPlan(value) : undefined;
  return plan && plan.selfServe ? plan.id : null;
}

export function toBillingPeriod(value: unknown): BillingPeriod {
  return value === 'annual' ? 'annual' : 'monthly';
}
