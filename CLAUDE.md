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
bun run build            # Build MCP server (tsup → dist/)
bun run dev              # Build in watch mode
bun socket               # Start WebSocket relay server (port 3055)
bun run start            # Run built MCP server
bun setup                # Full setup (install + write .cursor/mcp.json + .mcp.json)
```

There is no test suite or linter configured.

## Architecture

### MCP Server (`src/claude_to_figma_mcp/server.ts`)
The main server implementing the MCP protocol via `@modelcontextprotocol/sdk`. Exposes 50+ tools (create shapes, modify text, manage layouts, export images, etc.) and several AI prompts (design strategies). Communicates with Claude Code over stdio and with the WebSocket relay via `ws`. Each request gets a UUID, is tracked in a `pendingRequests` Map with timeout/promise callbacks, and resolves when the plugin responds.

### WebSocket Relay (`src/socket.ts`)
Lightweight Bun WebSocket server on port 3055 (configurable via `PORT` env). Routes messages between MCP server and Figma plugin using channel-based isolation. Clients call `join` to enter a channel; messages broadcast only within the same channel.

### Figma Plugin (`src/claude_figma_plugin/`)
Runs inside Figma. `code.js` is the plugin main thread handling 30+ commands via a dispatcher. `ui.html` is the plugin UI for WebSocket connection management. `manifest.json` declares permissions (dynamic-page access, localhost network). The plugin is **not built/bundled** — `code.js` is written directly as the runtime artifact.

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

## Setup

1. Run `bun setup` — installs dependencies and writes MCP config
2. `bun socket` in one terminal (WebSocket relay)
3. In Figma: Plugins → Development → Link existing plugin → select `src/claude_figma_plugin/manifest.json`
4. Run plugin in Figma, join a channel, then use tools from Claude Code

Add the MCP server to Claude Code:

```bash
claude mcp add ClaudeToFigma -- bun /path-to-repo/src/claude_to_figma_mcp/server.ts
```
