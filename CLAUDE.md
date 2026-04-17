# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Attribution

This project is a fork of [cursor-talk-to-figma-mcp](https://github.com/sonnylazuardi/cursor-talk-to-figma-mcp) by **sonnylazuardi**, licensed under MIT. The original project provides the MCP server, WebSocket relay, and Figma plugin architecture that this project builds upon.

## Project Overview

MCP (Model Context Protocol) server that bridges Claude Code with Figma. Three components communicate in a pipeline:

```
Claude Code ←(stdio)→ MCP Server ←(WebSocket)→ WebSocket Relay ←(WebSocket)→ Figma Plugin
```

## Build & Development Commands

```bash
bun install              # Install dependencies
bun run build            # Build MCP server (dist/) AND Figma plugin (src/claude_figma_plugin/code.js) via tsup
bun run build:plugin     # Build Figma plugin only (src/claude_figma_plugin/code.js)
bun run dev              # Build in watch mode
bun socket               # Start WebSocket relay server (port 3055)
bun run start            # Run built MCP server
bun setup                # Full setup (install + write .mcp.json)
```

There is no test suite or linter configured.

## Architecture

### MCP Server (`src/claude_to_figma_mcp/server.ts`)
The main server implementing the MCP protocol via `@modelcontextprotocol/sdk`. Exposes 90+ tools (create shapes, modify text, manage layouts, export images, component migration, design queries, event streaming, etc.) and several AI prompts (design strategies). Communicates with Claude Code over stdio and with the WebSocket relay via `ws`. Each request gets a UUID, is tracked in a `pendingRequests` Map with timeout/promise callbacks, and resolves when the plugin responds. Plugin-pushed events (no request ID) are routed to the event buffer in `events.ts`.

### WebSocket Relay (`src/socket.ts`)
Lightweight Bun WebSocket server on port 3055. Routes messages between MCP server and Figma plugin using channel-based isolation. Clients call `join` to enter a channel; messages broadcast only within the same channel.

### Figma Plugin (`src/claude_figma_plugin/`)
Runs inside Figma. The plugin source lives in `src/claude_figma_plugin/src/` as 14 TypeScript modules. `bun run build` compiles them via tsup into `code.js` as an IIFE bundle. `ui.html` is the plugin UI for WebSocket connection management and settings. `manifest.json` declares dynamic-page document access and localhost network access.

**Plugin modules** (`src/claude_figma_plugin/src/`):
- `main.ts` -- command dispatcher (100 commands), plugin lifecycle
- `analysis.ts` -- node introspection, style scanning, batch operations, design queries
- `components.ts` -- component creation, instances, styles, variables
- `creation.ts` -- shape and frame creation
- `document.ts` -- document info, node management, selection
- `events.ts` -- design event streaming (selection/node/page changes) pushed to MCP server
- `layout.ts` -- auto layout configuration
- `node-tree.ts` -- batch node tree creation with repeat directives
- `prototyping.ts` -- prototype connections, reactions, interaction flows
- `styling.ts` -- fill, stroke, corner radius
- `text.ts` -- text content, fonts, scanning
- `transforms.ts` -- move, resize, annotations
- `utils.ts` -- shared helpers, color conversion, progress reporting
- `vectors.ts` -- vector paths, lines, SVG normalization

## Key Patterns

- **Colors**: Figma uses RGBA 0-1 range. The MCP tools accept 0-1 floats, hex strings (`#RRGGBB`), or Figma variable references (`$var:Collection/Name`).
- **Logging**: All logs go to stderr. Stdout is reserved for MCP protocol messages.
- **Timeouts**: 30s default per command (60s for `create_node_tree`). Progress updates from the plugin reset the inactivity timer.
- **Chunking**: Large operations (scanning 100+ nodes) are chunked with progress updates to prevent Figma UI freezing.
- **Reconnection**: WebSocket auto-reconnects after 2 seconds on disconnect.
- **Zod validation**: All tool parameters are validated with Zod schemas.

## Batch Node Creation (`create_node_tree`)

The `create_node_tree` tool creates entire node hierarchies in one round-trip. Key features:

- **Nested tree spec**: frames, text, rectangles, vectors — only frames have children
- **`$repeat` directives**: data-driven repetition for tables/lists — `{"$repeat": {"data": [...], "template": {...}}}`
- **`$var:` color binding**: reference Figma variables by name — creates real variable bindings, not just resolved values
- **Hex color shorthand**: `"#3d6daa"` instead of `{"r": 0.24, "g": 0.43, "b": 0.67, "a": 1}`
- **Progress updates**: every 5 nodes to keep timeout alive

## Event Streaming (`figma_events_subscribe` / `figma_events_poll`)

Two MCP tools (defined in `src/claude_to_figma_mcp/tools/events.ts`) let Claude observe design changes the user makes inside Figma. Events flow plugin → relay → MCP server, where they accumulate in a 200-event ring buffer (`src/claude_to_figma_mcp/events.ts`) until polled.

- **`figma_events_subscribe`** — `{ enabled: boolean }`. Starts (or stops) event streaming. While subscribed, the plugin pushes `selectionchange`, `nodechange`, and `currentpagechange` events to the MCP server with no request ID.
- **`figma_events_poll`** — drains buffered events. Filters: `peek` (read without clearing), `eventTypes` (`["selectionchange" | "nodechange" | "currentpagechange"]`), `since` (epoch ms), `limit` (most recent N), `excludePluginOperations` (filter out events caused by tool commands).

**Buffer behavior**: priority-aware overflow — when full, low-priority events (`nodechange` with only `PROPERTY_CHANGE` entries) are dropped first to preserve `CREATE`/`DELETE` and selection/page events. Buffer is **not** cleared on unsubscribe so a final drain is possible. Each event carries `isPluginOperation: boolean` so callers can distinguish user actions from tool-driven changes.

## Setup

1. Run `bun setup` — installs dependencies and writes MCP config (machine-specific)
2. `bun socket` in one terminal (WebSocket relay)
3. In Figma: Plugins → Development → Link existing plugin → select `src/claude_figma_plugin/manifest.json`
4. Run plugin in Figma, join a channel, then use tools from Claude Code

Add the MCP server to Claude Code:

```bash
claude mcp add ClaudeToFigma -- bun /path-to-repo/src/claude_to_figma_mcp/server.ts
```

## Machine Portability

`.mcp.json` is **gitignored** because it contains absolute paths to `bun` and the repo that differ per machine. The committed templates and scripts handle this:

- **`.mcp.json.example`** — committed template showing the expected shape.
- **`scripts/setup.sh`** (`bun setup`) — resolves `bun` and the repo root absolutely, writes `.mcp.json`, stamps a `_generatedFor` block (hostname, user, ISO timestamp).
- **`scripts/preflight.sh`** — compares the stamp against the current machine; auto-runs `setup.sh` if `.mcp.json` is missing or stamped for a different host/user. Idempotent and silent when valid.

Run `./scripts/preflight.sh` (or wire it into a shell alias like `ctf`) before starting the relay so the config self-heals after machine switches, repo moves, or `bun` upgrades — no more silently broken paths sneaking into commits.

## Hooks & Reasoning

Claude Code hooks and scripts for capturing build/test history and generating per-commit reasoning:

- `.claude/hooks/post-bash-track-builds.sh` -- PostToolUse hook that captures build/test outcomes
- `.claude/scripts/generate-reasoning.sh` -- generates per-commit reasoning from build attempts
- `.claude/scripts/search-reasoning.sh` -- searches past reasoning
- `.claude/scripts/aggregate-reasoning.sh` -- aggregates reasoning for PR descriptions

Data is stored in `.git/claude/` (local, gitignored).
