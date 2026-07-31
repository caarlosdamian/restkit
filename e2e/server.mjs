/**
 * E2E web server: boots an in-memory MongoDB, then starts `next dev` wired to
 * it. Used as the Playwright `webServer` command so every E2E run gets a
 * fresh, isolated database — no external Mongo and no leftover state.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import { spawn } from 'node:child_process';

const PORT = process.env.E2E_PORT || '3100';

// E2E_PROD=1 serves the existing production build (`next start`) instead of
// `next dev`. Dev mode compiles each page on first visit, which on a loaded
// machine can blow test timeouts; prod mode needs a prior `npm run build` but
// serves precompiled pages and is immune to that flake.
const mode = process.env.E2E_PROD === '1' ? 'start' : 'dev';

const mongo = await MongoMemoryServer.create();
const uri = mongo.getUri('restkit-e2e');
console.log(`[e2e] in-memory MongoDB at ${uri} (next ${mode})`);

const next = spawn('npx', ['next', mode, '-p', PORT], {
  stdio: 'inherit',
  env: {
    ...process.env,
    MONGODB_URI: uri,
    // 32+ chars keeps better-auth from warning on every request.
    BETTER_AUTH_SECRET: 'restkit-e2e-secret-0123456789-abcdefghijklmn',
    // BETTER_AUTH_URL: `http://localhost:${PORT}`,
    POS_TOKEN_SECRET: 'restkit-e2e-pos-secret',
    // Prod builds enable better-auth's per-IP rate limit; the suite's rapid
    // logins from localhost would trip it (see lib/auth.ts).
    AUTH_DISABLE_RATE_LIMIT: '1',
    NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
    APP_URL: `http://localhost:${PORT}`,
  },
});

async function shutdown(code) {
  await mongo.stop().catch(() => {});
  process.exit(code ?? 0);
}

next.on('exit', shutdown);
process.on('SIGTERM', () => {
  next.kill('SIGTERM');
  shutdown(0);
});
process.on('SIGINT', () => {
  next.kill('SIGINT');
  shutdown(0);
});
