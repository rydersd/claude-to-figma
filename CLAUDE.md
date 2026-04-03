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
bun run dev              # Build in watch mode
bun socket               # Start WebSocket relay server (port 3055)
bun run start            # Run built MCP server
bun setup                # Full setup (install + write .mcp.json)
```

There is no test suite or linter configured.

## Architecture

### MCP Server (`src/claude_to_figma_mcp/server.ts`)
The main server implementing the MCP protocol via `@modelcontextprotocol/sdk`. Exposes 90+ tools (create shapes, modify text, manage layouts, export images, component migration, design queries, etc.) and several AI prompts (design strategies). Communicates with Claude Code over stdio and with the WebSocket relay via `ws`. Each request gets a UUID, is tracked in a `pendingRequests` Map with timeout/promise callbacks, and resolves when the plugin responds.

### WebSocket Relay (`src/socket.ts`)
Lightweight Bun WebSocket server on port 3055. Routes messages between MCP server and Figma plugin using channel-based isolation. Clients call `join` to enter a channel; messages broadcast only within the same channel.

### Figma Plugin (`src/claude_figma_plugin/`)
Runs inside Figma. The plugin source lives in `src/claude_figma_plugin/src/` as 13 TypeScript modules. `bun run build` compiles them via tsup into `code.js` as an IIFE bundle. `ui.html` is the plugin UI for WebSocket connection management and settings. `manifest.json` declares dynamic-page document access and localhost network access.

**Plugin modules** (`src/claude_figma_plugin/src/`):
- `main.ts` -- command dispatcher (~96 commands), plugin lifecycle
- `analysis.ts` -- node introspection, style scanning, batch operations, design queries
- `components.ts` -- component creation, instances, styles, variables
- `creation.ts` -- shape and frame creation
- `document.ts` -- document info, node management, selection
- `layout.ts` -- auto layout configuration
- `node-tree.ts` -- batch node tree creation with repeat directives
- `prototyping.ts` -- prototype connections, reactions, overlays
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

## Setup

1. Run `bun setup` — installs dependencies and writes MCP config
2. `bun socket` in one terminal (WebSocket relay)
3. In Figma: Plugins → Development → Link existing plugin → select `src/claude_figma_plugin/manifest.json`
4. Run plugin in Figma, join a channel, then use tools from Claude Code

Add the MCP server to Claude Code:

```bash
claude mcp add ClaudeToFigma -- bun /path-to-repo/src/claude_to_figma_mcp/server.ts
```

## Hooks & Reasoning

Claude Code hooks and scripts for capturing build/test history and generating per-commit reasoning:

- `.claude/hooks/post-bash-track-builds.sh` -- PostToolUse hook that captures build/test outcomes
- `.claude/scripts/generate-reasoning.sh` -- generates per-commit reasoning from build attempts
- `.claude/scripts/search-reasoning.sh` -- searches past reasoning
- `.claude/scripts/aggregate-reasoning.sh` -- aggregates reasoning for PR descriptions

Data is stored in `.git/claude/` (local, gitignored).
