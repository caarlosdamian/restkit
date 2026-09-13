import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { markEmailVerified } from '../helpers/verified';

/**
 * Changing the account's sign-in address, end to end, through the real
 * better-auth instance from `lib/auth.ts`.
 *
 * Same reasoning as password-reset.test.ts: every interesting part of this
 * feature is configuration, not code we wrote. Whether `sendVerificationEmail`
 * is reached at all, whether the mail goes to the NEW address, whether the
 * emailed link is one `/verify-email` accepts, and — the load-bearing one —
 * whether the address really is left alone until that link is opened. A unit
 * test of the template would pass with `changeEmail.enabled` switched off.
 */

let server: MongoMemoryServer;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let auth: any;

const PASSWORD = 'contrasena-de-prueba-1';

beforeAll(async () => {
  server = await MongoMemoryServer.create();
  // lib/auth.ts opens its MongoClient at module scope, so the env has to be in
  // place before the import. No RESEND_API_KEY: the log provider is what lets
  // us read the message back.
  process.env.MONGODB_URI = server.getUri('restkit-change-email-test');
  process.env.BETTER_AUTH_SECRET ||= 'test-secret-at-least-32-characters-long';
  process.env.APP_URL = 'https://www.restaurantkit.app';
  delete process.env.RESEND_API_KEY;

  vi.doUnmock('@/lib/auth');
  vi.resetModules();
  ({ auth } = await import('@/lib/auth'));
}, 120_000);

afterAll(async () => {
  await server?.stop();
});

/**
 * Sign up and return the session cookie header `/change-email` needs.
 *
 * Sign-up itself hands back no session now that `requireEmailVerification` is
 * on, so the address is confirmed directly and the session comes from signing
 * in — this file is about moving an address, not about confirming one.
 */
async function signUp(email: string, name = 'Carlos Damián'): Promise<string> {
  await auth.api.signUpEmail({ body: { email, password: PASSWORD, name } });
  await markEmailVerified(email);
  const res = await auth.api.signInEmail({
    body: { email, password: PASSWORD },
    asResponse: true,
  });
  const cookie = res.headers.get('set-cookie');
  expect(cookie, 'sign-in returned no session cookie').toBeTruthy();
  return cookie!;
}

/** Ask for the change and return whatever the email layer printed. */
async function requestChangeAndReadEmail(cookie: string, newEmail: string): Promise<string> {
  const info = vi.spyOn(console, 'info').mockImplementation(() => {});
  try {
    const res = await auth.handler(
      new Request('https://www.restaurantkit.app/api/auth/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({
          newEmail,
          callbackURL: '/dashboard/settings?correo=confirmado',
        }),
      })
    );
    expect(res.status).toBe(200);
    return info.mock.calls.map((c) => String(c[0])).join('\n');
  } finally {
    info.mockRestore();
  }
}

const linkIn = (sent: string) => sent.match(/https?:\/\/\S+/)?.[0];

describe('changing the account email, end to end', () => {
  it('mails the NEW address and only moves the account once the link is opened', async () => {
    const oldEmail = 'duena@negocio.mx';
    const newEmail = 'nueva@negocio.mx';
    const cookie = await signUp(oldEmail);

    const sent = await requestChangeAndReadEmail(cookie, newEmail);

    // Addressed to the new inbox — proving the owner can read it is the point.
    expect(sent).toContain(newEmail);
    expect(sent).toContain('Hola Carlos,');
    // And it names the address being left, which is what tells a reader whether
    // the message is about an account they recognise.
    expect(sent).toContain(oldEmail);

    // ⚠️ Nothing has changed yet. This is the whole security model: every user
    // here has `emailVerified: false`, so if better-auth were configured with
    // `updateEmailWithoutVerification` the account would already have moved.
    await expect(
      auth.api.signInEmail({ body: { email: oldEmail, password: PASSWORD } })
    ).resolves.toBeTruthy();
    await expect(
      auth.api.signInEmail({ body: { email: newEmail, password: PASSWORD } })
    ).rejects.toThrow();

    // ⚠️ ABSOLUTE and on our own domain — better-auth infers the origin from the
    // request and would happily mint a preview-deployment link.
    const link = linkIn(sent);
    expect(link, `no confirmation link in the sent message:\n${sent}`).toBeTruthy();
    expect(link).toMatch(/^https:\/\/www\.restaurantkit\.app\/api\/auth\/verify-email\?/);

    // ...and it RESOLVES: the reassembled path is hardcoded in lib/auth.ts, so
    // only feeding it back through the real handler proves the mail is clickable.
    const opened = await auth.handler(new Request(link!, { headers: { cookie } }));
    expect(opened.status).toBe(302);
    const landing = new URL(opened.headers.get('location')!, 'https://www.restaurantkit.app');
    expect(landing.pathname).toBe('/dashboard/settings');
    expect(landing.searchParams.get('correo')).toBe('confirmado');
    expect(landing.searchParams.get('error')).toBeNull();

    // Now the account has moved — and the password came along untouched.
    await expect(
      auth.api.signInEmail({ body: { email: newEmail, password: PASSWORD } })
    ).resolves.toBeTruthy();
    await expect(
      auth.api.signInEmail({ body: { email: oldEmail, password: PASSWORD } })
    ).rejects.toThrow();
  });

  it('says nothing, and sends nothing, about an address that is already taken', async () => {
    const taken = 'ocupada@negocio.mx';
    await signUp(taken, 'Ana');
    const cookie = await signUp('otra@negocio.mx', 'Luis');

    // ⚠️ Answers success and sends no mail. Reporting "ya está en uso" would
    // turn this form into a "does this address have a RestKit account?" oracle
    // for anyone with a login — the same reasoning that gives /recuperar one
    // success screen.
    const sent = await requestChangeAndReadEmail(cookie, taken);
    expect(sent).not.toContain('verify-email');

    // And the intruder's own account is untouched.
    await expect(
      auth.api.signInEmail({ body: { email: 'otra@negocio.mx', password: PASSWORD } })
    ).resolves.toBeTruthy();
  });

  it('burns the link, so a forwarded email is not a second key', async () => {
    const cookie = await signUp('tercera@negocio.mx', 'Sofía');
    const sent = await requestChangeAndReadEmail(cookie, 'tercera-nueva@negocio.mx');
    const link = linkIn(sent)!;

    const first = await auth.handler(new Request(link, { headers: { cookie } }));
    expect(first.status).toBe(302);

    // Second use: the address it names no longer exists, so better-auth can
    // only redirect with an error — never silently move the account again.
    const second = await auth.handler(new Request(link, { headers: { cookie } }));
    const landing = new URL(
      second.headers.get('location') ?? 'https://www.restaurantkit.app/none',
      'https://www.restaurantkit.app'
    );
    expect(landing.searchParams.get('error')).toBeTruthy();
  });

  it('refuses the address the account already has', async () => {
    const email = 'cuarta@negocio.mx';
    const cookie = await signUp(email, 'Diego');

    const res = await auth.handler(
      new Request('https://www.restaurantkit.app/api/auth/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({ newEmail: email }),
      })
    );
    expect(res.status).toBe(400);
  });

  it('refuses an unauthenticated request outright', async () => {
    const res = await auth.handler(
      new Request('https://www.restaurantkit.app/api/auth/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail: 'cualquiera@negocio.mx' }),
      })
    );
    expect(res.status).toBe(401);
  });
});
