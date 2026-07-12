import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  hashPin,
  verifyPinHash,
  signWaiterToken,
  verifyWaiterToken,
  WAITER_TOKEN_TTL_MS,
} from '@/lib/waiter-token';

describe('PIN hashing (scrypt)', () => {
  it('verifies the correct PIN against its hash', () => {
    const stored = hashPin('1234');
    expect(verifyPinHash('1234', stored)).toBe(true);
  });

  it('rejects a wrong PIN', () => {
    const stored = hashPin('1234');
    expect(verifyPinHash('4321', stored)).toBe(false);
  });

  it('salts every hash (same PIN → different hashes, both valid)', () => {
    const a = hashPin('9999');
    const b = hashPin('9999');
    expect(a).not.toBe(b);
    expect(verifyPinHash('9999', a)).toBe(true);
    expect(verifyPinHash('9999', b)).toBe(true);
  });

  it('rejects null, undefined, and malformed stored hashes', () => {
    expect(verifyPinHash('1234', null)).toBe(false);
    expect(verifyPinHash('1234', undefined)).toBe(false);
    expect(verifyPinHash('1234', 'not-a-hash')).toBe(false);
    expect(verifyPinHash('1234', ':')).toBe(false);
  });
});

describe('waiter token (HMAC, 90s TTL)', () => {
  const BIZ = '64b000000000000000000001';

  afterEach(() => {
    vi.useRealTimers();
  });

  it('round-trips a valid token', () => {
    const token = signWaiterToken('staff-1', 'Ana', BIZ);
    expect(verifyWaiterToken(token, BIZ)).toEqual({ staffId: 'staff-1', staffName: 'Ana' });
  });

  it('rejects a token for a different business (cross-tenant)', () => {
    const token = signWaiterToken('staff-1', 'Ana', BIZ);
    expect(verifyWaiterToken(token, '64b000000000000000000002')).toBeNull();
  });

  it('rejects an expired token (past the 90s window)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
    const token = signWaiterToken('staff-1', 'Ana', BIZ);

    vi.setSystemTime(new Date('2026-01-01T12:00:00Z').getTime() + WAITER_TOKEN_TTL_MS + 1);
    expect(verifyWaiterToken(token, BIZ)).toBeNull();
  });

  it('still verifies just inside the window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
    const token = signWaiterToken('staff-1', 'Ana', BIZ);

    vi.setSystemTime(new Date('2026-01-01T12:00:00Z').getTime() + WAITER_TOKEN_TTL_MS - 1000);
    expect(verifyWaiterToken(token, BIZ)).not.toBeNull();
  });

  it('rejects a tampered payload', () => {
    const token = signWaiterToken('staff-1', 'Ana', BIZ);
    const [, sig] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ staffId: 'attacker', staffName: 'X', businessId: BIZ, exp: Date.now() + 60_000 })
    ).toString('base64url');
    expect(verifyWaiterToken(`${forged}.${sig}`, BIZ)).toBeNull();
  });

  it('rejects a tampered signature', () => {
    const token = signWaiterToken('staff-1', 'Ana', BIZ);
    const [encoded] = token.split('.');
    expect(verifyWaiterToken(`${encoded}.AAAA`, BIZ)).toBeNull();
  });

  it('rejects null/undefined/garbage tokens', () => {
    expect(verifyWaiterToken(null, BIZ)).toBeNull();
    expect(verifyWaiterToken(undefined, BIZ)).toBeNull();
    expect(verifyWaiterToken('garbage', BIZ)).toBeNull();
    expect(verifyWaiterToken('a.b.c', BIZ)).toBeNull();
  });
});
