/**
 * Relay connection recovery (review finding #8). A spare-port TCP server that
 * accepts connections but never answers the WebSocket upgrade stands in for a
 * stalled relay. The MCP connection module runs in a child process with
 * L2F_RELAY_PORT pointing at it, so nothing here can reach the relay on 3055.
 *   bun test tests/connection.test.ts
 */
import { describe, expect, test } from "bun:test";
import net from "node:net";
import { resolve } from "node:path";

async function stalledServer() {
  // Counts WebSocket upgrade attempts only: the relay liveness probe also
  // opens (and immediately closes) plain TCP connections.
  const seen = { connections: 0, closed: 0 };
  const sockets = new Set<net.Socket>();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    let upgrade = false;
    socket.on("data", (data) => { // read the upgrade request, never reply
      if (!upgrade && data.toString().startsWith("GET ")) { upgrade = true; seen.connections++; }
    });
    socket.on("close", () => { if (upgrade) seen.closed++; sockets.delete(socket); });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const port = (server.address() as net.AddressInfo).port;
  const close = async () => { sockets.forEach((s) => s.destroy()); await new Promise((r) => server.close(r)); };
  return { port, seen, close };
}

// Runs body in a child, then snapshots what the server has seen while the
// child is still alive (its exit would close every socket and hide a leak).
async function runChild(port: number, body: string, seen: { connections: number; closed: number }) {
  const env: Record<string, string> = { ...process.env as Record<string, string>, L2F_RELAY_PORT: String(port) };
  delete env.CLAUDE_PLUGIN_ROOT;
  delete env.CLAUDE_PLUGIN_DATA;
  const child = Bun.spawn([process.execPath, "-e",
    `const c = await import(${JSON.stringify(resolve("src/llm2figma_mcp/connection.ts"))});\n${body}\nconsole.log("DONE");\nawait new Promise(() => {});`], {
    env, stdout: "pipe", stderr: "pipe",
  });
  let out = "";
  const decoder = new TextDecoder();
  for await (const chunk of child.stdout) {
    out += decoder.decode(chunk);
    if (out.includes("DONE")) break;
  }
  await new Promise((r) => setTimeout(r, 100));
  const snapshot = { ...seen };
  child.kill();
  await child.exited;
  return { out, snapshot };
}

describe("stalled relay handshake", () => {
  test("a retry after ensureConnected times out opens a fresh socket", async () => {
    const relay = await stalledServer();
    try {
      const { out, snapshot } = await runChild(relay.port, `
        for (let i = 0; i < 2; i++) {
          try { await c.listChannels(500); } catch (e) { console.log("attempt", i, e.message); }
        }`, relay.seen);
      expect(out).toContain("attempt 1");
      // The first stuck socket was abandoned and the second attempt dialled again.
      expect(snapshot).toEqual({ connections: 2, closed: 2 });
    } finally { await relay.close(); }
  }, 30_000);

  test("a handshake that never completes is terminated after the handshake timeout", async () => {
    const relay = await stalledServer();
    try {
      const { snapshot } = await runChild(relay.port, `
        c.connectToFigma(${relay.port}, 300);
        await new Promise((r) => setTimeout(r, 1200));`, relay.seen);
      expect(snapshot.connections).toBeGreaterThanOrEqual(1);
      expect(snapshot.closed).toBe(snapshot.connections);
    } finally { await relay.close(); }
  }, 30_000);

  // Second review, finding #5: ensureConnected giving up on a stuck socket
  // must leave the normal reconnect scheduled, exactly once.
  test("ensureConnected abandoning a stuck socket still schedules one reconnect", async () => {
    const relay = await stalledServer();
    try {
      const { out, snapshot } = await runChild(relay.port, `
        try { await c.listChannels(500); } catch (e) { console.log("failed", e.message); }
        await new Promise((r) => setTimeout(r, 4500));`, relay.seen);
      expect(out).toContain("failed Couldn't connect");
      // The abandoned socket was closed and exactly one new one was dialled
      // without any further caller.
      expect(snapshot).toEqual({ connections: 2, closed: 1 });
    } finally { await relay.close(); }
  }, 30_000);
});
