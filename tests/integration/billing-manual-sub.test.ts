import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { oid } from '../helpers/fixtures';
import Business from '@/models/Business';
import { DEFAULT_LOYALTY } from '@/lib/loyalty';
import { billingService } from '@/services/billing.service';
import { subscriptionMetadata } from '@/lib/billing-metadata';

/**
 * A subscription sold outside Checkout — by transfer, or agreed on the phone —
 * and created either by `scripts/grant-subscription.mts` or by hand in the
 * Stripe dashboard.
 *
 * ⚠️ The tier has TWO sources, and the order matters. Metadata wins when it is
 * there, because it is explicit and survives a price being swapped for a
 * grandfathered one. When it is absent — which is what the Stripe dashboard
 * produces — the plan is derived from the PRICE, so a subscription created by
 * hand still lands on the right tier with nothing to remember and nothing to
 * repair afterwards.
 *
 * Before that fallback existed, such a subscription granted access but left
 * `Business.subscription.plan` at whatever signup defaulted to (`pro`): sell
 * someone Lite and they ran as Profesional while paying $249, silently.
 */

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearTestDb);

async function trialingBusiness(extra: Record<string, unknown> = {}) {
  const businessId = oid();
  await Business.create({
    _id: businessId,
    name: 'Café Luna',
    slug: `luna-${businessId}`,
    settings: { loyalty: DEFAULT_LOYALTY },
    // Signup defaults to `pro` when no plan was picked on the pricing page.
    subscription: { plan: 'pro', status: 'trialing', trialEndsAt: new Date(), ...extra },
  });
  return businessId;
}

/** The shape `customer.subscription.created` delivers. A real subscription
 *  always carries its price, which is what makes the fallback possible. */
function event(sub: Record<string, unknown>, priceId = 'price_basic_monthly') {
  return {
    type: 'customer.subscription.created',
    data: {
      object: {
        items: { data: [{ current_period_end: 1893456000, price: { id: priceId } }] },
        ...sub,
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('a subscription created outside Checkout', () => {
  it('lands on the right plan when it carries the metadata', async () => {
    const businessId = await trialingBusiness({ stripeCustomerId: 'cus_manual' });

    await billingService.applyStripeEvent(
      event({
        id: 'sub_manual',
        status: 'active',
        customer: 'cus_manual',
        metadata: subscriptionMetadata(businessId.toString(), 'basic', 'annual'),
      })
    );

    const business = await Business.findById(businessId);
    expect(business!.subscription!.status).toBe('active');
    expect(business!.subscription!.stripeSubscriptionId).toBe('sub_manual');
    // The tier actually followed — this is what the metadata buys.
    expect(business!.subscription!.plan).toBe('basic');
    expect(business!.subscription!.billingPeriod).toBe('annual');
  });

  it('binds by businessId even when the customer was never stored', async () => {
    // Lets a subscription be created for a business that never opened the
    // billing page, which is the whole reason the script sets businessId.
    const businessId = await trialingBusiness();

    await billingService.applyStripeEvent(
      event({
        id: 'sub_meta_only',
        status: 'active',
        customer: 'cus_never_seen',
        metadata: subscriptionMetadata(businessId.toString(), 'lite', 'monthly'),
      })
    );

    const business = await Business.findById(businessId);
    expect(business!.subscription!.plan).toBe('lite');
    expect(business!.subscription!.stripeCustomerId).toBe('cus_never_seen');
  });

  it('⚠️ derives the tier from the PRICE when there is no metadata', async () => {
    // Exactly what the Stripe dashboard produces on its own. This used to leave
    // the business on `pro` while being billed for `lite`.
    process.env.STRIPE_PRICE_LITE_MONTHLY = 'price_lite_monthly';
    const businessId = await trialingBusiness({ stripeCustomerId: 'cus_manual' });

    await billingService.applyStripeEvent(
      event(
        { id: 'sub_bare', status: 'active', customer: 'cus_manual', metadata: {} },
        'price_lite_monthly'
      )
    );

    const business = await Business.findById(businessId);
    expect(business!.subscription!.stripeSubscriptionId).toBe('sub_bare');
    expect(business!.subscription!.status).toBe('active');
    // Self-healed: no metadata, no script, no manual step.
    expect(business!.subscription!.plan).toBe('lite');
    expect(business!.subscription!.billingPeriod).toBe('monthly');
  });

  it('leaves the plan alone for a price it does not recognise', async () => {
    // A one-off or grandfathered price. Guessing would be worse than keeping
    // what is there, so the plan is untouched and only access changes.
    const businessId = await trialingBusiness({ stripeCustomerId: 'cus_manual' });

    await billingService.applyStripeEvent(
      event(
        { id: 'sub_custom', status: 'active', customer: 'cus_manual', metadata: {} },
        'price_negotiated_one_off'
      )
    );

    const business = await Business.findById(businessId);
    expect(business!.subscription!.status).toBe('active');
    expect(business!.subscription!.plan).toBe('pro');
  });

  it('lets metadata win over the price when both are present', async () => {
    // A price swapped for a grandfathered one should not silently re-tier a
    // business whose plan was set deliberately.
    process.env.STRIPE_PRICE_LITE_MONTHLY = 'price_lite_monthly';
    const businessId = await trialingBusiness({ stripeCustomerId: 'cus_manual' });

    await billingService.applyStripeEvent(
      event(
        {
          id: 'sub_both',
          status: 'active',
          customer: 'cus_manual',
          metadata: subscriptionMetadata(businessId.toString(), 'basic', 'monthly'),
        },
        'price_lite_monthly'
      )
    );

    expect((await Business.findById(businessId))!.subscription!.plan).toBe('basic');
  });

  it('drops an event it cannot tie to a business, rather than guessing', async () => {
    const businessId = await trialingBusiness();

    await billingService.applyStripeEvent(
      event({ id: 'sub_orphan', status: 'active', customer: 'cus_unknown', metadata: {} })
    );

    const business = await Business.findById(businessId);
    expect(business!.subscription!.stripeSubscriptionId ?? null).toBeNull();
    expect(business!.subscription!.status).toBe('trialing');
  });

  it('maps an unpaid invoice to past_due, so access stops', async () => {
    const businessId = await trialingBusiness({ stripeCustomerId: 'cus_manual' });

    await billingService.applyStripeEvent(
      event({
        id: 'sub_unpaid',
        status: 'unpaid',
        customer: 'cus_manual',
        metadata: subscriptionMetadata(businessId.toString(), 'basic', 'monthly'),
      })
    );

    expect((await Business.findById(businessId))!.subscription!.status).toBe('past_due');
  });
});
