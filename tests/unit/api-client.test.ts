import { describe, it, expect } from 'vitest';
import { readJson } from '@/lib/api-client';

/**
 * The bug this exists for: clicking "Elegir plan" showed
 * "Failed to execute 'json' on 'Response': Unexpected end of JSON input".
 * That is the PARSER failing, not the server — and it replaced whatever the
 * server was actually trying to say.
 */
describe('reading a response that may not be JSON at all', () => {
  const res = (body: string, status = 200) =>
    new Response(body, { status, headers: { 'Content-Type': 'application/json' } });

  it('returns the payload on success', async () => {
    const { data, error } = await readJson<{ url: string }>(res('{"url":"https://checkout.test/s"}'));
    expect(error).toBeNull();
    expect(data?.url).toBe('https://checkout.test/s');
  });

  it('surfaces the server’s own message on an error status', async () => {
    const { error } = await readJson(res('{"error":"Precio no configurado"}', 500));
    expect(error).toBe('Precio no configurado');
  });

  it('says what happened when the body is EMPTY', async () => {
    // An uncaught throw in a route handler answers exactly like this. The old
    // code threw a JSON parse error here and lost the status entirely.
    const { data, error } = await readJson(new Response('', { status: 500 }));
    expect(data).toBeNull();
    expect(error).toContain('500');
    expect(error).not.toMatch(/JSON/i);
  });

  it('says what happened when the body is HTML', async () => {
    // A proxy or platform error page. Tags stripped so the message is readable.
    const { error } = await readJson(new Response('<html><body>502 Bad Gateway</body></html>', { status: 502 }));
    expect(error).toContain('502');
    expect(error).not.toContain('<');
  });

  it('treats an empty 200 as a failure, not a success', async () => {
    // `!res.ok || !data.url` used to be the only guard, so a 200 with no body
    // fell through to `data.url` on null and threw a TypeError.
    const { data, error } = await readJson<{ url: string }>(new Response('', { status: 200 }));
    expect(data).toBeNull();
    expect(error).toBeTruthy();
  });
});
