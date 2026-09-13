import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { jsonRequest } from '../helpers/fixtures';
import { resetThrottle } from '@/lib/throttle';
import Business from '@/models/Business';

/**
 * `POST /api/auth/register` — the orchestration, not better-auth.
 *
 * Whether the confirmation flow actually works is
 * tests/integration/signup-verification.test.ts, against the real instance.
 * What is left here is the part we wrote, and the reason this route exists at
 * all: **deciding whether a business may be created**, given a `signUpEmail`
 * whose return value cannot be trusted.
 *
 * So `signUpEmail` is a stub whose behaviour each test chooses — including the
 * one that matters, where it reports success for an address that already
 * exists and hands back an id belonging to no row.
 */

/** Set by each test: what the stubbed sign-up should do when called. */
let signUpBehaviour: (body: Record<string, string>) => Promise<unknown>;
const signUpCalls: Array<Record<string, string>> = [];

vi.mock('@/lib/auth', async () => {
  const state = await import('../helpers/auth-state');
  return {
    auth: {
      api: {
        getSession: async () => state.getMockSession(),
        signUpEmail: async ({ body }: { body: Record<string, string> }) => {
          signUpCalls.push(body);
          return signUpBehaviour(body);
        },
      },
    },
  };
});

const { POST: register } = await import('@/app/api/auth/register/route');

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  resetThrottle();
  signUpCalls.length = 0;
  // The honest default: insert the row better-auth would have inserted.
  signUpBehaviour = async (body) => {
    await mongoose.connection.collection('user').insertOne({
      name: body.name,
      email: body.email,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { user: { id: 'whatever' } };
  };
});

const VALID = {
  name: 'Carlos Damián',
  email: 'nuevo@restaurantkit.app',
  password: 'contrasena-de-prueba-1',
  businessName: 'Tacos El Norte',
};

const post = (body: Record<string, unknown>, headers?: Record<string, string>) =>
  register(jsonRequest('/api/auth/register', { method: 'POST', body, headers }));

const users = () => mongoose.connection.collection('user');

describe('opening an account', () => {
  it('creates the business and makes the signer-up its owner', async () => {
    const res = await post(VALID);
    expect(res.status).toBe(200);

    const business = await Business.findOne({ name: 'Tacos El Norte' });
    expect(business).toBeTruthy();
    // Trial-without-card, same as every other new business.
    expect(business!.subscription?.status).toBe('trialing');

    const row = await users().findOne({ email: VALID.email });
    expect(row!.role).toBe('OWNER');
    expect(row!.businessId).toBe(business!._id.toString());
  });

  it('carries the plan chosen on the pricing page through signup', async () => {
    await post({ ...VALID, plan: 'lite', period: 'annual' });
    const business = await Business.findOne({ name: 'Tacos El Norte' });
    expect(business!.subscription?.plan).toBe('lite');
    expect(business!.subscription?.billingPeriod).toBe('annual');
  });

  it('tells someone plainly that the address already has an account', async () => {
    await post(VALID);
    const res = await post({ ...VALID, businessName: 'Otro Negocio' });
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.code).toBe('EMAIL_TAKEN');
    // And nothing was built for the second attempt.
    expect(await Business.countDocuments({})).toBe(1);
    expect(await Business.findOne({ name: 'Otro Negocio' })).toBeNull();
    // better-auth was never even asked — no second confirmation mail goes out
    // for an account that may not belong to whoever is typing.
    expect(signUpCalls).toHaveLength(1);
  });

  it('⚠️ never builds a business against a user that is not in the database', async () => {
    // This is the whole reason the route exists. With requireEmailVerification
    // on, better-auth answers a duplicate sign-up with 200 and a SYNTHETIC user
    // carrying a freshly generated id, so that sign-up cannot be used to test
    // which addresses are customers. The old flow handed that id straight to an
    // open POST /api/business, which happily created a business owned by
    // nobody — on a 14-day trial, counted in every total.
    signUpBehaviour = async () => ({ user: { id: new mongoose.Types.ObjectId().toString() } });

    const res = await post(VALID);

    expect(res.status).toBe(500);
    expect(await Business.countDocuments({})).toBe(0);
  });

  it('refuses a password shorter than the policy, before creating anything', async () => {
    const res = await post({ ...VALID, password: 'corta' });

    expect(res.status).toBe(400);
    expect(signUpCalls).toHaveLength(0);
    expect(await Business.countDocuments({})).toBe(0);
  });

  it('refuses an incomplete form', async () => {
    expect((await post({ ...VALID, businessName: '' })).status).toBe(400);
    expect((await post({ ...VALID, email: 'no-es-un-correo' })).status).toBe(400);
    expect(await Business.countDocuments({})).toBe(0);
  });

  it('throttles one address of the internet, so the user table cannot be filled by a script', async () => {
    const ip = { 'x-forwarded-for': '203.0.113.9' };
    for (let i = 0; i < 5; i++) {
      const res = await post({ ...VALID, email: `uno${i}@restaurantkit.app` }, ip);
      expect(res.status).toBe(200);
    }

    const blocked = await post({ ...VALID, email: 'seis@restaurantkit.app' }, ip);
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).code).toBe('RATE_LIMITED');

    // Somebody else is unaffected.
    const other = await post(
      { ...VALID, email: 'otro@restaurantkit.app' },
      { 'x-forwarded-for': '198.51.100.4' }
    );
    expect(other.status).toBe(200);
  });
});
