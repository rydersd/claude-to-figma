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

// Stop a relay this plugin started earlier (its pid file points at a live
// process running a plugin relay.js). Never touches a relay started by hand.
async function stopOwnRelay(pidFile: string, port: number): Promise<boolean> {
  let pid: number;
  try {
    pid = Number(fs.readFileSync(pidFile, "utf-8").trim());
    const command = execFileSync("ps", ["-p", String(pid), "-o", "command="], { encoding: "utf-8" });
    if (!command.includes(path.join("server", "relay.js"))) return false;
    process.kill(pid, "SIGTERM");
  } catch {
    return false;
  }
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (!(await isRelayListening(port))) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

let relayStart: Promise<boolean> | null = null;

// Start the bundled relay in the background if nothing is listening on the
// port. It keeps running after this session ends so other sessions and the
// Figma plugin can keep using it; its log and pid live in CLAUDE_PLUGIN_DATA.
export function ensureRelay(port: number): Promise<boolean> {
  if (!PLUGIN_ROOT || !PLUGIN_DATA) return isRelayListening(port);
  if (!relayStart) {
    relayStart = (async () => {
      const pidFile = path.join(PLUGIN_DATA, "relay.pid");
      const version = await relayVersion(port);
      if (version === RELAY_PROTOCOL_VERSION) return true;
      if (version !== null) {
        // An older relay holds the port. Replace it if we started it;
        // otherwise leave it and let the caller report it.
        if (!(await stopOwnRelay(pidFile, port))) {
          logger.warn(`An older relay (protocol "${version}") is running on port ${port} and wasn't started by this plugin.`);
          return true;
        }
        logger.info("Replaced an older relay started by this plugin");
      }
      if (!process.versions.bun) {
        logger.error("The relay needs Bun. Install it: curl -fsSL https://bun.sh/install | bash");
        return false;
      }

      const relayScript = path.join(PLUGIN_ROOT, "server", "relay.js");
      const logPath = path.join(PLUGIN_DATA, "relay.log");
      fs.mkdirSync(PLUGIN_DATA, { recursive: true });
      // Start each relay with a fresh log so it can't grow without bound. The
      // relay writes its own pid once it holds the port.
      const log = fs.openSync(logPath, "w");
      const child = spawn(process.execPath, [relayScript], {
        detached: true,
        stdio: ["ignore", log, log],
        env: { ...process.env, C2F_RELAY_PID_FILE: pidFile },
      });
      child.unref();
      fs.closeSync(log);
      logger.info(`Starting relay; log: ${logPath}`);

      // Another session may have won the race for the port; either way, wait
      // until something answers.
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        if (await isRelayListening(port)) return true;
        await new Promise((r) => setTimeout(r, 150));
      }
      logger.error(`The relay did not start; see ${logPath}`);
      return false;
    })().finally(() => {
      relayStart = null;
    });
  }
  return relayStart;
}
