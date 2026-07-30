import type mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import Business from '@/models/Business';
import dbConnect from '@/lib/db';
import { featureAllowed } from '@/lib/subscription';
import type { FeatureId } from '@/lib/plans';

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
