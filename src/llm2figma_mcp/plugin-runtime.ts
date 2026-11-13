// Relay start-up for both installs, and helpers that only apply when the
// server runs as an installed Claude Code plugin. Claude Code sets
// CLAUDE_PLUGIN_ROOT (the installed, versioned copy) and CLAUDE_PLUGIN_DATA (a
// stable per-plugin directory kept across updates).
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { logger } from "./helpers.js";
import { RELAY_PROTOCOL_VERSION, RELAY_VERSION_HEADER } from "../relay-protocol.js";

const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT;
const PLUGIN_DATA = process.env.CLAUDE_PLUGIN_DATA;

export const isPluginInstall = Boolean(PLUGIN_ROOT && PLUGIN_DATA);

// A clone install (`bun <repo>/src/llm2figma_mcp/server.ts`) starts the relay
// from the same checkout. Its pid, lock and log files live in ~/.llm2figma
// (L2F_RELAY_DATA_DIR moves them, for tests). L2F_NO_RELAY_AUTOSTART=1 turns
// autostart off for either install.
// From src/llm2figma_mcp/ or dist/; the CJS build has no import.meta.url.
function cloneRelayScript(): string | undefined {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    return [path.resolve(here, "..", "socket.ts"), path.resolve(here, "..", "src", "socket.ts")].find((f) => fs.existsSync(f));
  } catch {
    return undefined;
  }
}
const CLONE_RELAY_SCRIPT = isPluginInstall ? undefined : cloneRelayScript();
const autostartOff = process.env.L2F_NO_RELAY_AUTOSTART === "1";
export const relayAutostart = !autostartOff && (isPluginInstall || Boolean(CLONE_RELAY_SCRIPT));

// What the last relay check found, for setup_status.
export type RelayStatus = "started" | "already-running" | "blocked" | "failed" | "autostart-off" | "not-running";
let relayStatus: RelayStatus | null = null;
export const lastRelayStatus = () => relayStatus;

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
  /** The plugin's installed root; unused when relayScript is set. */
  pluginRoot: string;
  /** Where the pid, lock and log files live. */
  pluginData: string;
  /** Clone install: the one relay script this server starts and may replace. */
  relayScript?: string;
  port: number;
  hasBun: boolean;
  /** The relay's protocol version, "" for one too old to report it, null when nothing answers. */
  version(): Promise<string | null>;
  isListening(): Promise<boolean>;
  /** Run a command (no shell) and return stdout; throws when it fails. */
  run(file: string, args: string[]): string;
  kill(pid: number): void;
  /** Start the relay detached; it writes its own pid to pidFile once it holds the port. */
  spawnRelay(pidFile: string, logPath: string): void;
  sleep(ms: number): Promise<void>;
}

// Per-port records, so sessions sharing CLAUDE_PLUGIN_DATA on different relay
// ports never act on each other's relay.
export const relayPidFile = (dataDir: string, port: number) => path.join(dataDir, `relay-${port}.pid`);
export const relayLockFile = (dataDir: string, port: number) => path.join(dataDir, `relay-${port}.lock`);
// Earlier versions recorded the relay in one file with no port in its name.
const legacyRelayPidFile = (dataDir: string) => path.join(dataDir, "relay.pid");

// A relay this plugin started runs <plugin cache>/<plugin>/<version>/server/relay.js.
// The version directory changes on every plugin update and the relay being
// replaced is usually the previous version's, so match any version of this
// plugin, not only the running one. The relay is launched as
// `<runtime> <script>`, so the script must be the whole of what follows the
// runtime and its flags: a relay path that merely appears in some other
// argument proves nothing. `ps` does not quote, so everything after the flags
// is taken as the script path, which also keeps paths with spaces working.
// A clone install's relay must run exactly host.relayScript.
function isOwnRelayCommand(command: string, host: RelayHost): boolean {
  const args = command.trim().split(/\s+/).slice(1);
  while (args.length > 0 && args[0].startsWith("-")) args.shift();
  const script = args.join(" ");
  if (!path.isAbsolute(script)) return false;
  if (host.relayScript) return path.resolve(script) === path.resolve(host.relayScript);
  const installDir = path.dirname(path.resolve(host.pluginRoot));
  const [version, ...rest] = path.relative(installDir, path.resolve(script)).split(path.sep);
  return Boolean(version) && version !== ".." && rest.length === 2 && rest[0] === "server" && rest[1] === "relay.js";
}

// Stop the relay on host.port only when it provably is one this plugin
// started: the per-port pid file names a live process running this plugin's
// relay.js, and that same process is the one listening on the port. Anything
// short of that proof leaves the process alone. A relay started before
// per-port pid files is recorded in the legacy relay.pid instead; that record
// is used only when this port has none, is held to the same proof, and is
// moved aside once the relay it named has been stopped.
export async function stopOwnRelay(host: RelayHost): Promise<boolean> {
  let legacyFile: string | null = null;
  try {
    let record: string;
    try {
      record = fs.readFileSync(relayPidFile(host.pluginData, host.port), "utf-8");
    } catch (error: any) {
      if (error?.code !== "ENOENT") return false;
      legacyFile = legacyRelayPidFile(host.pluginData);
      record = fs.readFileSync(legacyFile, "utf-8");
    }
    const pid = Number(record.trim());
    if (!Number.isInteger(pid) || pid <= 1) return false;
    const command = host.run("ps", ["-p", String(pid), "-o", "command="]);
    if (!isOwnRelayCommand(command.trim(), host)) return false;
    const listeners = host.run("lsof", ["-nP", `-iTCP:${host.port}`, "-sTCP:LISTEN", "-t"])
      .split(/\s+/).filter(Boolean);
    if (!listeners.includes(String(pid))) return false;
    host.kill(pid);
  } catch {
    return false;
  }
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (!(await host.isListening())) {
      if (legacyFile) {
        try { fs.renameSync(legacyFile, `${legacyFile}.migrated`); } catch {}
      }
      return true;
    }
    await host.sleep(100);
  }
  return false;
}

const LOCK_STALE_MS = 10_000;
const LOCK_WAIT_MS = 15_000;

// Remove the lock at lockPath only if it is the one the caller means. The
// rename is atomic, so exactly one process gets a given lock file; it is
// judged under its new, unique name, where nobody else can replace it. If it
// turns out to be a different (live) lock, it is linked back, which fails
// rather than overwrite a lock created in the meantime.
function removeLockIf(lockPath: string, isMine: (file: string) => boolean): boolean {
  const aside = `${lockPath}.${randomUUID()}`;
  try {
    fs.renameSync(lockPath, aside);
  } catch {
    return false;
  }
  let mine = false;
  try { mine = isMine(aside); } catch {}
  if (!mine) {
    try { fs.linkSync(aside, lockPath); } catch {}
  }
  try { fs.unlinkSync(aside); } catch {}
  return mine;
}

// Cross-process lock on one port's relay, so two sessions can't both decide to
// replace it (the second would kill the first one's replacement). A lock whose
// mtime is older than LOCK_STALE_MS belongs to a crashed holder and is broken;
// a live holder touches it while it works. Each lock holds its owner's unique
// token, and a lock is only ever removed by removeLockIf, so neither breaking
// a stale lock nor releasing can remove a lock someone else has taken since.
// Returns the release function, or null when the lock could not be taken in
// time.
export async function acquireRelayLock(host: RelayHost): Promise<(() => void) | null> {
  const lockPath = relayLockFile(host.pluginData, host.port);
  const token = `${process.pid}:${randomUUID()}`;
  const holdsLock = () => {
    try { return fs.readFileSync(lockPath, "utf-8") === token; } catch { return false; }
  };
  fs.mkdirSync(host.pluginData, { recursive: true });
  const deadline = Date.now() + LOCK_WAIT_MS;
  while (true) {
    try {
      const fd = fs.openSync(lockPath, "wx");
      fs.writeSync(fd, token);
      fs.closeSync(fd);
      const keepAlive = setInterval(() => {
        if (!holdsLock()) return;
        try { const now = new Date(); fs.utimesSync(lockPath, now, now); } catch {}
      }, 2000);
      keepAlive.unref?.();
      return () => {
        clearInterval(keepAlive);
        if (holdsLock()) removeLockIf(lockPath, (file) => fs.readFileSync(file, "utf-8") === token);
      };
    } catch (error: any) {
      if (error?.code !== "EEXIST") throw error;
    }
    try {
      // Content first, then mtime: a stale mtime then belongs to the lock
      // whose token was read, since any lock taken in between is fresh.
      const observed = fs.readFileSync(lockPath, "utf-8");
      const isStale = (file: string) => Date.now() - fs.statSync(file).mtimeMs > LOCK_STALE_MS;
      if (isStale(lockPath)) {
        removeLockIf(lockPath, (file) => fs.readFileSync(file, "utf-8") === observed && isStale(file));
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
  const done = (status: RelayStatus, result: boolean) => { relayStatus = status; return result; };
  if ((await host.version()) === RELAY_PROTOCOL_VERSION) return done("already-running", true);
  const release = await acquireRelayLock(host);
  if (!release) {
    logger.warn(`Another session is still starting the relay on port ${host.port}; not touching it.`);
    const listening = await host.isListening();
    return done(listening ? "already-running" : "failed", listening);
  }
  try {
    // Another session may have replaced or started it while we waited.
    const version = await host.version();
    if (version === RELAY_PROTOCOL_VERSION) return done("already-running", true);
    if (version === null && (await host.isListening())) {
      // Something that doesn't answer HTTP holds the port: not a relay.
      logger.warn(`Port ${host.port} is held by a process that isn't an llm2figma relay; leaving it alone.`);
      return done("blocked", true);
    }
    if (version !== null) {
      // An older relay holds the port. Replace it if we started it;
      // otherwise leave it and let the caller report it.
      if (!(await stopOwnRelay(host))) {
        logger.warn(`An older relay (protocol "${version}") is running on port ${host.port} and wasn't started by this server.`);
        return done("blocked", true);
      }
      logger.info("Replaced an older relay started by this server");
    }
    if (!host.hasBun) {
      logger.error("The relay needs Bun. Install it: curl -fsSL https://bun.sh/install | bash");
      return done("failed", false);
    }

    const logPath = path.join(host.pluginData, "relay.log");
    host.spawnRelay(relayPidFile(host.pluginData, host.port), logPath);
    logger.info(`Starting relay; log: ${logPath}`);

    // Another session may have won the race for the port; either way, wait
    // until something answers.
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      if (await host.isListening()) return done("started", true);
      await host.sleep(150);
    }
    logger.error(`The relay did not start; see ${logPath}`);
    return done("failed", false);
  } finally {
    release();
  }
}

function defaultRelayHost(pluginRoot: string, pluginData: string, port: number, relayScript?: string): RelayHost {
  const script = relayScript ?? path.join(pluginRoot, "server", "relay.js");
  return {
    pluginRoot,
    pluginData,
    relayScript,
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
      const child = spawn(process.execPath, [script], {
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

// Start the relay in the background if nothing is listening on the port: the
// bundled relay.js for the plugin (log and pid in CLAUDE_PLUGIN_DATA), or the
// checkout's src/socket.ts for a clone install. It keeps running after this
// session ends so other sessions and the Figma plugin can keep using it.
export function ensureRelay(port: number): Promise<boolean> {
  if (!relayAutostart) {
    return isRelayListening(port).then((listening) => {
      relayStatus = listening ? "already-running" : autostartOff ? "autostart-off" : "not-running";
      return listening;
    });
  }
  if (!relayStart) {
    const host = PLUGIN_ROOT && PLUGIN_DATA
      ? defaultRelayHost(PLUGIN_ROOT, PLUGIN_DATA, port)
      : defaultRelayHost(path.dirname(CLONE_RELAY_SCRIPT!),
          process.env.L2F_RELAY_DATA_DIR || path.join(os.homedir(), ".llm2figma"), port, CLONE_RELAY_SCRIPT);
    relayStart = startOrReplaceRelay(host).finally(() => {
      relayStart = null;
    });
  }
  return relayStart;
}
