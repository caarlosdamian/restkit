/**
 * Mutable state backing the module mocks in tests/setup.ts. Tests set the
 * acting user (the better-auth session) and any incoming request headers
 * (e.g. x-waiter-token); route handlers read them through the mocked
 * `@/lib/auth` and `next/headers`.
 */

export interface MockSessionUser {
  id: string;
  name: string;
  email?: string;
  businessId?: string;
  role?: 'OWNER' | 'ADMIN' | 'STAFF';
}

let session: { user: MockSessionUser } | null = null;
let requestHeaders = new Headers();

export function setSession(user: MockSessionUser | null): void {
  session = user ? { user } : null;
}

export function getMockSession(): { user: MockSessionUser } | null {
  return session;
}

export function setRequestHeaders(headers: Record<string, string>): void {
  requestHeaders = new Headers(headers);
}

export function getMockRequestHeaders(): Headers {
  return requestHeaders;
}

export function resetAuthState(): void {
  session = null;
  requestHeaders = new Headers();
}
