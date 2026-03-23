import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SendCommandFn } from "../types.js";
import { joinChannel } from "../connection.js";

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

  server.tool("redo", "Redo the last undone action(s) in Figma.", {
    count: z.number().int().min(1).max(50).optional().describe("Number of redo steps (default 1, max 50)"),
  }, async ({ count }: any) => {
    try {
      const steps = count || 1;
      await sendCommandToFigma("redo", { count: steps });
      return { content: [{ type: "text", text: `Redo triggered ${steps} time(s)` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error triggering redo: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("join_channel", "Join a specific channel to communicate with Figma", {
    channel: z.string().describe("The name of the channel to join").default(""),
  }, async ({ channel }: any) => {
    try {
      if (!channel) {
        return {
          content: [{ type: "text", text: "Please provide a channel name to join:" }],
          followUp: { tool: "join_channel", description: "Join the specified channel" },
        };
      }
      await joinChannel(channel);
      return { content: [{ type: "text", text: `Successfully joined channel: ${channel}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error joining channel: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
}
