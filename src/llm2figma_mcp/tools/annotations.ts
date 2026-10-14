import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SendCommandFn } from "../types.js";

export function registerTools(server: McpServer, sendCommandToFigma: SendCommandFn) {
  server.tool("get_annotations", "Get all annotations in the current document or specific node", {
    nodeId: z.string().describe("node ID to get annotations for specific node"),
    includeCategories: z.boolean().optional().default(true).describe("Whether to include category information")
  }, async ({ nodeId, includeCategories }: any) => {
    try {
      const result = await sendCommandToFigma("get_annotations", { nodeId, includeCategories });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error getting annotations: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("set_annotation", "Create or update an annotation", {
    nodeId: z.string().describe("The ID of the node to annotate"),
    annotationId: z.string().optional().describe("The ID of the annotation to update (if updating existing annotation)"),
    labelMarkdown: z.string().describe("The annotation text in markdown format"),
    categoryId: z.string().optional().describe("The ID of the annotation category"),
    properties: z.array(z.object({ type: z.string() })).optional().describe("Additional properties for the annotation")
  }, async ({ nodeId, annotationId, labelMarkdown, categoryId, properties }: any) => {
    try {
      const result = await sendCommandToFigma("set_annotation", { nodeId, annotationId, labelMarkdown, categoryId, properties });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting annotation: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("set_multiple_annotations", "Set multiple annotations parallelly in a node", {
    nodeId: z.string().describe("The ID of the node containing the elements to annotate"),
    annotations: z.array(z.object({
      nodeId: z.string().describe("The ID of the node to annotate"),
      labelMarkdown: z.string().describe("The annotation text in markdown format"),
      categoryId: z.string().optional().describe("The ID of the annotation category"),
      annotationId: z.string().optional().describe("The ID of the annotation to update (if updating existing annotation)"),
      properties: z.array(z.object({ type: z.string() })).optional().describe("Additional properties for the annotation")
    })).describe("Array of annotations to apply"),
  }, async ({ nodeId, annotations }: any) => {
    try {
      if (!annotations || annotations.length === 0) {
        return { content: [{ type: "text", text: "No annotations provided" }] };
      }
      const initialStatus = { type: "text" as const, text: `Starting annotation process for ${annotations.length} nodes. This will be processed in batches of 5...` };
      let totalProcessed = 0;
      const totalToProcess = annotations.length;
      const result = await sendCommandToFigma("set_multiple_annotations", { nodeId, annotations });
      interface AnnotationResult {
        success: boolean; nodeId: string; annotationsApplied?: number; annotationsFailed?: number;
        totalAnnotations?: number; completedInChunks?: number;
        results?: Array<{ success: boolean; nodeId: string; error?: string; annotationId?: string }>;
      }
      const typedResult = result as AnnotationResult;
      const success = typedResult.annotationsApplied && typedResult.annotationsApplied > 0;
      const progressText = `\n      Annotation process completed:\n      - ${typedResult.annotationsApplied || 0} of ${totalToProcess} successfully applied\n      - ${typedResult.annotationsFailed || 0} failed\n      - Processed in ${typedResult.completedInChunks || 1} batches\n      `;
      const detailedResults = typedResult.results || [];
      const failedResults = detailedResults.filter(item => !item.success);
      let detailedResponse = "";
      if (failedResults.length > 0) {
        detailedResponse = `\n\nNodes that failed:\n${failedResults.map(item => `- ${item.nodeId}: ${item.error || "Unknown error"}`).join('\n')}`;
      }
      return { content: [initialStatus, { type: "text" as const, text: progressText + detailedResponse }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting multiple annotations: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("scan_nodes_by_types", "Scan for child nodes with specific types in the selected Figma node", {
    nodeId: z.string().describe("ID of the node to scan"),
    types: z.array(z.string()).describe("Array of node types to find in the child nodes (e.g. ['COMPONENT', 'FRAME'])")
  }, async ({ nodeId, types }: any) => {
    try {
      const initialStatus = { type: "text" as const, text: `Starting node type scanning for types: ${types.join(', ')}...` };
      const result = await sendCommandToFigma("scan_nodes_by_types", { nodeId, types });
      if (result && typeof result === 'object' && 'matchingNodes' in result) {
        const typedResult = result as { success: boolean; count: number; matchingNodes: Array<{ id: string; name: string; type: string; bbox: { x: number; y: number; width: number; height: number } }>; searchedTypes: Array<string> };
        const summaryText = `Scan completed: Found ${typedResult.count} nodes matching types: ${typedResult.searchedTypes.join(', ')}`;
        return { content: [initialStatus, { type: "text" as const, text: summaryText }, { type: "text" as const, text: JSON.stringify(typedResult.matchingNodes, null, 2) }] };
      }
      return { content: [initialStatus, { type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error scanning nodes by types: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
}
