import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SendCommandFn, getInstanceOverridesResult, setInstanceOverridesResult } from "../types.js";

export function registerTools(server: McpServer, sendCommandToFigma: SendCommandFn) {
  server.tool("get_styles", "Get all styles from the current Figma document", {}, async () => {
    try {
      const result = await sendCommandToFigma("get_styles");
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error getting styles: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("get_local_variables", "Get all local variables (design tokens) from the Figma document, organized by collection. Use these variable names with $var:Collection/Name in create_node_tree color fields to bind real Figma variables.", {}, async () => {
    try {
      const result = await sendCommandToFigma("get_local_variables");
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error getting local variables: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("get_local_components", "Get all local components from the Figma document", {}, async () => {
    try {
      const result = await sendCommandToFigma("get_local_components");
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error getting local components: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("create_component_instance", "Create an instance of a component in Figma. For LOCAL components (from get_local_components), use componentId with the id field. For published LIBRARY components, use componentKey with the publishedKey field. Optionally set component properties and text overrides in the same call.", {
    componentId: z.string().optional().describe("ID of a local component (use the id field from get_local_components result). Use this for unpublished/local components."),
    componentKey: z.string().optional().describe("Key of a published library component to instantiate (use the publishedKey field from get_local_components result). Only works for published components."),
    x: z.number().describe("X position"),
    y: z.number().describe("Y position"),
    parentId: z.string().optional().describe("Optional parent node ID to place the instance into"),
    insertAt: z.number().int().min(0).optional().describe("Optional child index to insert at (0 = first/top). If omitted, appends as last child."),
    properties: z.record(z.string(), z.union([z.string(), z.boolean()])).optional().describe("Component property overrides using key#id pairs (e.g. {'Text#12345': 'Hello', 'Visible#67890': true})"),
    textOverrides: z.record(z.string(), z.string()).optional().describe("Text overrides keyed by child node name (e.g. {'Title': 'My Title', 'Description': 'My desc'}). Walks the instance tree and sets text on matching names."),
  }, async ({ componentId, componentKey, x, y, parentId, insertAt, properties, textOverrides }: any) => {
    try {
      const result = await sendCommandToFigma("create_component_instance", { componentId, componentKey, x, y, parentId, insertAt, properties, textOverrides });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating component instance: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("get_instance_overrides", "Get all override properties from a selected component instance. These overrides can be applied to other instances, which will swap them to match the source component.", {
    nodeId: z.string().optional().describe("Optional ID of the component instance to get overrides from. If not provided, currently selected instance will be used."),
  }, async ({ nodeId }: any) => {
    try {
      const result = await sendCommandToFigma("get_instance_overrides", { instanceNodeId: nodeId || null });
      const typedResult = result as getInstanceOverridesResult;
      return { content: [{ type: "text", text: typedResult.success ? `Successfully got instance overrides: ${typedResult.message}` : `Failed to get instance overrides: ${typedResult.message}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error copying instance overrides: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("set_instance_overrides", "Apply previously copied overrides to selected component instances. Target instances will be swapped to the source component and all copied override properties will be applied.", {
    sourceInstanceId: z.string().describe("ID of the source component instance"),
    targetNodeIds: z.array(z.string()).describe("Array of target instance IDs. Currently selected instances will be used.")
  }, async ({ sourceInstanceId, targetNodeIds }: any) => {
    try {
      const result = await sendCommandToFigma("set_instance_overrides", { sourceInstanceId, targetNodeIds: targetNodeIds || [] });
      const typedResult = result as setInstanceOverridesResult;
      if (typedResult.success) {
        const successCount = typedResult.results?.filter(r => r.success).length || 0;
        return { content: [{ type: "text", text: `Successfully applied ${typedResult.totalCount || 0} overrides to ${successCount} instances.` }] };
      } else {
        return { content: [{ type: "text", text: `Failed to set instance overrides: ${typedResult.message}` }] };
      }
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting instance overrides: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("swap_instance_variant", "Swap a component instance to a different component or variant. The target must be a COMPONENT node. Overrides on the instance are preserved where possible.", {
    nodeId: z.string().describe("The ID of the INSTANCE node to swap"),
    componentKey: z.string().describe("The ID of the target COMPONENT node to swap to (use the id field from get_local_components, or a component node ID from get_node_info)"),
  }, async ({ nodeId, componentKey }: any) => {
    try {
      const result = await sendCommandToFigma("swap_instance_variant", { nodeId, componentKey });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error swapping instance variant: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("set_component_properties", "Set component property values on a component instance. Properties use key-value pairs where keys include the #id suffix (e.g. 'Text#12345'). Use get_node_info on an instance to see its componentProperties and available property keys. Supports TEXT, BOOLEAN, INSTANCE_SWAP, and VARIANT property types.", {
    nodeId: z.string().describe("The ID of the INSTANCE node to update"),
    properties: z.record(z.string(), z.union([z.string(), z.boolean()])).describe("Key-value pairs of component properties to set. Keys must include the #id suffix (e.g. 'Text#12345': 'Hello', 'Visible#67890': true). For INSTANCE_SWAP, the value is a component ID string."),
  }, async ({ nodeId, properties }: any) => {
    try {
      const result = await sendCommandToFigma("set_component_properties", { nodeId, properties });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting component properties: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("create_component", "Convert an existing frame into a Figma component", {
    nodeId: z.string().describe("The ID of the frame to convert into a component"),
  }, async ({ nodeId }: any) => {
    try {
      const result = await sendCommandToFigma("create_component", { nodeId });
      const typedResult = result as { name: string; id: string; key: string };
      return { content: [{ type: "text", text: `Converted frame to component "${typedResult.name}" with ID: ${typedResult.id} and key: ${typedResult.key}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating component: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("export_node_as_image", "Export a node as an image from Figma", {
    nodeId: z.string().describe("The ID of the node to export"),
    format: z.enum(["PNG", "JPG", "SVG", "PDF"]).optional().describe("Export format"),
    scale: z.number().positive().optional().describe("Export scale"),
  }, async ({ nodeId, format, scale }: any) => {
    try {
      const result = await sendCommandToFigma("export_node_as_image", { nodeId, format: format || "PNG", scale: scale || 1 });
      const typedResult = result as { imageData: string; mimeType: string };
      return { content: [{ type: "image", data: typedResult.imageData, mimeType: typedResult.mimeType || "image/png" }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error exporting node as image: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
}
