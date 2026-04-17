# Figma Event Streaming Implementation Plan

## Overview

Add bidirectional communication to the claude-to-figma bridge. Currently the system is one-directional: Claude Code sends commands, Figma executes. The plugin never initiates. This plan adds event streaming where the Figma plugin pushes design changes (selection, node mutations, page switches) back to Claude Code through the existing WebSocket relay, enabling reactive design workflows.

## Current State Analysis

The system has three components connected via WebSocket:

```
Claude Code <--(stdio)--> MCP Server <--(ws)--> Relay <--(ws)--> Figma Plugin
                                        port 3055
```

**What exists:**
- Request/response: MCP server sends `type: "message"`, plugin responds with matching UUID
- Progress updates: Plugin sends `type: "progress_update"` — unidirectional, bypasses broadcast wrapper, resets inactivity timeout on pending request (`src/socket.ts:185-197`). The relay verifies channel membership before forwarding.
- Channel isolation: Clients join named channels, messages broadcast only within channel (`src/socket.ts:140-182`)
- Two-thread plugin architecture: Main thread (Figma sandbox) communicates with UI thread (WebSocket access) via `figma.ui.postMessage` / `parent.postMessage`

**What's missing:**
- No mechanism for the plugin to send unsolicited messages (events) to the MCP server
- MCP server only processes responses matched by UUID — no handler for event-type messages
- No Figma event listeners registered (selectionchange, nodechange, currentpagechange)
- No MCP tools for subscribing to or polling events

### Key Discoveries:
- `progress_update` path in relay (`src/socket.ts:185-197`) is the architectural template — events follow the same pattern, including channel membership verification
- `figma.currentPage.on("nodechange")` is preferred over `figma.on("documentchange")` for dynamic-page plugins — no `loadAllPagesAsync()` required
- `selectionchange` callback is arg-free (`ArgFreeEventType`) — must read `figma.currentPage.selection` inside callback
- Figma batches events internally (~200-500ms coalescing) but we should still debounce before WebSocket send
- `figma.off()` requires the exact same function reference passed to `figma.on()` — must store all callback references
- `selectionchange` and `nodechange` WILL fire from plugin-initiated operations (e.g., `set_selections`, `create_node_tree`) — need a plugin operation guard to distinguish user vs plugin changes
- `RemovedNode` (from DELETE events) has only `id`, `type`, `removed` — no `name` property
- The relay has no client identity system — clients are anonymous WebSocket references in channel Sets (`src/socket.ts:6`)

## Desired End State

After implementation:
1. The Figma plugin streams `selectionchange`, `nodechange`, and `currentpagechange` events through the WebSocket relay
2. The MCP server buffers events and exposes them via 2 tools: `figma_events_subscribe` and `figma_events_poll`
3. Claude Code can reactively respond to designer actions without polling Figma state
4. Events from plugin-initiated operations are tagged with `origin: "plugin"` so Claude can filter them
5. Events are opt-in — no overhead when not subscribed
6. UI shows event streaming status (indicator in plugin UI)

**Verification:**
- Open Figma with plugin connected, call `figma_events_subscribe` with `enabled: true` from Claude Code
- Select different nodes in Figma — `figma_events_poll` returns selection events with node IDs/types/names
- Move a frame — `figma_events_poll` returns property change event with node ID, changed properties, and current values
- Switch pages — `figma_events_poll` returns page change event
- Call `figma_events_subscribe` with `enabled: false` — events stop flowing, no overhead

## What We're NOT Doing

- **No push notifications to Claude Code** — MCP supports resource subscriptions (`notifications/resources/updated`) but Claude Code does not reactively act on them today. Events accumulate in a buffer; Claude polls with `figma_events_poll`. When Claude Code gains resource subscription support, we can expose events as an MCP resource at `figma://events` alongside the tool.
- **No `documentchange` listener** — using page-scoped `nodechange` instead (lighter, no `loadAllPagesAsync()`)
- **No persistent event history** — buffer is capped (last 200 events), not persisted
- **No reactive MCP prompts yet** — that's a follow-up after the infrastructure works
- **No undo/redo detection** — Figma's API provides no undo flag. Undo/redo operations appear as normal CREATE/DELETE/PROPERTY_CHANGE events with `origin: "LOCAL"`. This is a known Figma API limitation documented for consumers.

## Implementation Approach

Follow the `progress_update` pattern: add a new `type: "event"` message path through all three components. Events flow plugin-to-server only (one direction). The MCP server buffers them and exposes via poll-based tools.

```
Figma (selectionchange/nodechange/pagechange)
  --> events.ts: check plugin operation guard, gather data, debounce
  --> figma.ui.postMessage({ type: "figma-event", ... })
  --> ui.html: forward over WebSocket as type: "event"
  --> socket.ts: verify channel membership, route to other members
  --> connection.ts: receive, push to priority event buffer
  --> figma_events_poll tool: Claude reads buffer with optional filters
```

---

## Phase 1: Relay Event Routing

### Overview
Add `type: "event"` message handling to the WebSocket relay. Small change following the existing `progress_update` pattern, including channel membership verification.

### Changes Required:

#### 1. WebSocket Relay
**File**: `src/socket.ts`
**Changes**: Add event message routing after the progress_update handler (~line 197)

```typescript
// After the progress_update handler block:
if (data.type === "event") {
  const channelName = data.channel;
  const channelClients = channelName ? channels.get(channelName) : undefined;
  // Verify sender is in the channel (same check as progress_update)
  if (!channelClients || !channelClients.has(ws)) return;
  for (const client of channelClients) {
    if (client !== ws && client.readyState === 1) {
      client.send(JSON.stringify(data));
    }
  }
  return;
}
```

Events are forwarded verbatim to other channel members (same as progress_update), not wrapped in a broadcast envelope. Channel membership is verified to prevent cross-channel event injection.

### Success Criteria:

#### Automated Verification:
- [ ] `bun run build` passes
- [ ] Relay starts without errors: `bun socket`

#### Manual Verification:
- [ ] Send a mock `type: "event"` message via wscat to the relay — verify it arrives at other channel members
- [ ] Send a `type: "event"` with a channel the sender hasn't joined — verify it is dropped

---

## Phase 2: Plugin Event Emission

### Overview
Register Figma event listeners in the plugin main thread with proper lifecycle management (store references for `figma.off()`), a plugin operation guard to suppress self-caused events, leading-edge throttling, and debounced forwarding through the UI thread.

### Changes Required:

#### 1. New Event Module
**File**: `src/claude_figma_plugin/src/events.ts` (new file)
**Changes**: Event listeners with proper lifecycle, plugin operation guard, leading-edge throttle

```typescript
// --- Helpers ---

function debounce(fn: (...args: any[]) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: any[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// --- Plugin Operation Guard ---
// Set to true while handleCommand is executing. Events during this
// window are tagged with origin: "plugin" so Claude can filter them.
let isPluginOperation = false;

export function setPluginOperationGuard(active: boolean) {
  isPluginOperation = active;
}

// --- Listener State ---
// Store all callback references so we can call figma.off() to remove them.
let eventsEnabled = false;
let selectionCallback: (() => void) | null = null;
let pageChangeCallback: (() => void) | null = null;
let nodeChangeCallback: ((event: any) => void) | null = null;
let currentListenerPage: any = null; // Track which page has the nodechange listener

// --- Public API ---

export function startEventStreaming() {
  if (eventsEnabled) return;
  eventsEnabled = true;

  // Selection changes (debounced 150ms)
  selectionCallback = debounce(() => {
    if (!eventsEnabled) return;
    const selection = figma.currentPage.selection;
    // Cap at 50 nodes to limit serialization cost
    const nodes = selection.slice(0, 50).map(n => ({
      id: n.id,
      name: n.name,
      type: n.type,
      width: "width" in n ? (n as any).width : undefined,
      height: "height" in n ? (n as any).height : undefined,
    }));
    emitEvent("selectionchange", {
      nodes,
      totalSelected: selection.length,
      pageId: figma.currentPage.id,
      pageName: figma.currentPage.name,
    });
  }, 150);
  figma.on("selectionchange", selectionCallback);

  // Page changes
  pageChangeCallback = () => {
    if (!eventsEnabled) return;
    const page = figma.currentPage;
    emitEvent("currentpagechange", { pageId: page.id, pageName: page.name });
    // Re-register nodechange listener on new page (remove old first)
    attachNodeChangeListener();
  };
  figma.on("currentpagechange", pageChangeCallback);

  // Node changes on current page
  attachNodeChangeListener();

  figma.ui.postMessage({ type: "event-streaming-status", enabled: true });
}

export function stopEventStreaming() {
  if (!eventsEnabled) return;
  eventsEnabled = false;

  // Remove all listeners using stored references
  if (selectionCallback) {
    figma.off("selectionchange", selectionCallback);
    selectionCallback = null;
  }
  if (pageChangeCallback) {
    figma.off("currentpagechange", pageChangeCallback);
    pageChangeCallback = null;
  }
  detachNodeChangeListener();

  figma.ui.postMessage({ type: "event-streaming-status", enabled: false });
}

// --- Node Change Listener (page-scoped) ---

function attachNodeChangeListener() {
  // Remove listener from old page first
  detachNodeChangeListener();

  let pendingChanges: any[] = [];
  let throttleTimer: ReturnType<typeof setTimeout> | null = null;
  let lastFlush = 0;

  nodeChangeCallback = (event: any) => {
    if (!eventsEnabled) return;

    for (const change of event.nodeChanges) {
      const isRemoved = change.node && change.node.removed;
      const entry: any = {
        type: change.type, // CREATE, DELETE, PROPERTY_CHANGE
        nodeId: change.id,
        nodeType: change.node ? change.node.type : undefined,
        properties: change.properties || [],
        origin: change.origin, // LOCAL or REMOTE
      };
      // RemovedNode has no name — only include name for non-deleted nodes
      if (!isRemoved && change.node) {
        entry.nodeName = change.node.name;
        // For PROPERTY_CHANGE, include current values of changed properties
        if (change.type === "PROPERTY_CHANGE" && change.properties) {
          const values: any = {};
          for (const prop of change.properties) {
            if (prop in change.node) {
              const val = change.node[prop];
              // Only include serializable primitives (skip complex objects like fills)
              if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
                values[prop] = val;
              }
            }
          }
          if (Object.keys(values).length > 0) {
            entry.currentValues = values;
          }
        }
      }
      pendingChanges.push(entry);
    }

    // Leading-edge throttle: flush immediately on first event, then gate for 300ms
    const now = Date.now();
    if (now - lastFlush >= 300) {
      flushChanges();
    } else if (!throttleTimer) {
      throttleTimer = setTimeout(() => {
        flushChanges();
        throttleTimer = null;
      }, 300 - (now - lastFlush));
    }
  };

  function flushChanges() {
    if (pendingChanges.length === 0) return;
    lastFlush = Date.now();
    emitEvent("nodechange", {
      changes: pendingChanges,
      pageId: figma.currentPage.id,
      pageName: figma.currentPage.name,
    });
    pendingChanges = [];
  }

  currentListenerPage = figma.currentPage;
  currentListenerPage.on("nodechange", nodeChangeCallback);
}

function detachNodeChangeListener() {
  if (nodeChangeCallback && currentListenerPage) {
    try {
      currentListenerPage.off("nodechange", nodeChangeCallback);
    } catch (e) {
      // Page may have been removed — ignore
    }
  }
  nodeChangeCallback = null;
  currentListenerPage = null;
}

// --- Emit ---

function emitEvent(eventType: string, data: any) {
  figma.ui.postMessage({
    type: "figma-event",
    eventType,
    data,
    timestamp: Date.now(),
    isPluginOperation, // Tag whether this was caused by a plugin command
  });
}
```

#### 2. Main Thread Integration
**File**: `src/claude_figma_plugin/src/main.ts`
**Changes**: Import events module, add plugin operation guard around handleCommand, add subscribe/unsubscribe commands

```typescript
import { startEventStreaming, stopEventStreaming, setPluginOperationGuard } from './events';

// Wrap handleCommand to set the plugin operation guard:
// In figma.ui.onmessage handler, around the handleCommand call:
setPluginOperationGuard(true);
try {
  const result = await handleCommand(msg.command, msg.params);
  // ... send result ...
} catch (e) {
  // ... send error ...
} finally {
  setPluginOperationGuard(false);
}

// Add two new cases in the handleCommand switch:
case "subscribe_events":
  startEventStreaming();
  return { success: true, message: "Event streaming started" };

case "unsubscribe_events":
  stopEventStreaming();
  return { success: true, message: "Event streaming stopped" };
```

#### 3. UI Thread Forwarding
**File**: `src/claude_figma_plugin/ui.html`
**Changes**: Add handler in `window.onmessage` to forward events over WebSocket

```javascript
case "figma-event":
  if (state.socket && state.connected && state.channel) {
    state.socket.send(JSON.stringify({
      type: "event",
      channel: state.channel,
      eventType: message.eventType,
      data: message.data,
      timestamp: message.timestamp,
      isPluginOperation: message.isPluginOperation || false,
    }));
  }
  break;

case "event-streaming-status":
  updateEventStreamingUI(message.enabled);
  break;
```

Add a small UI indicator (colored dot next to connection status) showing event streaming state.

### Success Criteria:

#### Automated Verification:
- [ ] `bun run build` passes
- [ ] No TypeScript errors in events.ts

#### Manual Verification:
- [ ] `subscribe_events` → UI shows streaming indicator
- [ ] Select nodes → selectionchange events emitted (check relay logs)
- [ ] Move nodes → nodechange events with currentValues (x, y)
- [ ] Delete node → nodechange DELETE event (no nodeName, has nodeType)
- [ ] Switch pages → currentpagechange event, old page listener removed
- [ ] `unsubscribe_events` → events stop, re-subscribe works cleanly
- [ ] Send `set_selections` command → event has `isPluginOperation: true`
- [ ] User selects manually → event has `isPluginOperation: false`

**Implementation Note**: Pause here for manual testing before proceeding.

---

## Phase 3: MCP Server Event Consumption

### Overview
Add event reception, priority buffering with filters, and 2 MCP tools. Handle reconnection state.

### Changes Required:

#### 1. Event Buffer Module
**File**: `src/claude_to_figma_mcp/events.ts` (new file)
**Changes**: Priority buffer, subscription state, filtered poll/drain

```typescript
import { sendCommandToFigma } from "./connection.js";

interface FigmaEvent {
  eventType: string;
  data: any;
  timestamp: number;
  receivedAt: number;
  isPluginOperation: boolean;
}

const MAX_BUFFER_SIZE = 200;
// Reserve 20% of buffer for high-priority events (CREATE, DELETE)
const PRIORITY_RESERVE = 40;

let eventBuffer: FigmaEvent[] = [];
let subscribed = false;

export function isSubscribed(): boolean {
  return subscribed;
}

export function setSubscribed(value: boolean): void {
  subscribed = value;
  // Don't clear buffer on unsubscribe — allow final drain
}

export function clearBuffer(): void {
  eventBuffer = [];
}

export function pushEvent(event: FigmaEvent): void {
  if (!subscribed) return;
  eventBuffer.push(event);

  // Priority-aware overflow: when over limit, drop PROPERTY_CHANGE events
  // before CREATE/DELETE events
  if (eventBuffer.length > MAX_BUFFER_SIZE) {
    // Count high-priority events (CREATE, DELETE, currentpagechange, selectionchange)
    const isHighPriority = (e: FigmaEvent) =>
      e.eventType !== "nodechange" ||
      e.data?.changes?.some((c: any) => c.type === "CREATE" || c.type === "DELETE");

    const highPri = eventBuffer.filter(isHighPriority);
    const lowPri = eventBuffer.filter(e => !isHighPriority(e));

    // Keep all high-priority + most recent low-priority up to cap
    const lowPriSlots = MAX_BUFFER_SIZE - Math.min(highPri.length, PRIORITY_RESERVE);
    eventBuffer = [
      ...highPri.slice(-PRIORITY_RESERVE),
      ...lowPri.slice(-Math.max(0, lowPriSlots)),
    ].sort((a, b) => a.timestamp - b.timestamp);
  }
}

interface PollOptions {
  peek?: boolean;
  eventTypes?: string[];
  since?: number;
  limit?: number;
  excludePluginOperations?: boolean;
}

export function pollEvents(options: PollOptions = {}): FigmaEvent[] {
  let result = [...eventBuffer];

  // Apply filters
  if (options.eventTypes && options.eventTypes.length > 0) {
    result = result.filter(e => options.eventTypes!.includes(e.eventType));
  }
  if (options.since) {
    result = result.filter(e => e.timestamp > options.since!);
  }
  if (options.excludePluginOperations) {
    result = result.filter(e => !e.isPluginOperation);
  }
  if (options.limit) {
    result = result.slice(-options.limit);
  }

  // Drain matched events from buffer (unless peeking)
  if (!options.peek) {
    const drainedIds = new Set(result.map((_, i) => i));
    // Can't use index-based removal after filtering, so drain all if no filters
    if (!options.eventTypes && !options.since && !options.excludePluginOperations) {
      eventBuffer = [];
    } else {
      // Only drain the events we're returning — keep the rest
      const returned = new Set(result);
      eventBuffer = eventBuffer.filter(e => !returned.has(e));
    }
  }

  return result;
}

export function getBufferSize(): number {
  return eventBuffer.length;
}

// Reset subscription state on WebSocket disconnect
export function onDisconnect(): void {
  subscribed = false;
  // Don't clear buffer — events from before disconnect may still be useful
}
```

#### 2. Connection Event Handler
**File**: `src/claude_to_figma_mcp/connection.ts`
**Changes**: Add event message handling + reset subscription on disconnect

In the `ws.on("message", ...)` handler, after the progress_update check:

```typescript
// Handle events from Figma plugin — strict type check only
if (json.type === "event") {
  pushEvent({
    eventType: json.eventType,
    data: json.data,
    timestamp: json.timestamp || Date.now(),
    receivedAt: Date.now(),
    isPluginOperation: json.isPluginOperation || false,
  });
  return;
}
```

In the `ws.on("close", ...)` handler, add:
```typescript
onDisconnect(); // Reset event subscription state
```

#### 3. Type Updates
**File**: `src/claude_to_figma_mcp/types.ts`
**Changes**: Add `subscribe_events` and `unsubscribe_events` to the `FigmaCommand` type union

#### 4. MCP Tools
**File**: `src/claude_to_figma_mcp/server.ts`
**Changes**: Register 2 new tools with proper error handling

```typescript
// figma_events_subscribe — Start or stop receiving Figma design events
server.tool("figma_events_subscribe", {
  enabled: z.boolean().describe("true to start streaming, false to stop"),
}, async ({ enabled }) => {
  try {
    if (enabled) {
      const result = await sendCommandToFigma("subscribe_events", {});
      if (result && (result as any).success) {
        setSubscribed(true);
        return { content: [{ type: "text", text: "Event streaming started. Use figma_events_poll to read events." }] };
      }
      return { content: [{ type: "text", text: "Failed to start event streaming on the Figma side." }] };
    } else {
      const result = await sendCommandToFigma("unsubscribe_events", {});
      setSubscribed(false);
      return { content: [{ type: "text", text: "Event streaming stopped." }] };
    }
  } catch (error: any) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }] };
  }
});

// figma_events_poll — Read buffered design events with optional filters
server.tool("figma_events_poll", {
  peek: z.boolean().optional().describe("If true, read events without clearing them from the buffer"),
  eventTypes: z.array(z.enum(["selectionchange", "nodechange", "currentpagechange"])).optional()
    .describe("Only return events of these types"),
  since: z.number().optional().describe("Only return events after this timestamp (ms epoch)"),
  limit: z.number().optional().describe("Max number of events to return (most recent first)"),
  excludePluginOperations: z.boolean().optional().describe("If true, filter out events caused by plugin commands (default: false)"),
}, async ({ peek, eventTypes, since, limit, excludePluginOperations }) => {
  if (!isSubscribed()) {
    return { content: [{ type: "text", text: "Not subscribed to events. Call figma_events_subscribe first." }] };
  }
  const events = pollEvents({ peek, eventTypes, since, limit, excludePluginOperations });
  if (events.length === 0) {
    return { content: [{ type: "text", text: `No events in buffer. (Buffer size: ${getBufferSize()})` }] };
  }
  return { content: [{ type: "text", text: JSON.stringify(events, null, 2) }] };
});
```

### Success Criteria:

#### Automated Verification:
- [ ] `bun run build` passes
- [ ] MCP server starts without errors

#### Manual Verification:
- [ ] Full pipeline: subscribe → select node → poll returns event
- [ ] Filter by eventType: `figma_events_poll` with `eventTypes: ["selectionchange"]` returns only selection events
- [ ] `excludePluginOperations: true` filters out plugin-caused events
- [ ] `since` timestamp filter works
- [ ] `limit` parameter caps results
- [ ] Buffer priority: drag (100+ PROPERTY_CHANGE events), then delete a node → DELETE event is preserved in buffer
- [ ] Disconnect/reconnect: subscription resets, must re-subscribe
- [ ] Subscribe when not connected → returns error (not crash)
- [ ] Subscribe when no channel joined → returns error (not crash)

---

## Testing Strategy

### End-to-End Test Sequence:
1. Start relay: `bun socket`
2. Start MCP server (via Claude Code)
3. Open Figma, run plugin, join channel
4. Join same channel from MCP server
5. Call `figma_events_subscribe` with `enabled: true`
6. In Figma: select a rectangle → `figma_events_poll` shows selectionchange with node details
7. In Figma: move the rectangle → `figma_events_poll` shows nodechange with PROPERTY_CHANGE, properties `["x", "y"]`, and currentValues `{x: 100, y: 200}`
8. In Figma: create a new frame → nodechange with CREATE
9. In Figma: delete a node → nodechange with DELETE (no nodeName, has nodeType)
10. In Figma: switch pages → currentpagechange event
11. From Claude Code: call `set_selections` → `figma_events_poll` with `excludePluginOperations: true` should NOT show the selection event
12. Call `figma_events_subscribe` with `enabled: false` → verify no more events accumulate

### Performance Testing:
- Rapidly select different nodes — verify 150ms debounce prevents flood
- Drag a node across the canvas — verify leading-edge throttle sends first event immediately, then gates 300ms
- Leave streaming on for 5+ minutes — verify no memory leak (listeners properly managed)
- Subscribe/unsubscribe 10 times rapidly — verify no listener accumulation

### Edge Cases:
- Subscribe before plugin is connected → error message returned
- Subscribe when no channel joined → error message returned
- Plugin disconnects while subscribed → `isSubscribed()` resets to false, must re-subscribe
- `figma_events_poll` when not subscribed → returns "Not subscribed" message
- DELETE event → `nodeName` is undefined (documented limitation)
- Undo/redo → appears as normal LOCAL events (documented limitation)
- Multiplayer REMOTE events → included in buffer with `origin: "REMOTE"` tag
- 100+ nodes selected → only first 50 reported (with `totalSelected` count)

## Performance Considerations

- **Debounce `selectionchange`**: 150ms — fast enough to feel responsive, slow enough to batch rapid clicks
- **Leading-edge throttle `nodechange`**: Sends first event immediately (low latency), then gates for 300ms before next flush
- **Buffer cap**: 200 events max with priority-aware overflow (CREATE/DELETE preserved over PROPERTY_CHANGE)
- **Selection cap**: First 50 nodes only (with totalSelected count), prevents expensive serialization
- **No overhead when not subscribed**: Listeners not registered at all — only attached on subscribe
- **Clean lifecycle**: All listeners stored by reference, properly removed with `figma.off()` on unsubscribe and page change
- **Plugin operation guard**: Near-zero overhead (boolean flag check)
- **WebSocket message size**: Events are small JSON (~200-500 bytes each) — no chunking needed

## Known Limitations

1. **Undo/redo indistinguishable from user actions** — Figma API provides no undo flag. Consumers must accept that CREATE/DELETE/PROPERTY_CHANGE from undo look identical to direct user actions.
2. **DELETE events have no node name** — `RemovedNode` only carries `id`, `type`, and `removed: true`. Consumers can correlate with prior CREATE events if needed.
3. **Plugin-caused events are tagged, not suppressed** — We tag them with `isPluginOperation: true` rather than suppressing, because suppression during async operations (setTimeout, etc.) would miss events. Consumers filter with `excludePluginOperations: true`.
4. **No guaranteed delivery** — If the buffer overflows, oldest low-priority events are dropped. Events during WebSocket disconnect are lost.
5. **Multiplayer noise** — In multiplayer sessions, REMOTE events from other users will fill the buffer. Filter with `origin: "LOCAL"` at the consumer level.

## Files to Create/Modify

| File | Action | Phase |
|------|--------|-------|
| `src/socket.ts` | Modify (add event routing with membership check) | 1 |
| `src/claude_figma_plugin/src/events.ts` | Create (event listeners, lifecycle, guard, throttle) | 2 |
| `src/claude_figma_plugin/src/main.ts` | Modify (import events, add guard wrapper, add commands) | 2 |
| `src/claude_figma_plugin/ui.html` | Modify (forward events, streaming indicator) | 2 |
| `src/claude_to_figma_mcp/events.ts` | Create (priority buffer, filtered poll) | 3 |
| `src/claude_to_figma_mcp/connection.ts` | Modify (handle inbound events, reset on disconnect) | 3 |
| `src/claude_to_figma_mcp/types.ts` | Modify (add subscribe/unsubscribe to FigmaCommand union) | 3 |
| `src/claude_to_figma_mcp/server.ts` | Modify (register 2 new tools with error handling) | 3 |

## Event Message Format

```json
{
  "type": "event",
  "channel": "<channel-name>",
  "eventType": "selectionchange" | "nodechange" | "currentpagechange",
  "isPluginOperation": false,
  "data": {
    // selectionchange:
    "nodes": [{ "id": "1:23", "name": "Button", "type": "FRAME", "width": 120, "height": 40 }],
    "totalSelected": 1,
    "pageId": "0:1",
    "pageName": "Page 1"

    // nodechange:
    "changes": [{
      "type": "PROPERTY_CHANGE",
      "nodeId": "1:23",
      "nodeName": "Button",
      "nodeType": "FRAME",
      "properties": ["x", "y"],
      "currentValues": { "x": 150, "y": 200 },
      "origin": "LOCAL"
    }, {
      "type": "DELETE",
      "nodeId": "1:45",
      "nodeType": "RECTANGLE",
      "properties": [],
      "origin": "LOCAL"
    }],
    "pageId": "0:1",
    "pageName": "Page 1"

    // currentpagechange:
    "pageId": "0:2",
    "pageName": "Page 2"
  },
  "timestamp": 1712345678000
}
```

## Review Resolution Log

Issues identified by 3 adversarial review agents, all resolved in this revision:

| Issue | Resolution |
|-------|-----------|
| Listener accumulation memory leak | Store all callback refs, use `figma.off()` in `stopEventStreaming()` and `detachNodeChangeListener()` |
| Page switch orphans nodechange listeners | `attachNodeChangeListener()` calls `detachNodeChangeListener()` first, tracks page reference |
| selectionchange/nodechange fires from plugin ops | Plugin operation guard (`isPluginOperation` flag), tagged on events, filterable via `excludePluginOperations` |
| RemovedNode has no name | Guard on `change.node.removed`, only include name for non-deleted nodes |
| Buffer overflow drops CREATE/DELETE | Priority-aware overflow preserves CREATE/DELETE over PROPERTY_CHANGE |
| Relay doesn't verify channel membership | Added `channelClients.has(ws)` check matching progress_update pattern |
| WebSocket reconnect breaks subscription | `onDisconnect()` resets `subscribed = false` in close handler |
| subscribe_events sets state on failure | Check `result.success` before `setSubscribed(true)` |
| `json.type === "event" \|\| json.eventType` too loose | Strict `json.type === "event"` only |
| poll_events schema too thin | Added `eventTypes`, `since`, `limit`, `excludePluginOperations` filters |
| No error handling on tools | try/catch matching existing tool patterns |
| FigmaCommand type not updated | Added to files-to-modify table |
| 3 tools too many | Consolidated to 2: `figma_events_subscribe` (toggle) + `figma_events_poll` (read) |
| Buffer cleared on unsubscribe | Changed: unsubscribe stops streaming but preserves buffer for final drain |
| Trailing-edge throttle = 300ms latency | Changed to leading-edge throttle (flush immediately, gate 300ms) |
| nodechange lacks current values | Added `currentValues` for serializable primitive properties |
| Large selection performance | Capped at 50 nodes with `totalSelected` count |
| Undo/redo undetectable | Documented as known Figma API limitation |
| Multiplayer REMOTE events | Included with origin tag, documented for consumer filtering |
