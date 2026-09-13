import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';

/**
 * Opening an account, end to end, through the real better-auth instance.
 *
 * Same reasoning as password-reset.test.ts and change-email.test.ts: the whole
 * feature is configuration, not code we wrote. Whether the mail goes out at
 * sign-up at all, whether the emailed link is one `/verify-email` actually
 * accepts, whether sign-in is genuinely refused before it is opened and
 * genuinely works after — none of that is provable from a unit test of the
 * template, which would pass just as happily with `requireEmailVerification`
 * switched off.
 *
 * ⚠️ The link is fed back through `auth.handler` rather than pattern-matched,
 * because the thing most likely to break is its SHAPE — `lib/auth.ts` rebuilds
 * it from `appUrl()` plus a hardcoded base path, and asserting it "looks right"
 * is exactly the check that would keep passing after that path moved.
 */

let server: MongoMemoryServer;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let auth: any;

const PASSWORD = 'contrasena-de-prueba-1';
const ORIGIN = 'https://www.restaurantkit.app';

beforeAll(async () => {
  server = await MongoMemoryServer.create();
  // lib/auth.ts opens its MongoClient at module scope, so the env has to be in
  // place before the import. No RESEND_API_KEY: the log provider is what lets
  // us read the message back.
  process.env.MONGODB_URI = server.getUri('restkit-signup-verification-test');
  process.env.BETTER_AUTH_SECRET ||= 'test-secret-at-least-32-characters-long';
  process.env.APP_URL = ORIGIN;
  delete process.env.RESEND_API_KEY;

  vi.doUnmock('@/lib/auth');
  vi.resetModules();
  ({ auth } = await import('@/lib/auth'));
}, 120_000);

afterAll(async () => {
  await server?.stop();
});

/** Sign up and return whatever the email layer printed. */
async function signUpAndReadEmail(email: string, name = 'Carlos Damián'): Promise<string> {
  const info = vi.spyOn(console, 'info').mockImplementation(() => {});
  try {
    await auth.api.signUpEmail({ body: { email, password: PASSWORD, name } });
    return info.mock.calls.map((c) => String(c[0])).join('\n');
  } finally {
    info.mockRestore();
  }
}

function linkFrom(mail: string): string {
  const match = mail.match(/https:\/\/\S*verify-email\S*/);
  expect(match, 'no verification link in the message').toBeTruthy();
  return match![0].replace(/[.,)]+$/, '');
}

const signIn = (email: string) =>
  auth.api.signInEmail({ body: { email, password: PASSWORD }, asResponse: true });

describe('opening an account, end to end', () => {
  it('will not let a new account in until the emailed link is opened', async () => {
    const email = 'nuevo@restaurantkit.app';

    const mail = await signUpAndReadEmail(email);

    // Sign-up hands back no session: the confirmation link is the only way in.
    const refused = await signIn(email);
    expect(refused.status).toBe(403);

    // The link better-auth composed is not the one we send — ours is rebuilt on
    // appUrl(), so a preview deployment cannot mint a link on its own host.
    const link = linkFrom(mail);
    expect(link.startsWith(`${ORIGIN}/api/auth/verify-email`)).toBe(true);

    // Feed it back through the real handler.
    const opened = await auth.handler(new Request(link, { redirect: 'manual' }));
    expect(opened.status).toBeGreaterThanOrEqual(300);
    expect(opened.status).toBeLessThan(400);
    expect(opened.headers.get('location')).toContain('/dashboard');
    // autoSignInAfterVerification: they arrive signed in, not at a login form.
    expect(opened.headers.get('set-cookie')).toBeTruthy();

    // And now the password they chose works.
    const allowed = await signIn(email);
    expect(allowed.status).toBe(200);
  });

  it('addresses the mail to the new account and never puts the token in the subject', async () => {
    const email = 'asunto@restaurantkit.app';
    const mail = await signUpAndReadEmail(email, 'Ana Sofía');

    expect(mail).toContain(email);
    expect(mail).toContain('Ana');
    // Subjects render on lock screens.
    const subject = mail.match(/Subject: (.*)/)?.[1] ?? '';
    expect(subject.length).toBeGreaterThan(0);
    expect(subject).not.toContain('token');
    expect(subject.toLowerCase()).not.toContain('http');
  });

  it('hands out a session on the first open only, so a forwarded link is not a key', async () => {
    const email = 'una-vez@restaurantkit.app';
    const link = linkFrom(await signUpAndReadEmail(email));

    // ⚠️ The URL keeps redirecting after it has been used — it does NOT start
    // erroring, which is the obvious thing to assert and would be wrong. What
    // actually protects the account is narrower: only the first open is given a
    // session cookie. That is why the copy says not to forward the mail, and it
    // is the property to hold onto if this ever gets reworked.
    const first = await auth.handler(new Request(link, { redirect: 'manual' }));
    expect(first.headers.get('location')).toContain('/dashboard');
    expect(first.headers.get('set-cookie'), 'first open should sign them in').toBeTruthy();

    const second = await auth.handler(new Request(link, { redirect: 'manual' }));
    expect(second.headers.get('set-cookie'), 'a reused link must not sign anyone in').toBeFalsy();
  });

  it('leaves the account unverified and unusable if the link is never opened', async () => {
    const email = 'ignorado@restaurantkit.app';
    await signUpAndReadEmail(email);

    const client = new MongoClient(process.env.MONGODB_URI!);
    await client.connect();
    const row = await client.db().collection('user').findOne({ email });
    await client.close();

    expect(row, 'the user row should exist even before confirmation').toBeTruthy();
    expect(row!.emailVerified).toBeFalsy();
    expect((await signIn(email)).status).toBe(403);
  });
});
