import { scryptSync, randomBytes, timingSafeEqual, createHmac } from 'crypto';

/**
 * Waiter identity layer (Fase 2).
 *
 * A waiter PIN is NOT authentication to the system — the terminal is already
 * authenticated via the Better Auth session cookie (Fase 1). The PIN only
 * selects "who is acting" on that trusted terminal, so a short 4-6 digit PIN
 * is acceptable: it is useless off the physical terminal.
 *
 * On a correct PIN the server issues a short-lived signed token (the ~90s
 * activity window). The token is stateless (HMAC over the payload) and is
 * re-issued on each action, so an actively-working waiter never re-types the
 * PIN, while an idle terminal falls back to asking for it again.
 */

// ── PIN hashing (scrypt, no external deps) ──────────────────────────────────

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(pin, salt, 32).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPinHash(pin: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [salt, derived] = stored.split(':');
  if (!salt || !derived) return false;
  const expected = Buffer.from(derived, 'hex');
  const actual = scryptSync(pin, salt, 32);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// ── Ephemeral waiter token (HMAC) ───────────────────────────────────────────

export const WAITER_TOKEN_TTL_MS = 90_000; // 90s activity window

interface WaiterTokenPayload {
  staffId: string;
  staffName: string;
  businessId: string;
  exp: number;
}

function secret(): string {
  return (
    process.env.BETTER_AUTH_SECRET ||
    process.env.POS_TOKEN_SECRET ||
    'restkit-dev-insecure-secret-change-me'
  );
}

export function signWaiterToken(staffId: string, staffName: string, businessId: string): string {
  const payload: WaiterTokenPayload = {
    staffId,
    staffName,
    businessId,
    exp: Date.now() + WAITER_TOKEN_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret()).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

/**
 * Verifies a waiter token and that it belongs to the given business. Returns
 * the staff identity or null if invalid/expired/cross-tenant.
 */
export function verifyWaiterToken(
  token: string | null | undefined,
  businessId: string
): { staffId: string; staffName: string } | null {
  if (!token) return null;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;

  const expected = createHmac('sha256', secret()).update(encoded).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const data = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as WaiterTokenPayload;
    if (data.businessId !== businessId) return null;
    if (Date.now() > data.exp) return null;
    return { staffId: data.staffId, staffName: data.staffName };
  } catch {
    return null;
  }
}
