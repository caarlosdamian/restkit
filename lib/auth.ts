import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { MongoClient } from 'mongodb';
import { sendEmail } from './email';
import { resetPasswordEmail } from './email-templates';
import { MIN_PASSWORD_LENGTH } from './password-policy';
import { appUrl } from './app-url';

const mongodbUri = process.env.MONGODB_URI;

if (!mongodbUri) {
  if (process.env.NODE_ENV === 'development' || process.env.BETTER_AUTH_CLI) {
    console.warn(
      'MONGODB_URI is not defined. Better Auth might fail if database access is required.',
    );
  } else {
    throw new Error('MONGODB_URI is not defined');
  }
}

const client = new MongoClient(
  mongodbUri || 'mongodb://localhost:27017/unused',
);
const db = client.db();

/** One hour. Long enough to find the mail on another device, short enough
 *  that a link left in an inbox is not a standing key to the account. */
const RESET_TOKEN_TTL_SECONDS = 60 * 60;

/** Where better-auth's handler is mounted — `app/api/auth/[...all]/route.ts`.
 *  Move that folder and this must move with it. */
const AUTH_BASE_PATH = '/api/auth';

/** The page that finishes the reset. Only a fallback: the browser normally
 *  asks for it by `redirectTo`, which is what gets carried through. */
const RESET_PAGE = '/restablecer';

export const auth = betterAuth({
  database: mongodbAdapter(db),
//   trustedOrigins: [process.env.BETTER_AUTH_URL as string],
trustedOrigins: async (request) => {
        if (!request) {
            return [];
        }
        
        // Extract the origin header from the request object
        const origin = request.headers.get("origin");
        
        // Fallback to a default if the origin header is missing
        return origin ? [origin] : [];
    },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: MIN_PASSWORD_LENGTH,
    resetPasswordTokenExpiresIn: RESET_TOKEN_TTL_SECONDS,
    /**
     * ⚠️ A reset logs every device out, the POS terminal included.
     *
     * Tempting to leave alive: the terminal is signed in as the manager and
     * getting kicked out mid-shift is a real cost. But "I need to reset my
     * password" is precisely the moment where the account may already be in
     * someone else's hands, and a reset that leaves the attacker's session
     * signed in resets nothing. The staff member gets back in with the
     * password they just chose, so the email and the confirmation screen both
     * warn them before it happens.
     */
    revokeSessionsOnPasswordReset: true,
    /**
     * `url` points at better-auth's own `/api/auth/reset-password/:token`,
     * which checks the token and then redirects to `/restablecer`. That extra
     * hop is worth keeping rather than linking straight at our page: it means
     * an expired link lands on `?error=INVALID_TOKEN` immediately instead of
     * failing only after someone has chosen and confirmed a new password.
     *
     * ⚠️ **The link is rebuilt here rather than used as given.** better-auth
     * assembles `url` from the origin AND base path it infers from the
     * incoming request, and infers neither when there is no request — a
     * server-side call yields a bare `/reset-password/<token>`, which is a
     * dead link in an inbox. Where inference does work it would just as
     * happily mint a link on a preview deployment that stops existing next
     * week. A password reset is an outward-facing URL like every other one in
     * this product, so its origin is `appUrl()`, same as the QR on a printed
     * poster and the barcode in a wallet pass.
     *
     * Only the `callbackURL` is carried over from better-auth, so the page the
     * customer lands on still follows the `redirectTo` the form asked for.
     * That the reconstructed link actually resolves — base path included — is
     * held by tests/integration/password-reset.test.ts, which fetches it.
     */
    sendResetPassword: async ({ user, url, token }) => {
      // Base only matters to make `url` parseable; nothing from it is kept.
      const callbackURL = new URL(url, 'http://parse.invalid').searchParams.get('callbackURL');
      const link =
        `${appUrl()}${AUTH_BASE_PATH}/reset-password/${token}` +
        `?callbackURL=${encodeURIComponent(callbackURL || RESET_PAGE)}`;

      const message = resetPasswordEmail({
        url: link,
        name: user.name,
        expiresInMinutes: RESET_TOKEN_TTL_SECONDS / 60,
      });
      // The result is deliberately dropped. better-auth answers the same
      // "if this address exists, check your mail" whatever happens here, and a
      // provider outage must not become a 500 — a response that differs from
      // the unknown-address one is how an attacker enumerates accounts.
      // `sendEmail` never throws; a failure is logged instead.
      await sendEmail({ to: user.email, ...message });
    },
  },
  // better-auth rate-limits by IP in production builds (good — keep it).
  // The E2E suite runs a production build on localhost and fires many auth
  // calls in seconds from one IP, so its server sets this flag to opt out.
  // Never set it in a real deployment.
  ...(process.env.AUTH_DISABLE_RATE_LIMIT === '1'
    ? { rateLimit: { enabled: false } }
    : {}),
  user: {
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'STAFF',
      },
      businessId: {
        type: 'string',
      },
    },
  },
  // Required for the client-side to see these fields
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 1 week
    updateAge: 60 * 60 * 24, // 1 day
  },
});
