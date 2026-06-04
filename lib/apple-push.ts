import * as http2 from 'http2';

export async function sendAppleWalletPush(pushToken: string): Promise<void> {
  const passTypeId = process.env.APPLE_PASS_TYPE_IDENTIFIER;
  const certB64 = process.env.APPLE_SIGNER_CERT_BASE64;
  const keyB64 = process.env.APPLE_SIGNER_KEY_BASE64;

  if (!passTypeId || !certB64 || !keyB64) return;

  const isProduction = process.env.APPLE_PASS_ENV === 'production';
  const host = isProduction ? 'api.push.apple.com' : 'api.sandbox.push.apple.com';

  return new Promise((resolve, reject) => {
    const client = http2.connect(`https://${host}:443`, {
      cert: Buffer.from(certB64, 'base64'),
      key: Buffer.from(keyB64, 'base64'),
      passphrase: process.env.APPLE_SIGNER_KEY_PASSPHRASE,
    });

    client.on('error', (err) => { client.destroy(); reject(err); });

    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${pushToken}`,
      'apns-topic': passTypeId,
      'apns-push-type': 'background',
      'content-type': 'application/json',
      'content-length': '2',
    });

    req.write('{}');
    req.end();

    req.on('response', (headers) => {
      const status = headers[':status'] as number;
      client.close();
      if (status === 200) {
        resolve();
      } else {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => reject(new Error(`APNs ${status}: ${body}`)));
      }
    });

    req.on('error', (err) => { client.destroy(); reject(err); });
  });
}
