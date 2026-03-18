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

  server.tool("set_text_align", "Set horizontal and/or vertical text alignment on a text node", {
    nodeId: z.string().describe("The ID of the text node"),
    horizontal: z.enum(["LEFT", "CENTER", "RIGHT", "JUSTIFIED"]).optional().describe("Horizontal text alignment"),
    vertical: z.enum(["TOP", "CENTER", "BOTTOM"]).optional().describe("Vertical text alignment"),
  }, async ({ nodeId, horizontal, vertical }: any) => {
    if (horizontal === undefined && vertical === undefined) {
      return { content: [{ type: "text", text: "Error: At least one of horizontal or vertical alignment must be provided" }] };
    }
    try {
      const result = await sendCommandToFigma("set_text_align", { nodeId, horizontal, vertical });
      const typedResult = result as { name: string; id: string; textAlignHorizontal: string; textAlignVertical: string };
      return { content: [{ type: "text", text: `Set text alignment of "${typedResult.name}" to horizontal=${typedResult.textAlignHorizontal}, vertical=${typedResult.textAlignVertical}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting text alignment: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("set_text_format", "Set node-level text formatting: line height, paragraph indent/spacing, letter spacing, text case, leading trim, hanging punctuation/list, list spacing, truncation, and max lines.", {
    nodeId: z.string().describe("The ID of the text node"),
    lineHeight: z.union([z.number(), z.literal("AUTO")]).optional().describe("Line height in pixels, or 'AUTO' for automatic"),
    paragraphIndent: z.number().min(0).optional().describe("First-line paragraph indent in pixels"),
    paragraphSpacing: z.number().min(0).optional().describe("Spacing between paragraphs in pixels"),
    letterSpacing: z.number().optional().describe("Letter spacing in pixels"),
    textCase: z.enum(["ORIGINAL", "UPPER", "LOWER", "TITLE", "SMALL_CAPS", "SMALL_CAPS_FORCED"]).optional().describe("Text case transformation"),
    leadingTrim: z.enum(["NONE", "CAP_HEIGHT"]).optional().describe("Remove vertical space above/below glyphs"),
    hangingPunctuation: z.boolean().optional().describe("Whether punctuation hangs outside the text box"),
    hangingList: z.boolean().optional().describe("Whether list bullets/numbers hang outside the text box"),
    listSpacing: z.number().min(0).optional().describe("Vertical distance between list items in pixels"),
    textTruncation: z.enum(["DISABLED", "ENDING"]).optional().describe("Whether text truncates with ellipsis"),
    maxLines: z.number().int().min(1).nullable().optional().describe("Max lines before truncation (null for unlimited)"),
  }, async ({ nodeId, lineHeight, paragraphIndent, paragraphSpacing, letterSpacing, textCase, leadingTrim, hangingPunctuation, hangingList, listSpacing, textTruncation, maxLines }: any) => {
    try {
      const result = await sendCommandToFigma("set_text_format", { nodeId, lineHeight, paragraphIndent, paragraphSpacing, letterSpacing, textCase, leadingTrim, hangingPunctuation, hangingList, listSpacing, textTruncation, maxLines });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting text format: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("set_text_list", "Set native Figma list formatting (ordered/unordered) on a text node. Can apply to the entire node or to specific lines. Figma renders proper bullets/numbers with correct indentation on wrap.", {
    nodeId: z.string().describe("The ID of the text node"),
    listType: z.enum(["ORDERED", "UNORDERED", "NONE"]).optional().describe("List type to apply to entire text (default UNORDERED). Ignored if lines array is provided."),
    indentation: z.number().int().min(0).optional().describe("Indentation level for entire text (0 = top level, 1+ = nested)"),
    listSpacing: z.number().min(0).optional().describe("Vertical distance between list items in pixels"),
    hangingList: z.boolean().optional().describe("Whether bullets/numbers hang outside the text box"),
    lines: z.array(z.object({
      line: z.number().int().min(0).describe("0-based line index"),
      type: z.enum(["ORDERED", "UNORDERED", "NONE"]).optional().describe("List type for this line"),
      indentation: z.number().int().min(0).optional().describe("Indentation level (0+ for nesting)"),
    })).optional().describe("Per-line list settings. If provided, listType/indentation are used as defaults for lines that don't specify them."),
  }, async ({ nodeId, listType, indentation, listSpacing, hangingList, lines }: any) => {
    try {
      const result = await sendCommandToFigma("set_text_list", { nodeId, listType, indentation, listSpacing, hangingList, lines });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting text list: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("set_range_format", "Apply formatting to specific character ranges within a text node. Supports font family/size/style, color, text case, decoration, letter spacing, line height, list type, indentation, and hyperlinks — all per-range. Use this for rich text: bold words, colored spans, inline links, mixed fonts.", {
    nodeId: z.string().describe("The ID of the text node"),
    ranges: z.array(z.object({
      start: z.number().int().min(0).describe("Start character index (0-based, inclusive)"),
      end: z.number().int().min(1).describe("End character index (exclusive)"),
      fontFamily: z.string().optional().describe("Font family (e.g. 'Inter', 'Roboto')"),
      fontStyle: z.string().optional().describe("Font style (e.g. 'Regular', 'Bold', 'Italic'). Defaults to 'Regular'"),
      fontSize: z.number().positive().optional().describe("Font size in pixels"),
      color: z.union([z.string(), z.object({ r: z.number(), g: z.number(), b: z.number(), a: z.number().optional() })]).optional().describe("Text color as hex string or RGBA object (0-1)"),
      textCase: z.enum(["ORIGINAL", "UPPER", "LOWER", "TITLE", "SMALL_CAPS", "SMALL_CAPS_FORCED"]).optional().describe("Text case transformation"),
      textDecoration: z.enum(["NONE", "UNDERLINE", "STRIKETHROUGH"]).optional().describe("Text decoration"),
      letterSpacing: z.number().optional().describe("Letter spacing in pixels"),
      lineHeight: z.union([z.number(), z.literal("AUTO")]).optional().describe("Line height in pixels or AUTO"),
      listType: z.enum(["ORDERED", "UNORDERED", "NONE"]).optional().describe("List type for this range"),
      indentation: z.number().int().min(0).optional().describe("List indentation level"),
      hyperlink: z.union([z.object({ type: z.literal("URL"), value: z.string() }), z.null()]).optional().describe("Hyperlink target (null to remove)"),
    })).min(1).describe("Array of character ranges with formatting to apply"),
  }, async ({ nodeId, ranges }: any) => {
    try {
      const result = await sendCommandToFigma("set_range_format", { nodeId, ranges }, 60000);
      const typedResult = result as { successCount: number; failureCount: number; totalRanges: number; results: any[] };
      const failed = typedResult.results.filter((r: any) => !r.success);
      let text = `Range format: ${typedResult.successCount}/${typedResult.totalRanges} succeeded`;
      if (failed.length > 0) {
        text += `\n\nFailed:\n${failed.map((r: any) => `- range ${r.index} [${r.start}-${r.end}]: ${r.error}`).join("\n")}`;
      }
      return { content: [{ type: "text", text }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting range format: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
}
