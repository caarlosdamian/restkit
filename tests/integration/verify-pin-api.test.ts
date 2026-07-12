import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { resetAuthState } from '../helpers/auth-state';
import { signInAs, jsonRequest, createRawUser, oid } from '../helpers/fixtures';
import { POST as verifyPin } from '@/app/api/pos/waiter/verify-pin/route';
import { hashPin, verifyWaiterToken } from '@/lib/waiter-token';

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  resetAuthState();
});

// The route keeps an in-memory throttle map keyed by businessId that survives
// clearTestDb, so every test uses its own business to stay isolated.

const attempt = (pin: unknown) =>
  verifyPin(jsonRequest('/api/pos/waiter/verify-pin', { method: 'POST', body: { pin } }));

describe('POST /api/pos/waiter/verify-pin', () => {
  it('401s without a terminal session, 400s without a pin', async () => {
    expect((await attempt('1234')).status).toBe(401);

    signInAs(oid());
    expect((await attempt(undefined)).status).toBe(400);
    expect((await attempt(1234)).status).toBe(400); // must be a string
  });

  it('exchanges a correct PIN for a verifiable waiter token', async () => {
    const businessId = oid();
    signInAs(businessId, 'OWNER');
    const waiterId = await createRawUser({ businessId, name: 'Ana López', pinHash: hashPin('4321') });

    const res = await attempt('4321');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.staffId).toBe(waiterId.toString());
    expect(body.staffName).toBe('Ana López');
    expect(verifyWaiterToken(body.token, businessId.toString())).toMatchObject({
      staffId: waiterId.toString(),
    });
  });

  it('rejects a wrong PIN and a PIN belonging to another business', async () => {
    const businessId = oid();
    const otherBusiness = oid();
    signInAs(businessId, 'OWNER');
    await createRawUser({ businessId, pinHash: hashPin('1111') });
    await createRawUser({ businessId: otherBusiness, pinHash: hashPin('2222') });

    expect((await attempt('9999')).status).toBe(401);
    expect((await attempt('2222')).status).toBe(401); // exists, but in another tenant
  });

  it('ignores staff without a configured PIN', async () => {
    const businessId = oid();
    signInAs(businessId, 'OWNER');
    await createRawUser({ businessId, pinHash: null });
    expect((await attempt('1234')).status).toBe(401);
  });

  it('throttles after 5 failed attempts, blocking even the correct PIN', async () => {
    const businessId = oid();
    signInAs(businessId, 'OWNER');
    await createRawUser({ businessId, pinHash: hashPin('5555') });

    for (let i = 0; i < 5; i++) {
      expect((await attempt('0000')).status).toBe(401);
    }
    expect((await attempt('0000')).status).toBe(429);
    expect((await attempt('5555')).status).toBe(429); // locked out for the window
  });

  it('a successful attempt clears the failure counter', async () => {
    const businessId = oid();
    signInAs(businessId, 'OWNER');
    await createRawUser({ businessId, pinHash: hashPin('7777') });

    for (let i = 0; i < 4; i++) await attempt('0000');
    expect((await attempt('7777')).status).toBe(200); // still under the limit

    // Counter reset: four more failures don't trip the lockout.
    for (let i = 0; i < 4; i++) {
      expect((await attempt('0000')).status).toBe(401);
    }
    expect((await attempt('7777')).status).toBe(200);
  });
});
