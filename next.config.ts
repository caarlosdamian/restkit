import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the ngrok tunnel used for local Apple Wallet / mobile testing reach
  // Next's dev-only endpoints (HMR websocket, RSC fetches). ngrok issues a
  // new random subdomain per free-tier session, so this is a wildcard rather
  // than the specific host from any one run.
  // allowedDevOrigins: ['*.ngrok-free.dev', '*.ngrok-free.app','*'],

  // The card fonts. Nothing imports these files, so the build would not trace
  // them into the function — and a serverless runtime has no fonts of its own,
  // which is how every word on the wallet card came out as a .notdef box.
  // See `configureCardFonts` in lib/sharp-runtime.ts.
  outputFileTracingIncludes: {
    "/api/passes/**": ["./assets/fonts/**"],
  },
};

export default nextConfig;
