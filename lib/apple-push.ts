import * as http2 from 'http2';

/**
 * Silent "come and re-fetch your pass" pushes to Apple Wallet.
 *
 * ⚠️ **Every call here must be bounded and must be awaited by someone.**
 * This used to open a fresh TLS/HTTP2 session per device token with no timeout,
 * fired from an un-awaited `.then()` chain. On a serverless runtime the instance
 * freezes the moment the response is sent, so that work was cut off part-done —
 * which is why a manually recorded visit took minutes to reach the customer's
 * phone, or never arrived at all. See `syncWallet` in services/loyalty.service.ts.
 */

/** A stalled APNs connection must not outlive the request that started it.
 *  Measured handshake to api.push.apple.com is ~120-180ms, so 5s is generous. */
const APNS_TIMEOUT_MS = 5_000;

export interface PushResult {
  pushToken: string;
  ok: boolean;
  error?: string;
}

interface ApnsConfig {
  host: string;
  passTypeId: string;
  cert: Buffer;
  key: Buffer;
  passphrase?: string;
}

/** Null when the deployment carries no PassKit credentials — local dev and the
 *  test suite both run that way, and a missing cert is not an error there. */
function apnsConfig(): ApnsConfig | null {
  const passTypeId = process.env.APPLE_PASS_TYPE_IDENTIFIER;
  const certB64 = process.env.APPLE_SIGNER_CERT_BASE64;
  const keyB64 = process.env.APPLE_SIGNER_KEY_BASE64;
  if (!passTypeId || !certB64 || !keyB64) return null;

  return {
    host:
      process.env.APPLE_PASS_ENV === 'production'
        ? 'api.push.apple.com'
        : 'api.sandbox.push.apple.com',
    passTypeId,
    cert: Buffer.from(certB64, 'base64'),
    key: Buffer.from(keyB64, 'base64'),
    passphrase: process.env.APPLE_SIGNER_KEY_PASSPHRASE,
  };
}

function connect(config: ApnsConfig): Promise<http2.ClientHttp2Session> {
  return new Promise((resolve, reject) => {
    const session = http2.connect(`https://${config.host}:443`, {
      cert: config.cert,
      key: config.key,
      passphrase: config.passphrase,
    });

    const timer = setTimeout(() => {
      session.destroy();
      reject(new Error(`APNs connect timed out after ${APNS_TIMEOUT_MS}ms`));
    }, APNS_TIMEOUT_MS);

    session.once('connect', () => {
      clearTimeout(timer);
      resolve(session);
    });
    session.once('error', (err) => {
      clearTimeout(timer);
      session.destroy();
      reject(err);
    });
  });
}

/** One device. Never rejects — a dead token for one phone must not stop the
 *  push to the same customer's other devices. */
function pushOne(
  session: http2.ClientHttp2Session,
  passTypeId: string,
  pushToken: string
): Promise<PushResult> {
  return new Promise((resolve) => {
    const req = session.request({
      ':method': 'POST',
      ':path': `/3/device/${pushToken}`,
      'apns-topic': passTypeId,
      'apns-push-type': 'background',
      // Apple documents priority 5 for background pushes. APNs currently
      // accepts the request without it (verified against the live endpoint:
      // the only complaint about a deliberately invalid token was
      // BadDeviceToken, never BadPriority) — set anyway, because relying on a
      // default that contradicts the docs is borrowing trouble.
      'apns-priority': '5',
      'content-type': 'application/json',
    });

    const timer = setTimeout(() => {
      req.close(http2.constants.NGHTTP2_CANCEL);
      resolve({ pushToken, ok: false, error: `timed out after ${APNS_TIMEOUT_MS}ms` });
    }, APNS_TIMEOUT_MS);

    let status = 0;
    let body = '';
    req.setEncoding('utf8');
    req.on('response', (headers) => {
      status = Number(headers[':status']);
    });
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      clearTimeout(timer);
      resolve(
        status === 200
          ? { pushToken, ok: true }
          : { pushToken, ok: false, error: `APNs ${status}: ${body}` }
      );
    });
    req.on('error', (err) => {
      clearTimeout(timer);
      resolve({ pushToken, ok: false, error: err.message });
    });

    // The payload is empty by design: a pass update carries no alert, it only
    // tells the device to call the pass web service back.
    req.write('{}');
    req.end();
  });
}

/**
 * Push to every device holding a customer's pass over ONE session.
 *
 * A customer with a phone and a watch used to cost two full TLS handshakes;
 * they now share one. Never throws — the caller logs what came back.
 */
export async function sendAppleWalletPushes(pushTokens: string[]): Promise<PushResult[]> {
  const config = apnsConfig();
  if (!config || pushTokens.length === 0) return [];

  let session: http2.ClientHttp2Session;
  try {
    session = await connect(config);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return pushTokens.map((pushToken) => ({ pushToken, ok: false, error }));
  }

  try {
    return await Promise.all(pushTokens.map((t) => pushOne(session, config.passTypeId, t)));
  } finally {
    session.close();
  }
}

/** Single-device convenience. Prefer `sendAppleWalletPushes` for a set — it
 *  shares one connection instead of opening one each. */
export async function sendAppleWalletPush(pushToken: string): Promise<void> {
  const [result] = await sendAppleWalletPushes([pushToken]);
  if (result && !result.ok) throw new Error(result.error);
}
