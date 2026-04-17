/**
 * Event buffer module for Figma event streaming.
 *
 * Receives events pushed by the plugin (via connection.ts), stores them in a
 * priority-aware ring buffer, and exposes a filtered poll/drain API consumed
 * by the MCP tools in tools/events.ts.
 *
 * Priority logic: when the buffer exceeds MAX_BUFFER_SIZE, low-priority events
 * (nodechange with only PROPERTY_CHANGE entries) are dropped first, preserving
 * high-priority events (CREATE, DELETE, selectionchange, currentpagechange).
 */

export interface FigmaEvent {
  eventType: string;
  data: any;
  timestamp: number;
  receivedAt: number;
  isPluginOperation: boolean;
}

const MAX_BUFFER_SIZE = 200;

let eventBuffer: FigmaEvent[] = [];
let subscribed = false;

// --- Subscription state ---

export function isSubscribed(): boolean {
  return subscribed;
}

export function setSubscribed(value: boolean): void {
  subscribed = value;
  // Don't clear buffer on unsubscribe -- allow final drain
}

export function clearBuffer(): void {
  eventBuffer = [];
}

export function getBufferSize(): number {
  return eventBuffer.length;
}

// --- Push (called from connection.ts message handler) ---

export function pushEvent(event: FigmaEvent): void {
  if (!subscribed) return;
  eventBuffer.push(event);

  // Priority-aware overflow: high-priority fills first, low-priority gets remaining slots
  if (eventBuffer.length > MAX_BUFFER_SIZE) {
    const isHighPriority = (e: FigmaEvent) =>
      e.eventType !== "nodechange" ||
      e.data?.changes?.some((c: any) => c.type === "CREATE" || c.type === "DELETE");

    const highPri = eventBuffer.filter(isHighPriority);
    const lowPri = eventBuffer.filter(e => !isHighPriority(e));

    // High-priority fills first (up to MAX_BUFFER_SIZE), low-priority gets remaining slots
    const highPriKeep = Math.min(highPri.length, MAX_BUFFER_SIZE);
    const lowPriSlots = MAX_BUFFER_SIZE - highPriKeep;
    eventBuffer = [
      ...highPri.slice(-highPriKeep),
      ...lowPri.slice(-Math.max(0, lowPriSlots)),
    ].sort((a, b) => a.timestamp - b.timestamp);
  }
}

// --- Poll / drain (called from tools/events.ts) ---

export interface PollOptions {
  peek?: boolean;
  eventTypes?: string[];
  since?: number;
  limit?: number;
  excludePluginOperations?: boolean;
}

export function pollEvents(options: PollOptions = {}): FigmaEvent[] {
  let matched = [...eventBuffer];

  // Apply filters (except limit — limit only restricts the return set, not the drain set)
  if (options.eventTypes && options.eventTypes.length > 0) {
    matched = matched.filter(e => options.eventTypes!.includes(e.eventType));
  }
  if (options.since) {
    matched = matched.filter(e => e.timestamp > options.since!);
  }
  if (options.excludePluginOperations) {
    matched = matched.filter(e => !e.isPluginOperation);
  }

  // Drain ALL filter-matching events from buffer (unless peeking),
  // even if limit restricts the returned subset. This prevents stale
  // events from accumulating when the caller uses limit.
  if (!options.peek) {
    if (!options.eventTypes && !options.since && !options.excludePluginOperations) {
      // No filters applied -- drain everything (fast path)
      eventBuffer = [];
    } else {
      // Drain all matched events -- keep only non-matching events
      const drainSet = new Set(matched);
      eventBuffer = eventBuffer.filter(e => !drainSet.has(e));
    }
  }

  // Apply limit to the return set only (after draining)
  const result = options.limit ? matched.slice(-options.limit) : matched;

  return result;
}

// --- Disconnect handler (called from connection.ts close handler) ---

export function onDisconnect(): void {
  subscribed = false;
  // Don't clear buffer -- events from before disconnect may still be useful
}
