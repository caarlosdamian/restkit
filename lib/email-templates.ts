import type { EmailMessage } from './email';

/**
 * The messages we send, as data.
 *
 * Kept apart from the transport so the wording is testable without a provider,
 * a key or a network — and so the html and the text part can never drift into
 * saying different things, which is the classic way a reset link ends up
 * correct in one half of a message and stale in the other.
 *
 * House rules for anything added here:
 *  - **Inline styles, table layout, no external assets.** Gmail strips `<style>`
 *    blocks and `<svg>`, Outlook ignores `flex` and `border-radius` on `<a>`.
 *    A logo would have to be a hosted PNG, and a blocked image is worse than
 *    the wordmark set in type.
 *  - **Never put a token in a subject line.** Subjects are what shows on a lock
 *    screen and what mail clients sync into notification previews.
 *  - **Escape everything interpolated.** `user.name` is typed by the user.
 */

const BRAND = '#10b981';
const INK = '#111827';
const MUTED = '#6b7280';

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

/** "Hola Carlos," / "Hola," — first name only, and never a bare "Hola  ,". */
function greetingFor(name?: string | null): string {
  const first = (name ?? '').trim().split(' ')[0];
  return first ? `Hola ${esc(first)},` : 'Hola,';
}

/** A duration a person would say out loud, not "60 minutos". */
function expiryPhrase(minutes: number): string {
  if (minutes < 60) return `${minutes} minutos`;
  const hours = Math.round(minutes / 60);
  return `${hours} hora${hours === 1 ? '' : 's'}`;
}

/**
 * The chrome every message shares: grey ground, white card, wordmark set in
 * type, sign-off rule. Extracted when the second message arrived — two copies
 * of forty lines of table markup is how one of them quietly stops matching the
 * other. Only the middle changes.
 */
function shell(inner: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:0;background-color:#f9fafb;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9fafb;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:16px;">
          <tr>
            <td style="padding:32px 32px 8px 32px;font-family:${FONT};">
              <div style="font-size:18px;font-weight:700;letter-spacing:-0.02em;color:${INK};">RestKit</div>
            </td>
          </tr>
${inner}
          <tr>
            <td style="padding:24px 32px 32px 32px;">
              <div style="border-top:1px solid #e5e7eb;padding-top:16px;font-family:${FONT};font-size:12px;color:${MUTED};">RestKit — punto de venta y fidelización para restaurantes</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Lead paragraphs, in the card's body type. */
function lead(paragraphs: string[]): string {
  return `          <tr>
            <td style="padding:16px 32px 0 32px;font-family:${FONT};font-size:15px;line-height:1.6;color:${INK};">
${paragraphs.map((p, i) => `              <p style="margin:0 0 ${i === paragraphs.length - 1 ? 24 : 16}px 0;">${p}</p>`).join('\n')}
            </td>
          </tr>`;
}

/** Outlook ignores border-radius on an <a>, so the pill is a table cell. */
function button(url: string, label: string): string {
  return `          <tr>
            <td style="padding:0 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="border-radius:10px;background-color:${BRAND};">
                    <a href="${esc(url)}" style="display:inline-block;padding:12px 24px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${label}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

/** The small print under the button. `wrap` is for the raw-URL line, which is
 *  long and unbreakable and otherwise blows the card out sideways. */
function footnotes(items: Array<{ html: string; wrap?: boolean }>): string {
  return `          <tr>
            <td style="padding:24px 32px 0 32px;font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED};">
${items
  .map(
    (item, i) =>
      `              <p style="margin:0 0 ${i === items.length - 1 ? 0 : 16}px 0;${item.wrap ? 'word-break:break-all;' : ''}">${item.html}</p>`
  )
  .join('\n')}
            </td>
          </tr>`;
}

export function resetPasswordEmail(params: {
  url: string;
  name?: string | null;
  expiresInMinutes: number;
}): Omit<EmailMessage, 'to'> {
  const { url, expiresInMinutes } = params;
  const greeting = greetingFor(params.name);
  const expiry = expiryPhrase(expiresInMinutes);

  const subject = 'Restablece tu contraseña de RestKit';

  // The plain-text part is not a fallback nobody reads — it is what lands in
  // spam-scored clients and what the dev-mode log prints, so it carries the
  // whole message, link included.
  const text = [
    greeting,
    '',
    'Recibimos una solicitud para restablecer la contraseña de tu cuenta de RestKit.',
    'Abre este enlace para elegir una nueva:',
    '',
    url,
    '',
    `El enlace vence en ${expiry} y sólo sirve una vez.`,
    '',
    'Al cambiarla se cierran todas las sesiones abiertas, así que vas a tener que',
    'volver a iniciar sesión en la terminal del punto de venta.',
    '',
    'Si no fuiste tú, ignora este correo: tu contraseña no cambia hasta que alguien',
    'abra el enlace y escriba una nueva.',
    '',
    '— RestKit',
  ].join('\n');

  const html = shell(
    [
      lead([
        greeting,
        'Recibimos una solicitud para restablecer la contraseña de tu cuenta. Elige una nueva desde aquí:',
      ]),
      button(url, 'Elegir nueva contraseña'),
      footnotes([
        {
          html: `El enlace vence en ${esc(expiry)} y sólo sirve una vez. Si el botón no abre, copia y pega esta dirección:`,
        },
        {
          html: `<a href="${esc(url)}" style="color:${BRAND};text-decoration:underline;">${esc(url)}</a>`,
          wrap: true,
        },
        {
          html: 'Al cambiarla se cierran todas las sesiones abiertas, así que vas a tener que volver a iniciar sesión en la terminal del punto de venta.',
        },
        {
          html: 'Si no fuiste tú, puedes ignorar este correo: tu contraseña no cambia hasta que alguien abra el enlace y escriba una nueva.',
        },
      ]),
    ].join('\n')
  );

  return { subject, html, text };
}

/**
 * Confirm a new sign-in address.
 *
 * ⚠️ **This goes to the NEW address, and opening the link signs the reader in.**
 * better-auth's `/verify-email` creates a session when the browser opening it
 * has none — which is what makes the flow work from a phone, and what makes the
 * link a credential. Hence the short TTL, and hence the warning in the copy:
 * whoever holds this mail holds the account.
 *
 * The old address is deliberately named in the body. It is the one thing that
 * tells a reader whether the message is about an account they recognise, and
 * without it a change request they did not make looks like ordinary spam.
 */
export function changeEmailVerificationEmail(params: {
  url: string;
  name?: string | null;
  /** The address currently on the account — what this mail is moving away from. */
  currentEmail: string;
  /** Where it is moving to. This message's own recipient. */
  newEmail: string;
  expiresInMinutes: number;
}): Omit<EmailMessage, 'to'> {
  const { url, currentEmail, newEmail, expiresInMinutes } = params;
  const greeting = greetingFor(params.name);
  const expiry = expiryPhrase(expiresInMinutes);

  // No address in the subject: subjects render on lock screens, and this one is
  // read by whoever picks the phone up.
  const subject = 'Confirma tu nuevo correo de RestKit';

  const text = [
    greeting,
    '',
    `Pediste cambiar el correo de tu cuenta de RestKit de ${currentEmail} a ${newEmail}.`,
    'Abre este enlace para confirmarlo:',
    '',
    url,
    '',
    `El enlace vence en ${expiry} y sólo sirve una vez.`,
    '',
    'Hasta que lo abras, sigues entrando con tu correo anterior. Después de',
    `confirmarlo, ${newEmail} será tu usuario para iniciar sesión — en el panel y`,
    'en la terminal del punto de venta. Tu contraseña no cambia.',
    '',
    'Si no pediste esto, ignora este correo y avísale a quien administra la cuenta:',
    'alguien con la sesión abierta intentó moverla a esta dirección.',
    '',
    '— RestKit',
  ].join('\n');

  const html = shell(
    [
      lead([
        greeting,
        `Pediste cambiar el correo de tu cuenta de <strong style="color:${INK};">${esc(currentEmail)}</strong> a <strong style="color:${INK};">${esc(newEmail)}</strong>. Confírmalo desde aquí:`,
      ]),
      button(url, 'Confirmar este correo'),
      footnotes([
        {
          html: `El enlace vence en ${esc(expiry)} y sólo sirve una vez. Si el botón no abre, copia y pega esta dirección:`,
        },
        {
          html: `<a href="${esc(url)}" style="color:${BRAND};text-decoration:underline;">${esc(url)}</a>`,
          wrap: true,
        },
        {
          html: `Hasta que lo abras, sigues entrando con tu correo anterior. Después de confirmarlo, ${esc(newEmail)} será tu usuario para iniciar sesión, en el panel y en la terminal del punto de venta. Tu contraseña no cambia.`,
        },
        {
          html: 'Si no pediste esto, ignora este correo y avísale a quien administra la cuenta: alguien con la sesión abierta intentó moverla a esta dirección.',
        },
      ]),
    ].join('\n')
  );

  return { subject, html, text };
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
