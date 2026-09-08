import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Customer from '@/models/Customer';
import Business from '@/models/Business';
import Visit from '@/models/Visit';
import { getBusinessContext } from '@/lib/pos-auth';
import { summariseCustomer } from '@/lib/customer-summary';
import { loyaltyService } from '@/services/loyalty.service';
import { loyaltyConfig } from '@/lib/loyalty';
import { evaluateSubscription } from '@/lib/subscription';

/**
 * Register loyalty from a scanned card, with no order behind it.
 *
 * This is the path for a business that does NOT run its register on RestKit.
 * Earning at cobro is still the better flow — it needs no scanner and no extra
 * step — but it only exists for businesses that switched their till to us.
 * Making the loyalty programme depend on that made the whole product
 * un-buyable for anyone who wants the cards and not the register.
 *
 * The token identifies the CUSTOMER. The business always comes from the
 * session, and a token belonging to another business 404s rather than 403s —
 * confirming "this code is real but not yours" is a lookup service for anyone
 * holding a stolen ticket.
 */

/**
 * A card can be scanned twice in a row by accident — a slow camera, a second
 * tap, a customer holding the phone up again. `sellos.maxPerDay` is the policy
 * knob for farming and is off by default; this is the narrower guard that
 * always applies, and staff can override it deliberately.
 */
export const SCAN_COOLDOWN_MS = 3 * 60 * 1000;

/**
 * Writing loyalty is selling, so it sits behind the same money gate as opening
 * the register. Reading a card stays open: a cashier mid-transaction should see
 * who they are serving and why it failed, not a blank screen.
 */
async function expired(businessIdStr: string): Promise<boolean> {
  const business = await Business.findById(businessIdStr).select('subscription');
  return evaluateSubscription(business?.subscription).needsUpgrade;
}

async function resolve(token: string, businessIdStr: string) {
  await dbConnect();
  const customer = await Customer.findOne({ publicToken: token });
  if (!customer) return null;
  // Scoped to the scanning business, not just to a valid token.
  if (String(customer.businessId) !== businessIdStr) return null;
  return customer;
}

async function lastAccrualAt(customerId: mongoose.Types.ObjectId): Promise<Date | null> {
  const last = await Visit.findOne({ customerId, type: 'ACCRUAL' })
    .sort({ createdAt: -1 })
    .select('createdAt')
    .lean();
  return (last as { createdAt?: Date } | null)?.createdAt ?? null;
}

/** Who is this, and what do they have? */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const ctx = await getBusinessContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { token } = await params;
  const customer = await resolve(token, ctx.businessIdStr);
  if (!customer) {
    return NextResponse.json({ error: 'Esta tarjeta no es de tu negocio' }, { status: 404 });
  }

  const business = await Business.findById(ctx.businessIdStr);
  const last = await lastAccrualAt(customer._id as mongoose.Types.ObjectId);

  return NextResponse.json({
    ...summariseCustomer(customer, business),
    lastAccrualAt: last,
    recentlyStamped: Boolean(last && Date.now() - last.getTime() < SCAN_COOLDOWN_MS),
  });
}

/** Register a visit, hand over a reward, or spend cashback. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const ctx = await getBusinessContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { token } = await params;
  const customer = await resolve(token, ctx.businessIdStr);
  if (!customer) {
    return NextResponse.json({ error: 'Esta tarjeta no es de tu negocio' }, { status: 404 });
  }

  if (await expired(ctx.businessIdStr)) {
    return NextResponse.json(
      {
        error: 'Tu suscripción expiró. Reactívala para registrar visitas.',
        code: 'SUBSCRIPTION_REQUIRED',
      },
      { status: 402 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action as 'accrue' | 'redeemReward' | 'redeemCashback';
  const amount = Number(body.amount ?? 0);
  const customerId = String(customer._id);

  const business = await Business.findById(ctx.businessIdStr);
  const config = loyaltyConfig(business);

  try {
    if (action === 'accrue') {
      // Cashback is a percentage OF something, so without a till there is no
      // amount to take it from — the cashier has to type the ticket total.
      if (config.mechanic === 'cashback' && !(amount > 0)) {
        return NextResponse.json(
          { error: 'Escribe el total de la compra', code: 'AMOUNT_REQUIRED' },
          { status: 400 }
        );
      }

      if (!body.force) {
        const last = await lastAccrualAt(customer._id as mongoose.Types.ObjectId);
        if (last && Date.now() - last.getTime() < SCAN_COOLDOWN_MS) {
          return NextResponse.json(
            {
              error: 'Ya registraste a este cliente hace un momento',
              code: 'RECENTLY_STAMPED',
              lastAccrualAt: last,
            },
            { status: 409 }
          );
        }
      }

      const result = await loyaltyService.accrueForOrder({
        customerId,
        businessId: ctx.businessIdStr,
        employeeId: ctx.userId,
        orderTotal: amount,
        // No order behind it, so no per-order idempotency — the cooldown above
        // is what stops a double scan becoming a double stamp.
        manual: true,
      });
      if (!result) {
        return NextResponse.json({ error: 'No se pudo registrar' }, { status: 400 });
      }

      const fresh = await Customer.findById(customerId);
      return NextResponse.json({
        ...summariseCustomer(fresh!, business),
        earned: result.delta,
        justEarnedReward: result.justEarnedReward,
      });
    }

    if (action === 'redeemReward') {
      await loyaltyService.redeemReward({
        customerId,
        businessId: ctx.businessIdStr,
        employeeId: ctx.userId,
      });
      const fresh = await Customer.findById(customerId);
      return NextResponse.json(summariseCustomer(fresh!, business));
    }

    if (action === 'redeemCashback') {
      const applied = await loyaltyService.redeemCashback({
        customerId,
        businessId: ctx.businessIdStr,
        employeeId: ctx.userId,
        orderTotal: amount,
        requested: Number(body.requested ?? amount),
      });
      const fresh = await Customer.findById(customerId);
      return NextResponse.json({ ...summariseCustomer(fresh!, business), applied });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (err) {
    // The service throws for the rules it owns — no reward to hand over, not
    // enough balance. Those are answers for the cashier, not 500s.
    const message = err instanceof Error ? err.message : 'No se pudo completar';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
