import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SendCommandFn } from "../types.js";
import { DEFAULTS, RAILS } from "../../shared/callouts.js";

export const CalloutSchema = z.object({
  key: z.string().min(1).max(100).optional().describe("Stable id for this callout across re-runs (default: targetId). Give two callouts on one target distinct keys"),
  targetId: z.string().min(1).describe("The node inside the frame this callout points at"),
  text: z.string().min(1).max(2000).describe("The callout text"),
});

export const PlaceCalloutsSchema = {
  frameId: z.string().min(1).describe("The frame being reviewed; it must sit directly on a page or in a section"),
  callouts: z.array(CalloutSchema).min(1).max(200)
    .refine(list => new Set(list.map(c => c.key ?? c.targetId)).size === list.length, { message: "callout keys must be unique (key defaults to targetId)" }),
  rails: z.array(z.enum(RAILS as unknown as [string, ...string[]])).min(1).optional()
    .describe("Rails labels may use (default all four). Left and right fill first, then top and bottom"),
  gap: z.number().min(0).max(200).optional().describe(`Minimum space between labels, px (default ${DEFAULTS.gap})`),
  railOffset: z.number().min(8).max(400).optional().describe(`Gutter between the frame and the rails, where leaders turn, px (default ${DEFAULTS.railOffset})`),
  width: z.number().min(80).max(800).optional().describe(`Label width, px (default ${DEFAULTS.width})`),
  denseThreshold: z.number().int().min(0).max(200).optional()
    .describe(`Above this many callouts, use numbered badges on the targets and a numbered list in the rails, with no leaders (default ${DEFAULTS.denseThreshold})`),
  native: z.boolean().optional().describe("Also write each callout as a native annotation on its target, for Dev Mode (default true)"),
  leaderStyle: z.enum(["auto", "connector", "vector"]).optional()
    .describe("auto (default): a FigJam-style connector, which stays attached and can be dragged by hand, when the file has one to clone (the default connector from set_default_connector, or any connector on the page), otherwise drawn vector leaders. connector: fail if there is no connector to clone. vector: always drawn leaders"),
};

export function registerTools(server: McpServer, sendCommandToFigma: SendCommandFn) {
  server.tool(
    "place_callouts",
    "Place review callouts around a frame without covering it: labels go in rails beside the frame (nearer side first, then the other side, then top and bottom), each joined to its target by an orthogonal leader with one elbow in the gutter and a dot on the target, never a diagonal. Leaders are cloned connectors (elbowed, attached to the label and the target) when the file has one to clone, otherwise vectors; only vector leaders are guaranteed not to cross, since Figma routes connector elbows itself. Labels keep their targets' order and never overlap the frame, sibling frames or each other; anything that does not fit is returned in `overflow`. Above denseThreshold callouts it switches to numbered badges on the targets and a matching numbered list. Everything is one group, callouts/<frame name>, next to the frame. With native (default) each callout is also added to its target's annotations, so it shows in Dev Mode; other annotations are kept. Use this for callouts and design reviews instead of drawing lines with create_line. Returns {groupId, mode, leaderStyle, placed: [{key, rail, x, y, leaderId?}], overflow, annotations, verification}; x and y are the label's offset from the frame's top-left.",
    PlaceCalloutsSchema,
    async (args: any) => {
      try {
        const result = await sendCommandToFigma("place_callouts", args, 60000);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: `Error placing callouts: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    },
  );
}
