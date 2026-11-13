/**
 * The relay refuses a second Figma window on a channel that already has one,
 * since the plugin now reuses one channel per file and every command is
 * broadcast to all peers (two plugins would apply each write twice).
 * Runs the real relay (src/socket.ts) on a spare port.
 *   bun test tests/relay-channel.test.ts
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { resolve } from "node:path";

const PORT = 39000 + Math.floor(Math.random() * 1000);
let relay: ReturnType<typeof Bun.spawn>;

async function waitForRelay() {
  for (let i = 0; i < 50; i++) {
    try {
      const probe = await Bun.connect({ hostname: "127.0.0.1", port: PORT, socket: { data() {} } });
      probe.end();
      return;
    } catch {
      await Bun.sleep(100);
    }
  }
  throw new Error("relay did not start");
}

function open(): Promise<{ ws: WebSocket; messages: any[]; next: (pred: (m: any) => boolean) => Promise<any> }> {
  return new Promise((resolveOpen, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
    const messages: any[] = [];
    const waiters: { pred: (m: any) => boolean; done: (m: any) => void }[] = [];
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data));
      messages.push(m);
      for (const w of [...waiters]) if (w.pred(m)) { waiters.splice(waiters.indexOf(w), 1); w.done(m); }
    };
    const next = (pred: (m: any) => boolean) =>
      new Promise<any>((done, fail) => {
        const hit = messages.find(pred);
        if (hit) return done(hit);
        waiters.push({ pred, done });
        setTimeout(() => fail(new Error("timed out waiting for message")), 3000);
      });
    ws.onopen = () => resolveOpen({ ws, messages, next });
    ws.onerror = reject;
  });
}

const joined = (m: any) => m.type === "system" && m.message && m.message.result;
const taken = (m: any) => m.type === "error" && m.code === "channel_taken";

beforeAll(async () => {
  relay = Bun.spawn([process.execPath, resolve("src/socket.ts")], {
    env: { ...process.env, L2F_RELAY_PORT: String(PORT) },
    stdout: "ignore",
    stderr: "ignore",
  });
  await waitForRelay();
});

afterAll(() => relay.kill());

describe("relay: one Figma window per channel", () => {
  test("a second plugin on the same channel is refused; the MCP server is not", async () => {
    const a = await open();
    a.ws.send(JSON.stringify({ type: "join", channel: "filechan1" }));
    await a.next(joined);

    const b = await open();
    b.ws.send(JSON.stringify({ type: "join", channel: "filechan1" }));
    const refusal = await b.next(taken);
    expect(refusal.channel).toBe("filechan1");
    expect(b.messages.some(joined)).toBe(false);

    const mcp = await open();
    mcp.ws.send(JSON.stringify({ type: "join", channel: "filechan1", role: "mcp" }));
    await mcp.next(joined);

    // The refused window can join a fresh channel on the same socket.
    b.ws.send(JSON.stringify({ type: "join", channel: "freshchan" }));
    await b.next(joined);

    // A command from the MCP server reaches exactly one plugin.
    mcp.ws.send(JSON.stringify({ type: "message", channel: "filechan1", message: { id: "x1", command: "ping" } }));
    await a.next((m) => m.type === "broadcast" || (m.message && m.message.id === "x1"));
    await Bun.sleep(200);
    expect(b.messages.some((m) => m.message && m.message.id === "x1")).toBe(false);

    a.ws.close(); b.ws.close(); mcp.ws.close();
  });

  test("after the first window leaves, the same channel can be rejoined", async () => {
    const a = await open();
    a.ws.send(JSON.stringify({ type: "join", channel: "filechan2" }));
    await a.next(joined);
    a.ws.close();
    await Bun.sleep(200);

    const again = await open();
    again.ws.send(JSON.stringify({ type: "join", channel: "filechan2" }));
    await again.next(joined);
    expect(again.messages.some(taken)).toBe(false);
    again.ws.close();
  });
});
