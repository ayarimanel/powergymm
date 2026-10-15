import { defineConfig } from 'vitest/config';

// Only the plain TypeScript logic (src/floor/**) is unit tested this way — no React Native
// components here, so no special test environment is needed.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
