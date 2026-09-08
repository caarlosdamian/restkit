import QRCode from 'qrcode';

/**
 * QR codes are generated locally. They used to come from api.qrserver.com,
 * which put a third-party HTTP call on the path of a core loyalty surface —
 * and it failed silently whenever the restaurant's connection blipped.
 */

/** Inline SVG markup, for embedding straight into a page or a receipt. */
export async function qrSvg(data: string, size = 200): Promise<string> {
  return QRCode.toString(data, {
    type: 'svg',
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
  });
}

/** A data: URI, for an <img> or a printed ticket. */
export async function qrDataUrl(data: string, size = 200): Promise<string> {
  return QRCode.toDataURL(data, {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  });
}
