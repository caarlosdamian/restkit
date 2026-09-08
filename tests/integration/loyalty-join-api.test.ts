import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { jsonRequest, oid } from '../helpers/fixtures';
import { resetThrottle } from '@/lib/throttle';
import Business from '@/models/Business';
import Customer from '@/models/Customer';
import { DEFAULT_LOYALTY } from '@/lib/loyalty';

import { POST as join } from '@/app/api/loyalty/join/[slug]/route';

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  resetThrottle();
});

const SLUG = 'cafe-luna';

async function seedBusiness(subscription?: Record<string, unknown>) {
  const businessId = oid();
  await Business.create({
    _id: businessId,
    name: 'Café Luna',
    slug: SLUG,
    settings: { loyalty: DEFAULT_LOYALTY },
    ...(subscription ? { subscription } : {}),
  });
  return businessId;
}

/** The public endpoint takes no session — an IP is all it can key on. */
function post(body: Record<string, unknown>, ip = '203.0.113.7', slug = SLUG) {
  const req = jsonRequest(`/api/loyalty/join/${slug}`, { method: 'POST', body });
  const withIp = new Request(req, { headers: { ...Object.fromEntries(req.headers), 'x-forwarded-for': ip } });
  return join(withIp, { params: Promise.resolve({ slug }) });
}

describe('a customer can enrol themselves', () => {
  it('creates a card from a phone number alone, with no staff involved', async () => {
    // Until this existed the programme only grew while somebody remembered to
    // ask at the counter.
    const businessId = await seedBusiness();

    const res = await post({ phone: '55 1234 5678', name: 'Ana' });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.token).toMatch(/^[a-f0-9]{40}$/);

    const customer = await Customer.findOne({ businessId, phone: '5512345678' });
    expect(customer!.name).toBe('Ana');
  });

  it('needs no name', async () => {
    await seedBusiness();
    const res = await post({ phone: '5512345678' });
    expect(res.status).toBe(201);
    expect((await Customer.findOne({ phone: '5512345678' }))!.name).toBe('Cliente 5678');
  });

  it('grants no welcome stamp', async () => {
    // The first stamp comes from a real purchase, so the counter never has to
    // explain one nobody earned.
    await seedBusiness();
    await post({ phone: '5512345678' });

    const customer = await Customer.findOne({ phone: '5512345678' });
    expect(customer!.stats.currentVisits).toBe(0);
    expect(customer!.stats.totalVisits).toBe(0);
  });

  it('issues the wallet credentials the pass needs', async () => {
    await seedBusiness();
    await post({ phone: '5512345678' });

    const customer = await Customer.findOne({ phone: '5512345678' });
    // Without this the pass would be issued permanently un-updatable.
    expect(customer!.externalIds?.appleAuthToken).toBeTruthy();
    expect(customer!.publicToken).toBeTruthy();
  });

  it('rejects a phone that is not 10 digits', async () => {
    await seedBusiness();
    for (const phone of ['55123', '', '551234567890', 'abcdefghij']) {
      expect((await post({ phone })).status).toBe(400);
    }
  });

  it('404s an unknown business', async () => {
    expect((await post({ phone: '5512345678' }, '203.0.113.7', 'nope')).status).toBe(404);
  });
});

describe('a phone number is not a secret', () => {
  it('never hands back the card of a phone that already has one', async () => {
    // The whole vulnerability: anyone can type a stranger's number. Returning
    // the token would hand over their balance, their pending rewards, and a
    // pass the claimant could present at the counter.
    const businessId = await seedBusiness();
    await Customer.create({
      businessId,
      name: 'Ana Pérez',
      phone: '5512345678',
      stats: { totalVisits: 20, currentVisits: 8, cashbackBalance: 640 },
    });

    const res = await post({ phone: '5512345678' });
    const body = await res.text();

    expect(res.status).toBe(409);
    expect(JSON.parse(body).code).toBe('ALREADY_ENROLLED');
    // Not the token, not the name, not the balance.
    expect(body).not.toMatch(/token|Ana|640/);
  });

  it('does not create a duplicate customer either', async () => {
    const businessId = await seedBusiness();
    await Customer.create({ businessId, name: 'Ana', phone: '5512345678', stats: {} });

    await post({ phone: '5512345678' });
    expect(await Customer.countDocuments({ businessId })).toBe(1);
  });
});

describe('minting cards is rate limited', () => {
  it('cuts off one client after a burst', async () => {
    // Public and unauthenticated: without this, one script fills the customer
    // list with junk.
    await seedBusiness();

    const codes: number[] = [];
    for (let i = 0; i < 9; i++) {
      codes.push((await post({ phone: `55123456${String(i).padStart(2, '0')}` })).status);
    }

    expect(codes.filter((c) => c === 201).length).toBeLessThanOrEqual(7);
    expect(codes).toContain(429);
  });

  it('limits per client, not globally', async () => {
    // One busy table must not lock out the next customer.
    await seedBusiness();
    for (let i = 0; i < 8; i++) {
      await post({ phone: `55123456${String(i).padStart(2, '0')}`, name: 'a' }, '198.51.100.1');
    }

    expect((await post({ phone: '5599887766' }, '198.51.100.2')).status).toBe(201);
  });
});

describe('the money gate', () => {
  it('refuses to enrol for a lapsed business', async () => {
    // Enrolling a customer is selling, same as opening the register.
    await seedBusiness({
      plan: 'lite',
      status: 'trialing',
      trialEndsAt: new Date(Date.now() - 86_400_000),
    });

    const res = await post({ phone: '5512345678' });
    expect(res.status).toBe(402);
    expect((await res.json()).code).toBe('SUBSCRIPTION_REQUIRED');
  });

  it('works during the trial', async () => {
    await seedBusiness({
      plan: 'lite',
      status: 'trialing',
      trialEndsAt: new Date(Date.now() + 5 * 86_400_000),
    });
    expect((await post({ phone: '5512345678' })).status).toBe(201);
  });
});
