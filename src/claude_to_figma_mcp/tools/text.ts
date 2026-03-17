import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SendCommandFn } from "../types.js";

export function registerTools(server: McpServer, sendCommandToFigma: SendCommandFn) {
  server.tool("set_text_content", "Set the text content of an existing text node in Figma", {
    nodeId: z.string().describe("The ID of the text node to modify"),
    text: z.string().describe("New text content"),
  }, async ({ nodeId, text }: any) => {
    try {
      const result = await sendCommandToFigma("set_text_content", { nodeId, text });
      const typedResult = result as { name: string };
      return { content: [{ type: "text", text: `Updated text content of node "${typedResult.name}" to "${text}"` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting text content: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("scan_text_nodes", "Scan all text nodes in the selected Figma node", {
    nodeId: z.string().describe("ID of the node to scan"),
  }, async ({ nodeId }: any) => {
    try {
      const initialStatus = { type: "text" as const, text: "Starting text node scanning. This may take a moment for large designs..." };
      const result = await sendCommandToFigma("scan_text_nodes", { nodeId, useChunking: true, chunkSize: 10 });
      if (result && typeof result === 'object' && 'chunks' in result) {
        const typedResult = result as { success: boolean; totalNodes: number; processedNodes: number; chunks: number; textNodes: Array<any> };
        const summaryText = `\n        Scan completed:\n        - Found ${typedResult.totalNodes} text nodes\n        - Processed in ${typedResult.chunks} chunks\n        `;
        return { content: [initialStatus, { type: "text" as const, text: summaryText }, { type: "text" as const, text: JSON.stringify(typedResult.textNodes, null, 2) }] };
      }
      return { content: [initialStatus, { type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error scanning text nodes: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("set_multiple_text_contents", "Set multiple text contents parallelly in a node", {
    nodeId: z.string().describe("The ID of the node containing the text nodes to replace"),
    text: z.array(z.object({
      nodeId: z.string().describe("The ID of the text node"),
      text: z.string().describe("The replacement text"),
    })).describe("Array of text node IDs and their replacement texts"),
  }, async ({ nodeId, text }: any) => {
    try {
      if (!text || text.length === 0) {
        return { content: [{ type: "text", text: "No text provided" }] };
      }
      const initialStatus = { type: "text" as const, text: `Starting text replacement for ${text.length} nodes. This will be processed in batches of 5...` };
      let totalProcessed = 0;
      const totalToProcess = text.length;
      const result = await sendCommandToFigma("set_multiple_text_contents", { nodeId, text });
      interface TextReplaceResult {
        success: boolean; nodeId: string; replacementsApplied?: number; replacementsFailed?: number;
        totalReplacements?: number; completedInChunks?: number;
        results?: Array<{ success: boolean; nodeId: string; error?: string; originalText?: string; translatedText?: string }>;
      }
      const typedResult = result as TextReplaceResult;
      const success = typedResult.replacementsApplied && typedResult.replacementsApplied > 0;
      const progressText = `\n      Text replacement completed:\n      - ${typedResult.replacementsApplied || 0} of ${totalToProcess} successfully updated\n      - ${typedResult.replacementsFailed || 0} failed\n      - Processed in ${typedResult.completedInChunks || 1} batches\n      `;
      const detailedResults = typedResult.results || [];
      const failedResults = detailedResults.filter(item => !item.success);
      let detailedResponse = "";
      if (failedResults.length > 0) {
        detailedResponse = `\n\nNodes that failed:\n${failedResults.map(item => `- ${item.nodeId}: ${item.error || "Unknown error"}`).join('\n')}`;
      }
      return { content: [initialStatus, { type: "text" as const, text: progressText + detailedResponse }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting multiple text contents: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("set_font_family", "Set the font family on a text node in Figma", {
    nodeId: z.string().describe("The ID of the text node"),
    fontFamily: z.string().describe("Font family name (e.g. 'Inter', 'Roboto', 'SF Pro')"),
    fontStyle: z.string().optional().describe("Font style (e.g. 'Regular', 'Bold', 'Italic'). Defaults to 'Regular'"),
  }, async ({ nodeId, fontFamily, fontStyle }: any) => {
    try {
      const result = await sendCommandToFigma("set_font_family", { nodeId, fontFamily, fontStyle: fontStyle || "Regular" });
      const typedResult = result as { name: string; id: string; fontFamily: string; fontStyle: string };
      return { content: [{ type: "text", text: `Set font family of "${typedResult.name}" to ${typedResult.fontFamily} ${typedResult.fontStyle}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting font family: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("set_text_auto_resize", "Set text auto-resize mode on a text node to control text wrapping behavior", {
    nodeId: z.string().describe("The ID of the text node"),
    textAutoResize: z.enum(["NONE", "WIDTH_AND_HEIGHT", "HEIGHT", "TRUNCATE"]).describe("Auto-resize mode: NONE (fixed size), WIDTH_AND_HEIGHT (auto size), HEIGHT (fixed width, auto height), TRUNCATE (fixed size with truncation)"),
  }, async ({ nodeId, textAutoResize }: any) => {
    try {
      const result = await sendCommandToFigma("set_text_auto_resize", { nodeId, textAutoResize });
      const typedResult = result as { name: string; id: string };
      return { content: [{ type: "text", text: `Set text auto-resize of "${typedResult.name}" to ${textAutoResize}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting text auto-resize: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
}
