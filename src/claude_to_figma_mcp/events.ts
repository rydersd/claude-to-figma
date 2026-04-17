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
// Reserve slots for high-priority events during overflow trimming
const PRIORITY_RESERVE = 40;

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

  // Priority-aware overflow: drop PROPERTY_CHANGE-only nodechange events first
  if (eventBuffer.length > MAX_BUFFER_SIZE) {
    const isHighPriority = (e: FigmaEvent) =>
      e.eventType !== "nodechange" ||
      e.data?.changes?.some((c: any) => c.type === "CREATE" || c.type === "DELETE");

    const highPri = eventBuffer.filter(isHighPriority);
    const lowPri = eventBuffer.filter(e => !isHighPriority(e));

    // Keep all high-priority (capped at PRIORITY_RESERVE from most recent)
    // plus as many low-priority as fit in the remaining slots
    const lowPriSlots = MAX_BUFFER_SIZE - Math.min(highPri.length, PRIORITY_RESERVE);
    eventBuffer = [
      ...highPri.slice(-PRIORITY_RESERVE),
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
    if (!options.eventTypes && !options.since && !options.excludePluginOperations) {
      // No filters applied -- drain everything (fast path)
      eventBuffer = [];
    } else {
      // Only drain the events we're returning -- keep non-matching events
      const returned = new Set(result);
      eventBuffer = eventBuffer.filter(e => !returned.has(e));
    }
  }

  return result;
}

// --- Disconnect handler (called from connection.ts close handler) ---

export function onDisconnect(): void {
  subscribed = false;
  // Don't clear buffer -- events from before disconnect may still be useful
}
