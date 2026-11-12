# Plugin Development

**Tags:** `guide` · `figma-plugin` · `build` · `typescript`

How the Figma plugin is structured, how to rebuild it after changes, and where each command lives.

## Build commands

```bash
bun install              # install dependencies
bun run build            # build MCP server (dist/) AND plugin (code.js) via tsup
bun run build:plugin     # build the Figma plugin only
bun run dev              # build in watch mode
```

The plugin source is TypeScript in `src/claude_figma_plugin/src/`; tsup compiles it into `src/claude_figma_plugin/code.js` as an IIFE bundle. `ui.html` (connection management and settings UI) is edited directly. `manifest.json` declares dynamic-page document access and localhost network access.

There is no test suite or linter configured for the plugin itself; `tests/` covers server-side behavior (prototyping, sync mode).

## Module map

| Module | Responsibility |
|---|---|
| `main.ts` | Command dispatcher (~100 commands), plugin lifecycle |
| `analysis.ts` | Node introspection, style scanning, batch operations, design queries |
| `components.ts` | Component creation, instances, styles, variables |
| `creation.ts` | Shape and frame creation |
| `document.ts` | Document info, node management, selection |
| `layout.ts` | Auto layout configuration |
| `node-tree.ts` | Batch node tree creation with `$repeat` directives |
| `prototyping.ts` | Prototype connections, reactions, interaction flows |
| `styling.ts` | Fill, stroke, corner radius |
| `text.ts` | Text content, fonts, scanning |
| `transforms.ts` | Move, resize, annotations |
| `utils.ts` | Shared helpers, color conversion, progress reporting |
| `vectors.ts` | Vector paths, lines, SVG normalization |

Each plugin command has a matching MCP tool definition in `src/claude_to_figma_mcp/tools/` — when adding a command, register it in both places (dispatcher case in `main.ts`, Zod-validated tool in the appropriate `tools/*.ts` file).

## Adding a new tool: checklist

1. Implement the handler in the right plugin module (`src/claude_figma_plugin/src/`)
2. Add a dispatcher case in `main.ts`
3. Register the MCP tool with a Zod schema in `src/claude_to_figma_mcp/tools/`
4. `bun run build` to regenerate both `dist/` and `code.js`
5. Reload the plugin in Figma (Plugins → Development → your plugin)
6. Document it in the wiki ([[Tool-Reference]]) and README

For long-running commands, send progress updates every few nodes — progress resets the server's inactivity timeout (see [[Architecture#key-runtime-patterns|runtime patterns]]).

---

## Related

- [[Architecture]] — where the plugin sits in the pipeline
- [[Tool-Reference]] — the MCP-side tool catalog that mirrors the dispatcher
- [[Roadmap]] — proposed features, most of which land as new plugin commands
- [[Troubleshooting]] — debugging plugin/relay connection issues
