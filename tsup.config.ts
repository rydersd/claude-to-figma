import { defineConfig } from 'tsup';

export default defineConfig([
  // MCP Server build
  {
    entry: ['src/llm2figma_mcp/server.ts'],
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
    entry: { 'code': 'src/llm2figma_plugin/src/main.ts' },
    format: ['iife'],
    outDir: 'src/llm2figma_plugin',
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
