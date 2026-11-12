/**
 * Relay ownership and replacement (review findings #4 and #5). Uses temp dirs,
 * injected fakes and spare ports only; never touches the relay on 3055.
 *   bun test tests/plugin-runtime.test.ts
 */
import { afterAll, describe, expect, spyOn, test } from "bun:test";
import fs, { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { RELAY_PROTOCOL_VERSION } from "../src/relay-protocol";
import {
  acquireRelayLock, relayLockFile, relayPidFile, startOrReplaceRelay, stopOwnRelay, type RelayHost,
} from "../src/llm2figma_mcp/plugin-runtime";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const tempDirs: string[] = [];
afterAll(() => { for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true }); });

// One simulated machine: a relay process table and a port, shared by any
// number of simulated sessions (RelayHosts).
function makeWorld(port: number) {
  const dir = mkdtempSync(join(tmpdir(), "llm2figma-runtime-"));
  tempDirs.push(dir);
  const cache = join(dir, "cache", "llm2figma");
  const world = {
    dir,
    data: join(dir, "data"),
    root: join(cache, "0.2.0"),
    oldRoot: join(cache, "0.1.0"),
    port,
    // pid -> command line of live processes
    procs: new Map<number, string>(),
    listener: null as number | null,
    versions: new Map<number, string>(),
    nextPid: 500,
    kills: [] as number[],
    spawns: [] as string[],
    lsofFails: false,
  };
  mkdirSync(world.data, { recursive: true });
  return world;
}
type World = ReturnType<typeof makeWorld>;

function startProcess(world: World, command: string, opts: { listen?: boolean; version?: string } = {}) {
  const pid = world.nextPid++;
  world.procs.set(pid, command);
  if (opts.listen) world.listener = pid;
  if (opts.version !== undefined) world.versions.set(pid, opts.version);
  return pid;
}

function hostFor(world: World, overrides: Partial<RelayHost> = {}): RelayHost {
  return {
    pluginRoot: world.root,
    pluginData: world.data,
    port: world.port,
    hasBun: true,
    version: async () => {
      await sleep(5);
      return world.listener === null ? null : world.versions.get(world.listener) ?? "";
    },
    isListening: async () => world.listener !== null,
    run: (file, args) => {
      if (file === "ps") {
        const command = world.procs.get(Number(args[1]));
        if (!command) throw new Error("no such process");
        return command + "\n";
      }
      if (file === "lsof") {
        if (world.lsofFails || world.listener === null) throw new Error("lsof: exit 1");
        expect(args).toEqual(["-nP", `-iTCP:${world.port}`, "-sTCP:LISTEN", "-t"]);
        return `${world.listener}\n`;
      }
      throw new Error(`unexpected ${file}`);
    },
    kill: (pid) => {
      world.kills.push(pid);
      world.procs.delete(pid);
      if (world.listener === pid) world.listener = null;
    },
    spawnRelay: (pidFile) => {
      world.spawns.push(pidFile);
      // The relay binds the port a moment later, then writes its own pid.
      setTimeout(() => {
        if (world.listener !== null) return;
        const pid = startProcess(world, `/bin/bun ${join(world.root, "server", "relay.js")}`, { listen: true, version: RELAY_PROTOCOL_VERSION });
        writeFileSync(pidFile, String(pid));
      }, 30);
    },
    sleep,
    ...overrides,
  };
}

const oldPluginRelay = (world: World) => startProcess(world, `/bin/bun ${join(world.oldRoot, "server", "relay.js")}`, { listen: true, version: "1" });

describe("stopOwnRelay ownership checks (finding #4)", () => {
  test("uses a per-port pid file, so another port's relay is never the target", async () => {
    const world = makeWorld(3998);
    // Session A's relay on another port, recorded in the shared data dir.
    const other = startProcess(world, `/bin/bun ${join(world.root, "server", "relay.js")}`);
    writeFileSync(join(world.data, "relay.pid"), String(other));
    writeFileSync(relayPidFile(world.data, 3997), String(other));
    oldPluginRelay(world);
    expect(await stopOwnRelay(hostFor(world))).toBe(false);
    expect(world.kills).toEqual([]);
    expect(relayPidFile(world.data, 3998)).toEndWith("relay-3998.pid");
  });

  test("refuses when the pid runs the plugin's relay.js but is not the port's listener", async () => {
    const world = makeWorld(3998);
    oldPluginRelay(world);
    const other = startProcess(world, `/bin/bun ${join(world.root, "server", "relay.js")}`);
    writeFileSync(relayPidFile(world.data, 3998), String(other));
    expect(await stopOwnRelay(hostFor(world))).toBe(false);
    expect(world.kills).toEqual([]);
  });

  test("refuses a reused pid that now runs something else", async () => {
    const world = makeWorld(3998);
    const listener = startProcess(world, "/usr/bin/python3 -m http.server 3998", { listen: true, version: "" });
    writeFileSync(relayPidFile(world.data, 3998), String(listener));
    expect(await stopOwnRelay(hostFor(world))).toBe(false);
    expect(world.kills).toEqual([]);
  });

  test("refuses a relay.js that belongs to a different install", async () => {
    const world = makeWorld(3998);
    const listener = startProcess(world, "/bin/bun /Users/someone/llm2figma/plugin/server/relay.js", { listen: true, version: "1" });
    writeFileSync(relayPidFile(world.data, 3998), String(listener));
    expect(await stopOwnRelay(hostFor(world))).toBe(false);
    expect(world.kills).toEqual([]);
  });

  test("refuses when the listener can't be proven (lsof fails)", async () => {
    const world = makeWorld(3998);
    const old = oldPluginRelay(world);
    writeFileSync(relayPidFile(world.data, 3998), String(old));
    world.lsofFails = true;
    expect(await stopOwnRelay(hostFor(world))).toBe(false);
    expect(world.kills).toEqual([]);
  });

  test("stops the listener when it is this plugin's relay (any plugin version)", async () => {
    const world = makeWorld(3998);
    const old = oldPluginRelay(world);
    writeFileSync(relayPidFile(world.data, 3998), String(old));
    expect(await stopOwnRelay(hostFor(world))).toBe(true);
    expect(world.kills).toEqual([old]);
  });
});

describe("startOrReplaceRelay across processes (finding #5)", () => {
  test("two sessions upgrading at once replace the old relay exactly once", async () => {
    const world = makeWorld(3998);
    const old = oldPluginRelay(world);
    writeFileSync(relayPidFile(world.data, 3998), String(old));
    // Separate hosts = separate processes: no shared in-process promise.
    // Session B sees the old relay on both checks, then is slow, and only
    // reads the pid file once A's replacement is up and has written its pid.
    const a = hostFor(world);
    const b = hostFor(world);
    let bCalls = 0;
    b.version = async () => {
      const seen = world.listener === null ? null : world.versions.get(world.listener) ?? "";
      await sleep(++bCalls === 2 ? 200 : 5);
      return seen;
    };
    const results = await Promise.all([startOrReplaceRelay(a), startOrReplaceRelay(b)]);
    expect(results).toEqual([true, true]);
    expect(world.kills).toEqual([old]);
    expect(world.spawns).toEqual([relayPidFile(world.data, 3998)]);
    expect(world.versions.get(world.listener!)).toBe(RELAY_PROTOCOL_VERSION);
    expect(existsSync(relayLockFile(world.data, 3998))).toBe(false);
  });

  test("releases the lock when replacement throws", async () => {
    const world = makeWorld(3998);
    const old = oldPluginRelay(world);
    writeFileSync(relayPidFile(world.data, 3998), String(old));
    const host = hostFor(world, { spawnRelay: () => { throw new Error("spawn failed"); } });
    await expect(startOrReplaceRelay(host)).rejects.toThrow("spawn failed");
    expect(existsSync(relayLockFile(world.data, 3998))).toBe(false);
  });

  test("breaks a stale lock but waits on a fresh one", async () => {
    const world = makeWorld(3998);
    const lock = relayLockFile(world.data, 3998);
    writeFileSync(lock, "999999");
    const old = new Date(Date.now() - 11_000);
    utimesSync(lock, old, old);
    const release = await acquireRelayLock(hostFor(world));
    expect(release).not.toBeNull();
    expect(readFileSync(lock, "utf8")).toStartWith(`${process.pid}:`);
    expect(readdirSync(world.data)).toEqual(["relay-3998.lock"]);

    // Held and fresh: a second acquirer waits until it is released.
    let second: (() => void) | null = null;
    const waiting = acquireRelayLock(hostFor(world)).then((r) => { second = r; });
    await sleep(250);
    expect(second).toBeNull();
    release!();
    await waiting;
    expect(second).not.toBeNull();
    second!();
    expect(existsSync(lock)).toBe(false);
  });
});

// Second review, finding #1: breaking a stale lock and releasing a lock must
// only ever remove the lock instance that was observed or is owned.
describe("relay lock ownership", () => {
  function staleLock(world: World) {
    const lock = relayLockFile(world.data, world.port);
    writeFileSync(lock, "crashed-holder");
    const old = new Date(Date.now() - 11_000);
    utimesSync(lock, old, old);
    return lock;
  }

  test("an observer of a stale lock does not remove the lock another session took meanwhile", async () => {
    const world = makeWorld(3998);
    const lock = staleLock(world);
    // Session B breaks the stale lock and takes a fresh one in the gap right
    // after session A has read the stale mtime.
    const realStat = fs.statSync as (...args: any[]) => any;
    let swapped = false;
    const spy = spyOn(fs, "statSync").mockImplementation(((file: any, ...rest: any[]) => {
      const stat = realStat(file, ...rest);
      if (!swapped && file === lock) {
        swapped = true;
        rmSync(lock);
        writeFileSync(lock, "session-b");
      }
      return stat;
    }) as any);
    try {
      let release: (() => void) | null = null;
      const acquiring = acquireRelayLock(hostFor(world)).then((r) => { release = r; });
      await sleep(300);
      expect(swapped).toBe(true);
      expect(release).toBeNull();
      expect(readFileSync(lock, "utf8")).toBe("session-b");
      expect(readdirSync(world.data)).toEqual(["relay-3998.lock"]);
      rmSync(lock); // session B releases
      await acquiring;
      expect(release).not.toBeNull();
      release!();
      expect(existsSync(lock)).toBe(false);
    } finally { spy.mockRestore(); }
  });

  test("release leaves a lock that now belongs to another session", async () => {
    const world = makeWorld(3998);
    const lock = relayLockFile(world.data, 3998);
    const release = await acquireRelayLock(hostFor(world));
    const token = readFileSync(lock, "utf8");
    // The holder stalled, its lock was broken and session B holds the path now.
    rmSync(lock);
    writeFileSync(lock, "session-b");
    release!();
    expect(readFileSync(lock, "utf8")).toBe("session-b");
    expect(readdirSync(world.data)).toEqual(["relay-3998.lock"]);
    // Every acquisition has its own owner token, even within one process.
    rmSync(lock);
    const again = await acquireRelayLock(hostFor(world));
    expect(readFileSync(lock, "utf8")).not.toBe(token);
    again!();
    expect(existsSync(lock)).toBe(false);
  });
});

// Second review, finding #2: the relay script must be the script argument,
// not a substring anywhere on the command line.
describe("stopOwnRelay script-argument check", () => {
  test("refuses a process that only mentions the relay path in another argument", async () => {
    const world = makeWorld(3998);
    const relay = join(world.oldRoot, "server", "relay.js");
    for (const command of [
      `node /srv/unrelated-http.js --asset=${relay}`,
      `/bin/bun /srv/unrelated-http.js ${relay}`,
      `/bin/bun ${relay} --extra`,
      `/bin/bun ${join(world.oldRoot, "..", "..", "other", "0.1.0", "server", "relay.js")}`,
      `/bin/bun ${join(world.oldRoot, "nested", "server", "relay.js")}`,
    ]) {
      const listener = startProcess(world, command, { listen: true, version: "1" });
      writeFileSync(relayPidFile(world.data, 3998), String(listener));
      expect([command, await stopOwnRelay(hostFor(world))]).toEqual([command, false]);
    }
    expect(world.kills).toEqual([]);
  });

  test("accepts runtime flags before the script and an unnormalized script path", async () => {
    const world = makeWorld(3998);
    const listener = startProcess(world, `/bin/bun --smol ${world.oldRoot}/server/../server/relay.js`, { listen: true, version: "1" });
    writeFileSync(relayPidFile(world.data, 3998), String(listener));
    expect(await stopOwnRelay(hostFor(world))).toBe(true);
    expect(world.kills).toEqual([listener]);
  });
});

// Second review, finding #3: relays started before per-port pid files recorded
// themselves in relay.pid; they must still be replaceable after an upgrade.
describe("legacy relay.pid migration", () => {
  const legacy = (world: World) => join(world.data, "relay.pid");

  test("replaces a relay recorded only in the legacy relay.pid and moves the file aside", async () => {
    const world = makeWorld(3998);
    const old = oldPluginRelay(world);
    writeFileSync(legacy(world), String(old));
    expect(await startOrReplaceRelay(hostFor(world))).toBe(true);
    expect(world.kills).toEqual([old]);
    expect(world.spawns).toEqual([relayPidFile(world.data, 3998)]);
    expect(existsSync(legacy(world))).toBe(false);
    expect(readFileSync(`${legacy(world)}.migrated`, "utf8")).toBe(String(old));
    // Idempotent: a second pass has nothing to migrate and stops nothing,
    // even with no per-port record to fall back from.
    expect(await startOrReplaceRelay(hostFor(world))).toBe(true);
    rmSync(relayPidFile(world.data, 3998));
    expect(await stopOwnRelay(hostFor(world))).toBe(false);
    expect(world.kills).toEqual([old]);
    expect(world.spawns.length).toBe(1);
    expect(readFileSync(`${legacy(world)}.migrated`, "utf8")).toBe(String(old));
  });

  test("leaves the legacy file alone unless its pid passes the strict checks and listens on this port", async () => {
    const world = makeWorld(3998);
    const relay = join(world.oldRoot, "server", "relay.js");
    // Not this plugin's relay script.
    const stranger = startProcess(world, `node /srv/unrelated-http.js --asset=${relay}`, { listen: true, version: "1" });
    writeFileSync(legacy(world), String(stranger));
    expect(await stopOwnRelay(hostFor(world))).toBe(false);
    // This plugin's relay, but serving another port.
    const elsewhere = startProcess(world, `/bin/bun ${relay}`);
    writeFileSync(legacy(world), String(elsewhere));
    expect(await stopOwnRelay(hostFor(world))).toBe(false);
    expect(world.kills).toEqual([]);
    expect(readFileSync(legacy(world), "utf8")).toBe(String(elsewhere));
    expect(existsSync(`${legacy(world)}.migrated`)).toBe(false);
  });

  test("prefers the per-port pid file over the legacy one", async () => {
    const world = makeWorld(3998);
    const old = oldPluginRelay(world);
    writeFileSync(legacy(world), String(old));
    writeFileSync(relayPidFile(world.data, 3998), "999999");
    expect(await stopOwnRelay(hostFor(world))).toBe(false);
    expect(world.kills).toEqual([]);
    expect(existsSync(legacy(world))).toBe(true);
  });
});

// End to end through ensureRelay with real processes on spare ports: session
// B (port Y) meets an older relay it didn't start, while relay.pid in the
// shared data dir names session A's live relay on port X. Before per-port
// ownership, B killed A.
describe("ensureRelay with real processes (finding #4)", () => {
  async function freePort(): Promise<number> {
    const server = net.createServer();
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    const port = (server.address() as net.AddressInfo).port;
    await new Promise((r) => server.close(r));
    return port;
  }

  async function waitForPort(port: number) {
    for (let i = 0; i < 100; i++) {
      const open = await new Promise<boolean>((r) => {
        const s = net.connect({ host: "127.0.0.1", port });
        s.once("connect", () => { s.destroy(); r(true); });
        s.once("error", () => r(false));
      });
      if (open) return;
      await sleep(50);
    }
    throw new Error(`port ${port} never opened`);
  }

  test("does not kill another port's relay named by the shared relay.pid", async () => {
    const dir = mkdtempSync(join(tmpdir(), "llm2figma-ensure-"));
    const root = join(dir, "cache", "llm2figma", "0.2.0");
    const data = join(dir, "data");
    mkdirSync(join(root, "server"), { recursive: true });
    mkdirSync(data);
    const [portA, portB] = [await freePort(), await freePort()];
    // Stand-ins: A runs this plugin's relay.js path; B is an older relay.
    const serve = (header: string) => `Bun.serve({ hostname: "127.0.0.1", port: Number(process.env.PORT), fetch: () => new Response("ok", { headers: { "X-L2F-Relay-Protocol": "${header}" } }) });`;
    writeFileSync(join(root, "server", "relay.js"), serve(RELAY_PROTOCOL_VERSION));
    writeFileSync(join(dir, "old-relay.js"), serve("1"));
    const a = Bun.spawn([process.execPath, join(root, "server", "relay.js")], { env: { ...process.env, PORT: String(portA) } });
    const b = Bun.spawn([process.execPath, join(dir, "old-relay.js")], { env: { ...process.env, PORT: String(portB) } });
    try {
      await waitForPort(portA);
      await waitForPort(portB);
      writeFileSync(join(data, "relay.pid"), String(a.pid));
      writeFileSync(join(data, `relay-${portA}.pid`), String(a.pid));
      const session = Bun.spawnSync([process.execPath, "-e",
        `const m = await import(${JSON.stringify(resolve("src/llm2figma_mcp/plugin-runtime.ts"))}); console.log(await m.ensureRelay(${portB}));`], {
        env: { ...process.env, CLAUDE_PLUGIN_ROOT: root, CLAUDE_PLUGIN_DATA: data },
      });
      expect(session.stdout.toString().trim()).toBe("true");
      // A must still be running and serving its port.
      await Promise.race([a.exited, sleep(300)]);
      expect(a.exitCode).toBeNull();
      expect(a.signalCode).toBeNull();
      const probe = new URL(`https://127.0.0.1:${portA}/`);
      probe.protocol = "http:";
      const res = await fetch(probe, { signal: AbortSignal.timeout(1000) });
      expect(res.headers.get("X-L2F-Relay-Protocol")).toBe(RELAY_PROTOCOL_VERSION);
    } finally {
      a.kill(); b.kill();
      await Promise.all([a.exited, b.exited]);
      rmSync(dir, { recursive: true });
    }
  }, 20_000);
});
