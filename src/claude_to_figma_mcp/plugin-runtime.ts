// Helpers that only apply when the server runs as an installed Claude Code
// plugin. Claude Code sets CLAUDE_PLUGIN_ROOT (the installed, versioned copy)
// and CLAUDE_PLUGIN_DATA (a stable per-plugin directory kept across updates).
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { logger } from "./helpers.js";

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

let relayStart: Promise<boolean> | null = null;

// Start the bundled relay in the background if nothing is listening on the
// port. It keeps running after this session ends so other sessions and the
// Figma plugin can keep using it; its log and pid live in CLAUDE_PLUGIN_DATA.
export function ensureRelay(port: number): Promise<boolean> {
  if (!PLUGIN_ROOT || !PLUGIN_DATA) return isRelayListening(port);
  if (!relayStart) {
    relayStart = (async () => {
      if (await isRelayListening(port)) return true;
      if (!process.versions.bun) {
        logger.error("The relay needs Bun. Install it: curl -fsSL https://bun.sh/install | bash");
        return false;
      }

      const relayScript = path.join(PLUGIN_ROOT, "server", "relay.js");
      const logPath = path.join(PLUGIN_DATA, "relay.log");
      fs.mkdirSync(PLUGIN_DATA, { recursive: true });
      const log = fs.openSync(logPath, "a");
      const child = spawn(process.execPath, [relayScript], {
        detached: true,
        stdio: ["ignore", log, log],
      });
      child.unref();
      fs.closeSync(log);
      if (child.pid) fs.writeFileSync(path.join(PLUGIN_DATA, "relay.pid"), String(child.pid));
      logger.info(`Started relay (pid ${child.pid}); log: ${logPath}`);

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
