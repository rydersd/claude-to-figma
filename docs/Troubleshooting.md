# Troubleshooting

**Tags:** `guide` · `setup` · `websocket` · `debugging`

Fixes for the common failure modes: nothing connects, commands time out, or the plugin can't reach the relay from WSL.

## Nothing responds to tool calls

Both the relay and the plugin must be running before any tool call succeeds:

1. Is `bun socket` running? (port 3055)
2. Is the plugin open in Figma and showing a connected state?
3. Did you call `join_channel` with the **same channel name** the plugin joined? Channel-based isolation means mismatched names silently route to nobody (see [[Architecture#websocket-relay|the relay design]]).

## Commands time out

Default timeout is 30s per command (60s for `create_node_tree`). Long scans and batch operations send progress updates that reset the timer — if a custom command times out, it's usually because it does long work without reporting progress. Prefer batch tools (`set_multiple_text_contents`, `delete_multiple_nodes`, `batch_mutate`) over loops of single-node calls, and use chunking parameters on `scan_text_nodes` for large trees.

## MCP server won't start from Claude Code

Use an absolute path to `node` in `.mcp.json` (e.g. `/opt/homebrew/bin/node`) — Claude Code may launch the server with a minimal PATH. See [[Getting-Started#registering-the-mcp-server-manually|manual registration]].

## Windows + WSL

The relay binds to localhost by default, which WSL can't always reach. Uncomment the hostname line in `src/socket.ts`:

```typescript
// uncomment this to allow connections in windows wsl
hostname: "0.0.0.0",
```

Then restart `bun socket`.

## Stale plugin code

If a tool exists on the MCP side but the plugin reports "unknown command", the `code.js` bundle is stale. Run `bun run build` and reload the plugin in Figma. See [[Plugin-Development#build-commands|build commands]].

## Recovering from bad mutations

The `undo` tool reverses up to 50 steps of plugin-driven changes (wrong-size rasterizations, accidental deletions, batch mutations gone wrong); `redo` restores them. Prefer dry-run modes where offered (`migrate_instance`, `optimize_structure`) before applying destructive changes.

---

## Related

- [[Getting-Started]] — the full setup sequence these failures usually trace back to
- [[Architecture]] — timeout, chunking, and reconnection behavior explained
- [[Plugin-Development]] — rebuilding when plugin and server drift apart
- [[Tool-Reference#query--eval|figma_eval]] — last-resort escape hatch for debugging document state
