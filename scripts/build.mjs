import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import * as esbuildModule from 'esbuild';
import { typescriptTransform } from './vite-plugin-typescript.mjs';

const esbuildApi = esbuildModule.default ?? esbuildModule;
if (typeof esbuildApi.initialize === 'function') {
  await esbuildApi.initialize({ worker: false });
  console.info('[build] esbuild-wasm 已初始化');
}

const { build } = await import('vite');
const { viteSingleFile } = await import('vite-plugin-singlefile');

const single = process.argv.includes('--single');
const pkg = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

const plugins = [typescriptTransform({ version: pkg.version, single })];
if (single) {
  plugins.push(
    viteSingleFile({
      removeViteModuleLoader: true,
      useRecommendedBuildConfig: true,
    }),
  );
}

const alias = {
  '@': fileURLToPath(new URL('../src', import.meta.url)),
  '@worker-factory': fileURLToPath(
    new URL(
      single ? '../src/workers/factory.inline.ts' : '../src/workers/factory.standard.ts',
      import.meta.url,
    ),
  ),
};

await build({
  configFile: false,
  root: process.cwd(),
  base: './',
  plugins,
  publicDir: false,
  esbuild: false,
  logLevel: 'info',

  resolve: { alias },
  build: {
    outDir: single ? 'dist-single' : 'dist',
    emptyOutDir: true,
    target: 'es2020',
    minify: false,
    cssMinify: false,
    sourcemap: false,
    cssCodeSplit: false,
    assetsInlineLimit: single ? 100_000_000 : 4096,
    modulePreload: false,
    rollupOptions: single
      ? {
          output: {
            inlineDynamicImports: true,
          },
        }
      : {},
  },
  worker: {
    format: 'iife',
    plugins: () => [typescriptTransform({ version: pkg.version, single })],
  },
});

console.info(`[build] 完成：${single ? 'dist-single' : 'dist'}`);