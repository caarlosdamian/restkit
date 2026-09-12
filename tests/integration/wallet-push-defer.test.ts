import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { oid } from '../helpers/fixtures';

/**
 * Wallet pushes must be handed to the runtime, not left as a floating promise.
 *
 * A serverless instance is frozen the moment its response is sent, so an
 * un-awaited `.then()` chain is suspended part-done — which is how a manually
 * recorded visit reached Mongo instantly and the customer's phone minutes later
 * or never. `after()` is what keeps the instance alive for that work.
 *
 * The assertion is deliberately about WHERE the work is registered, not about
 * whether a push succeeds: the bug was never a failing push, it was a push that
 * never got the chance to run.
 */

/** Captures whatever the service defers, and lets the test run it by hand. */
const deferred: Array<() => Promise<void>> = [];
/** Flipped on to simulate being outside a request scope, which is what
 *  `after()` does in a script, a seed, or a test. */
let afterThrows = false;

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    after: (work: () => Promise<void>) => {
      if (afterThrows) throw new Error('`after` was called outside a request scope.');
      deferred.push(work);
    },
  };
});

const sendAppleWalletPushes = vi.fn(async () => []);
vi.mock('@/lib/apple-push', () => ({
  sendAppleWalletPush: vi.fn(async () => {}),
  sendAppleWalletPushes: (...args: unknown[]) => sendAppleWalletPushes(...(args as [])),
}));

const updateGoogleWalletObject = vi.fn(async () => {});
vi.mock('@/lib/google-wallet', () => ({
  updateGoogleWalletObject: (...args: unknown[]) => updateGoogleWalletObject(...(args as [])),
}));

const { loyaltyService } = await import('@/services/loyalty.service');
const Customer = (await import('@/models/Customer')).default;
const Business = (await import('@/models/Business')).default;
const AppleDevice = (await import('@/models/AppleDevice')).default;

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  deferred.length = 0;
  afterThrows = false;
  sendAppleWalletPushes.mockClear();
  updateGoogleWalletObject.mockClear();
});

const PUSH_TOKEN = 'a'.repeat(64);

async function seed(loyalty?: Record<string, unknown>) {
  const businessId = oid();
  await Business.create({
    _id: businessId,
    name: 'Cafetería Push',
    slug: `push-${businessId.toString()}`,
    settings: {
      loyalty: loyalty ?? {
        mechanic: 'sellos',
        sellos: { required: 10, rewardDescription: 'Café' },
      },
    },
  });
  const customer = await Customer.create({
    businessId,
    name: 'Ana',
    phone: `55${Date.now().toString().slice(-8)}`,
    stats: { totalVisits: 0, currentVisits: 0, cashbackBalance: 0 },
    publicToken: 'tok-' + businessId.toString(),
    externalIds: { appleAuthToken: 'auth-' + businessId.toString() },
  });
  // The pass's serial number IS the customer id — that is how
  // appleDeviceRepository.findBySerialNumber ties a device to a card.
  await AppleDevice.create({
    deviceLibraryIdentifier: 'dev-1',
    pushToken: PUSH_TOKEN,
    serialNumber: String(customer._id),
    passTypeIdentifier: 'pass.mx.restkit.loyalty',
  });
  return { businessId, customer };
}

/** Same shape, cashback mechanic — the balance is what moves. */
const seedCashback = () =>
  seed({ mechanic: 'cashback', cashback: { rate: 10, threshold: 0 } });

const accrue = (businessId: mongoose.Types.ObjectId, customerId: string) =>
  loyaltyService.accrueForOrder({
    customerId,
    businessId,
    employeeId: oid(),
    orderTotal: 120,
    manual: true,
  });

describe('wallet sync on a manually recorded visit', () => {
  it('defers the push to after() instead of leaving it floating', async () => {
    const { businessId, customer } = await seed();

    const result = await accrue(businessId, String(customer._id));
    expect(result?.earned).toBe(true);

    // ⚠️ The point: the work is REGISTERED with the runtime, and has not been
    // fired off into a promise nobody holds. Before the fix this list was empty
    // and the push was already racing the freeze.
    expect(deferred).toHaveLength(1);
    expect(sendAppleWalletPushes).not.toHaveBeenCalled();

    // And what was deferred is the actual push.
    await deferred[0]();
    expect(sendAppleWalletPushes).toHaveBeenCalledWith([PUSH_TOKEN]);
    expect(updateGoogleWalletObject).toHaveBeenCalled();
  });

  it('still runs the work when there is no request scope to defer into', async () => {
    afterThrows = true;
    const { businessId, customer } = await seed();

    await accrue(businessId, String(customer._id));

    expect(deferred).toHaveLength(0);
    // The fallback runs it inline, but "inline" still includes a database round
    // trip to find the devices — so poll rather than guess at a sleep. A fixed
    // setTimeout(0) happened to pass and was a flake waiting to happen.
    await vi.waitFor(() => expect(sendAppleWalletPushes).toHaveBeenCalledWith([PUSH_TOKEN]));
  });

  it('still updates Google when Apple throws, and never rejects', async () => {
    sendAppleWalletPushes.mockRejectedValueOnce(new Error('APNs down') as never);
    const { businessId, customer } = await seed();

    await accrue(businessId, String(customer._id));
    // allSettled inside: one side failing must not skip the other, and the
    // deferred work must not reject — an unhandled rejection in `after()` is
    // what turns a best-effort push into a crashed instance.
    await expect(deferred[0]()).resolves.toBeUndefined();
    expect(updateGoogleWalletObject).toHaveBeenCalled();
  });
});

describe('removing a purchase', () => {
  /**
   * A reversal used to pass `silent: true` into syncWallet, which skipped the
   * Apple push entirely. No notification — but also no correction: a storeCard
   * never polls, so the iPhone kept showing a stamp the customer no longer had
   * until some later purchase happened to push. Google was patched every time,
   * so the two platforms disagreed about the same card.
   */
  it('pushes to Apple, so the card actually becomes correct', async () => {
    const { businessId, customer } = await seed();
    const customerId = String(customer._id);

    await accrue(businessId, customerId);
    const [entry] = (await loyaltyService.history(customerId, String(businessId), 0, 10)).entries;

    deferred.length = 0;
    sendAppleWalletPushes.mockClear();
    updateGoogleWalletObject.mockClear();

    await loyaltyService.reverse({
      visitId: String(entry._id),
      businessId: String(businessId),
      employeeId: String(oid()),
    });

    expect(deferred).toHaveLength(1);
    await deferred[0]();

    expect(sendAppleWalletPushes).toHaveBeenCalledWith([PUSH_TOKEN]);
    // Google was never the broken side; it must stay working.
    expect(updateGoogleWalletObject).toHaveBeenCalled();
  });

  it('marks the next pass build as silent, and un-marks it on the next sale', async () => {
    const { businessId, customer } = await seed();
    const customerId = String(customer._id);

    await accrue(businessId, customerId);
    // A purchase is news worth announcing.
    expect(await loyaltyService.lastChangeWasDecrease(customerId)).toBe(false);

    const [entry] = (await loyaltyService.history(customerId, String(businessId), 0, 10)).entries;
    await loyaltyService.reverse({
      visitId: String(entry._id),
      businessId: String(businessId),
      employeeId: String(oid()),
    });
    // A correction is not.
    expect(await loyaltyService.lastChangeWasDecrease(customerId)).toBe(true);

    // ⚠️ And it flips back. The device may fetch long after the reversal; if a
    // real purchase landed in between there IS something to announce, and the
    // customer should hear about that one.
    await accrue(businessId, customerId);
    expect(await loyaltyService.lastChangeWasDecrease(customerId)).toBe(false);
  });

  it('is false for a customer with no history at all', async () => {
    const { customer } = await seed();
    expect(await loyaltyService.lastChangeWasDecrease(String(customer._id))).toBe(false);
  });
});

describe('who gets told: the sign of the change, not the kind of entry', () => {
  /**
   * The card ALWAYS syncs. The only question is whether Apple announces it, and
   * the rule is direction: a gain is worth a lock screen, a loss is not.
   *
   * `Visit.type` cannot answer that. REWARD_REDEMPTION is always a decrease but
   * is not a REVERSAL, and REVERSAL has no fixed direction at all — it writes
   * `-entry.delta`, so it moves whichever way the entry it undoes did not.
   */
  it('stays silent when a customer spends their cashback', async () => {
    const { businessId, customer } = await seedCashback();
    const customerId = String(customer._id);

    await loyaltyService.accrueForOrder({
      customerId, businessId, employeeId: oid(), orderTotal: 500, manual: true,
    });
    expect(await loyaltyService.lastChangeWasDecrease(customerId)).toBe(false);

    await loyaltyService.redeemCashback({
      customerId, businessId: String(businessId), employeeId: String(oid()),
      orderTotal: 200, requested: 10,
    });

    // ✗ before the fix: REWARD_REDEMPTION is not REVERSAL, so the customer's
    // phone announced the balance they had just spent.
    expect(await loyaltyService.lastChangeWasDecrease(customerId)).toBe(true);
  });

  it('stays silent when a customer claims a stamp reward', async () => {
    const { businessId, customer } = await seed();
    const customerId = String(customer._id);
    for (let i = 0; i < 10; i++) await accrue(businessId, customerId);

    await loyaltyService.redeemReward({
      customerId, businessId: String(businessId), employeeId: String(oid()),
    });

    // "Llevas 0 de 10" is not the news a free coffee deserves.
    expect(await loyaltyService.lastChangeWasDecrease(customerId)).toBe(true);
  });

  it('SPEAKS UP when undoing a cashback redemption hands money back', async () => {
    const { businessId, customer } = await seedCashback();
    const customerId = String(customer._id);

    await loyaltyService.accrueForOrder({
      customerId, businessId, employeeId: oid(), orderTotal: 500, manual: true,
    });
    await loyaltyService.redeemCashback({
      customerId, businessId: String(businessId), employeeId: String(oid()),
      orderTotal: 200, requested: 10,
    });

    const { entries } = await loyaltyService.history(customerId, String(businessId), 0, 10);
    const redemption = entries.find((e) => e.type === 'REWARD_REDEMPTION')!;
    await loyaltyService.reverse({
      visitId: String(redemption._id),
      businessId: String(businessId),
      employeeId: String(oid()),
    });

    // ✗ before the fix: the entry is a REVERSAL, so this gain went out silently.
    // The balance came BACK to the customer — that is worth telling them.
    expect(await loyaltyService.lastChangeWasDecrease(customerId)).toBe(false);
  });
});
