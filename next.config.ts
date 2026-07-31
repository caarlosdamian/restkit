import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the ngrok tunnel used for local Apple Wallet / mobile testing reach
  // Next's dev-only endpoints (HMR websocket, RSC fetches). ngrok issues a
  // new random subdomain per free-tier session, so this is a wildcard rather
  // than the specific host from any one run.
  // allowedDevOrigins: ['*.ngrok-free.dev', '*.ngrok-free.app','*'],
};

export default nextConfig;
