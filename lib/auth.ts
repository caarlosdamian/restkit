import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { MongoClient } from 'mongodb';
import { sendEmail } from './email';
import { resetPasswordEmail, changeEmailVerificationEmail } from './email-templates';
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

/** Same hour as a reset token, and for the same reason — except that this one
 *  matters more: `/verify-email` CREATES a session when the browser opening the
 *  link has none, so the emailed link is a way into the account, not just a
 *  confirmation of an address. */
const EMAIL_VERIFICATION_TTL_SECONDS = 60 * 60;

/** Where a confirmed email change lands. */
const SETTINGS_PAGE = '/dashboard/settings';

/**
 * Read the addresses out of a better-auth email-verification token.
 *
 * The `sendVerificationEmail` hook is handed the user with the NEW address
 * already substituted, and never the old one — but the token it comes with is
 * a JWT carrying both (`email` = current, `updateTo` = requested). Naming the
 * outgoing address is what lets the reader tell a change they asked for from
 * one somebody else started on their account, so it is worth digging out.
 *
 * Signature deliberately unchecked: we minted this token microseconds ago and
 * are only reading it to write a sentence. Anything unexpected in the shape
 * returns nothing rather than throwing — a mail that is slightly vaguer beats
 * a mail that never arrives.
 */
function peekVerificationToken(token: string): { email?: string; updateTo?: string } {
  try {
    const payload = token.split('.')[1];
    if (!payload) return {};
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    return {
      email: typeof json.email === 'string' ? json.email : undefined,
      updateTo: typeof json.updateTo === 'string' ? json.updateTo : undefined,
    };
  } catch {
    return {};
  }
}

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
  emailVerification: {
    expiresIn: EMAIL_VERIFICATION_TTL_SECONDS,
    /**
     * Reached only by the change-email flow today (nothing here verifies an
     * address at sign-up). better-auth routes BOTH through this one hook, so
     * it branches on what the token says rather than assuming.
     *
     * ⚠️ Same rebuilt-link rule as `sendResetPassword`: better-auth composes
     * `url` from the origin it infers from the request, which is wrong on a
     * preview deployment and missing entirely on a server-side call. Only the
     * `callbackURL` is carried across.
     */
    sendVerificationEmail: async ({ user, url, token }) => {
      const { email: currentEmail, updateTo } = peekVerificationToken(token);

      if (!updateTo) {
        // A plain address verification. Nothing in the product asks for one
        // yet, and inventing the copy for a flow with no caller would just rot.
        // Loud on purpose: whoever turns on `requireEmailVerification` or
        // `sendOnSignUp` needs to land here and write the template.
        console.error(
          '[auth] sendVerificationEmail reached without an email change to confirm. ' +
            'Plain address verification has no template yet; no mail was sent.'
        );
        return;
      }

      const callbackURL = new URL(url, 'http://parse.invalid').searchParams.get('callbackURL');
      const link =
        `${appUrl()}${AUTH_BASE_PATH}/verify-email` +
        `?token=${encodeURIComponent(token)}` +
        `&callbackURL=${encodeURIComponent(callbackURL || SETTINGS_PAGE)}`;

      const message = changeEmailVerificationEmail({
        url: link,
        name: user.name,
        // `user.email` is already the new address here; the old one comes from
        // the token. If it could not be read, say nothing rather than guess.
        currentEmail: currentEmail ?? '',
        newEmail: updateTo,
        expiresInMinutes: EMAIL_VERIFICATION_TTL_SECONDS / 60,
      });

      // Sent to the NEW address: proving the owner can read it is the whole
      // point, and it is the address the account moves to.
      await sendEmail({ to: updateTo, ...message });
    },
  },
  user: {
    /**
     * ⚠️ The account's email is its POS login too. A confirmed change moves the
     * terminal's sign-in as well as the dashboard's, which is why the mail says
     * so explicitly.
     *
     * `updateEmailWithoutVerification` is left OFF. Every user in this app has
     * `emailVerified: false` (nothing verifies at sign-up), so turning it on
     * would let anyone holding a session move the account to an address they
     * control in one request, with no proof they can read either address —
     * session theft upgraded to account takeover. With it off, better-auth
     * requires the new address to be confirmed before anything is written.
     */
    changeEmail: {
      enabled: true,
    },
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
