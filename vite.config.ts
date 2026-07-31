import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  // Relative asset URLs so the build works both standalone and mounted
  // under TheMotoHub's /rush-app/ proxy path (see src/game/base-url.ts).
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
