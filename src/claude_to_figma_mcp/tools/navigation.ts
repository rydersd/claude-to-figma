import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SendCommandFn } from "../types.js";
import { joinChannel, autoJoinChannel } from "../connection.js";

export function registerTools(server: McpServer, sendCommandToFigma: SendCommandFn) {
  server.tool("set_focus", "Set focus on a specific node in Figma by selecting it and scrolling viewport to it", {
    nodeId: z.string().describe("The ID of the node to focus on"),
  }, async ({ nodeId }: any) => {
    try {
      const result = await sendCommandToFigma("set_focus", { nodeId });
      const typedResult = result as { name: string; id: string };
      return { content: [{ type: "text", text: `Focused on node "${typedResult.name}" (ID: ${typedResult.id})` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting focus: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("set_selections", "Set selection to multiple nodes in Figma and scroll viewport to show them", {
    nodeIds: z.array(z.string()).describe("Array of node IDs to select"),
  }, async ({ nodeIds }: any) => {
    try {
      const result = await sendCommandToFigma("set_selections", { nodeIds });
      const typedResult = result as { selectedNodes: Array<{ name: string; id: string }>; count: number };
      return { content: [{ type: "text", text: `Selected ${typedResult.count} nodes: ${typedResult.selectedNodes.map(node => `"${node.name}" (${node.id})`).join(', ')}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting selections: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("undo", "Undo the last action(s) in Figma. Use after destructive operations like rasterizing images at wrong sizes, accidental deletions, or batch mutations that produced wrong results.", {
    count: z.number().int().min(1).max(50).optional().describe("Number of undo steps (default 1, max 50)"),
  }, async ({ count }: any) => {
    try {
      const steps = count || 1;
      await sendCommandToFigma("undo", { count: steps });
      return { content: [{ type: "text", text: `Undo triggered ${steps} time(s)` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error triggering undo: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("join_channel", "Connect to a Figma file through its plugin channel. Leave channel empty to join the only connected file automatically. Other tools also auto-join, so this is only needed when several files are connected.", {
    channel: z.string().describe("Channel name shown in the Figma plugin. Empty = auto-join the only connected file").default(""),
  }, async ({ channel }: any) => {
    try {
      const joined = channel ? (await joinChannel(channel), channel) : await autoJoinChannel();
      return { content: [{ type: "text", text: `Successfully joined channel: ${joined}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error joining channel: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
}
