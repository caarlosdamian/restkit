import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { resetAuthState } from '../helpers/auth-state';
import { signInAs, jsonRequest, oid } from '../helpers/fixtures';
import Business from '@/models/Business';
import Customer from '@/models/Customer';
import Visit from '@/models/Visit';
import { DEFAULT_LOYALTY } from '@/lib/loyalty';

import { GET as scanGet, POST as scanPost, SCAN_COOLDOWN_MS } from '@/app/api/loyalty/scan/[token]/route';

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  resetAuthState();
});

async function seed(
  loyalty: Partial<typeof DEFAULT_LOYALTY> = {},
  stats = {},
  subscription?: Record<string, unknown>
) {
  const businessId = oid();
  await Business.create({
    _id: businessId,
    name: 'Café Luna',
    slug: `luna-${businessId}`,
    settings: { loyalty: { ...DEFAULT_LOYALTY, ...loyalty } },
    ...(subscription ? { subscription } : {}),
  });
  const customer = await Customer.create({
    businessId,
    name: 'Ana Pérez',
    phone: '5512345678',
    stats: { totalVisits: 3, currentVisits: 3, cashbackBalance: 0, ...stats },
  });
  return { businessId, customer, token: customer.publicToken! };
}

const get = (token: string) =>
  scanGet(new Request(`http://t/api/loyalty/scan/${token}`), {
    params: Promise.resolve({ token }),
  });

const post = (token: string, body: Record<string, unknown>) =>
  scanPost(jsonRequest(`/api/loyalty/scan/${token}`, { method: 'POST', body }), {
    params: Promise.resolve({ token }),
  });

describe('a card belongs to one business', () => {
  it('refuses a token from another business, and does not confirm it exists', async () => {
    // 404, not 403: "this code is real but not yours" is a lookup service for
    // anyone holding a stolen ticket.
    const { token } = await seed();
    signInAs(oid(), 'OWNER');

    const res = await get(token);
    expect(res.status).toBe(404);
    expect((await res.json()).error).not.toContain('Ana');
  });

  it('refuses an unknown token the same way', async () => {
    signInAs(oid(), 'OWNER');
    expect((await get('nope')).status).toBe(404);
  });

  it('requires a session at all', async () => {
    const { token } = await seed();
    resetAuthState();
    expect((await get(token)).status).toBe(401);
    expect((await post(token, { action: 'accrue' })).status).toBe(401);
  });
});

describe('registering a visit with no order behind it', () => {
  it('stamps a card for a business that does not run our register', async () => {
    // The whole point: earning at cobro only works for businesses that
    // switched their till to us.
    const { businessId, token, customer } = await seed();
    signInAs(businessId, 'STAFF');

    const res = await post(token, { action: 'accrue' });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.stamps).toBe(4);

    const entries = await Visit.find({ customerId: customer._id, type: 'ACCRUAL' });
    expect(entries).toHaveLength(1);
    // Ledger entry with no order — reversible exactly like one from the till.
    expect(entries[0].orderId).toBeUndefined();
  });

  it('lets any signed-in role scan', async () => {
    // Registering a visit is what the person behind the counter is there to do.
    const { businessId, token } = await seed();
    signInAs(businessId, 'STAFF');
    expect((await post(token, { action: 'accrue' })).status).toBe(200);
  });

  it('hands over a reward that is due', async () => {
    const { businessId, token } = await seed({}, { currentVisits: 10 });
    signInAs(businessId, 'OWNER');

    const res = await post(token, { action: 'redeemReward' });
    expect(res.status).toBe(200);
    expect((await res.json()).rewardsPending).toBe(0);
  });

  it('answers the cashier instead of 500ing when there is no reward', async () => {
    const { businessId, token } = await seed({}, { currentVisits: 2 });
    signInAs(businessId, 'OWNER');

    const res = await post(token, { action: 'redeemReward' });
    expect(res.status).toBe(400);
    expect(typeof (await res.json()).error).toBe('string');
  });
});

describe('cashback needs an amount', () => {
  it('refuses to guess the ticket total', async () => {
    // A percentage OF something: with no till there is nothing to take it from.
    const { businessId, token } = await seed({ mechanic: 'cashback' });
    signInAs(businessId, 'OWNER');

    const res = await post(token, { action: 'accrue' });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('AMOUNT_REQUIRED');
  });

  it('accrues the configured percentage of what the cashier typed', async () => {
    const { businessId, token } = await seed({
      mechanic: 'cashback',
      cashback: { rate: 10, threshold: 100 },
    });
    signInAs(businessId, 'OWNER');

    const res = await post(token, { action: 'accrue', amount: 250 });
    expect((await res.json()).cashbackBalance).toBe(25);
  });
});

describe('a double scan is not a double stamp', () => {
  it('stops a second scan inside the cooldown', async () => {
    // A slow camera, a second tap, a customer holding the phone up again.
    const { businessId, token } = await seed();
    signInAs(businessId, 'OWNER');

    expect((await post(token, { action: 'accrue' })).status).toBe(200);

    const res = await post(token, { action: 'accrue' });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('RECENTLY_STAMPED');
  });

  it('lets staff override it deliberately', async () => {
    const { businessId, token } = await seed();
    signInAs(businessId, 'OWNER');

    await post(token, { action: 'accrue' });
    const res = await post(token, { action: 'accrue', force: true });

    expect(res.status).toBe(200);
    expect((await res.json()).stamps).toBe(5);
  });

  it('allows the next visit once the cooldown has passed', async () => {
    const { businessId, token, customer } = await seed();
    signInAs(businessId, 'OWNER');

    await post(token, { action: 'accrue' });
    // Through the raw driver: `timestamps: true` makes createdAt immutable, so
    // Mongoose silently ignores a $set on it. That immutability is the right
    // property for an append-only ledger — the test is what has to bend.
    await Visit.collection.updateMany(
      { customerId: customer._id },
      { $set: { createdAt: new Date(Date.now() - SCAN_COOLDOWN_MS - 1000) } }
    );

    expect((await post(token, { action: 'accrue' })).status).toBe(200);
  });
});

describe('reading a card', () => {
  it('returns progress, not just a name', async () => {
    const { businessId, token } = await seed({}, { currentVisits: 7 });
    signInAs(businessId, 'OWNER');

    const data = await (await get(token)).json();
    expect(data).toMatchObject({ name: 'Ana Pérez', stamps: 7, required: 10 });
    expect(data.recentlyStamped).toBe(false);
  });

  it('warns that this card was just stamped', async () => {
    const { businessId, token } = await seed();
    signInAs(businessId, 'OWNER');
    await post(token, { action: 'accrue' });

    expect((await (await get(token)).json()).recentlyStamped).toBe(true);
  });
});

describe('the money gate', () => {
  const lapsed = {
    plan: 'lite',
    status: 'trialing',
    trialEndsAt: new Date(Date.now() - 86_400_000),
  };

  it('refuses to register a visit once the subscription lapsed', async () => {
    // Writing loyalty is selling, so it sits behind the same gate as opening
    // the register — otherwise an expired business stamps cards forever.
    const { businessId, token } = await seed({}, {}, lapsed);
    signInAs(businessId, 'OWNER');

    const res = await post(token, { action: 'accrue' });
    expect(res.status).toBe(402);
    expect((await res.json()).code).toBe('SUBSCRIPTION_REQUIRED');
  });

  it('still lets the cashier SEE who they are serving', async () => {
    // Mid-transaction, a blank screen is worse than a clear refusal.
    const { businessId, token } = await seed({}, {}, lapsed);
    signInAs(businessId, 'OWNER');

    expect((await get(token)).status).toBe(200);
  });

  it('leaves a business inside its trial alone', async () => {
    const { businessId, token } = await seed({}, {}, {
      plan: 'lite',
      status: 'trialing',
      trialEndsAt: new Date(Date.now() + 5 * 86_400_000),
    });
    signInAs(businessId, 'OWNER');

    expect((await post(token, { action: 'accrue' })).status).toBe(200);
  });
});
