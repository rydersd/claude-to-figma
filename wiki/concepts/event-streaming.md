# Event Streaming

> Brief: Bidirectional event streaming from Figma to Claude Code. Plugin pushes `selectionchange` / `nodechange` / `currentpagechange` through the WebSocket relay into a priority buffer on the MCP server. Claude polls events via `figma_events_poll`.
> Tags: architecture, events, mcp, websocket, figma-plugin
> Created: 2026-04-16
> Updated: 2026-04-16
> First landed: PR #14, merged to `main` as commit `1d02041`

## Motivation

Before this feature, the system was one-directional: Claude sent commands, Figma executed. The plugin never initiated. That made reactive workflows impossible — Claude had no way to "know" the designer just selected a frame or moved a node without polling Figma state with expensive reads.

## Architecture

```
Figma event (selectionchange / nodechange / currentpagechange)
  → events.ts: check plugin operation guard, gather data, debounce/throttle
  → figma.ui.postMessage({ type: "figma-event", ... })
  → ui.html: forward over WebSocket as { type: "event", channel, ... }
  → socket.ts: verify channel membership, route to other members
  → connection.ts: receive, push to priority event buffer
  → figma_events_poll tool: Claude reads buffer with optional filters
```

Events flow plugin → server only (one direction). The relay follows the existing `progress_update` pattern including channel-membership verification.

## Tools

### `figma_events_subscribe`

Toggle event streaming on/off in the plugin.

- Param: `enabled: boolean`
- Must be called before any events will be buffered

### `figma_events_poll`

Read buffered events with optional filters. Drains matching events from the buffer by default.

- `peek: boolean` — read without clearing
- `eventTypes: ("selectionchange" | "nodechange" | "currentpagechange")[]`
- `since: number` — ms epoch timestamp filter
- `limit: number` — cap on events returned (most recent first)
- `excludePluginOperations: boolean` — filter out events caused by plugin commands

## Key Design Decisions

### Poll-based, not MCP resources

MCP supports resource subscriptions with `notifications/resources/updated`, but Claude Code doesn't reactively act on them today. Poll-based tools work with current Claude Code behavior. When resource subscriptions land, expose events at `figma://events` alongside the poll tool.

### Tag plugin operations, don't suppress

The `isPluginOperation` flag tags events rather than suppressing them. Suppression during async plugin operations (setTimeout, chunked work) would miss legitimate events. Consumers filter with `excludePluginOperations: true`.

The guard wraps `handleCommand` in `main.ts` with a `try/finally` that sets the flag, plus a **500ms cooldown** because debounced/throttled events fire after `handleCommand` returns. Without the cooldown, events triggered by plugin commands would leak through as user-caused.

### Page-scoped `nodechange` over `documentchange`

For `dynamic-page` plugins, `figma.currentPage.on("nodechange")` is lighter weight and does not require `loadAllPagesAsync()`. The tradeoff is that node changes on background pages are invisible — acceptable because Claude only acts on the current page anyway.

### Priority buffer (200 cap, high-pri fill first)

The buffer caps at 200 events. When full, high-priority events (CREATE, DELETE, `selectionchange`, `currentpagechange`) are preserved over low-priority ones (PROPERTY_CHANGE).

The original implementation reserved 40 slots for high-pri, which inverted into a **cap** when high-pri events dominated. The fix: fill high-priority up to `MAX_BUFFER_SIZE` first; low-priority gets remaining slots. Three reviewers caught this independently.

## Listener Lifecycle (subtle)

1. **`figma.off()` requires the same function reference**. All callbacks must be stored at module level — the flag-gating pattern (checking a boolean inside the callback) leaks listeners on subscribe/unsubscribe cycles.
2. **Page change re-attaches nodechange**. The listener is page-scoped. When the current page changes, explicitly `.off()` the old page and `.on()` the new one. Tracked via `currentListenerPage`.
3. **`RemovedNode` has only `id` / `type` / `removed`** — no `.name`. DELETE events will never have `nodeName`.

## Known Limitations

1. **Undo/redo indistinguishable from user actions.** Figma API exposes no undo flag. CREATE/DELETE/PROPERTY_CHANGE from undo look identical to direct user actions.
2. **DELETE events have no node name.** Consumers can correlate with prior CREATE events if needed.
3. **Plugin-caused events are tagged, not suppressed.** See decision above.
4. **No guaranteed delivery.** Overflow drops oldest low-priority events. Events during WebSocket disconnect are lost.
5. **Multiplayer noise.** REMOTE events from other users fill the buffer in multiplayer sessions. Filter with `origin: "LOCAL"` at consumer level.

## Gotchas Found During Review

- `head -n -1` is GNU-only; macOS `head` doesn't support negative line counts. Use `sed '$d'` instead.
- Shell heredoc injection: unquoted `<< EOF` allows command execution via `$()` and backticks in variables. Use `printf '%s'` for safe variable writing.
- Selective drain + limit: if you drain only the events returned by a limited poll, excess matching events strand in the buffer permanently. Fix: drain ALL matching events, return only the limited subset.

## Files

| File | Role |
|------|------|
| `src/socket.ts:199-213` | Relay event routing with channel membership check |
| `src/claude_figma_plugin/src/events.ts` | Plugin event listeners, lifecycle, guard, throttle |
| `src/claude_figma_plugin/src/main.ts:40-63` | Operation guard wrapper + subscribe/unsubscribe commands |
| `src/claude_figma_plugin/ui.html:910-930` | Event forwarding over WebSocket + streaming indicator |
| `src/claude_to_figma_mcp/events.ts` | Priority-aware event buffer |
| `src/claude_to_figma_mcp/tools/events.ts` | `figma_events_subscribe` + `figma_events_poll` tools |
| `src/claude_to_figma_mcp/connection.ts:90-100` | Event reception + disconnect reset |

## See Also

- `thoughts/shared/plans/2026-04-11-figma-event-streaming.md` — original implementation plan with 19-issue review resolution log
- `thoughts/shared/handoffs/general/2026-04-16_17-54-47_event-streaming-and-review-fixes.md` — handoff covering 3 rounds of adversarial review
