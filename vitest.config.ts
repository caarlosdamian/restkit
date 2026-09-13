import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname) },
  },
  test: {
    // .tsx so a React client component can be rendered and re-rendered; such a
    // file opts into jsdom with a `// @vitest-environment jsdom` pragma.
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'], // Playwright owns e2e/**
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    // First run downloads the mongod binary for mongodb-memory-server.
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
});
