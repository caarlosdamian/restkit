import { appUrl } from './app-url';

/**
 * Outbound transactional email.
 *
 * One function, two providers, chosen by what is configured — so the same call
 * site works on a laptop with no account and on Vercel with a real one:
 *
 *  1. **Resend** when `RESEND_API_KEY` is set. Free tier is 3,000 emails/month
 *     (100/day), which is orders of magnitude more than password resets for a
 *     few hundred restaurants. Called over plain `fetch` rather than the SDK:
 *     it is one POST, and a dependency that ships its own runtime detection is
 *     exactly the kind of thing that broke `sharp` on Turbopack.
 *  2. **The log**, otherwise. `npm run dev` prints the whole message, reset
 *     link included, so the forgotten-password flow is testable end to end
 *     with no account, no domain and no key.
 *
 * ⚠️ **This never throws.** Every caller is inside an auth flow, and an email
 * provider having a bad minute must not turn a password reset into a 500 — or,
 * worse, into a response that differs from the one an unknown address gets,
 * which is how "does this email have an account?" becomes a public API. A
 * failure is logged loudly and reported in the return value; it is not raised.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  /** Always send one. A text/plain part is what keeps a message out of spam
   *  filters that score html-only mail, and it is what a watch renders. */
  text: string;
}

export interface EmailResult {
  ok: boolean;
  provider: 'resend' | 'log';
  id?: string;
  error?: string;
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
/** A hung provider must not hold a serverless function open to its timeout. */
const TIMEOUT_MS = 10_000;

/**
 * The From address.
 *
 * Defaults to `no-reply@<the app's own domain>` because that is the domain the
 * owner verifies at the provider — there is nothing else it could be. The
 * `www.` is stripped: mail is authenticated (SPF/DKIM) against the registrable
 * domain, and `no-reply@www.restaurantkit.app` is a different, unverified one.
 */
export function emailFrom(): string {
  const explicit = process.env.EMAIL_FROM?.trim();
  if (explicit) return explicit;
  const host = new URL(appUrl()).hostname.replace(/^www\./i, '');
  return `RestKit <no-reply@${host}>`;
}

export function emailProvider(): 'resend' | 'log' {
  return process.env.RESEND_API_KEY?.trim() ? 'resend' : 'log';
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const provider = emailProvider();
  if (provider === 'log') return logEmail(message);

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: emailFrom(),
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    // Resend puts the reason in the body, and the reason is nearly always one
    // of two fixable things: an unverified sending domain, or a key from the
    // wrong account. Logging just the status hides both.
    const body = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;

    if (!res.ok) {
      const detail = body?.message ?? `HTTP ${res.status}`;
      console.error(`[email] Resend refused a message to ${redact(message.to)}: ${detail}`);
      return { ok: false, provider, error: detail };
    }

    return { ok: true, provider, id: body?.id };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[email] Could not reach Resend for ${redact(message.to)}: ${detail}`);
    return { ok: false, provider, error: detail };
  }
}

/**
 * No provider configured.
 *
 * In development this is the feature: the link is right there in the terminal.
 * In production it is a misconfiguration that silently strands every owner who
 * forgets their password, so it is logged as an error naming the variable to
 * set — the response the browser gets cannot say so without leaking which
 * addresses have accounts.
 */
function logEmail(message: EmailMessage): EmailResult {
  if (process.env.NODE_ENV === 'production') {
    console.error(
      `[email] RESEND_API_KEY is not set — "${message.subject}" was NOT delivered to ${redact(message.to)}. ` +
        'Password resets are silently failing for every user.'
    );
    return { ok: false, provider: 'log', error: 'RESEND_API_KEY is not set' };
  }

  console.info(
    ['', '─'.repeat(72), `[email:log] To: ${message.to}`, `Subject: ${message.subject}`, '', message.text, '─'.repeat(72), ''].join(
      '\n'
    )
  );
  return { ok: true, provider: 'log' };
}

/** Enough to identify the recipient in a log without printing the address. */
function redact(address: string): string {
  const [user, domain] = address.split('@');
  if (!domain) return '***';
  return `${user.slice(0, 2)}***@${domain}`;
}
