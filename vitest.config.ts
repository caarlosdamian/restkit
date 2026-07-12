import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname) },
  },
  test: {
    include: ['tests/**/*.test.ts'], // Playwright owns e2e/**
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    // First run downloads the mongod binary for mongodb-memory-server.
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
});
