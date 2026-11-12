// Event streaming module for the Figma plugin
// Registers Figma event listeners (selectionchange, nodechange, currentpagechange)
// and forwards them to the UI thread for WebSocket transmission.
// All callback references are stored for proper cleanup via figma.off().

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
// window are tagged with isPluginOperation: true so Claude can filter them.
let isPluginOperation = false;

export function setPluginOperationGuard(active: boolean) {
  isPluginOperation = active;
}

// --- Listener State ---
// Store all callback references so we can call figma.off() to remove them.
let eventsEnabled = false;
let selectionCallback: (() => void) | null = null;
let pageChangeCallback: (() => void) | null = null;
let nodeChangeCallback: ((event: NodeChangeEvent) => void) | null = null;
let currentListenerPage: PageNode | null = null; // Track which page has the nodechange listener

// --- Public API ---

export function startEventStreaming() {
  if (eventsEnabled) return;
  eventsEnabled = true;

  // Selection changes (debounced 150ms trailing edge)
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

  // Page changes — re-register nodechange listener on the new page
  pageChangeCallback = () => {
    if (!eventsEnabled) return;
    const page = figma.currentPage;
    emitEvent("currentpagechange", { pageId: page.id, pageName: page.name });
    // Detach old page listener and attach to new page
    attachNodeChangeListener();
  };
  figma.on("currentpagechange", pageChangeCallback);

  // Node changes on current page (leading-edge throttle)
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
  // Remove listener from old page first to prevent orphaned listeners
  detachNodeChangeListener();

  let pendingChanges: any[] = [];
  let throttleTimer: ReturnType<typeof setTimeout> | null = null;
  let lastFlush = 0;

  nodeChangeCallback = (event: NodeChangeEvent) => {
    if (!eventsEnabled) return;

    for (const change of event.nodeChanges) {
      const isRemoved = change.node && change.node.removed;
      const entry: any = {
        type: change.type, // CREATE, DELETE, PROPERTY_CHANGE
        nodeId: change.node.id,
        nodeType: change.node.type,
        properties: change.type === "PROPERTY_CHANGE" ? change.properties : [],
        origin: change.origin, // LOCAL or REMOTE
      };
      // RemovedNode has only id, type, removed — do NOT access .name
      if (!isRemoved && change.node) {
        entry.nodeName = change.node.name;
        // For PROPERTY_CHANGE, include current values of changed properties
        // but only for serializable primitives (skip complex objects like fills)
        if (change.type === "PROPERTY_CHANGE" && change.properties) {
          const values: Record<string, string | number | boolean> = {};
          for (const prop of change.properties) {
            if (prop in change.node) {
              const val = (change.node as any)[prop];
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
    if (!eventsEnabled) return; // Guard against ghost-emission after stop
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
// Sends event data from the plugin main thread to the UI thread
// via figma.ui.postMessage. The UI thread forwards over WebSocket.

function emitEvent(eventType: string, data: any) {
  figma.ui.postMessage({
    type: "figma-event",
    eventType,
    data,
    timestamp: Date.now(),
    isPluginOperation, // Tag whether this was caused by a plugin command
  });
}
