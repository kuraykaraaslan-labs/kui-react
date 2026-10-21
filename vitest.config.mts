import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': import.meta.dirname,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist', '.next', '.junk'],
    // The scene editor tests mount a palette with a thumbnail per SCADA symbol (about 550): a mount takes seconds in jsdom on a busy machine.
    testTimeout: 20_000,
  },
});
