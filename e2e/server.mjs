/**
 * E2E web server: boots an in-memory MongoDB, then starts `next dev` wired to
 * it. Used as the Playwright `webServer` command so every E2E run gets a
 * fresh, isolated database — no external Mongo and no leftover state.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import { spawn } from 'node:child_process';

const PORT = process.env.E2E_PORT || '3100';

const mongo = await MongoMemoryServer.create();
const uri = mongo.getUri('restkit-e2e');
console.log(`[e2e] in-memory MongoDB at ${uri}`);

const next = spawn('npx', ['next', 'dev', '-p', PORT], {
  stdio: 'inherit',
  env: {
    ...process.env,
    MONGODB_URI: uri,
    // 32+ chars keeps better-auth from warning on every request.
    BETTER_AUTH_SECRET: 'restkit-e2e-secret-0123456789-abcdefghijklmn',
    BETTER_AUTH_URL: `http://localhost:${PORT}`,
    POS_TOKEN_SECRET: 'restkit-e2e-pos-secret',
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
