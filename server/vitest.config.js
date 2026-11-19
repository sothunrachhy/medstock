import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    setupFiles: ['tests/setup.js'],
    // integration tests share one test database
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
