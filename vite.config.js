import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the built site works from any GitHub Pages sub-path.
  base: './',
  build: {
    target: 'es2020',
    sourcemap: false,
    // three.js is one big chunk by design; no point code-splitting a single page.
    chunkSizeWarningLimit: 700,
  },
});
