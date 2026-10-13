/**
 * dsh-esc-pause build: two esbuild bundles.
 *
 * - lib/index.js — host half (ESM, node platform; Node builtins stay external).
 * - lib/client.js — client half, wrapped as the DSH client module-loader
 *   factory (`window.__ModuleLoader__.load`), registered with the package
 *   name; browser platform, everything inlined (the plugin is dependency-free).
 */
import { build } from 'esbuild'
import { readFile, rm } from 'node:fs/promises'

const pkg = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'))

await rm(new URL('./lib', import.meta.url), { recursive: true, force: true })

// Host half.
await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  outfile: 'lib/index.js',
  sourcemap: false,
  logLevel: 'warning',
})

// Client half: one CJS closure registered with the module loader. The
// module/exports shim rides the banner (esbuild build() has no `intro`).
await build({
  entryPoints: ['src/client/index.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2020',
  outfile: 'lib/client.js',
  sourcemap: false,
  logLevel: 'warning',
  define: { 'process.env.NODE_ENV': '"production"' },
  banner: {
    js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(pkg.name)}, factory: (require) => {\n`
      + 'var module = { exports: {} }; var exports = module.exports;',
  },
  footer: { js: '\nreturn module.exports; } });' },
})

console.log(`built ${pkg.name}: lib/index.js + lib/client.js`)