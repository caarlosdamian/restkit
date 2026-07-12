import { vi } from 'vitest';

// lib/db.ts throws at import time without this. Integration tests never use
// this URI — they connect to an in-memory server via tests/helpers/db.ts.
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/restkit-test-unused';
process.env.BETTER_AUTH_SECRET ??= 'restkit-test-secret';

// The better-auth session is the only auth boundary in the app. Replacing it
// here lets every route handler run unmodified: tests choose the acting user
// via tests/helpers/auth-state.ts.
vi.mock('@/lib/auth', async () => {
  const state = await import('./helpers/auth-state');
  return {
    auth: {
      api: {
        getSession: async () => state.getMockSession(),
      },
    },
  };
});

// Routes read the x-waiter-token header through next/headers.
vi.mock('next/headers', async () => {
  const state = await import('./helpers/auth-state');
  return {
    headers: async () => state.getMockRequestHeaders(),
  };
});
