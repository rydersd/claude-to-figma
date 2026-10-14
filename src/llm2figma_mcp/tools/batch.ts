import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SendCommandFn } from "../types.js";

export function registerTools(server: McpServer, sendCommandToFigma: SendCommandFn) {
  server.tool("rename_node", "Rename a node's layer name in Figma", {
    nodeId: z.string().describe("The ID of the node to rename"),
    name: z.string().describe("The new name for the node"),
  }, async ({ nodeId, name }: any) => {
    try {
      const result = await sendCommandToFigma("rename_node", { nodeId, name });
      const typedResult = result as { id: string; oldName: string; newName: string };
      return { content: [{ type: "text", text: `Renamed node "${typedResult.oldName}" to "${typedResult.newName}" (ID: ${typedResult.id})` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error renaming node: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("batch_rename", "Rename multiple nodes' layer names in Figma in one call", {
    mappings: z.array(z.object({
      nodeId: z.string().describe("The ID of the node to rename"),
      name: z.string().describe("The new name for the node"),
    })).describe("Array of node ID and name pairs to rename"),
  }, async ({ mappings }: any) => {
    try {
      if (!mappings || mappings.length === 0) {
        return { content: [{ type: "text", text: "No mappings provided" }] };
      }
      const result = await sendCommandToFigma("batch_rename", { mappings });
      const typedResult = result as { success: boolean; totalRequested: number; successCount: number; failureCount: number; results: Array<{ success: boolean; nodeId: string; oldName?: string; newName?: string; error?: string }> };
      const failedResults = typedResult.results.filter((item: any) => !item.success);
      let responseText = `Batch rename completed: ${typedResult.successCount} of ${typedResult.totalRequested} nodes renamed successfully.`;
      if (failedResults.length > 0) {
        responseText += `\n\nFailed nodes:\n${failedResults.map((item: any) => `- ${item.nodeId}: ${item.error}`).join("\n")}`;
      }
      return { content: [{ type: "text", text: responseText }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error batch renaming nodes: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("group_nodes", "Group multiple nodes together (like Cmd+G). All nodes must share the same parent.", {
    nodeIds: z.array(z.string()).min(1).describe("Array of node IDs to group together"),
    name: z.string().optional().describe("Optional name for the group"),
  }, async ({ nodeIds, name }: any) => {
    try {
      const result = await sendCommandToFigma("group_nodes", { nodeIds, name });
      const typedResult = result as { id: string; name: string; childrenCount: number };
      return { content: [{ type: "text", text: `Created group "${typedResult.name}" (ID: ${typedResult.id}) with ${typedResult.childrenCount} children` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error grouping nodes: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("batch_reparent", "Move multiple nodes into a target frame/group/section. Validates parent is a container type.", {
    nodeIds: z.array(z.string()).min(1).describe("Array of node IDs to move"),
    parentId: z.string().describe("The ID of the target parent (FRAME, GROUP, SECTION, PAGE, or COMPONENT)"),
    index: z.number().int().min(0).optional().describe("Optional insertion index (0-based). If omitted, nodes are appended."),
  }, async ({ nodeIds, parentId, index }: any) => {
    try {
      const result = await sendCommandToFigma("batch_reparent", { nodeIds, parentId, index });
      const typedResult = result as { success: boolean; totalRequested: number; successCount: number; failureCount: number; parentName: string; results: Array<{ success: boolean; nodeId: string; nodeName?: string; error?: string }> };
      const failedResults = typedResult.results.filter((item: any) => !item.success);
      let responseText = `Batch reparent completed: ${typedResult.successCount} of ${typedResult.totalRequested} nodes moved into "${typedResult.parentName}".`;
      if (failedResults.length > 0) {
        responseText += `\n\nFailed nodes:\n${failedResults.map((item: any) => `- ${item.nodeId}: ${item.error}`).join("\n")}`;
      }
      return { content: [{ type: "text", text: responseText }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error batch reparenting nodes: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("batch_set_fill_color", "Set the fill color of multiple nodes at once. Supports RGBA (0-1), hex strings (#RRGGBB), or Figma variable references ($var:Collection/Name). Returns success/failure counts.", {
    nodeIds: z.array(z.string()).describe("Array of node IDs to modify"),
    r: z.number().min(0).max(1).describe("Red component (0-1)"),
    g: z.number().min(0).max(1).describe("Green component (0-1)"),
    b: z.number().min(0).max(1).describe("Blue component (0-1)"),
    a: z.number().min(0).max(1).optional().describe("Alpha component (0-1)"),
  }, async ({ nodeIds, r, g, b, a }: any) => {
    try {
      if (!nodeIds || nodeIds.length === 0) {
        return { content: [{ type: "text", text: "No node IDs provided" }] };
      }
      const result = await sendCommandToFigma("batch_set_fill_color", { nodeIds, color: { r, g, b, a: a || 1 } });
      const typedResult = result as { successCount: number; failureCount: number; results: Array<{ nodeId: string; success: boolean; name?: string; error?: string }> };
      return { content: [{ type: "text", text: `Batch set fill color to RGBA(${r}, ${g}, ${b}, ${a || 1}) on ${nodeIds.length} nodes: ${typedResult.successCount} succeeded, ${typedResult.failureCount} failed` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error batch setting fill color: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("batch_clone", "Clone an existing node to multiple positions in one call. Optionally name each clone. Returns array of created clones with their IDs and positions.", {
    sourceId: z.string().describe("The ID of the node to clone"),
    positions: z.array(z.object({
      x: z.number().describe("X position for this clone"),
      y: z.number().describe("Y position for this clone"),
    })).describe("Array of {x, y} positions for each clone"),
    names: z.array(z.string()).optional().describe("Optional array of names for each clone (must match positions length)"),
  }, async ({ sourceId, positions, names }: any) => {
    try {
      if (!positions || positions.length === 0) {
        return { content: [{ type: "text", text: "No positions provided" }] };
      }
      if (names && names.length !== positions.length) {
        return { content: [{ type: "text", text: `Names array length (${names.length}) must match positions array length (${positions.length})` }] };
      }
      const result = await sendCommandToFigma("batch_clone", { sourceId, positions, names });
      const typedResult = result as { clones: Array<{ id: string; name: string; x: number; y: number }>; successCount: number; failureCount: number };
      const cloneList = typedResult.clones.map((c: any) => `  - "${c.name}" (${c.id}) at (${c.x}, ${c.y})`).join("\n");
      return { content: [{ type: "text", text: `Cloned node to ${typedResult.successCount} positions (${typedResult.failureCount} failed):\n${cloneList}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error batch cloning: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
}
