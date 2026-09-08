# Apple Wallet Setup

Apple Wallet support is **fully built** in the codebase (pass generation, push
updates, device registration webservice, log endpoint — see the file map at
the bottom). It has been running with empty credentials, so
`generateApplePass()` throws immediately (`lib/apple-pass.ts:29`). Nothing left
to code for the base flow — this is entirely about producing 5 credential
values from your new Apple Developer account and setting them as env vars.

Everything below happens at [developer.apple.com](https://developer.apple.com/account)
and in your terminal. Nothing here touches the RestKit codebase.

## 1. Register a Pass Type ID

1. **Certificates, Identifiers & Profiles → Identifiers → +**
2. Choose **Pass Type IDs** → Continue.
3. Description: `RestKit Loyalty Card` (or whatever you like).
4. Identifier: reverse-DNS, e.g. `pass.mx.restkit.loyalty` — **this exact
   string becomes `APPLE_PASS_TYPE_IDENTIFIER`**.
5. Register.

## 2. Generate the signing certificate

The Pass Type ID needs its own certificate (different from an app signing cert).

1. On your Mac: **Keychain Access → Certificate Assistant → Request a
   Certificate From a Certificate Authority**. Fill your email + name, select
   **Saved to disk**. This produces a `CertificateSigningRequest.certSigningRequest`.
2. Back in the portal: open the Pass Type ID you just created → **Create
   Certificate** → upload the CSR file → Continue → **Download** the
   resulting `.cer`.
3. Double-click the downloaded `.cer` to import it into Keychain Access (it
   pairs with the private key Keychain generated in step 1).
4. In Keychain Access, find the cert under **My Certificates** (expand it —
   the private key is nested underneath), select **both** the cert and its
   key, right-click → **Export 2 items…** → save as `Certificates.p12`. Set
   an export password — that password is `APPLE_SIGNER_KEY_PASSPHRASE`.

## 3. Get the WWDR intermediate certificate

Apple's Worldwide Developer Relations cert, needed to complete the trust
chain — not project-specific, one download:
[Apple PKI page](https://www.apple.com/certificateauthority/) → **Worldwide
Developer Relations — G4** (or whichever is current) → download the `.cer`.

## 4. Get your Team ID

**Membership** page in the developer portal, or top-right of any portal page.
10-character alphanumeric string → `APPLE_TEAM_ID`.

## 5. Convert everything to PEM + base64

The code (`lib/apple-pass.ts`, `lib/apple-push.ts`) reads three cert/key
values as **base64-encoded PEM**, not raw `.p12`/`.cer`. From a terminal, in
the folder with your downloaded files:

```bash
# Signer certificate (from the .p12)
openssl pkcs12 -in Certificates.p12 -clcerts -nokeys -out signerCert.pem -legacy -passin pass:YOUR_P12_PASSWORD

# Signer private key (from the .p12) — keep it encrypted, matches APPLE_SIGNER_KEY_PASSPHRASE
openssl pkcs12 -in Certificates.p12 -nocerts -out signerKey.pem -legacy -passin pass:YOUR_P12_PASSWORD -passout pass:YOUR_P12_PASSWORD

# WWDR cert — Apple now ships it as .cer (DER); convert to PEM
openssl x509 -inform der -in AppleWWDRCAG4.cer -out wwdr.pem

# base64-encode each (single line, no wrapping)
base64 -i signerCert.pem | tr -d '\n' > signerCert.b64
base64 -i signerKey.pem | tr -d '\n' > signerKey.b64
base64 -i wwdr.pem | tr -d '\n' > wwdr.b64
```

(Drop `-legacy` if your `openssl` version doesn't recognize it — that flag is
only needed on OpenSSL 3.x talking to older PKCS#12 files.)

## 6. Set the env vars

Six variables, matching `.env.example`:

```
APPLE_PASS_TYPE_IDENTIFIER=pass.mx.restkit.loyalty   # from step 1
APPLE_TEAM_ID=XXXXXXXXXX                              # from step 4
APPLE_WWDR_CERT_BASE64=<contents of wwdr.b64>
APPLE_SIGNER_CERT_BASE64=<contents of signerCert.b64>
APPLE_SIGNER_KEY_BASE64=<contents of signerKey.b64>
APPLE_SIGNER_KEY_PASSPHRASE=<your .p12 export password>
APPLE_PASS_ENV=production                             # see note below — sandbox does not work for Wallet push
```

- **Local dev**: paste into `.env` (already has the placeholder keys, just fill values in).
- **Vercel**: Project → Settings → Environment Variables — add all seven for
  Production (and Preview if you want pass generation to work on preview
  deploys too).

`APPLE_PASS_ENV` only affects the push endpoint host in `lib/apple-push.ts`
(`api.sandbox.push.apple.com` vs `api.push.apple.com`) — it does not affect
pass generation/signing, which is identical either way.

**Use `production` even during local testing.** Unlike regular app push
notifications, Wallet/PassKit updates authenticate with the Pass Type ID
certificate itself (mutual TLS, no separate APNs auth key), and Apple's
sandbox APNs host refuses that connection outright — confirmed by testing
both hosts directly against a real registered device token: sandbox returns
`NGHTTP2_REFUSED_STREAM`, production returns `200`. There is effectively no
usable sandbox environment for this push path, so `sandbox` will silently
break visit-count push updates (registration + the initial pass download
still work fine, only the live "add a visit and watch it update" flow fails).

## 7. Test end-to-end

1. Deploy (or run locally with `APP_URL` set to a URL Apple can reach —
   `localhost` will not work for the webservice callback, only for the
   initial download).
2. Go to a customer's page in the dashboard → **Agregar a Apple Wallet**, or
   hit `/api/passes/apple/[customerId]` directly. Should download a
   `.pkpass` that opens in Wallet on an iPhone (AirDrop or Mail it to a real
   device — the simulator can preview it but can't register for push).
3. Add it to Wallet on a real device → this fires
   `POST /api/wallet/apple/v1/devices/.../registrations/...`, storing a push
   token in `AppleDevice`.
4. Record a visit for that customer in the dashboard → `services/visit.service.ts`
   should call `sendAppleWalletPush()` → the card in Wallet should update its
   visit count within a few seconds without re-downloading.
5. Check `POST /api/wallet/apple/v1/log` in your server logs if the device
   reports the pass failed to update — Apple posts diagnostics there.

## Already built (no code changes needed)

| Piece | File |
|---|---|
| Pass generation + signing | `lib/apple-pass.ts` |
| APNs push (visit updates) | `lib/apple-push.ts` |
| Initial pass download | `app/api/passes/apple/[customerId]/route.ts` |
| Device registration (register/unregister) | `app/api/wallet/apple/v1/devices/[deviceId]/registrations/[passTypeId]/[serialNumber]/route.ts` |
| Registered-serials lookup | `app/api/wallet/apple/v1/devices/[deviceId]/registrations/[passTypeId]/route.ts` |
| Updated pass fetch (post-push) | `app/api/wallet/apple/v1/passes/[passTypeId]/[serialNumber]/route.ts` |
| Device error log sink | `app/api/wallet/apple/v1/log/route.ts` |
| Push token storage | `models/AppleDevice.ts` |
| Dashboard "Add to Wallet" button | `components/appleWallet/AppleWallet.tsx` |
| Public customer card page button | `app/c/[customerId]/page.tsx` |

## Note: `.env` naming was drifted

Before this doc, `.env` had stale placeholder keys (`APPLE_PASS_SIGNING_CERTIFICATE`,
`APPLE_PASS_PRIVATE_KEY`, `APPLE_WWDR_CERTIFICATE`) that didn't match what the
code reads. Fixed to match `.env.example` / the code's actual `process.env.*`
names — all still empty, ready for you to fill in via steps 1–6 above.
