/**
 * Best-effort in-memory throttle.
 *
 * Per server instance only. On Vercel that means one lambda, so a determined
 * attacker spread across cold starts gets more attempts than the numbers here
 * suggest — this raises the cost of guessing, it does not make it impossible.
 * A multi-node deployment that needs a real limit should move this to Redis.
 */

interface Bucket {
  count: number;
  until: number;
}

const buckets = new Map<string, Bucket>();

/** Dropped lazily on access, so an idle process doesn't hold keys forever. */
function current(key: string, now: number): Bucket | undefined {
  const bucket = buckets.get(key);
  if (!bucket) return undefined;
  if (bucket.until <= now) {
    buckets.delete(key);
    return undefined;
  }
  return bucket;
}

export function isThrottled(key: string, max: number): boolean {
  const bucket = current(key, Date.now());
  return Boolean(bucket && bucket.count >= max);
}

/** Counts one attempt against the key and returns whether it is now over. */
export function recordAttempt(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = current(key, now) ?? { count: 0, until: now + windowMs };
  bucket.count += 1;
  buckets.set(key, bucket);
  return bucket.count > max;
}

export function clearThrottle(key: string): void {
  buckets.delete(key);
}

/** Tests only — a fresh process is the production reset. */
export function resetThrottle(): void {
  buckets.clear();
}
