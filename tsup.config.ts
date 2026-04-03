import { defineConfig } from 'tsup';

export default defineConfig([
  // MCP Server build
  {
    entry: ['src/claude_to_figma_mcp/server.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    outDir: 'dist',
    target: 'node18',
    sourcemap: true,
    minify: false,
    splitting: false,
    bundle: true,
  },
  // Figma Plugin build
  {
    entry: { 'code': 'src/claude_figma_plugin/src/main.ts' },
    format: ['iife'],
    outDir: 'src/claude_figma_plugin',
    target: 'es2020',
    bundle: true,
    splitting: false,
    dts: false,
    sourcemap: false,
    minify: false,
    treeshake: true,
    clean: false,
    noExternal: [/.*/],
    outExtension() {
      return { js: '.js' };
    },
  },
]);
