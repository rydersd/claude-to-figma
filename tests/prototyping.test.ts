/**
 * Integration tests for prototyping interaction tools.
 *
 * Run against a live Figma plugin via WebSocket:
 *   CHANNEL=mawbmp7g bun test tests/prototyping.test.ts
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
// Connection helpers
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

function createTree(tree: any, opts: Record<string, any> = {}): Promise<any> {
  return send("create_node_tree", { tree, ...opts });
}
function deleteNode(nodeId: string): Promise<any> {
  return send("delete_node", { nodeId });
}

const cleanup: string[] = [];

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await connect();
  await send("join", { channel: CHANNEL });
});

afterAll(async () => {
  for (const id of cleanup) {
    try { await deleteNode(id); } catch { /* best-effort */ }
  }
  ws?.close();
});

// ---------------------------------------------------------------------------
// Helper: create two test frames to use as navigation source/destination
// ---------------------------------------------------------------------------

let testFrameX = 0;
async function createTestFrames(): Promise<{ sourceId: string; destId: string; rootId: string }> {
  // Figma requires navigate destinations to be top-level frames (direct page children)
  // Position each pair to avoid overlap with other tests
  const xOffset = testFrameX;
  testFrameX += 800;

  const srcRes = await createTree({
    type: "frame",
    name: "Screen-A-" + xOffset,
    x: xOffset,
    width: 375,
    height: 400,
    fillColor: "#e8e8e8",
  });
  const dstRes = await createTree({
    type: "frame",
    name: "Screen-B-" + xOffset,
    x: xOffset + 400,
    width: 375,
    height: 400,
    fillColor: "#d0d0d0",
  });

  const sourceId = srcRes.nodes[0].id;
  const destId = dstRes.nodes[0].id;
  cleanup.push(sourceId);
  cleanup.push(destId);

  return { sourceId, destId, rootId: sourceId };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("prototyping tools", () => {

  // -----------------------------------------------------------------------
  // set_reactions
  // -----------------------------------------------------------------------

  test("set_reactions — wire click-to-navigate", async () => {
    const { sourceId, destId } = await createTestFrames();

    const res = await send("set_reactions", {
      nodeId: sourceId,
      reactions: [{
        trigger: { type: "ON_CLICK" },
        actions: [{
          type: "NODE",
          navigation: "NAVIGATE",
          destinationId: destId,
          transition: { type: "DISSOLVE", duration: 300, easing: { type: "EASE_IN_AND_OUT" } },
        }],
      }],
    });

    expect(res.success).toBe(true);
    expect(res.reactionsSet).toBe(1);
    expect(res.nodeId).toBe(sourceId);
  });

  test("set_reactions — multiple reactions on one node", async () => {
    const { sourceId, destId } = await createTestFrames();

    const res = await send("set_reactions", {
      nodeId: sourceId,
      reactions: [
        {
          trigger: { type: "ON_CLICK" },
          actions: [{ type: "NODE", navigation: "NAVIGATE", destinationId: destId }],
        },
        {
          trigger: { type: "ON_HOVER" },
          actions: [{ type: "NODE", navigation: "OVERLAY", destinationId: destId }],
        },
      ],
    });

    expect(res.success).toBe(true);
    expect(res.reactionsSet).toBe(2);
  });

  test("set_reactions — URL action", async () => {
    const { sourceId } = await createTestFrames();

    const res = await send("set_reactions", {
      nodeId: sourceId,
      reactions: [{
        trigger: { type: "ON_CLICK" },
        actions: [{ type: "URL", url: "https://example.com" }],
      }],
    });

    expect(res.success).toBe(true);
    expect(res.reactionsSet).toBe(1);
  });

  test("set_reactions — BACK action", async () => {
    const { sourceId } = await createTestFrames();

    const res = await send("set_reactions", {
      nodeId: sourceId,
      reactions: [{
        trigger: { type: "ON_CLICK" },
        actions: [{ type: "BACK" }],
      }],
    });

    expect(res.success).toBe(true);
  });

  test("set_reactions — replaces existing reactions", async () => {
    const { sourceId, destId } = await createTestFrames();

    // Set initial NAVIGATE
    await send("set_reactions", {
      nodeId: sourceId,
      reactions: [{
        trigger: { type: "ON_CLICK" },
        actions: [{ type: "NODE", navigation: "NAVIGATE", destinationId: destId }],
      }],
    });

    // Replace with different NAVIGATE (Figma requires same action category on replacement)
    const res = await send("set_reactions", {
      nodeId: sourceId,
      reactions: [{
        trigger: { type: "ON_HOVER" },
        actions: [{ type: "NODE", navigation: "NAVIGATE", destinationId: destId,
          transition: { type: "SMART_ANIMATE", duration: 500, easing: { type: "EASE_OUT" } } }],
      }],
    });

    expect(res.reactionsSet).toBe(1);

    // Verify only the new reaction exists
    const interactions = await send("get_interactions", { nodeId: sourceId });
    expect(interactions.interactionCount).toBe(1);
    expect(interactions.interactions[0].trigger).toBe("ON_HOVER");
  });

  // -----------------------------------------------------------------------
  // add_reaction
  // -----------------------------------------------------------------------

  test("add_reaction — appends without clobbering", async () => {
    const { sourceId, destId } = await createTestFrames();

    // Set initial click reaction
    await send("set_reactions", {
      nodeId: sourceId,
      reactions: [{
        trigger: { type: "ON_CLICK" },
        actions: [{ type: "NODE", navigation: "NAVIGATE", destinationId: destId }],
      }],
    });

    // Add hover reaction
    const res = await send("add_reaction", {
      nodeId: sourceId,
      trigger: { type: "ON_HOVER" },
      action: { type: "NODE", navigation: "OVERLAY", destinationId: destId },
    });

    expect(res.success).toBe(true);
    expect(res.totalReactions).toBe(2);

    // Verify both exist
    const interactions = await send("get_interactions", { nodeId: sourceId });
    expect(interactions.interactionCount).toBe(2);
    const triggers = interactions.interactions.map((i: any) => i.trigger);
    expect(triggers).toContain("ON_CLICK");
    expect(triggers).toContain("ON_HOVER");
  });

  test("add_reaction — works on node with no existing reactions", async () => {
    const { sourceId, destId } = await createTestFrames();

    const res = await send("add_reaction", {
      nodeId: sourceId,
      trigger: { type: "ON_CLICK" },
      action: { type: "NODE", navigation: "NAVIGATE", destinationId: destId },
    });

    expect(res.success).toBe(true);
    expect(res.totalReactions).toBe(1);
  });

  // -----------------------------------------------------------------------
  // remove_reactions
  // -----------------------------------------------------------------------

  test("remove_reactions — remove all", async () => {
    const { sourceId, destId } = await createTestFrames();

    // Set two NAVIGATE reactions with different triggers
    await send("set_reactions", {
      nodeId: sourceId,
      reactions: [
        { trigger: { type: "ON_CLICK" }, actions: [{ type: "NODE", navigation: "NAVIGATE", destinationId: destId }] },
        { trigger: { type: "ON_HOVER" }, actions: [{ type: "NODE", navigation: "NAVIGATE", destinationId: destId }] },
      ],
    });

    // Remove all
    const res = await send("remove_reactions", { nodeId: sourceId });

    expect(res.success).toBe(true);
    expect(res.removedCount).toBe(2);
    expect(res.remainingCount).toBe(0);
  });

  test("remove_reactions — remove by trigger type", async () => {
    const { sourceId, destId } = await createTestFrames();

    // Set two NAVIGATE reactions with different triggers
    await send("set_reactions", {
      nodeId: sourceId,
      reactions: [
        { trigger: { type: "ON_CLICK" }, actions: [{ type: "NODE", navigation: "NAVIGATE", destinationId: destId }] },
        { trigger: { type: "ON_HOVER" }, actions: [{ type: "NODE", navigation: "NAVIGATE", destinationId: destId }] },
      ],
    });

    // Remove only hover
    const res = await send("remove_reactions", { nodeId: sourceId, triggerType: "ON_HOVER" });

    expect(res.success).toBe(true);
    expect(res.removedCount).toBe(1);
    expect(res.remainingCount).toBe(1);

    // Verify click is preserved
    const interactions = await send("get_interactions", { nodeId: sourceId });
    expect(interactions.interactionCount).toBe(1);
    expect(interactions.interactions[0].trigger).toBe("ON_CLICK");
  });

  // -----------------------------------------------------------------------
  // get_interactions
  // -----------------------------------------------------------------------

  test("get_interactions — resolves destination names", async () => {
    const { sourceId, destId } = await createTestFrames();

    await send("set_reactions", {
      nodeId: sourceId,
      reactions: [{
        trigger: { type: "ON_CLICK" },
        actions: [{ type: "NODE", navigation: "NAVIGATE", destinationId: destId }],
      }],
    });

    const res = await send("get_interactions", { nodeId: sourceId });

    expect(res.interactionCount).toBe(1);
    const interaction = res.interactions[0];
    expect(interaction.trigger).toBe("ON_CLICK");
    expect(interaction.actions[0].destinationId).toBe(destId);
    expect(interaction.actions[0].destinationName).toContain("Screen-B");
    expect(interaction.actions[0].navigation).toBe("NAVIGATE");
  });

  test("get_interactions — node with no reactions returns empty", async () => {
    const { destId } = await createTestFrames(); // Screen-B has no reactions

    const res = await send("get_interactions", { nodeId: destId });
    expect(res.interactionCount).toBe(0);
    expect(res.interactions).toEqual([]);
  });

  test("get_interactions — recursive mode", async () => {
    // Create a container with a child that has a reaction
    const container = await createTree({
      type: "frame",
      name: "Recursive-Container",
      width: 400,
      height: 400,
      layoutMode: "VERTICAL",
      children: [
        { type: "frame", name: "Child-With-Reaction", width: 200, height: 100 },
      ],
    });
    cleanup.push(container.nodes[0].id);
    const childId = container.nodes.find((n: any) => n.name === "Child-With-Reaction").id;

    // Set a BACK reaction on the child (doesn't need a destination)
    await send("set_reactions", {
      nodeId: childId,
      reactions: [{ trigger: { type: "ON_CLICK" }, actions: [{ type: "BACK" }] }],
    });

    // Query the container recursively
    const res = await send("get_interactions", { nodeId: container.nodes[0].id, recursive: true });
    expect(res.interactionCount).toBeGreaterThanOrEqual(1);

    const childInteraction = res.interactions.find((i: any) => i.nodeName === "Child-With-Reaction");
    expect(childInteraction).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // batch_set_reactions
  // -----------------------------------------------------------------------

  test("batch_set_reactions — wire multiple nodes at once", async () => {
    // Create 3 top-level frames (Figma requires top-level for navigate destinations)
    const p1 = await createTree({ type: "frame", name: "Page-1", width: 375, height: 400, fillColor: "#eee" });
    const p2 = await createTree({ type: "frame", name: "Page-2", width: 375, height: 400, fillColor: "#ddd" });
    const p3 = await createTree({ type: "frame", name: "Page-3", width: 375, height: 400, fillColor: "#ccc" });

    const page1Id = p1.nodes[0].id;
    const page2Id = p2.nodes[0].id;
    const page3Id = p3.nodes[0].id;
    cleanup.push(page1Id, page2Id, page3Id);

    const res = await send("batch_set_reactions", {
      operations: [
        {
          nodeId: page1Id,
          reactions: [{ trigger: { type: "ON_CLICK" }, actions: [{ type: "NODE", navigation: "NAVIGATE", destinationId: page2Id }] }],
        },
        {
          nodeId: page2Id,
          reactions: [{ trigger: { type: "ON_CLICK" }, actions: [{ type: "NODE", navigation: "NAVIGATE", destinationId: page3Id }] }],
        },
        {
          nodeId: page3Id,
          reactions: [{ trigger: { type: "ON_CLICK" }, actions: [{ type: "NODE", navigation: "NAVIGATE", destinationId: page1Id }] }],
        },
      ],
    });

    expect(res.success).toBe(true);
    expect(res.totalOperations).toBe(3);
    expect(res.successCount).toBe(3);
    expect(res.errorCount).toBe(0);

    // Verify all three are wired
    for (const pageId of [page1Id, page2Id, page3Id]) {
      const interactions = await send("get_interactions", { nodeId: pageId });
      expect(interactions.interactionCount).toBe(1);
    }
  });

  test("batch_set_reactions — handles invalid nodeId gracefully", async () => {
    const { sourceId, destId } = await createTestFrames();

    const res = await send("batch_set_reactions", {
      operations: [
        {
          nodeId: sourceId,
          reactions: [{ trigger: { type: "ON_CLICK" }, actions: [{ type: "NODE", navigation: "NAVIGATE", destinationId: destId }] }],
        },
        {
          nodeId: "999:999",
          reactions: [{ trigger: { type: "ON_CLICK" }, actions: [{ type: "BACK" }] }],
        },
      ],
    });

    expect(res.success).toBe(false); // One failed
    expect(res.successCount).toBe(1);
    expect(res.errorCount).toBe(1);
    expect(res.results[1].success).toBe(false);
    expect(res.results[1].error).toContain("not found");
  });

  // -----------------------------------------------------------------------
  // Transition types
  // -----------------------------------------------------------------------

  test("set_reactions — SMART_ANIMATE transition", async () => {
    const { sourceId, destId } = await createTestFrames();

    const res = await send("set_reactions", {
      nodeId: sourceId,
      reactions: [{
        trigger: { type: "ON_CLICK" },
        actions: [{
          type: "NODE",
          navigation: "NAVIGATE",
          destinationId: destId,
          transition: { type: "SMART_ANIMATE", duration: 500, easing: { type: "EASE_OUT" } },
        }],
      }],
    });

    expect(res.success).toBe(true);

    const interactions = await send("get_interactions", { nodeId: sourceId });
    const transition = interactions.interactions[0].actions[0].transition;
    expect(transition.type).toBe("SMART_ANIMATE");
  });

  test("set_reactions — PUSH transition with direction", async () => {
    const { sourceId, destId } = await createTestFrames();

    const res = await send("set_reactions", {
      nodeId: sourceId,
      reactions: [{
        trigger: { type: "ON_CLICK" },
        actions: [{
          type: "NODE",
          navigation: "NAVIGATE",
          destinationId: destId,
          transition: { type: "PUSH", duration: 400, direction: "LEFT", easing: { type: "EASE_IN_AND_OUT" } },
        }],
      }],
    });

    expect(res.success).toBe(true);
  });
});
