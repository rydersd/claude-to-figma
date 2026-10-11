import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listChannels } from "../connection.js";
import { ensureRelay, figmaPluginManifestPath, isPluginInstall } from "../plugin-runtime.js";

// One call that answers "is everything connected, and if not, what's next?"
export function registerSetupTools(server: McpServer) {
  server.tool(
    "setup_status",
    "Check the claude-to-figma connection: whether the relay is running (starting it when installed as a Claude Code plugin), which Figma files have the plugin open, and where the Figma plugin manifest is for importing into Figma. Use it when setting up or when a Figma tool reports it isn't connected.",
    {},
    async () => {
      const relay = await ensureRelay(3055);
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
        ? "Start the relay: `bun socket` in the claude-to-figma repo (the plugin version starts it automatically; it needs Bun)."
        : channelError
          ? channelError
          : files.length === 0
            ? `Open a file in the Figma desktop app and run Plugins → Development → Claude to Figma Plugin.${manifest ? ` If it isn't listed, import it first: Plugins → Development → Import plugin from manifest… → ${manifest}` : ""}`
            : files.length === 1
              ? "Ready. Figma tools will use the open file."
              : "Several files have the plugin open. Ask the user which one, then call join_channel with its channel name.";

      const status = {
        installedAsClaudeCodePlugin: isPluginInstall,
        relayRunning: relay,
        connectedFigmaFiles: files.map((f) => f.name),
        figmaPluginManifest: manifest ?? "src/claude_figma_plugin/manifest.json in the claude-to-figma repo",
        next,
      };
      return { content: [{ type: "text", text: JSON.stringify(status, null, 2) }] };
    }
  );
}
