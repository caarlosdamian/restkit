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

async function seed() {
  const businessId = oid();
  await Business.create({
    _id: businessId,
    name: 'Cafetería Push',
    slug: `push-${businessId.toString()}`,
    settings: { loyalty: { mechanic: 'sellos', sellos: { required: 10, rewardDescription: 'Café' } } },
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
    // The fallback runs it inline; give the microtasks a turn.
    await new Promise((r) => setTimeout(r, 0));

    expect(deferred).toHaveLength(0);
    expect(sendAppleWalletPushes).toHaveBeenCalledWith([PUSH_TOKEN]);
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
