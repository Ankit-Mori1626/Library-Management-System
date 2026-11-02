import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    setupFiles: ['./tests/setup.js'],
    coverage: {
      provider: 'v8',
      include: ['server.js'],
      reporter: ['text', 'lcov'], // SonarQube reads coverage/lcov.info
    },
  },
});
