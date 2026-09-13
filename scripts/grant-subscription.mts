/**
 * Put a business on a paid plan that was sold outside Checkout.
 *
 * For the case where somebody pays by transfer, or agrees a plan over the
 * phone, and never goes through `/dashboard/billing`.
 *
 * Creating it in the Stripe dashboard works just as well — `billingService`
 * derives the tier from the PRICE when no metadata is present, so nothing has
 * to be remembered and nothing needs repairing afterwards. This exists because
 * it is quicker and it checks things the dashboard cannot: that the price
 * matches the plan you meant, that the business is not already paying, that the
 * billing mode will not leave the subscription unpaid, and that the webhook
 * actually arrived.
 *
 * ⚠️ **It never writes to Mongo.** `billingService.applyStripeEvent` stays the
 * only thing that moves a Business onto a plan, exactly as the webhook does for
 * a normal purchase. The script creates the Stripe side and then WATCHES for
 * the webhook to land — so a webhook that is not wired up is reported here,
 * loudly, instead of being masked by a second writer.
 *
 *   MONGODB_URI=... STRIPE_SECRET_KEY=... \
 *     node scripts/grant-subscription.mts --business cafe-luna --plan basic --period monthly
 *
 * Dry run by default. Add --apply to actually create it.
 *
 *   --business   slug, owner email, or exact business name
 *   --plan       lite | basic | pro
 *   --period     monthly | annual        (default monthly)
 *   --trial-days N                       (optional free days before the first invoice)
 *   --auto       charge a saved card instead of emailing an invoice
 */
import { MongoClient, ObjectId } from 'mongodb';
import Stripe from 'stripe';
import { requirePriceId, StripePriceMisconfiguredError } from '../lib/stripe.ts';
import { subscriptionMetadata } from '../lib/billing-metadata.ts';
import { PLANS } from '../lib/plans.ts';

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const AUTO = argv.includes('--auto');
const arg = (flag: string): string | undefined => {
  const i = argv.indexOf(flag);
  return i === -1 ? undefined : argv[i + 1];
};

function die(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

const who = arg('--business');
const plan = (arg('--plan') ?? '') as 'lite' | 'basic' | 'pro';
const period = (arg('--period') ?? 'monthly') as 'monthly' | 'annual';
const trialDays = arg('--trial-days') ? Number(arg('--trial-days')) : undefined;

if (!who) die('--business is required (slug, owner email, or exact name).');
if (!PLANS.some((p) => p.id === plan)) {
  die(`--plan must be one of: ${PLANS.map((p) => p.id).join(', ')}`);
}
if (period !== 'monthly' && period !== 'annual') die('--period must be monthly or annual.');
if (trialDays !== undefined && (!Number.isInteger(trialDays) || trialDays < 1)) {
  die('--trial-days must be a whole number of days.');
}

const uri = process.env.MONGODB_URI;
if (!uri) die('MONGODB_URI is not set. Point it at the database you mean to change.');
const secret = process.env.STRIPE_SECRET_KEY;
if (!secret) die('STRIPE_SECRET_KEY is not set.');

// A price id carries no hint of which mode it belongs to, so this is worth
// saying out loud before anything is created.
const mode = secret.startsWith('sk_live_') ? 'LIVE' : 'test';

let priceId: string;
try {
  priceId = requirePriceId(plan, period);
} catch (err) {
  if (err instanceof StripePriceMisconfiguredError) die(err.message);
  throw err;
}

const stripe = new Stripe(secret);
const client = new MongoClient(uri);
await client.connect();
const db = client.db();

/** slug → owner email → exact name, in that order. */
async function findBusiness() {
  const businesses = db.collection('businesses');
  const bySlug = await businesses.findOne({ slug: who });
  if (bySlug) return bySlug;

  const user = await db.collection('user').findOne({ email: who!.toLowerCase() });
  if (user?.businessId) {
    const byOwner = await businesses.findOne({ _id: new ObjectId(String(user.businessId)) });
    if (byOwner) return byOwner;
  }

  return businesses.findOne({ name: who });
}

const business = await findBusiness();
if (!business) {
  await client.close();
  die(`No business matched "${who}" by slug, owner email or name.`);
}

const businessId = business._id.toString();
const sub = business.subscription ?? {};
const chosen = PLANS.find((p) => p.id === plan)!;
const price = period === 'annual' ? chosen.annual : chosen.monthly;

console.log(`\nStripe key is ${mode} mode.`);
console.log(`Business : ${business.name}  (${business.slug})`);
console.log(`           ${businessId}`);
console.log(`Now      : plan=${sub.plan ?? '—'} status=${sub.status ?? '—'}`);
console.log(`           stripeCustomerId=${sub.stripeCustomerId ?? '—'}`);
console.log(`           stripeSubscriptionId=${sub.stripeSubscriptionId ?? '—'}`);
console.log(`Grant    : ${chosen.name} ${period} · $${price}/mes · ${priceId}`);
console.log(`Billing  : ${AUTO ? 'charge a saved card' : 'email an invoice (7 días)'}`);
if (trialDays) console.log(`Trial    : ${trialDays} días antes de la primera factura`);

/**
 * Find a subscription this business already has, whether or not we know its id:
 * one created in the Stripe dashboard is not stored here until the webhook
 * applies it, and if the metadata was missing the plan never followed.
 */
async function liveSubscription() {
  if (sub.stripeSubscriptionId) {
    const byId = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId).catch(() => null);
    if (byId && !['canceled', 'incomplete_expired'].includes(byId.status)) return byId;
  }
  if (!sub.stripeCustomerId) return null;
  const list = await stripe.subscriptions
    .list({ customer: sub.stripeCustomerId, status: 'all', limit: 10 })
    .catch(() => null);
  return (
    list?.data.find((x) => !['canceled', 'incomplete_expired'].includes(x.status)) ?? null
  );
}

const existing = await liveSubscription();

// Refuse to stack a second subscription onto a business that already pays.
if (existing) {
  await client.close();
  die(
    `${business.name} already has a live Stripe subscription (${existing.id}, ${existing.status}).\n` +
      `Creating a second subscription would bill them twice.`
  );
}

if (!APPLY) {
  console.log('\nDry run. Re-run with --apply to create it.\n');
  await client.close();
  process.exit(0);
}

/**
 * Reuse the customer if there is one, and look it up by metadata rather than
 * trusting only the stored id: a business that opened Checkout and abandoned it
 * already has a customer, and minting a second one splits their invoices.
 */
async function resolveCustomer(): Promise<string> {
  if (sub.stripeCustomerId) {
    const found = await stripe.customers.retrieve(sub.stripeCustomerId).catch(() => null);
    if (found && !('deleted' in found && found.deleted)) return found.id;
  }
  const search = await stripe.customers
    .search({ query: `metadata['businessId']:'${businessId}'`, limit: 1 })
    .catch(() => null);
  if (search?.data[0]) return search.data[0].id;

  const owner = await db
    .collection('user')
    .findOne({ businessId: { $in: [businessId, business!._id] }, role: 'OWNER' });
  const created = await stripe.customers.create({
    email: owner?.email,
    name: business!.name,
    metadata: { businessId },
  });
  console.log(`Created customer ${created.id}`);
  return created.id;
}

const customerId = await resolveCustomer();

const created = await stripe.subscriptions.create({
  customer: customerId,
  items: [{ price: priceId }],
  // ⚠️ `charge_automatically` with no card on file leaves the subscription
  // `incomplete`, which mapStatus turns into `past_due` — the business would be
  // BLOCKED by the very thing meant to give them access. Invoicing starts
  // `active`, which is what "I sold them a plan" means.
  collection_method: AUTO ? 'charge_automatically' : 'send_invoice',
  ...(AUTO ? {} : { days_until_due: 7 }),
  ...(trialDays ? { trial_period_days: trialDays } : {}),
  // The whole point of this script. Without these the tier silently does not
  // follow, and `findBusinessId` has to fall back to the stored customer id.
  metadata: subscriptionMetadata(businessId, plan, period),
});

console.log(`\nCreated subscription ${created.id} (${created.status}).`);

await waitForWebhook(created.id);

/**
 * Confirm the webhook actually applied it. If this times out the subscription
 * is real and the customer will be billed, but RestKit does not know — which
 * means `POST /api/stripe/webhook` is not receiving `customer.subscription.*`,
 * and every future renewal and cancellation will be missed too.
 */
async function waitForWebhook(subscriptionId: string) {
  process.stdout.write('Waiting for the webhook to apply it');
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    process.stdout.write('.');
    const fresh = await db.collection('businesses').findOne({ _id: business!._id });
    const applied =
      fresh?.subscription?.stripeSubscriptionId === subscriptionId &&
      fresh?.subscription?.plan === plan;
    if (applied) {
      console.log(
        `\n\n✓ Applied: plan=${fresh!.subscription.plan} period=${fresh!.subscription.billingPeriod} status=${fresh!.subscription.status}`
      );
      return;
    }
  }

  const fresh = await db.collection('businesses').findOne({ _id: business!._id });
  console.log(
    `\n\n⚠️  The webhook has not applied it after 20s.\n` +
      `    Stripe has the subscription (${subscriptionId}); RestKit still shows\n` +
      `    plan=${fresh?.subscription?.plan ?? '—'} status=${fresh?.subscription?.status ?? '—'}.\n\n` +
      `    Check that ${mode} mode has an endpoint for POST /api/stripe/webhook with\n` +
      `    customer.subscription.* enabled, and that STRIPE_WEBHOOK_SECRET matches it.\n` +
      `    An owner opening /dashboard/billing also triggers a sync, as a stopgap.`
  );
  process.exitCode = 1;
}

await client.close();
