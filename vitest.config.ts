import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Тесты гоняют только чистую логику из src/core — без React Native,
// поэтому эмулятор и нативные модули не нужны.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
