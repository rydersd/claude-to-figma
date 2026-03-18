import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SendCommandFn } from "../types.js";

export function registerTools(server: McpServer, sendCommandToFigma: SendCommandFn) {
  server.tool(
    "figma_eval",
    "WARNING: Executes arbitrary JavaScript in the Figma plugin sandbox. Can read, modify, or delete any nodes in the document. Use with caution. Code is the body of an async function receiving: figma, hexToFigmaColor, appendOrInsertChild, loadAllFonts, getVariableByName, bindVariableToColor, resolveColorValue, sendProgressUpdate, introspectNode, setProperties. Use `return` to send results. Figma nodes auto-serialize to {id, name, type}.",
    {
      code: z.string().describe("JavaScript code body. Use `return` for results. `figma` and helpers available as locals."),
    },
    async ({ code }: { code: string }) => {
      try {
        const result = await sendCommandToFigma("figma_eval", { code }, 120000);
        const typedResult = result as { success: boolean; result?: any; error?: string };
        if (typedResult.success) {
          return { content: [{ type: "text" as const, text: JSON.stringify(typedResult.result, null, 2) }] };
        } else {
          return { content: [{ type: "text" as const, text: `Eval error: ${typedResult.error}` }] };
        }
      } catch (error) {
        return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
