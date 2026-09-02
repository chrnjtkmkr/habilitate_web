import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Load .env so VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are available
    env: {},
    environment: 'node',
    // Integration tests are slow (network I/O) — separate from unit tests
    include: ['src/__integration__/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // Run sequentially — steps depend on each other
    sequence: { concurrent: false },
  },
});
