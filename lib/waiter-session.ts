/**
 * Client-side "active waiter" held in sessionStorage with a rolling 90s
 * window. This is convenience/UX only — the server always re-verifies the
 * signed token. The window survives table-to-table navigation (sessionStorage)
 * but clears when the tab closes.
 */

const KEY = 'waiterActive';
const WINDOW_MS = 90_000; // keep in sync with WAITER_TOKEN_TTL_MS on the server

export interface ActiveWaiter {
  staffId: string;
  staffName: string;
  token: string;
  exp: number;
}

export function getActiveWaiter(): ActiveWaiter | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const w = JSON.parse(raw) as ActiveWaiter;
    if (Date.now() > w.exp) {
      window.sessionStorage.removeItem(KEY);
      return null;
    }
    return w;
  } catch {
    return null;
  }
}

export function setActiveWaiter(staffId: string, staffName: string, token: string): void {
  window.sessionStorage.setItem(
    KEY,
    JSON.stringify({ staffId, staffName, token, exp: Date.now() + WINDOW_MS })
  );
}

export function clearActiveWaiter(): void {
  if (typeof window !== 'undefined') window.sessionStorage.removeItem(KEY);
}

/** Header to attach to order mutations so the server can attribute the action. */
export function waiterHeader(): Record<string, string> {
  const w = getActiveWaiter();
  return w ? { 'x-waiter-token': w.token } : {};
}

/** Rolls the window forward using the refreshed token the server returns. */
export function refreshWaiterFromResponse(res: Response): void {
  const token = res.headers.get('x-waiter-token');
  if (!token) return;
  const w = getActiveWaiter();
  if (!w) return;
  window.sessionStorage.setItem(
    KEY,
    JSON.stringify({ ...w, token, exp: Date.now() + WINDOW_MS })
  );
}
