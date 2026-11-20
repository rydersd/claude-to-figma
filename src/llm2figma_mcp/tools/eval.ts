import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SendCommandFn } from "../types.js";

// The plugin runs with documentAccess: dynamic-page, so Figma rejects the
// synchronous lookups that scripts written for other bridges often use.
export const DYNAMIC_PAGE_HINT =
  "This plugin uses documentAccess: dynamic-page, so synchronous lookups are rejected. Use the async forms: await figma.getNodeByIdAsync(id), await figma.getStyleByIdAsync(id), await instance.getMainComponentAsync() instead of instance.mainComponent (findAll/findOne callbacks cannot await, so collect instances first, then await each), await page.loadAsync() before reading another page's children, and await figma.variables.getVariableByIdAsync(id).";

export function evalErrorText(error: string | undefined): string {
  const text = `Eval error: ${error}`;
  return /dynamic-page/.test(error ?? "") ? `${text}\n${DYNAMIC_PAGE_HINT}` : text;
}

// Reading instance.mainComponent always throws under dynamic-page, and Figma logs
// each throw to the plugin console. Scripts copied from skills written for other
// Figma bridges do this inside findAll/findOne callbacks, so catch it before the
// script runs: no console error, no half-applied changes, and the fix up front.
// componentPropertyReferences.mainComponent is a plain string and stays allowed.
export function syncMainComponentRead(code: string): boolean {
  const stripped = code.replace(/componentPropertyReferences\s*(\?\.|\.)\s*mainComponent/g, "");
  return /(\?\.|\.)\s*mainComponent\b(?!\s*=[^=])/.test(stripped);
}

export const SYNC_MAIN_COMPONENT_TEXT =
  "Eval not run: the script reads .mainComponent, which Figma rejects under documentAccess: dynamic-page. Use await instance.getMainComponentAsync(). findAll/findOne callbacks cannot await, so collect the instances first (const insts = root.findAllWithCriteria({ types: [\"INSTANCE\"] })), then loop: for (const i of insts) { const mc = await i.getMainComponentAsync(); ... }.";

export function registerTools(server: McpServer, sendCommandToFigma: SendCommandFn) {
  server.tool(
    "figma_eval",
    "WARNING: Executes arbitrary JavaScript in the Figma plugin sandbox. Can read, modify, or delete any nodes in the document. Use with caution. Code is the body of an async function receiving: figma, hexToFigmaColor, appendOrInsertChild, loadAllFonts, getVariableByName, bindVariableToColor, resolveColorValue, sendProgressUpdate, introspectNode, setProperties, resizeWithReadBack. Use `return` to send results. Figma nodes auto-serialize to {id, name, type}. Only async document APIs work (documentAccess: dynamic-page): use await figma.getNodeByIdAsync(id), not figma.getNodeById(id), and await instance.getMainComponentAsync(), not instance.mainComponent. Figma ignores resize() without an error on any layer inside an instance (ids starting with \"I\") and clamps it to min/max sizes: call resizeWithReadBack(node, w, h) instead, which returns { applied, partial, cause }.",
    {
      code: z.string().describe("JavaScript code body. Use `return` for results. `figma` and helpers available as locals."),
    },
    async ({ code }: { code: string }) => {
      if (syncMainComponentRead(code)) {
        return { content: [{ type: "text" as const, text: SYNC_MAIN_COMPONENT_TEXT }] };
      }
      try {
        const result = await sendCommandToFigma("figma_eval", { code }, 120000);
        const typedResult = result as { success: boolean; result?: any; error?: string };
        if (typedResult.success) {
          return { content: [{ type: "text" as const, text: JSON.stringify(typedResult.result, null, 2) }] };
        } else {
          return { content: [{ type: "text" as const, text: evalErrorText(typedResult.error) }] };
        }
      } catch (error) {
        return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
