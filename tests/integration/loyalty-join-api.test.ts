import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import mongoose from 'mongoose';
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

describe('a queue of strangers, none of whom have an email', () => {
  // The shape of the real thing: a QR on a table, and everyone who scans it
  // gives a phone and nothing else.
  it('enrols all of them', async () => {
    await seedBusiness();
    for (const [i, phone] of ['5511110001', '5522220002', '5533330003'].entries()) {
      const res = await post({ phone }, `203.0.113.${20 + i}`);
      expect([res.status, await res.json()]).toEqual([201, expect.objectContaining({ token: expect.any(String) })]);
    }
    expect(await Customer.countDocuments()).toBe(3);
  });

  it('declares its uniques as partial, never sparse', () => {
    // ⚠️ A compound SPARSE index indexes any document holding at least one of
    // its fields, so every email-less customer lands on (businessId, null) and
    // the second one collides. Partial skips the document unless the field is
    // actually a string. The distinction is the whole bug.
    const declared = Customer.schema.indexes();
    for (const field of ['email', 'phone']) {
      const idx = declared.find(([key]: [Record<string, unknown>, ...unknown[]]) => 'businessId' in key && field in key);
      expect(idx, `no unique declared for businessId+${field}`).toBeDefined();
      const [, options] = idx!;
      expect(options?.unique).toBe(true);
      expect(options?.sparse).toBeFalsy();
      expect(options?.partialFilterExpression).toEqual({ [field]: { $type: 'string' } });
    }
  });
});

describe('a database still carrying the old sparse index', () => {
  // Mongoose cannot change an index that already exists, so a database created
  // before the schema was fixed keeps `sparse: true` for ever and nothing says
  // so. Production was in exactly this state. The route cannot make the insert
  // succeed — but it must not blame the customer's phone number for it.
  const legacy = async () => {
    const customers = mongoose.connection.db!.collection('customers');
    await customers.dropIndex('businessId_1_email_1').catch(() => {});
    await customers.createIndex({ businessId: 1, email: 1 }, {
      name: 'businessId_1_email_1', unique: true, sparse: true,
    });
  };

  afterEach(async () => {
    const customers = mongoose.connection.db!.collection('customers');
    await customers.dropIndex('businessId_1_email_1').catch(() => {});
    await customers.createIndex({ businessId: 1, email: 1 }, {
      name: 'businessId_1_email_1',
      unique: true,
      partialFilterExpression: { email: { $type: 'string' } },
    });
  });

  it('never tells someone with a brand-new number that they already have a card', async () => {
    await seedBusiness();
    await legacy();

    const first = await post({ phone: '5511110001' }, '203.0.113.31');
    expect(first.status).toBe(201);

    // Same business, a number nobody has ever used. The collision is on the
    // EMAIL index, and reporting it as ALREADY_ENROLLED sent this person to a
    // counter that had never heard of them.
    const second = await post({ phone: '5599990009' }, '203.0.113.32');
    const body = await second.json();
    expect(body.code).not.toBe('ALREADY_ENROLLED');
    expect(body.error).not.toMatch(/ya tienes una tarjeta/i);
    expect(body.code).toBe('ENROLMENT_CONFLICT');
    // And it says WHICH index, so a report from production is diagnosable.
    expect(body.conflict).toBe('businessId+email');
  });

  it('still refuses a phone that genuinely has a card', async () => {
    // The security rule this route exists to enforce survives the fix: a real
    // phone collision is still 409 with no token.
    const businessId = await seedBusiness();
    await Customer.create({
      businessId, name: 'Ana', phone: '5511110001',
      stats: { totalVisits: 0, currentVisits: 0, cashbackBalance: 0 },
      publicToken: 'a'.repeat(40),
    });
    const res = await post({ phone: '5511110001' }, '203.0.113.33');
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('ALREADY_ENROLLED');
    expect(body.token).toBeUndefined();
  });
});

describe('the same person, spelled two ways', () => {
  // Self-enrolment writes 10 bare digits. The till and the seed data write
  // what the cashier typed. An exact-match check misses the customer entirely
  // and mints them a SECOND card — the quiet opposite of the bug above.
  const AT_THE_TILL = '+52 55 1234 5678';

  beforeEach(async () => {
    const businessId = await seedBusiness();
    await Customer.create({
      businessId,
      name: 'Ana (del mostrador)',
      phone: AT_THE_TILL,
      stats: { totalVisits: 4, currentVisits: 4, cashbackBalance: 0 },
      publicToken: 'b'.repeat(40),
    });
  });

  it('recognises a customer whose phone was stored in another format', async () => {
    const res = await post({ phone: '5512345678' }, '203.0.113.41');
    expect(res.status).toBe(409);
    const body = await res.json();
    // Its own code: the card exists, and our own writers disagree on spelling.
    expect(body.code).toBe('ALREADY_ENROLLED_FORMAT');
    // Still no token — a phone is not a secret, whatever shape it is stored in.
    expect(body.token).toBeUndefined();
    expect(await Customer.countDocuments()).toBe(1);
  });

  it('does not match a different number that merely ends the same way', async () => {
    // A suffix match would refuse strangers. The digits must all line up.
    const res = await post({ phone: '5599345678' }, '203.0.113.42');
    expect(res.status).toBe(201);
    expect(await Customer.countDocuments()).toBe(2);
  });
});
