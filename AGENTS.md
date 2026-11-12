# AGENTS.md

This file provides guidance to Claude Code agents (claude.ai/code) when working with code in this repository.

## Project Overview

MCP (Model Context Protocol) server that bridges MCP-compatible AI assistants with Figma. Three components communicate in a pipeline:

```
MCP Client ←(stdio)→ MCP Server ←(WebSocket)→ WebSocket Relay ←(WebSocket)→ Figma Plugin
```

## Build & Development Commands

```bash
bun install              # Install dependencies
bun run build            # Build MCP server (tsup → dist/)
bun run dev              # Build in watch mode
bun socket               # Start WebSocket relay server (port 3055)
bun run start            # Run built MCP server
bun setup                # Full setup (install + write .mcp.json)
```

Tests: `bun test tests/gradients.test.ts tests/images.test.ts tests/library.test.ts tests/plugin-library.test.ts tests/efficiency.test.ts tests/launcher.test.ts` runs unit and plugin-contract tests without Figma. `tests/library-live.test.ts` requires REST credentials and skips when unconfigured. `tests/sync-mode.test.ts` and `tests/prototyping.test.ts` require a live Figma plugin on a WebSocket channel (`CHANNEL=<channel> bun test tests/sync-mode.test.ts`) and time out otherwise. No linter is configured.

## Architecture

### MCP Server (`src/llm2figma_mcp/server.ts`)
The main server implementing the MCP protocol via `@modelcontextprotocol/sdk`. Exposes 90+ tools (create shapes, modify text, manage layouts, export images, component migration, design queries, etc.) and several AI prompts (design strategies). Communicates with the AI agent over stdio and with the WebSocket relay via `ws`. Each request gets a UUID, is tracked in a `pendingRequests` Map with timeout/promise callbacks, and resolves when the plugin responds.

### WebSocket Relay (`src/socket.ts`)
Lightweight Bun WebSocket server on port 3055 (configurable via `PORT` env). Routes messages between MCP server and Figma plugin using channel-based isolation. Clients call `join` to enter a channel; messages broadcast only within the same channel.

### Figma Plugin (`src/llm2figma_plugin/`)
Runs inside Figma. `code.js` is the plugin main thread handling 80+ commands via a dispatcher. `ui.html` is the plugin UI for WebSocket connection management and settings. `manifest.json` declares permissions (dynamic-page access, localhost network). The plugin is bundled from `src/` by `bun run build`; commit the generated `code.js` runtime artifact after source changes.

## Key Patterns

- **Colors**: Figma uses RGBA 0-1 range. The MCP tools accept 0-1 floats and the filter converts to hex for display.
- **Logging**: All logs go to stderr. Stdout is reserved for MCP protocol messages.
- **Timeouts**: 30s default per command. Progress updates from the plugin reset the inactivity timer.
- **Chunking**: Large operations (scanning 100+ nodes) are chunked with progress updates to prevent Figma UI freezing.
- **Reconnection**: WebSocket auto-reconnects after 2 seconds on disconnect.
- **Zod validation**: All tool parameters are validated with Zod schemas.

## Setup

1. Run `bun setup` — installs dependencies and writes MCP config
2. `bun socket` in one terminal (WebSocket relay on port 3055)
3. In Figma: Plugins → Development → Link existing plugin → select `src/llm2figma_plugin/manifest.json`
4. Run plugin in Figma, join a channel, then use tools from Claude Code

The MCP config written by `bun setup` uses the published package:

```json
{
  "mcpServers": {
    "LLM2Figma": {
      "command": "bun",
      "args": ["/path-to-repo/src/llm2figma_mcp/server.ts"]
    }
  }
}
```

You can also add it manually for Claude Code via the CLI:

```bash
claude mcp add LLM2Figma -- bun /path-to-repo/src/llm2figma_mcp/server.ts
```

## Agent Notes

- Always call `join_channel` before issuing any Figma commands
- Call `get_document_info` first to understand the design structure
- Use `read_my_design` or `get_selection` before making modifications
- Batch operations (`set_multiple_text_contents`, `delete_multiple_nodes`, `set_multiple_annotations`) are preferred over repeated single-node calls for performance
- All MCP tool parameters are Zod-validated; invalid inputs return structured errors
- The plugin and relay must both be running before any tool calls succeed

## Efficient design workflow

- Establish the file/page and selection once, then inspect only the properties needed for the next decision. Use `fields`, `maxNodes`, `maxDepth`, and `maxTextLength` with node inspection; include `children` only when necessary. Defaults cap inspection at 100 nodes, depth 2, and 2,000 characters per text node. Follow explicit `inspection.truncated` metadata with targeted child/root reads.
- Keep a small reference snapshot of palettes/variable refs, font choices, component/root IDs, layout helper snippets, and already-read skill guidance. `reference_cache` scopes entries to a file/page or task; defaults to 30-minute expiry with a 64-entry, 64KB-per-entry bound. Refresh references after library changes, deletions, or changes to the source design. Cache misses require a fresh read.
- Reuse auto-layout helpers, section templates, real library instances, and `$repeat` templates. Use one `figma_eval` helper definition per composition when custom layout logic is needed. Successful and in-flight font loads are shared for the plugin session; failed loads can retry.
- Batch related mutations and validate the composition after the batch. `scan_node_styles` with `summary:true` returns counts, font families, up to ten unbound-color example IDs, and coverage metadata. Its default budget is 100 nodes at depth 10. `truncated:true` means validation covered only part of the tree; increase the budget or validate separate subtrees before reporting completion.
- After repairs and compact validation, take one screenshot per completed composition. Repeat screenshots after meaningful visual changes or when a visual defect remains unresolved.
- Load relevant skill guidance once per task. The `efficient_workflow` MCP prompt carries these rules for any compatible client.
