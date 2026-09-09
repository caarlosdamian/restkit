/**
 * Reads a JSON response without assuming there is one.
 *
 * ⚠️ **`await res.json()` on an empty body throws "Unexpected end of JSON
 * input"**, and that parser error then REPLACES the real failure — the owner
 * clicking "Elegir plan" was shown a JavaScript message about JSON while the
 * actual cause (an unset STRIPE_SECRET_KEY, say) was never surfaced anywhere
 * they could see it. A body-less 500 is exactly what an uncaught throw in a
 * route handler produces, and a platform-level failure (502, a timeout) has no
 * body either.
 *
 * So: read the text, parse it only if there is any, and when there isn't, say
 * what the server actually answered.
 */
export async function readJson<T>(res: Response): Promise<{ data: T | null; error: string | null }> {
  const raw = await res.text().catch(() => '');

  let data: T | null = null;
  if (raw) {
    try {
      data = JSON.parse(raw) as T;
    } catch {
      // HTML (an error page, a proxy) or plain text. Keep the first line: it is
      // usually the only human-readable part.
      const snippet = raw.replace(/<[^>]*>/g, ' ').trim().split('\n')[0].slice(0, 140);
      return { data: null, error: snippet || `El servidor respondió ${res.status} con contenido no válido.` };
    }
  }

  const message = (data as { error?: string } | null)?.error;
  if (!res.ok) {
    return { data, error: message || `El servidor respondió ${res.status} sin detalle.` };
  }
  if (!raw) {
    return { data: null, error: `El servidor respondió ${res.status} sin contenido.` };
  }
  return { data, error: message ?? null };
}
