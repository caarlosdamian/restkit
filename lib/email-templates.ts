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

export function resetPasswordEmail(params: {
  url: string;
  name?: string | null;
  expiresInMinutes: number;
}): Omit<EmailMessage, 'to'> {
  const { url, expiresInMinutes } = params;
  const name = (params.name ?? '').trim().split(' ')[0];
  const greeting = name ? `Hola ${esc(name)},` : 'Hola,';
  const expiry =
    expiresInMinutes >= 60
      ? `${Math.round(expiresInMinutes / 60)} hora${Math.round(expiresInMinutes / 60) === 1 ? '' : 's'}`
      : `${expiresInMinutes} minutos`;

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

  const html = `<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:0;background-color:#f9fafb;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9fafb;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:16px;">
          <tr>
            <td style="padding:32px 32px 8px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
              <div style="font-size:18px;font-weight:700;letter-spacing:-0.02em;color:${INK};">RestKit</div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:${INK};">
              <p style="margin:0 0 16px 0;">${greeting}</p>
              <p style="margin:0 0 24px 0;">Recibimos una solicitud para restablecer la contraseña de tu cuenta. Elige una nueva desde aquí:</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="border-radius:10px;background-color:${BRAND};">
                    <a href="${esc(url)}" style="display:inline-block;padding:12px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">Elegir nueva contraseña</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 0 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:${MUTED};">
              <p style="margin:0 0 16px 0;">El enlace vence en ${esc(expiry)} y sólo sirve una vez. Si el botón no abre, copia y pega esta dirección:</p>
              <p style="margin:0 0 16px 0;word-break:break-all;"><a href="${esc(url)}" style="color:${BRAND};text-decoration:underline;">${esc(url)}</a></p>
              <p style="margin:0 0 16px 0;">Al cambiarla se cierran todas las sesiones abiertas, así que vas a tener que volver a iniciar sesión en la terminal del punto de venta.</p>
              <p style="margin:0;">Si no fuiste tú, puedes ignorar este correo: tu contraseña no cambia hasta que alguien abra el enlace y escriba una nueva.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 32px 32px;">
              <div style="border-top:1px solid #e5e7eb;padding-top:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:${MUTED};">RestKit — punto de venta y fidelización para restaurantes</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

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
