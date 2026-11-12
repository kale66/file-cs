import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { typescriptTransform } from './scripts/vite-plugin-typescript.mjs';

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
);

export default defineConfig({
  base: './',
  plugins: [typescriptTransform()],
  publicDir: false,
  esbuild: false,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __SINGLE_FILE__: 'false',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@worker-factory': fileURLToPath(
        new URL('./src/workers/factory.standard.ts', import.meta.url),
      ),
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
    sourcemap: false,
    cssCodeSplit: false,
    assetsInlineLimit: 4096,
    modulePreload: false,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  worker: {
    format: 'iife',
  },
  server: {
    port: 5173,
  },
});