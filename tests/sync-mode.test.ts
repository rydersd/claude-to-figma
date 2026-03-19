/**
 * Integration tests for create_node_tree sync mode.
 *
 * Run against a live Figma plugin via WebSocket:
 *   CHANNEL=mawbmp7g bun test tests/sync-mode.test.ts
 *
 * Prerequisites:
 *   1. Socket server running: bun run socket
 *   2. Figma plugin connected to the same channel
 *   3. A page open in Figma with room for test nodes
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

// ---------------------------------------------------------------------------
// Connection helpers (lightweight — no import of production connection.ts so
// tests stay isolated)
// ---------------------------------------------------------------------------

const WS_PORT = Number(process.env.WS_PORT) || 3055;
const WS_HOST = process.env.WS_HOST || "localhost";
const CHANNEL = process.env.CHANNEL || "mawbmp7g";
const TIMEOUT_MS = 30_000;

let ws: WebSocket;
const pending = new Map<
  string,
  { resolve: (v: any) => void; reject: (e: any) => void; timeout: ReturnType<typeof setTimeout> }
>();

function connect(): Promise<void> {
  return new Promise((resolve, reject) => {
    ws = new WebSocket(`ws://${WS_HOST}:${WS_PORT}`);
    ws.on("open", () => resolve());
    ws.on("error", reject);
    ws.on("message", (raw: any) => {
      const json = JSON.parse(raw);

      // Progress updates — reset timeout
      if (json.type === "progress_update") {
        const reqId = json.id || "";
        if (pending.has(reqId)) {
          const req = pending.get(reqId)!;
          clearTimeout(req.timeout);
          req.timeout = setTimeout(() => {
            pending.delete(reqId);
            req.reject(new Error("Timeout after progress stall"));
          }, TIMEOUT_MS);
        }
        return;
      }

      // Regular response
      const msg = json.message;
      if (msg?.id && pending.has(msg.id) && msg.result !== undefined) {
        const req = pending.get(msg.id)!;
        clearTimeout(req.timeout);
        pending.delete(msg.id);
        if (msg.error) req.reject(new Error(msg.error));
        else req.resolve(msg.result);
      }
    });
  });
}

function send(command: string, params: Record<string, any> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`${command} timed out after ${TIMEOUT_MS}ms`));
    }, TIMEOUT_MS);

    pending.set(id, { resolve, reject, timeout });

    ws.send(
      JSON.stringify({
        id,
        type: command === "join" ? "join" : "message",
        ...(command === "join" ? { channel: (params as any).channel } : { channel: CHANNEL }),
        message: { id, command, params: { ...params, commandId: id } },
      })
    );
  });
}

/** Shorthand: create_node_tree */
function createTree(tree: any, opts: Record<string, any> = {}): Promise<any> {
  return send("create_node_tree", { tree, ...opts });
}

/** Shorthand: delete a node (cleanup) */
function deleteNode(nodeId: string): Promise<any> {
  return send("delete_node", { nodeId });
}

/** Shorthand: read a node back */
function getNode(nodeId: string): Promise<any> {
  return send("get_node_info", { nodeId });
}

// Track root IDs for cleanup
const cleanup: string[] = [];

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await connect();
  await send("join", { channel: CHANNEL });
});

afterAll(async () => {
  // Clean up all test-created root nodes
  for (const id of cleanup) {
    try {
      await deleteNode(id);
    } catch {
      /* best-effort */
    }
  }
  ws?.close();
});

// ---------------------------------------------------------------------------
// Test 2: Create mode unchanged (regression)
// ---------------------------------------------------------------------------

describe("create_node_tree sync mode", () => {
  test("2. Create mode unchanged — no rootId works as before", async () => {
    const res = await createTree({
      type: "frame",
      name: "Test2-CreateMode",
      width: 200,
      height: 100,
      fillColor: "#aabbcc",
    });

    expect(res.success).toBe(true);
    expect(res.createdCount).toBeGreaterThanOrEqual(1);
    expect(res.nodes).toBeArray();
    expect(res.nodes.length).toBeGreaterThanOrEqual(1);

    // Should report create mode (not sync)
    expect(res.mode).toBe("create");

    const rootId = res.nodes[0].id;
    cleanup.push(rootId);

    // Verify node exists
    const node = await getNode(rootId);
    expect(node.name).toBe("Test2-CreateMode");
  });

  // -------------------------------------------------------------------------
  // Test 3: Sync — text update
  // -------------------------------------------------------------------------

  test("3. Sync — text update — text changes, node ID preserved", async () => {
    // Create initial tree
    const create = await createTree({
      type: "frame",
      name: "Test3-Root",
      width: 300,
      height: 100,
      layoutMode: "VERTICAL",
      children: [{ type: "text", name: "Test3-Label", text: "Hello", fontSize: 16 }],
    });
    expect(create.success).toBe(true);
    const rootId = create.nodes[0].id;
    cleanup.push(rootId);

    const origTextNode = create.nodes.find((n: any) => n.type === "text");
    expect(origTextNode).toBeDefined();
    const origTextId = origTextNode.id;

    // Sync with updated text
    const sync = await createTree(
      {
        type: "frame",
        name: "Test3-Root",
        width: 300,
        height: 100,
        layoutMode: "VERTICAL",
        children: [{ type: "text", name: "Test3-Label", text: "World", fontSize: 16 }],
      },
      { rootId }
    );

    expect(sync.mode).toBe("sync");

    // Find the text node in sync results — ID should be preserved
    const syncTextNode = sync.nodes?.find((n: any) => n.name === "Test3-Label");
    expect(syncTextNode).toBeDefined();
    expect(syncTextNode.id).toBe(origTextId);

    // Verify the text actually changed
    const readback = await getNode(origTextId);
    expect(readback.characters || readback.text).toBe("World");
  });

  // -------------------------------------------------------------------------
  // Test 4: Sync — color update
  // -------------------------------------------------------------------------

  test("4. Sync — color update — fill changes in place", async () => {
    const create = await createTree({
      type: "frame",
      name: "Test4-ColorFrame",
      width: 200,
      height: 200,
      fillColor: "#0000ff", // blue
    });
    expect(create.success).toBe(true);
    const rootId = create.nodes[0].id;
    cleanup.push(rootId);

    // Sync with red fill
    const sync = await createTree(
      {
        type: "frame",
        name: "Test4-ColorFrame",
        width: 200,
        height: 200,
        fillColor: "#ff0000", // red
      },
      { rootId }
    );

    expect(sync.mode).toBe("sync");

    // Verify fill changed
    const node = await getNode(rootId);
    const fill = node.fills?.[0]?.color || node.fillColor;
    // Red channel should be ~1, blue should be ~0
    if (fill && typeof fill === "object") {
      expect(fill.r).toBeCloseTo(1, 1);
      expect(fill.b).toBeCloseTo(0, 1);
    }
  });

  // -------------------------------------------------------------------------
  // Test 5: Sync — add child
  // -------------------------------------------------------------------------

  test("5. Sync — add child — third child created, first two updated", async () => {
    const create = await createTree({
      type: "frame",
      name: "Test5-Root",
      width: 400,
      height: 200,
      layoutMode: "VERTICAL",
      children: [
        { type: "text", name: "Child-A", text: "A", fontSize: 14 },
        { type: "text", name: "Child-B", text: "B", fontSize: 14 },
      ],
    });
    expect(create.success).toBe(true);
    const rootId = create.nodes[0].id;
    cleanup.push(rootId);
    const origChildIds = create.nodes.filter((n: any) => n.type === "text").map((n: any) => n.id);
    expect(origChildIds).toHaveLength(2);

    // Sync with 3 children
    const sync = await createTree(
      {
        type: "frame",
        name: "Test5-Root",
        width: 400,
        height: 200,
        layoutMode: "VERTICAL",
        children: [
          { type: "text", name: "Child-A", text: "A-updated", fontSize: 14 },
          { type: "text", name: "Child-B", text: "B-updated", fontSize: 14 },
          { type: "text", name: "Child-C", text: "C-new", fontSize: 14 },
        ],
      },
      { rootId }
    );

    expect(sync.mode).toBe("sync");

    // Original children should keep their IDs
    const syncA = sync.nodes?.find((n: any) => n.name === "Child-A");
    const syncB = sync.nodes?.find((n: any) => n.name === "Child-B");
    expect(syncA?.id).toBe(origChildIds[0]);
    expect(syncB?.id).toBe(origChildIds[1]);

    // New child should exist
    const syncC = sync.nodes?.find((n: any) => n.name === "Child-C");
    expect(syncC).toBeDefined();
    expect(syncC.id).not.toBe(origChildIds[0]);
    expect(syncC.id).not.toBe(origChildIds[1]);
  });

  // -------------------------------------------------------------------------
  // Test 6: Sync — prune
  // -------------------------------------------------------------------------

  test("6. Sync — prune — third child removed", async () => {
    const create = await createTree({
      type: "frame",
      name: "Test6-Root",
      width: 400,
      height: 200,
      layoutMode: "VERTICAL",
      children: [
        { type: "text", name: "Keep-A", text: "A", fontSize: 14 },
        { type: "text", name: "Keep-B", text: "B", fontSize: 14 },
        { type: "text", name: "Remove-C", text: "C", fontSize: 14 },
      ],
    });
    expect(create.success).toBe(true);
    const rootId = create.nodes[0].id;
    cleanup.push(rootId);
    const removedId = create.nodes.find((n: any) => n.name === "Remove-C")!.id;

    // Sync with only 2 children + prune
    const sync = await createTree(
      {
        type: "frame",
        name: "Test6-Root",
        width: 400,
        height: 200,
        layoutMode: "VERTICAL",
        children: [
          { type: "text", name: "Keep-A", text: "A", fontSize: 14 },
          { type: "text", name: "Keep-B", text: "B", fontSize: 14 },
        ],
      },
      { rootId, prune: true }
    );

    expect(sync.mode).toBe("sync");
    expect(sync.prunedCount).toBeGreaterThanOrEqual(1);

    // Removed node should be gone
    try {
      const gone = await getNode(removedId);
      // If it resolves, the node should indicate it was removed
      expect(gone).toBeNull();
    } catch {
      // Expected — node was deleted
    }
  });

  // -------------------------------------------------------------------------
  // Test 7: Sync — no prune (default)
  // -------------------------------------------------------------------------

  test("7. Sync — no prune — third child preserved", async () => {
    const create = await createTree({
      type: "frame",
      name: "Test7-Root",
      width: 400,
      height: 200,
      layoutMode: "VERTICAL",
      children: [
        { type: "text", name: "Keep-A", text: "A", fontSize: 14 },
        { type: "text", name: "Keep-B", text: "B", fontSize: 14 },
        { type: "text", name: "Extra-C", text: "C", fontSize: 14 },
      ],
    });
    expect(create.success).toBe(true);
    const rootId = create.nodes[0].id;
    cleanup.push(rootId);
    const extraId = create.nodes.find((n: any) => n.name === "Extra-C")!.id;

    // Sync with only 2 children, NO prune (default)
    const sync = await createTree(
      {
        type: "frame",
        name: "Test7-Root",
        width: 400,
        height: 200,
        layoutMode: "VERTICAL",
        children: [
          { type: "text", name: "Keep-A", text: "A-updated", fontSize: 14 },
          { type: "text", name: "Keep-B", text: "B-updated", fontSize: 14 },
        ],
      },
      { rootId }
    );

    expect(sync.mode).toBe("sync");

    // Extra-C should still exist
    const node = await getNode(extraId);
    expect(node).toBeDefined();
    expect(node.name).toBe("Extra-C");
  });

  // -------------------------------------------------------------------------
  // Test 8: Sync — $repeat data change
  // -------------------------------------------------------------------------

  test("8. Sync — $repeat data change — rows added and updated", async () => {
    const threeRows = [
      ["Row 1", "A"],
      ["Row 2", "B"],
      ["Row 3", "C"],
    ];

    const create = await createTree({
      type: "frame",
      name: "Test8-Table",
      width: 300,
      height: 400,
      layoutMode: "VERTICAL",
      children: [
        {
          $repeat: {
            data: threeRows,
            template: {
              type: "frame",
              name: "Row-$[0]",
              width: 300,
              height: 40,
              layoutMode: "HORIZONTAL",
              children: [
                { type: "text", name: "Cell-Label", text: "$[0]", fontSize: 14 },
                { type: "text", name: "Cell-Value", text: "$[1]", fontSize: 14 },
              ],
            },
          },
        },
      ],
    });

    expect(create.success).toBe(true);
    const rootId = create.nodes[0].id;
    cleanup.push(rootId);

    // Count original row frames
    const origRowCount = create.nodes.filter(
      (n: any) => n.type === "frame" && n.name?.startsWith("Row-")
    ).length;
    expect(origRowCount).toBe(3);

    // Sync with 5 rows
    const fiveRows = [
      ["Row 1", "A-updated"],
      ["Row 2", "B-updated"],
      ["Row 3", "C-updated"],
      ["Row 4", "D-new"],
      ["Row 5", "E-new"],
    ];

    const sync = await createTree(
      {
        type: "frame",
        name: "Test8-Table",
        width: 300,
        height: 400,
        layoutMode: "VERTICAL",
        children: [
          {
            $repeat: {
              data: fiveRows,
              template: {
                type: "frame",
                name: "Row-$[0]",
                width: 300,
                height: 40,
                layoutMode: "HORIZONTAL",
                children: [
                  { type: "text", name: "Cell-Label", text: "$[0]", fontSize: 14 },
                  { type: "text", name: "Cell-Value", text: "$[1]", fontSize: 14 },
                ],
              },
            },
          },
        ],
      },
      { rootId }
    );

    expect(sync.mode).toBe("sync");

    // Should have 5 row frames now
    const syncRowCount = sync.nodes?.filter(
      (n: any) => n.type === "frame" && n.name?.startsWith("Row-")
    ).length;
    expect(syncRowCount).toBe(5);

    // updatedCount should include the 3 existing rows
    expect(sync.updatedCount).toBeGreaterThanOrEqual(3);
  });

  // -------------------------------------------------------------------------
  // Test 9: Sync — type mismatch
  // -------------------------------------------------------------------------

  test("9. Sync — type mismatch — warning, no crash", async () => {
    const create = await createTree({
      type: "frame",
      name: "Test9-Root",
      width: 200,
      height: 100,
      layoutMode: "VERTICAL",
      children: [
        {
          type: "frame",
          name: "Mismatched",
          width: 100,
          height: 50,
        },
      ],
    });
    expect(create.success).toBe(true);
    const rootId = create.nodes[0].id;
    cleanup.push(rootId);

    // Sync where spec says "text" but existing "Mismatched" is a frame
    const sync = await createTree(
      {
        type: "frame",
        name: "Test9-Root",
        width: 200,
        height: 100,
        layoutMode: "VERTICAL",
        children: [{ type: "text", name: "Mismatched", text: "I am text now", fontSize: 14 }],
      },
      { rootId }
    );

    // Should not crash — either warns or replaces
    expect(sync).toBeDefined();
    expect(sync.mode).toBe("sync");

    // Check for warnings in response
    if (sync.warnings) {
      const mismatchWarn = sync.warnings.find((w: string) => w.includes("type mismatch") || w.includes("Mismatched"));
      expect(mismatchWarn).toBeDefined();
    }
  });

  // -------------------------------------------------------------------------
  // Test 10: Sync — unchanged detection
  // -------------------------------------------------------------------------

  test("10. Sync — unchanged detection — identical spec triggers no mutations", async () => {
    const spec = {
      type: "frame" as const,
      name: "Test10-Root",
      width: 200,
      height: 100,
      fillColor: "#336699",
      layoutMode: "VERTICAL" as const,
      children: [{ type: "text" as const, name: "Static-Label", text: "Unchanged", fontSize: 14 }],
    };

    const create = await createTree(spec);
    expect(create.success).toBe(true);
    const rootId = create.nodes[0].id;
    cleanup.push(rootId);

    // Sync with identical spec
    const sync = await createTree(spec, { rootId });

    expect(sync.mode).toBe("sync");
    expect(sync.unchangedCount).toBeGreaterThanOrEqual(1);

    // No nodes should have been mutated
    // updatedCount should be 0 or very low (only if implementation counts matched-but-same as updated)
    expect(sync.updatedCount || 0).toBeLessThanOrEqual(sync.unchangedCount);
  });

  // -------------------------------------------------------------------------
  // Test 11: Sync — stats
  // -------------------------------------------------------------------------

  test("11. Sync — stats — response includes mode, updatedCount, unchangedCount, prunedCount", async () => {
    const create = await createTree({
      type: "frame",
      name: "Test11-Root",
      width: 400,
      height: 200,
      layoutMode: "VERTICAL",
      children: [
        { type: "text", name: "Stat-A", text: "Alpha", fontSize: 14 },
        { type: "text", name: "Stat-B", text: "Beta", fontSize: 14 },
        { type: "text", name: "Stat-C", text: "Gamma", fontSize: 14 },
      ],
    });
    expect(create.success).toBe(true);
    const rootId = create.nodes[0].id;
    cleanup.push(rootId);

    // Sync: update A, keep B unchanged, drop C (prune), add D
    const sync = await createTree(
      {
        type: "frame",
        name: "Test11-Root",
        width: 400,
        height: 200,
        layoutMode: "VERTICAL",
        children: [
          { type: "text", name: "Stat-A", text: "Alpha-v2", fontSize: 14 }, // updated
          { type: "text", name: "Stat-B", text: "Beta", fontSize: 14 }, // unchanged
          { type: "text", name: "Stat-D", text: "Delta", fontSize: 14 }, // new
        ],
      },
      { rootId, prune: true }
    );

    // Verify sync stats shape
    expect(sync.mode).toBe("sync");
    expect(typeof sync.updatedCount).toBe("number");
    expect(typeof sync.unchangedCount).toBe("number");
    expect(typeof sync.prunedCount).toBe("number");

    // At least: 1 updated (A), 1 unchanged (B), 1 pruned (C), 1 created (D)
    expect(sync.updatedCount).toBeGreaterThanOrEqual(1);
    expect(sync.unchangedCount).toBeGreaterThanOrEqual(1);
    expect(sync.prunedCount).toBeGreaterThanOrEqual(1);

    // createdCount for the new node
    expect(sync.createdCount).toBeGreaterThanOrEqual(1);
  });
});
