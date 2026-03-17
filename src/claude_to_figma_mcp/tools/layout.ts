import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SendCommandFn } from "../types.js";

export function registerTools(server: McpServer, sendCommandToFigma: SendCommandFn) {
  server.tool("set_layout_mode", "Set the layout mode and wrap behavior of a frame in Figma", {
    nodeId: z.string().describe("The ID of the frame to modify"),
    layoutMode: z.enum(["NONE", "HORIZONTAL", "VERTICAL"]).describe("Layout mode for the frame"),
    layoutWrap: z.enum(["NO_WRAP", "WRAP"]).optional().describe("Whether the auto-layout frame wraps its children")
  }, async ({ nodeId, layoutMode, layoutWrap }: any) => {
    try {
      const result = await sendCommandToFigma("set_layout_mode", { nodeId, layoutMode, layoutWrap: layoutWrap || "NO_WRAP" });
      const typedResult = result as { name: string };
      return { content: [{ type: "text", text: `Set layout mode of frame "${typedResult.name}" to ${layoutMode}${layoutWrap ? ` with ${layoutWrap}` : ''}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting layout mode: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("set_padding", "Set padding values for an auto-layout frame in Figma", {
    nodeId: z.string().describe("The ID of the frame to modify"),
    paddingTop: z.number().optional().describe("Top padding value"),
    paddingRight: z.number().optional().describe("Right padding value"),
    paddingBottom: z.number().optional().describe("Bottom padding value"),
    paddingLeft: z.number().optional().describe("Left padding value"),
  }, async ({ nodeId, paddingTop, paddingRight, paddingBottom, paddingLeft }: any) => {
    try {
      const result = await sendCommandToFigma("set_padding", { nodeId, paddingTop, paddingRight, paddingBottom, paddingLeft });
      const typedResult = result as { name: string };
      const paddingMessages: string[] = [];
      if (paddingTop !== undefined) paddingMessages.push(`top: ${paddingTop}`);
      if (paddingRight !== undefined) paddingMessages.push(`right: ${paddingRight}`);
      if (paddingBottom !== undefined) paddingMessages.push(`bottom: ${paddingBottom}`);
      if (paddingLeft !== undefined) paddingMessages.push(`left: ${paddingLeft}`);
      const paddingText = paddingMessages.length > 0 ? `padding (${paddingMessages.join(', ')})` : "padding";
      return { content: [{ type: "text", text: `Set ${paddingText} for frame "${typedResult.name}"` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting padding: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("set_axis_align", "Set primary and counter axis alignment for an auto-layout frame in Figma", {
    nodeId: z.string().describe("The ID of the frame to modify"),
    primaryAxisAlignItems: z.enum(["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]).optional().describe("Primary axis alignment (MIN/MAX = left/right in horizontal, top/bottom in vertical). Note: When set to SPACE_BETWEEN, itemSpacing will be ignored as children will be evenly spaced."),
    counterAxisAlignItems: z.enum(["MIN", "MAX", "CENTER", "BASELINE"]).optional().describe("Counter axis alignment (MIN/MAX = top/bottom in horizontal, left/right in vertical)")
  }, async ({ nodeId, primaryAxisAlignItems, counterAxisAlignItems }: any) => {
    try {
      const result = await sendCommandToFigma("set_axis_align", { nodeId, primaryAxisAlignItems, counterAxisAlignItems });
      const typedResult = result as { name: string };
      const alignMessages: string[] = [];
      if (primaryAxisAlignItems !== undefined) alignMessages.push(`primary: ${primaryAxisAlignItems}`);
      if (counterAxisAlignItems !== undefined) alignMessages.push(`counter: ${counterAxisAlignItems}`);
      const alignText = alignMessages.length > 0 ? `axis alignment (${alignMessages.join(', ')})` : "axis alignment";
      return { content: [{ type: "text", text: `Set ${alignText} for frame "${typedResult.name}"` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting axis alignment: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("set_layout_sizing", "Set horizontal and vertical sizing modes for an auto-layout frame in Figma", {
    nodeId: z.string().describe("The ID of the frame to modify"),
    layoutSizingHorizontal: z.enum(["FIXED", "HUG", "FILL"]).optional().describe("Horizontal sizing mode (HUG for frames/text only, FILL for auto-layout children only)"),
    layoutSizingVertical: z.enum(["FIXED", "HUG", "FILL"]).optional().describe("Vertical sizing mode (HUG for frames/text only, FILL for auto-layout children only)")
  }, async ({ nodeId, layoutSizingHorizontal, layoutSizingVertical }: any) => {
    try {
      const result = await sendCommandToFigma("set_layout_sizing", { nodeId, layoutSizingHorizontal, layoutSizingVertical });
      const typedResult = result as { name: string };
      const sizingMessages: string[] = [];
      if (layoutSizingHorizontal !== undefined) sizingMessages.push(`horizontal: ${layoutSizingHorizontal}`);
      if (layoutSizingVertical !== undefined) sizingMessages.push(`vertical: ${layoutSizingVertical}`);
      const sizingText = sizingMessages.length > 0 ? `layout sizing (${sizingMessages.join(', ')})` : "layout sizing";
      return { content: [{ type: "text", text: `Set ${sizingText} for frame "${typedResult.name}"` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting layout sizing: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("set_item_spacing", "Set distance between children in an auto-layout frame", {
    nodeId: z.string().describe("The ID of the frame to modify"),
    itemSpacing: z.number().optional().describe("Distance between children. Note: This value will be ignored if primaryAxisAlignItems is set to SPACE_BETWEEN."),
    counterAxisSpacing: z.number().optional().describe("Distance between wrapped rows/columns. Only works when layoutWrap is set to WRAP.")
  }, async ({ nodeId, itemSpacing, counterAxisSpacing }: any) => {
    try {
      const params: any = { nodeId };
      if (itemSpacing !== undefined) params.itemSpacing = itemSpacing;
      if (counterAxisSpacing !== undefined) params.counterAxisSpacing = counterAxisSpacing;
      const result = await sendCommandToFigma("set_item_spacing", params);
      const typedResult = result as { name: string; itemSpacing?: number; counterAxisSpacing?: number };
      let message = `Updated spacing for frame "${typedResult.name}":`;
      if (itemSpacing !== undefined) message += ` itemSpacing=${itemSpacing}`;
      if (counterAxisSpacing !== undefined) message += ` counterAxisSpacing=${counterAxisSpacing}`;
      return { content: [{ type: "text", text: message }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting spacing: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("move_node", "Move a node to a new position in Figma", {
    nodeId: z.string().describe("The ID of the node to move"),
    x: z.number().describe("New X position"),
    y: z.number().describe("New Y position"),
  }, async ({ nodeId, x, y }: any) => {
    try {
      const result = await sendCommandToFigma("move_node", { nodeId, x, y });
      const typedResult = result as { name: string };
      return { content: [{ type: "text", text: `Moved node "${typedResult.name}" to position (${x}, ${y})` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error moving node: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("resize_node", "Resize a node in Figma", {
    nodeId: z.string().describe("The ID of the node to resize"),
    width: z.number().positive().describe("New width"),
    height: z.number().positive().describe("New height"),
  }, async ({ nodeId, width, height }: any) => {
    try {
      const result = await sendCommandToFigma("resize_node", { nodeId, width, height });
      const typedResult = result as { name: string };
      return { content: [{ type: "text", text: `Resized node "${typedResult.name}" to width ${width} and height ${height}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error resizing node: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("delete_node", "Delete a node from Figma", {
    nodeId: z.string().describe("The ID of the node to delete"),
  }, async ({ nodeId }: any) => {
    try {
      await sendCommandToFigma("delete_node", { nodeId });
      return { content: [{ type: "text", text: `Deleted node with ID: ${nodeId}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error deleting node: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("delete_multiple_nodes", "Delete multiple nodes from Figma at once", {
    nodeIds: z.array(z.string()).describe("Array of node IDs to delete"),
  }, async ({ nodeIds }: any) => {
    try {
      const result = await sendCommandToFigma("delete_multiple_nodes", { nodeIds });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error deleting multiple nodes: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("clone_node", "Clone an existing node in Figma", {
    nodeId: z.string().describe("The ID of the node to clone"),
    x: z.number().optional().describe("New X position for the clone"),
    y: z.number().optional().describe("New Y position for the clone")
  }, async ({ nodeId, x, y }: any) => {
    try {
      const result = await sendCommandToFigma('clone_node', { nodeId, x, y });
      const typedResult = result as { name: string; id: string };
      return { content: [{ type: "text", text: `Cloned node "${typedResult.name}" with new ID: ${typedResult.id}${x !== undefined && y !== undefined ? ` at position (${x}, ${y})` : ''}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error cloning node: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("insert_child_at", "Insert a child node at a specific index in a parent frame (useful for ordering in auto-layout)", {
    parentId: z.string().describe("The ID of the parent frame"),
    childId: z.string().describe("The ID of the child node to insert"),
    index: z.number().int().min(0).describe("The index at which to insert the child (0-based)"),
  }, async ({ parentId, childId, index }: any) => {
    try {
      const result = await sendCommandToFigma("insert_child_at", { parentId, childId, index });
      const typedResult = result as { parentName: string; childName: string; index: number };
      return { content: [{ type: "text", text: `Inserted "${typedResult.childName}" at index ${typedResult.index} in "${typedResult.parentName}"` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error inserting child: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("reorder_child", "Move a child node to a different position in its parent's child array", {
    childId: z.string().describe("The ID of the child node to reorder"),
    index: z.number().int().min(0).describe("The new index position (0-based)"),
  }, async ({ childId, index }: any) => {
    try {
      const result = await sendCommandToFigma("reorder_child", { childId, index });
      const typedResult = result as { childName: string; parentName: string; index: number };
      return { content: [{ type: "text", text: `Moved "${typedResult.childName}" to index ${typedResult.index} in "${typedResult.parentName}"` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error reordering child: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
}
