/**
 * The one canonical origin for this deployment.
 *
 * Everything outward-facing hangs off this: the QR on a printed join poster,
 * the barcode inside a wallet pass, Apple's `webServiceURL`, Google's hero
 * image, Stripe's return URLs, every canonical tag and the sitemap. It used to
 * be `process.env.APP_URL || 'http://localhost:3000'` written out twelve times,
 * which is twelve chances for one of them to drift.
 *
 * ⚠️ **A stale value here is invisible until it is printed on paper.** These
 * URLs are baked into QR codes a customer photographs and into signed passes
 * that cannot be edited afterwards, so this resolves to a REAL domain rather
 * than falling back to localhost the moment someone forgets an env var:
 *
 *  1. `APP_URL` — explicit, always wins. Set this.
 *  2. `VERCEL_PROJECT_PRODUCTION_URL` — the project's production domain, which
 *     Vercel sets on every deployment. Deliberately preferred over VERCEL_URL:
 *     a preview build must not mint passes pointing at a preview host that
 *     disappears in a week.
 *  3. `VERCEL_URL` — this specific deployment. Last resort on Vercel.
 *  4. localhost, for development.
 *
 * ⚠️ On Vercel an environment variable is bound when a deployment is built —
 * changing `APP_URL` in the dashboard does nothing until you **redeploy**.
 */
export function appUrl(): string {
  const explicit = process.env.APP_URL?.trim();
  if (explicit) return normalize(explicit);

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return normalize(production);

  const deployment = process.env.VERCEL_URL?.trim();
  if (deployment) {
    warnOnce(
      'APP_URL is not set — falling back to this deployment’s own URL. Wallet passes and printed QR codes will point at a host that will not outlive it.'
    );
    return normalize(deployment);
  }

  if (process.env.VERCEL) {
    warnOnce('APP_URL is not set and no Vercel URL is available — using localhost, which is wrong in production.');
  }
  return 'http://localhost:3000';
}

/** Accepts `example.com`, `https://example.com/`, `http://localhost:3000`. */
function normalize(value: string): string {
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return withScheme.replace(/\/+$/, '');
}

let warned = false;
function warnOnce(message: string): void {
  if (warned) return;
  warned = true;
  console.warn(`[app-url] ${message}`);
}
