import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SendCommandFn } from "../types.js";

export function registerTools(server: McpServer, sendCommandToFigma: SendCommandFn) {
  server.tool("get_reactions", "Get Figma Prototyping Reactions from multiple nodes. CRITICAL: The output MUST be processed using the 'reaction_to_connector_strategy' prompt IMMEDIATELY to generate parameters for connector lines via the 'create_connections' tool.", {
    nodeIds: z.array(z.string()).describe("Array of node IDs to get reactions from"),
  }, async ({ nodeIds }: any) => {
    try {
      const result = await sendCommandToFigma("get_reactions", { nodeIds });
      return {
        content: [
          { type: "text", text: JSON.stringify(result) },
          { type: "text", text: "IMPORTANT: You MUST now use the reaction data above and follow the `reaction_to_connector_strategy` prompt to prepare the parameters for the `create_connections` tool call. This is a required next step." }
        ],
        followUp: { type: "prompt", prompt: "reaction_to_connector_strategy" },
      };
    } catch (error) {
      return { content: [{ type: "text", text: `Error getting reactions: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("set_default_connector", "Set a copied connector node as the default connector", {
    connectorId: z.string().optional().describe("The ID of the connector node to set as default")
  }, async ({ connectorId }: any) => {
    try {
      const result = await sendCommandToFigma("set_default_connector", { connectorId });
      return { content: [{ type: "text", text: `Default connector set: ${JSON.stringify(result)}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting default connector: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("create_connections", "Create connections between nodes using the default connector style", {
    connections: z.array(z.object({
      startNodeId: z.string().describe("ID of the starting node"),
      endNodeId: z.string().describe("ID of the ending node"),
      text: z.string().optional().describe("Optional text to display on the connector")
    })).describe("Array of node connections to create")
  }, async ({ connections }: any) => {
    try {
      if (!connections || connections.length === 0) {
        return { content: [{ type: "text", text: "No connections provided" }] };
      }
      const result = await sendCommandToFigma("create_connections", { connections });
      return { content: [{ type: "text", text: `Created ${connections.length} connections: ${JSON.stringify(result)}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating connections: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
}
