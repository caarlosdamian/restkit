import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * The forgotten-password flow, end to end, through the real better-auth
 * instance from `lib/auth.ts` — not a mock of it.
 *
 * Worth the setup cost because every interesting part of this feature lives in
 * configuration rather than in code we wrote: whether `sendResetPassword` is
 * reached at all, whether the token in the emailed link is the one
 * `/reset-password` accepts, and whether `revokeSessionsOnPasswordReset`
 * actually ends the sessions it promises to. A unit test of our own helpers
 * would pass with the whole thing switched off.
 */

let server: MongoMemoryServer;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let auth: any;

const EMAIL = 'duena@negocio.mx';
const OLD_PASSWORD = 'contrasena-vieja-1';
const NEW_PASSWORD = 'contrasena-nueva-2';

beforeAll(async () => {
  server = await MongoMemoryServer.create();
  // lib/auth.ts opens its MongoClient at module scope, so the env has to be in
  // place before the import — hence the dynamic import rather than a top-level
  // one. No RESEND_API_KEY: the log provider is what lets us read the message.
  process.env.MONGODB_URI = server.getUri('restkit-auth-test');
  process.env.BETTER_AUTH_SECRET ||= 'test-secret-at-least-32-characters-long';
  process.env.APP_URL = 'https://www.restaurantkit.app';
  delete process.env.RESEND_API_KEY;

  // tests/setup.ts replaces @/lib/auth with a session stub for every other
  // suite — this is the one that needs the real thing.
  vi.doUnmock('@/lib/auth');
  vi.resetModules();
  ({ auth } = await import('@/lib/auth'));
}, 120_000);

afterAll(async () => {
  await server?.stop();
});

/** Runs the request and returns whatever the email layer printed. */
async function requestResetAndReadEmail(email: string): Promise<string> {
  const info = vi.spyOn(console, 'info').mockImplementation(() => {});
  try {
    await auth.api.requestPasswordReset({ body: { email, redirectTo: '/restablecer' } });
    return info.mock.calls.map((c) => String(c[0])).join('\n');
  } finally {
    info.mockRestore();
  }
}

describe('forgotten password, end to end', () => {
  it('takes an owner from "olvidé mi contraseña" to a working new one', async () => {
    await auth.api.signUpEmail({
      body: { email: EMAIL, password: OLD_PASSWORD, name: 'Carlos Damián' },
    });

    const sent = await requestResetAndReadEmail(EMAIL);

    // The message went out, addressed to them, greeting them by first name.
    expect(sent).toContain(EMAIL);
    expect(sent).toContain('Hola Carlos,');

    // ⚠️ ABSOLUTE, and on our own domain. better-auth builds this link from
    // the origin and base path it infers, and infers neither when there is no
    // incoming request — which yielded a bare `/reset-password/…`: unclickable
    // in an inbox, and invisible until a real customer needed it.
    const link = sent.match(/https?:\/\/\S+/)?.[0];
    expect(link, `no reset link in the sent message:\n${sent}`).toBeTruthy();
    expect(link).toMatch(/^https:\/\/www\.restaurantkit\.app\/api\/auth\/reset-password\//);

    // ⚠️ And it RESOLVES. lib/auth.ts reassembles this path from a hardcoded
    // base path, so asserting its shape only proves it matches itself. Feeding
    // it back through the real handler is what proves the link in the email
    // actually opens — it must answer a redirect to the page that finishes the
    // reset, carrying the token.
    const opened = await auth.handler(new Request(link!));
    expect(opened.status).toBe(302);
    const landing = new URL(opened.headers.get('location')!, 'https://www.restaurantkit.app');
    expect(landing.pathname).toBe('/restablecer');

    const token = landing.searchParams.get('token')!;
    expect(token).toBeTruthy();

    const result = await auth.api.resetPassword({ body: { newPassword: NEW_PASSWORD, token } });
    expect(result).toMatchObject({ status: true });

    // The new password works...
    await expect(
      auth.api.signInEmail({ body: { email: EMAIL, password: NEW_PASSWORD } }),
    ).resolves.toBeTruthy();

    // ...and the old one is genuinely gone, not merely deprioritised.
    await expect(
      auth.api.signInEmail({ body: { email: EMAIL, password: OLD_PASSWORD } }),
    ).rejects.toThrow();
  });

  it('burns the token, so a forwarded email is not a second key', async () => {
    const email = 'segunda@negocio.mx';
    await auth.api.signUpEmail({ body: { email, password: OLD_PASSWORD, name: 'Ana' } });

    const sent = await requestResetAndReadEmail(email);
    const token = sent.match(/\/reset-password\/(\S+?)\?/)![1];

    await auth.api.resetPassword({ body: { newPassword: NEW_PASSWORD, token } });
    await expect(
      auth.api.resetPassword({ body: { newPassword: 'otra-contrasena-3', token } }),
    ).rejects.toThrow();
  });

  it('rejects a password under the shared minimum', async () => {
    const email = 'tercera@negocio.mx';
    await auth.api.signUpEmail({ body: { email, password: OLD_PASSWORD, name: 'Luis' } });

    const sent = await requestResetAndReadEmail(email);
    const token = sent.match(/\/reset-password\/(\S+?)\?/)![1];

    // MIN_PASSWORD_LENGTH is 8; the reset page shows that number and this is
    // the server that enforces it. Both read the same constant.
    await expect(auth.api.resetPassword({ body: { newPassword: 'corta', token } })).rejects.toThrow();
  });

  it('says nothing about an address that has no account', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      // ⚠️ Must not throw and must not send: the response an attacker sees is
      // identical either way, which is the only thing keeping this public form
      // from being a "does this email have a RestKit account?" service.
      await expect(
        auth.api.requestPasswordReset({ body: { email: 'nadie@ejemplo.mx', redirectTo: '/restablecer' } }),
      ).resolves.toBeTruthy();
      expect(info.mock.calls.join('\n')).not.toContain('reset-password/');
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('signs every device out, the POS terminal included', async () => {
    const email = 'cuarta@negocio.mx';
    await auth.api.signUpEmail({ body: { email, password: OLD_PASSWORD, name: 'Sofía' } });

    // Stand in for the terminal that has been signed in since the shift began.
    const terminal = await auth.api.signInEmail({
      body: { email, password: OLD_PASSWORD },
      returnHeaders: true,
    });
    const cookie = terminal.headers.get('set-cookie')!;
    const headers = new Headers({ cookie: cookie.split(';')[0] });

    expect(await auth.api.getSession({ headers })).toBeTruthy();

    const sent = await requestResetAndReadEmail(email);
    const token = sent.match(/\/reset-password\/(\S+?)\?/)![1];
    await auth.api.resetPassword({ body: { newPassword: NEW_PASSWORD, token } });

    // A reset that left the attacker's session alive would reset nothing.
    expect(await auth.api.getSession({ headers })).toBeNull();
  });
});
