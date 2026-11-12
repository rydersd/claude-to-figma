# Architecture

**Tags:** `reference` · `mcp` · `websocket` · `figma-plugin`

How the three components of claude-to-figma communicate, and the key runtime patterns (request tracking, timeouts, chunking) that make 100+ tools reliable over a WebSocket bridge.

## The pipeline

```
Claude Code ←(stdio)→ MCP Server ←(WebSocket)→ WebSocket Relay ←(WebSocket)→ Figma Plugin
```

| Component | Location | Role |
|---|---|---|
| MCP Server | `src/claude_to_figma_mcp/server.ts` | Implements the MCP protocol, exposes 100+ tools and design-strategy prompts |
| WebSocket Relay | `src/socket.ts` | Bun WebSocket server on port 3055, channel-based message routing |
| Figma Plugin | `src/claude_figma_plugin/` | Runs inside Figma, executes commands against the document |

## MCP Server

Built on `@modelcontextprotocol/sdk`. Talks to Claude Code over stdio and to the relay via `ws`. Each request gets a UUID and is tracked in a `pendingRequests` Map with timeout/promise callbacks; it resolves when the plugin responds. Tool definitions live in `src/claude_to_figma_mcp/tools/` (one file per category — see [[Tool-Reference]]).

## WebSocket Relay

Lightweight Bun server on port 3055 (configurable via `PORT`). Clients call `join` to enter a channel; messages broadcast only within the same channel, so multiple Figma files and Claude sessions can coexist without cross-talk.

## Figma Plugin

The plugin source lives in `src/claude_figma_plugin/src/` as 13 TypeScript modules, compiled by tsup into `code.js` (IIFE bundle). `main.ts` is the command dispatcher routing ~100 commands to the right module. See [[Plugin-Development]] for the module map and build workflow.

## REST discovery (team libraries)

Alongside the WebSocket/plugin pipeline above, the MCP server has a second, independent path for team-library components: `tools/library.ts` calls the Figma REST API (`api.figma.com`) directly with a personal access token — `GET /v1/files/:key/components`, `/component_sets`, and `/meta` — never touching the plugin or WebSocket relay. This powers `get_library_components` and `search_library_components`, and the `$lib:` reference resolution consumed by `create_node_tree`'s `instance` node type (see [[Create-Node-Tree#library-component-instances-lib-refs|library component instances]]).

```
Claude Code ←(stdio)→ MCP Server ──(HTTPS)──→ api.figma.com
```

Fetched component sets are grouped and cached in memory per file key for the MCP server's session lifetime (`refresh: true` on either tool forces a refetch); nothing here depends on a plugin being connected to a channel. Requires `FIGMA_API_TOKEN` + `FIGMA_LIBRARY_FILE_KEYS` — see [[Getting-Started#team-library-setup|team library setup]].

## Key runtime patterns

- **Colors** — Figma uses RGBA in 0–1 range. Tools accept 0–1 floats, hex strings (`#RRGGBB`), or Figma variable references (`$var:Collection/Name`). See [[Create-Node-Tree#color-shorthand-and-variable-binding|color binding in create_node_tree]].
- **Logging** — all logs go to stderr; stdout is reserved for MCP protocol messages.
- **Timeouts** — 30s default per command (60s for `create_node_tree`). Progress updates from the plugin reset the inactivity timer.
- **Chunking** — large operations (scanning 100+ nodes) are chunked with progress updates to prevent Figma UI freezing.
- **Reconnection** — the WebSocket auto-reconnects 2 seconds after a disconnect.
- **Zod validation** — every tool's parameters are validated with Zod schemas; invalid input returns a structured error without hitting Figma.

---

## Related

- [[Getting-Started#team-library-setup|Team library setup]] — PAT + file keys for the REST discovery path
- [[Getting-Started]] — wiring the three components up for the first time
- [[Tool-Reference]] — the tool catalog the MCP server exposes
- [[Plugin-Development]] — plugin module layout and build process
- [[Design-Round-Trip]] — how the pipeline supports fast read–modify–verify loops
