import { defineConfig } from 'tsdown';

// Bundles src/index.ts into a single ESM file + one .d.ts (rolldown/oxc).
// ESM-only by design. `ws` is an optional peer dep — tsdown keeps deps/peerDeps
// external automatically, so it is never inlined into the bundle.
export default defineConfig({
  entry: 'src/index.ts',
  format: 'esm',
  dts: true,
  sourcemap: true,
  target: 'node20',
  clean: true,
});
