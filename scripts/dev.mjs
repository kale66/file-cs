import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as esbuildModule from 'esbuild';
import { typescriptTransform } from './vite-plugin-typescript.mjs';

const esbuildApi = esbuildModule.default ?? esbuildModule;
if (typeof esbuildApi.initialize === 'function') {
  await esbuildApi.initialize({ worker: false });
}

const { createServer } = await import('vite');
const pkg = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

const alias = {
  '@': fileURLToPath(new URL('../src', import.meta.url)),
  '@worker-factory': fileURLToPath(
    new URL('../src/workers/factory.standard.ts', import.meta.url),
  ),
};

const server = await createServer({
  configFile: false,
  root: process.cwd(),
  base: './',
  publicDir: false,
  esbuild: false,
  plugins: [typescriptTransform({ version: pkg.version, single: false })],
  resolve: { alias },
  server: {
    port: 5173,
    strictPort: false,
  },
  worker: {
    format: 'iife',
    plugins: () => [typescriptTransform({ version: pkg.version, single: false })],
  },
});

await server.listen();
server.printUrls();