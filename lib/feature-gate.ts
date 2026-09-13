import type mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import Business from '@/models/Business';
import dbConnect from '@/lib/db';
import { featureAllowed } from '@/lib/subscription';
import { evaluateSubscription } from '@/lib/subscription';
import { limitFor, wouldExceed, TOP_PLAN, type FeatureId, type LimitId, type PlanId } from '@/lib/plans';

/**
 * Server-side tier gate for API routes: loads the business's subscription and
 * answers whether its plan includes a feature. A missing business (tests, edge
 * races) is treated as allowed — same grandfathering philosophy as
 * lib/subscription. Call AFTER the auth check; this is authorization of a
 * capability, not authentication.
 */
export async function businessAllows(
  businessId: string | mongoose.Types.ObjectId,
  feature: FeatureId
): Promise<boolean> {
  await dbConnect();
  const business = await Business.findById(businessId).select('subscription');
  return featureAllowed(business?.subscription, feature);
}

const FEATURE_MESSAGES: Record<FeatureId, string> = {
  inventory: 'Tu plan no incluye inventario. Mejora al plan Profesional para usarlo.',
  kds: 'Tu plan no incluye la pantalla de cocina (KDS). Mejora al plan Profesional para usarla.',
  reports: 'Tu plan no incluye reportes avanzados. Mejora al plan Profesional para verlos.',
};

/**
 * Convenience for route handlers: 403 JSON response when the plan doesn't
 * include the feature, or null when it does (continue normally).
 *
 *   const denied = await requireFeature(session.user.businessId, 'inventory');
 *   if (denied) return denied;
 */
export async function requireFeature(
  businessId: string | mongoose.Types.ObjectId,
  feature: FeatureId
): Promise<NextResponse | null> {
  if (await businessAllows(businessId, feature)) return null;
  return NextResponse.json(
    { error: FEATURE_MESSAGES[feature], code: 'PLAN_UPGRADE_REQUIRED', feature },
    { status: 403 }
  );
}


/* ------------------------------------------------------------- capacity */

const LIMIT_NOUN: Record<LimitId, { one: string; many: string }> = {
  tables: { one: 'mesa', many: 'mesas' },
  staff: { one: 'usuario', many: 'usuarios' },
};

/**
 * Capacity ceiling for the business's plan.
 *
 * Tiers differ by how much they hold rather than by which features they
 * unlock, so hitting a ceiling should read as outgrowing the plan, not as
 * being locked out of the product. The message names the number and the next
 * step instead of just refusing.
 *
 * A business with no subscription is grandfathered, exactly as lib/subscription
 * treats a missing record — legacy and seeded businesses are never capped.
 */
export async function requireCapacity(
  businessId: string | mongoose.Types.ObjectId,
  limit: LimitId,
  currentCount: number
): Promise<NextResponse | null> {
  await dbConnect();
  const business = await Business.findById(businessId).select('subscription');
  const sub = business?.subscription;

  const plan = sub?.plan as PlanId | undefined;
  if (!plan) return null;

  // Only a PURCHASED plan is capped — same rule the feature gate follows. A
  // business on the free trial has merely picked a plan at signup, and capping
  // them would cripple the trial they haven't paid for yet.
  const view = evaluateSubscription(sub);
  if (!view.subscribed) return null;

  if (!wouldExceed(plan, limit, currentCount)) return null;

  const max = limitFor(plan, limit);
  const noun = max === 1 ? LIMIT_NOUN[limit].one : LIMIT_NOUN[limit].many;
  // The top plan has a ceiling too (see PLAN_LIMITS), and telling the customer
  // who already bought the most expensive tier to "upgrade" is a dead end — the
  // only honest next step there is talking to us.
  const nextStep =
    plan === TOP_PLAN
      ? 'Escríbenos para ampliar tu cuenta.'
      : 'Mejora de plan para agregar más.';
  return NextResponse.json(
    {
      error: `Tu plan incluye ${max} ${noun}. ${nextStep}`,
      code: 'PLAN_LIMIT_REACHED',
      limit,
      max,
    },
    { status: 403 }
  );
}


/* --------------------------------------------------- access (money gate) */

/**
 * The money gate: an expired business may not sell.
 *
 * Distinct from the two gates above, which differentiate WHAT an in-good-
 * standing business can do. This one answers whether they're in good standing
 * at all, and mirrors the 402 that `POST /api/pos-session/start` already
 * returns — same shape and code, so the POS can handle one response everywhere.
 *
 * Grandfathering is inherited from `evaluateSubscription`: a business with no
 * subscription record is never blocked.
 */
export async function requireSubscription(
  businessId: string | mongoose.Types.ObjectId,
  message = 'Tu suscripción expiró. Reactívala para seguir vendiendo.'
): Promise<NextResponse | null> {
  await dbConnect();
  const business = await Business.findById(businessId).select('subscription');
  if (!evaluateSubscription(business?.subscription).needsUpgrade) return null;
  return NextResponse.json(
    { error: message, code: 'SUBSCRIPTION_REQUIRED' },
    { status: 402 }
  );
}
