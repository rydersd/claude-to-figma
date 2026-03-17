import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SendCommandFn } from "../types.js";

export function registerTools(server: McpServer, sendCommandToFigma: SendCommandFn) {
  server.tool(
    "introspect",
    "Discover the full manipulation surface of a component or frame in one call. Returns a flat property map with semantic keys (e.g. 'badge.text', 'header.fill') where each entry describes a text, color, instance, boolean, or component_property that can be changed. Also reports wrapper frames, name collisions, and nesting depth — use this output to feed set_properties or optimize_structure.",
    {
      nodeId: z.string().describe("Root node ID to introspect"),
      maxDepth: z.number().int().min(1).max(50).optional().describe("Maximum tree depth to walk (default 20)"),
    },
    async ({ nodeId, maxDepth }: { nodeId: string; maxDepth?: number }) => {
      try {
        const result = await sendCommandToFigma("introspect_node", { nodeId, maxDepth }, 60000);
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error introspecting node: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );

  server.tool(
    "set_properties",
    "Modify multiple properties of a component or frame by semantic key in one call. Pass the property map from introspect (or a subset) along with new values. Supports text, color (hex), instance swap (variant name), boolean (visibility), and component_property changes. Each property is applied independently — one failure won't abort others.",
    {
      nodeId: z.string().describe("Root node ID (same one passed to introspect)"),
      properties: z.record(z.string(), z.union([z.string(), z.boolean(), z.number()])).describe("Map of semantic key → new value. Keys must match those returned by introspect."),
      propertyMap: z.record(z.string(), z.any()).optional().describe("Optional property map from introspect result. If omitted, introspect is called internally."),
    },
    async ({ nodeId, properties, propertyMap }: any) => {
      try {
        const result = await sendCommandToFigma("set_properties", { nodeId, properties, propertyMap }, 60000);
        const typedResult = result as {
          nodeId: string;
          totalProperties: number;
          successCount: number;
          failureCount: number;
          results: Array<{ key: string; success: boolean; error?: string }>;
        };

        const failedResults = typedResult.results.filter(r => !r.success);
        let responseText = `Set properties: ${typedResult.successCount}/${typedResult.totalProperties} succeeded`;
        if (failedResults.length > 0) {
          responseText += `\n\nFailed:\n${failedResults.map(r => `- ${r.key}: ${r.error}`).join("\n")}`;
        }

        return {
          content: [{ type: "text", text: responseText }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error setting properties: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );

  server.tool(
    "optimize_structure",
    "Analyze and optionally restructure a component or frame for more efficient AI manipulation. By default runs in dry-run mode — reports what it would change without applying. Detects wrapper frames (single-child frames with no visual purpose) and proposes flattening, and identifies text nodes that could be renamed with _ prefix for clarity. Use dryRun: false to apply changes.",
    {
      nodeId: z.string().describe("Root node ID to optimize"),
      options: z.object({
        dryRun: z.boolean().optional().describe("If true (default), only report changes without applying them"),
        maxDepth: z.number().int().min(1).max(50).optional().describe("Maximum tree depth to analyze (default 20)"),
        flatten: z.boolean().optional().describe("Remove wrapper frames (default true)"),
        rename: z.boolean().optional().describe("Prefix text node names with _ (default true)"),
        exposeProperties: z.boolean().optional().describe("Report candidates for component property exposure (default false)"),
        extractComponents: z.boolean().optional().describe("Report repeated subtree patterns (default false, v2)"),
      }).optional().describe("Optimization options"),
    },
    async ({ nodeId, options }: any) => {
      try {
        const result = await sendCommandToFigma("optimize_structure", { nodeId, options }, 60000);
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error optimizing structure: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );
}
