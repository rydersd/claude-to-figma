// Helpers that only apply when the server runs as an installed Claude Code
// plugin. Claude Code sets CLAUDE_PLUGIN_ROOT (the installed, versioned copy)
// and CLAUDE_PLUGIN_DATA (a stable per-plugin directory kept across updates).
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { logger } from "./helpers.js";
import { RELAY_PROTOCOL_VERSION, RELAY_VERSION_HEADER } from "../relay-protocol.js";

const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT;
const PLUGIN_DATA = process.env.CLAUDE_PLUGIN_DATA;

export const isPluginInstall = Boolean(PLUGIN_ROOT && PLUGIN_DATA);

// Figma imports a development plugin by manifest path, so keep its files in
// the data directory: that path survives plugin updates, the root does not.
export function figmaPluginManifestPath(): string | null {
  return PLUGIN_DATA ? path.join(PLUGIN_DATA, "figma-plugin", "manifest.json") : null;
}

export function installFigmaPluginFiles(): void {
  if (!PLUGIN_ROOT || !PLUGIN_DATA) return;
  const src = path.join(PLUGIN_ROOT, "figma-plugin");
  const dest = path.join(PLUGIN_DATA, "figma-plugin");
  try {
    fs.mkdirSync(dest, { recursive: true });
    for (const file of fs.readdirSync(src)) {
      fs.copyFileSync(path.join(src, file), path.join(dest, file));
    }
  } catch (error) {
    logger.warn(`Could not copy the Figma plugin files to ${dest}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function isRelayListening(port: number, timeoutMs: number = 500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    const done = (open: boolean) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });
}

// The relay's protocol version, "" for a relay too old to report one, or null
// when nothing answers.
async function relayVersion(port: number): Promise<string | null> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1000) });
    return res.headers.get(RELAY_VERSION_HEADER) ?? "";
  } catch {
    return null;
  }
}

// Everything relay replacement touches outside this module, injectable so the
// ownership and locking rules can be tested without real processes.
export interface RelayHost {
  pluginRoot: string;
  pluginData: string;
  port: number;
  hasBun: boolean;
  /** The relay's protocol version, "" for one too old to report it, null when nothing answers. */
  version(): Promise<string | null>;
  isListening(): Promise<boolean>;
  /** Run a command (no shell) and return stdout; throws when it fails. */
  run(file: string, args: string[]): string;
  kill(pid: number): void;
  /** Start the bundled relay detached; it writes its own pid to pidFile once it holds the port. */
  spawnRelay(pidFile: string, logPath: string): void;
  sleep(ms: number): Promise<void>;
}

// Per-port records, so sessions sharing CLAUDE_PLUGIN_DATA on different relay
// ports never act on each other's relay.
export const relayPidFile = (dataDir: string, port: number) => path.join(dataDir, `relay-${port}.pid`);
export const relayLockFile = (dataDir: string, port: number) => path.join(dataDir, `relay-${port}.lock`);

// A relay this plugin started runs <plugin cache>/<plugin>/<version>/server/relay.js.
// The version directory changes on every plugin update and the relay being
// replaced is usually the previous version's, so match any version of this
// plugin, not only the running one.
function isPluginRelayCommand(command: string, pluginRoot: string): boolean {
  const installDir = path.dirname(path.resolve(pluginRoot)) + path.sep;
  const script = path.sep + path.join("server", "relay.js");
  const at = command.indexOf(installDir);
  return at >= 0 && command.indexOf(script, at + installDir.length) > at;
}

// Stop the relay on host.port only when it provably is one this plugin
// started: the per-port pid file names a live process running this plugin's
// relay.js, and that same process is the one listening on the port. Anything
// short of that proof leaves the process alone.
export async function stopOwnRelay(host: RelayHost): Promise<boolean> {
  try {
    const pid = Number(fs.readFileSync(relayPidFile(host.pluginData, host.port), "utf-8").trim());
    if (!Number.isInteger(pid) || pid <= 1) return false;
    const command = host.run("ps", ["-p", String(pid), "-o", "command="]);
    if (!isPluginRelayCommand(command.trim(), host.pluginRoot)) return false;
    const listeners = host.run("lsof", ["-nP", `-iTCP:${host.port}`, "-sTCP:LISTEN", "-t"])
      .split(/\s+/).filter(Boolean);
    if (!listeners.includes(String(pid))) return false;
    host.kill(pid);
  } catch {
    return false;
  }
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (!(await host.isListening())) return true;
    await host.sleep(100);
  }
  return false;
}

const LOCK_STALE_MS = 10_000;
const LOCK_WAIT_MS = 15_000;

// Cross-process lock on one port's relay, so two sessions can't both decide to
// replace it (the second would kill the first one's replacement). A lock whose
// mtime is older than LOCK_STALE_MS belongs to a crashed holder and is broken;
// a live holder touches it while it works. Returns the release function, or
// null when the lock could not be taken in time.
export async function acquireRelayLock(host: RelayHost): Promise<(() => void) | null> {
  const lockPath = relayLockFile(host.pluginData, host.port);
  fs.mkdirSync(host.pluginData, { recursive: true });
  const deadline = Date.now() + LOCK_WAIT_MS;
  while (true) {
    try {
      const fd = fs.openSync(lockPath, "wx");
      fs.writeSync(fd, String(process.pid));
      fs.closeSync(fd);
      const keepAlive = setInterval(() => {
        try { const now = new Date(); fs.utimesSync(lockPath, now, now); } catch {}
      }, 2000);
      keepAlive.unref?.();
      return () => {
        clearInterval(keepAlive);
        try { fs.unlinkSync(lockPath); } catch {}
      };
    } catch (error: any) {
      if (error?.code !== "EEXIST") throw error;
    }
    try {
      if (Date.now() - fs.statSync(lockPath).mtimeMs > LOCK_STALE_MS) {
        fs.unlinkSync(lockPath);
        continue;
      }
    } catch {
      continue; // released between our open and stat: try again
    }
    if (Date.now() >= deadline) return null;
    await host.sleep(100);
  }
}

/**
 * Make sure a current relay listens on host.port: start one if the port is
 * free, replace an older one this plugin started, and leave anything else
 * alone. Replacement is serialized across processes by a per-port lock and
 * the version is re-checked under it.
 */
export async function startOrReplaceRelay(host: RelayHost): Promise<boolean> {
  if ((await host.version()) === RELAY_PROTOCOL_VERSION) return true;
  const release = await acquireRelayLock(host);
  if (!release) {
    logger.warn(`Another session is still starting the relay on port ${host.port}; not touching it.`);
    return host.isListening();
  }
  try {
    // Another session may have replaced or started it while we waited.
    const version = await host.version();
    if (version === RELAY_PROTOCOL_VERSION) return true;
    if (version !== null) {
      // An older relay holds the port. Replace it if we started it;
      // otherwise leave it and let the caller report it.
      if (!(await stopOwnRelay(host))) {
        logger.warn(`An older relay (protocol "${version}") is running on port ${host.port} and wasn't started by this plugin.`);
        return true;
      }
      logger.info("Replaced an older relay started by this plugin");
    }
    if (!host.hasBun) {
      logger.error("The relay needs Bun. Install it: curl -fsSL https://bun.sh/install | bash");
      return false;
    }

    const logPath = path.join(host.pluginData, "relay.log");
    host.spawnRelay(relayPidFile(host.pluginData, host.port), logPath);
    logger.info(`Starting relay; log: ${logPath}`);

    // Another session may have won the race for the port; either way, wait
    // until something answers.
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      if (await host.isListening()) return true;
      await host.sleep(150);
    }
    logger.error(`The relay did not start; see ${logPath}`);
    return false;
  } finally {
    release();
  }
}

function defaultRelayHost(pluginRoot: string, pluginData: string, port: number): RelayHost {
  return {
    pluginRoot,
    pluginData,
    port,
    hasBun: Boolean(process.versions.bun),
    version: () => relayVersion(port),
    isListening: () => isRelayListening(port),
    run: (file, args) => execFileSync(file, args, { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }),
    kill: (pid) => process.kill(pid, "SIGTERM"),
    spawnRelay: (pidFile, logPath) => {
      fs.mkdirSync(pluginData, { recursive: true });
      // Start each relay with a fresh log so it can't grow without bound.
      const log = fs.openSync(logPath, "w");
      const child = spawn(process.execPath, [path.join(pluginRoot, "server", "relay.js")], {
        detached: true,
        stdio: ["ignore", log, log],
        env: { ...process.env, L2F_RELAY_PORT: String(port), L2F_RELAY_PID_FILE: pidFile },
      });
      child.unref();
      fs.closeSync(log);
    },
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  };
}

let relayStart: Promise<boolean> | null = null;

// Start the bundled relay in the background if nothing is listening on the
// port. It keeps running after this session ends so other sessions and the
// Figma plugin can keep using it; its log and pid live in CLAUDE_PLUGIN_DATA.
export function ensureRelay(port: number): Promise<boolean> {
  if (!PLUGIN_ROOT || !PLUGIN_DATA) return isRelayListening(port);
  if (!relayStart) {
    relayStart = startOrReplaceRelay(defaultRelayHost(PLUGIN_ROOT, PLUGIN_DATA, port)).finally(() => {
      relayStart = null;
    });
  }
  return relayStart;
}
