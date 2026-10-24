/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // The e2e build bundles src/testing/ (window.__pumpops, fixture gallery) and disables the
  // real-time loop. Statically replaced, so production builds tree-shake it out.
  define: {
    'import.meta.env.VITE_E2E': JSON.stringify(mode === 'e2e'),
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}));
