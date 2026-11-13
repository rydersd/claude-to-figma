import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listChannels } from "../connection.js";
import { ensureRelay, figmaPluginManifestPath, isPluginInstall, lastRelayStatus, type RelayStatus } from "../plugin-runtime.js";

const RELAY_STATUS_TEXT: Record<RelayStatus, string> = {
  "started": "started by this server",
  "already-running": "already running",
  "blocked": `blocked: port ${RELAY_PORT} is held by a process this server didn't start (another program, or an older relay); it was left alone`,
  "failed": "this server couldn't start it",
  "autostart-off": "not running; autostart is off (L2F_NO_RELAY_AUTOSTART=1)",
  "not-running": "not running",
};
const START_BY_HAND = "Start the relay by hand: `bun socket` in the llm2figma repo (it needs Bun).";
import { RELAY_PORT } from "../../relay-protocol.js";
import { hasFigmaTokenItem } from "../keychain.js";

// One call that answers "is everything connected, and if not, what's next?"
export function registerSetupTools(server: McpServer) {
  server.tool(
    "setup_status",
    "Check the llm2figma connection: whether the relay is running (starting it if the port is free, unless L2F_NO_RELAY_AUTOSTART=1), which Figma files have the plugin open, and where the Figma plugin manifest is for importing into Figma. Use it when setting up or when a Figma tool reports it isn't connected.",
    {},
    async () => {
      const relay = await ensureRelay(RELAY_PORT);
      const relayStatus = lastRelayStatus();
      let files: { name: string; clients: number }[] = [];
      let channelError: string | undefined;
      if (relay) {
        try {
          files = await listChannels();
        } catch (error) {
          channelError = error instanceof Error ? error.message : String(error);
        }
      }

      const manifest = figmaPluginManifestPath();
      const next = !relay
        ? START_BY_HAND
        : relayStatus === "blocked"
          ? `Port ${RELAY_PORT} is held by a process that isn't a current llm2figma relay. Stop it, then restart this server or run \`bun socket\` in the llm2figma repo.`
        : channelError
          ? channelError
          : files.length === 0
            ? `Open a file in the Figma desktop app and run Plugins → Development → llm2figma.${manifest ? ` If it isn't listed, import it first: Plugins → Development → Import plugin from manifest… → ${manifest}` : ""}`
            : files.length === 1
              ? "Ready. Figma tools will use the open file."
              : "Several files have the plugin open. Ask the user which one, then call join_channel with its channel name.";

      const status = {
        installedAsClaudeCodePlugin: isPluginInstall,
        relayRunning: relay,
        relay: relayStatus ? RELAY_STATUS_TEXT[relayStatus] : "unknown",
        connectedFigmaFiles: files.map((f) => f.name),
        figmaPluginManifest: manifest ?? "src/llm2figma_plugin/manifest.json in the llm2figma repo",
        // Existence only; the token itself is never read here. Needed by the REST tools (team library).
        figmaTokenInKeychain: await hasFigmaTokenItem(),
        next,
      };
      return { content: [{ type: "text", text: JSON.stringify(status, null, 2) }] };
    }
  );
}
