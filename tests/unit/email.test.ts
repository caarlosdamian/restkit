import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sendEmail, emailFrom, emailProvider } from '@/lib/email';
import { resetPasswordEmail } from '@/lib/email-templates';

/**
 * The email layer is the one part of the reset flow with no user-visible
 * failure mode: the response is identical whether the message went out or
 * not (deliberately — see lib/email.ts), so a break here is silent in
 * production and only these tests stand between it and a stranded owner.
 */

const ENV = { ...process.env };

beforeEach(() => {
  vi.unstubAllGlobals();
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  delete process.env.APP_URL;
});

afterEach(() => {
  process.env = { ...ENV };
  vi.restoreAllMocks();
});

const message = { to: 'duena@negocio.mx', subject: 'Hola', html: '<p>Hola</p>', text: 'Hola' };

describe('choosing a provider', () => {
  it('falls back to the log when no key is configured', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    expect(emailProvider()).toBe('log');

    const result = await sendEmail(message);
    // `ok` on purpose: with no key, dev is the intended mode, and a form that
    // reported failure there would send someone hunting a bug that isn't one.
    expect(result).toMatchObject({ ok: true, provider: 'log' });
  });

  it('prints the whole message, link included, so dev needs no account', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    await sendEmail({ ...message, text: 'Abre https://restkit.test/api/auth/reset-password/abc123' });
    expect(info.mock.calls[0][0]).toContain('reset-password/abc123');
  });

  it('treats a missing key in production as the outage it is', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('NODE_ENV', 'production');

    const result = await sendEmail(message);
    expect(result.ok).toBe(false);
    // Names the variable to set: nothing else in production will say so.
    expect(error.mock.calls[0][0]).toContain('RESEND_API_KEY');
    // And never prints the address in full.
    expect(error.mock.calls[0][0]).not.toContain('duena@negocio.mx');
  });
});

describe('sending through Resend', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 'test_key';
    process.env.APP_URL = 'https://www.restaurantkit.app';
  });

  it('posts the message and returns the provider id', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'msg_1' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendEmail(message);
    expect(result).toMatchObject({ ok: true, provider: 'resend', id: 'msg_1' });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test_key');

    const body = JSON.parse(init.body as string);
    expect(body.to).toEqual(['duena@negocio.mx']);
    // Both parts, always — an html-only message scores as spam.
    expect(body.html).toBeTruthy();
    expect(body.text).toBeTruthy();
  });

  it('surfaces the reason Resend refused, which is the fix', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ message: 'The restaurantkit.app domain is not verified' }), { status: 403 })),
    );

    const result = await sendEmail(message);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('not verified');
    expect(error.mock.calls[0][0]).toContain('not verified');
  });

  it('never throws when the provider is unreachable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));

    // The caller is inside an auth flow. A raised error here would turn a
    // password reset into a 500 — and a 500 for real addresses only is an
    // account-enumeration oracle.
    await expect(sendEmail(message)).resolves.toMatchObject({ ok: false });
  });
});

describe('the From address', () => {
  it('drops www., because that is a different domain to verify', () => {
    process.env.APP_URL = 'https://www.restaurantkit.app';
    expect(emailFrom()).toBe('RestKit <no-reply@restaurantkit.app>');
  });

  it('yields to an explicit EMAIL_FROM', () => {
    process.env.APP_URL = 'https://www.restaurantkit.app';
    process.env.EMAIL_FROM = 'Soporte RestKit <hola@restaurantkit.app>';
    expect(emailFrom()).toBe('Soporte RestKit <hola@restaurantkit.app>');
  });
});

describe('the reset email', () => {
  const url = 'https://www.restaurantkit.app/api/auth/reset-password/tok_abc?callbackURL=%2Frestablecer';

  it('carries the link in both parts', () => {
    const mail = resetPasswordEmail({ url, name: 'Carlos Damián', expiresInMinutes: 60 });
    expect(mail.text).toContain(url);
    expect(mail.html).toContain('href="' + url.replace(/&/g, '&amp;'));
  });

  it('keeps the token out of the subject line', () => {
    // Subjects show on lock screens and sync into notification previews.
    const mail = resetPasswordEmail({ url, name: null, expiresInMinutes: 60 });
    expect(mail.subject).not.toContain('tok_abc');
  });

  it('greets by first name, and copes without one', () => {
    expect(resetPasswordEmail({ url, name: 'Carlos Damián', expiresInMinutes: 60 }).text).toContain('Hola Carlos,');
    expect(resetPasswordEmail({ url, name: null, expiresInMinutes: 60 }).text).toContain('Hola,');
    expect(resetPasswordEmail({ url, name: '   ', expiresInMinutes: 60 }).text).toContain('Hola,');
  });

  it('escapes a name, which is typed by the user', () => {
    const mail = resetPasswordEmail({ url, name: '<script>alert(1)</script>', expiresInMinutes: 60 });
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
  });

  it('warns that the POS terminal will be signed out', () => {
    // revokeSessionsOnPasswordReset is on. Someone mid-shift deserves to know
    // before it happens, not when the register stops responding.
    const mail = resetPasswordEmail({ url, name: 'Ana', expiresInMinutes: 60 });
    expect(mail.text).toMatch(/punto de venta/);
    expect(mail.html).toMatch(/punto de venta/);
  });

  it('says how long the link lasts, in words a person uses', () => {
    expect(resetPasswordEmail({ url, name: null, expiresInMinutes: 60 }).text).toContain('1 hora');
    expect(resetPasswordEmail({ url, name: null, expiresInMinutes: 120 }).text).toContain('2 horas');
    expect(resetPasswordEmail({ url, name: null, expiresInMinutes: 30 }).text).toContain('30 minutos');
  });

  it('is a complete html document with no external assets', () => {
    const mail = resetPasswordEmail({ url, name: null, expiresInMinutes: 60 });
    expect(mail.html).toMatch(/^<!DOCTYPE html>/);
    // Gmail strips <style> and <svg>; a blocked <img> is worse than no image.
    expect(mail.html).not.toMatch(/<style|<svg|<img/i);
  });
});
