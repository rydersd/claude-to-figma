import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SendCommandFn } from "../types.js";
import { isEnabled } from "../../shared/flags.js";
import { getChannelFileKey } from "../connection.js";
import { mergeFileKey } from "../file-key.js";

// --- Reaction schema ---

const EasingSchema = z.object({
  type: z.enum([
    "EASE_IN", "EASE_OUT", "EASE_IN_AND_OUT", "LINEAR",
    "EASE_IN_BACK", "EASE_OUT_BACK", "EASE_IN_AND_OUT_BACK",
    "CUSTOM_BEZIER",
  ]),
  easingFunctionCubicBezier: z.object({
    x1: z.number(), y1: z.number(),
    x2: z.number(), y2: z.number(),
  }).optional(),
}).describe("Easing curve for the transition");

const TransitionSchema = z.object({
  type: z.enum([
    "DISSOLVE", "SMART_ANIMATE",
    "MOVE_IN", "MOVE_OUT",
    "PUSH",
    "SLIDE_IN", "SLIDE_OUT",
  ]).describe("Transition animation type"),
  duration: z.number().positive().optional().describe("Duration in milliseconds (default 300)"),
  easing: EasingSchema.optional(),
  direction: z.enum(["LEFT", "RIGHT", "TOP", "BOTTOM"]).optional()
    .describe("Direction for directional transitions (MOVE_IN, PUSH, SLIDE_IN, etc.)"),
}).describe("Transition animation applied when navigating");

const TriggerSchema = z.object({
  type: z.enum([
    "ON_CLICK", "ON_HOVER", "ON_PRESS", "ON_DRAG",
    "MOUSE_ENTER", "MOUSE_LEAVE",
    "MOUSE_UP", "MOUSE_DOWN",
    "AFTER_TIMEOUT",
    "ON_KEY_DOWN",
  ]).describe("Event that triggers the interaction"),
  delay: z.number().optional().describe("Delay in ms before action fires (AFTER_TIMEOUT)"),
  keyCodes: z.array(z.number()).optional().describe("Key codes for ON_KEY_DOWN trigger"),
});

const ActionSchema = z.object({
  type: z.enum(["NODE", "BACK", "CLOSE", "URL", "SET_VARIABLE", "CONDITIONAL"])
    .describe("Action type"),
  navigation: z.enum(["NAVIGATE", "SWAP", "OVERLAY", "SCROLL_TO", "CHANGE_TO"]).optional()
    .describe("Navigation type (required for NODE actions)"),
  destinationId: z.string().optional()
    .describe("Target node ID (required for NODE actions)"),
  transition: TransitionSchema.optional(),
  preserveScrollPosition: z.boolean().optional(),
  // Overlay-specific
  overlayRelativePosition: z.object({ x: z.number(), y: z.number() }).optional(),
  // URL action
  url: z.string().optional().describe("URL to open (for URL actions)"),
  // SET_VARIABLE action
  variableId: z.string().optional(),
  variableValue: z.any().optional(),
});

const ReactionSchema = z.object({
  trigger: TriggerSchema,
  actions: z.array(ActionSchema).min(1).describe("Actions to execute when triggered"),
});

// --- Tool registration ---

export function registerTools(server: McpServer, sendCommandToFigma: SendCommandFn) {

  // -----------------------------------------------------------------------
  // set_reactions — write full reactions array to a node
  // -----------------------------------------------------------------------
  server.tool(
    "set_reactions",
    "Set prototype interactions on a Figma node. Replaces the entire reactions array. Use this to wire click-to-navigate, hover overlays, scroll-to, or any prototype interaction. Each reaction has a trigger (ON_CLICK, ON_HOVER, etc.) and one or more actions (NAVIGATE, OVERLAY, BACK, URL, etc.). For NODE actions, destinationId must reference an existing frame ID.",
    {
      nodeId: z.string().describe("The node to set reactions on"),
      reactions: z.array(ReactionSchema).describe("Array of reactions to set"),
    },
    async ({ nodeId, reactions }: any) => {
      try {
        const result = await sendCommandToFigma("set_reactions", { nodeId, reactions }, 30000);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error setting reactions: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );

  // -----------------------------------------------------------------------
  // add_reaction — append one reaction without clobbering existing ones
  // -----------------------------------------------------------------------
  server.tool(
    "add_reaction",
    "Add a single prototype interaction to a node without removing existing interactions. Reads current reactions, appends the new one, and writes back. Use this when a node already has interactions and you want to add another (e.g., add hover state to a button that already has on-click).",
    {
      nodeId: z.string().describe("The node to add a reaction to"),
      trigger: TriggerSchema.describe("The trigger for the new reaction"),
      action: ActionSchema.describe("The action to execute when triggered"),
    },
    async ({ nodeId, trigger, action }: any) => {
      try {
        const result = await sendCommandToFigma("add_reaction", { nodeId, trigger, action }, 30000);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error adding reaction: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );

  // -----------------------------------------------------------------------
  // remove_reactions — clear reactions from a node
  // -----------------------------------------------------------------------
  server.tool(
    "remove_reactions",
    "Remove prototype interactions from a node. With no triggerType, removes ALL reactions. With a triggerType (e.g., 'ON_HOVER'), removes only reactions matching that trigger, preserving others.",
    {
      nodeId: z.string().describe("The node to remove reactions from"),
      triggerType: z.enum([
        "ON_CLICK", "ON_HOVER", "ON_PRESS", "ON_DRAG",
        "MOUSE_ENTER", "MOUSE_LEAVE",
        "MOUSE_UP", "MOUSE_DOWN",
        "AFTER_TIMEOUT", "ON_KEY_DOWN",
      ]).optional().describe("If provided, only remove reactions with this trigger type"),
    },
    async ({ nodeId, triggerType }: any) => {
      try {
        const result = await sendCommandToFigma("remove_reactions", { nodeId, triggerType }, 30000);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error removing reactions: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );

  // -----------------------------------------------------------------------
  // get_interactions — enhanced read with resolved destination names
  // -----------------------------------------------------------------------
  server.tool(
    "get_interactions",
    "Read prototype interactions from a node with resolved destination names. Unlike get_reactions (which is designed for connector-line workflows), this returns a clean interaction summary: trigger type, action type, destination frame name and ID, transition details. Use this to inspect existing prototype wiring before modifying it.",
    {
      nodeId: z.string().describe("The node to read interactions from"),
      recursive: z.boolean().optional().describe("If true, also scan children for interactions (default false)"),
    },
    async ({ nodeId, recursive }: any) => {
      try {
        const result = await sendCommandToFigma("get_interactions", { nodeId, recursive }, 30000);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error getting interactions: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );

  // -----------------------------------------------------------------------
  // batch_set_reactions — set reactions on multiple nodes in one call
  // -----------------------------------------------------------------------
  server.tool(
    "batch_set_reactions",
    "Set prototype interactions on multiple nodes in a single call. Essential for wiring an entire screen's navigation (nav bar links, card clicks, button targets) efficiently. Each operation sets the full reactions array on one node.",
    {
      operations: z.array(z.object({
        nodeId: z.string().describe("Node to set reactions on"),
        reactions: z.array(ReactionSchema).describe("Reactions to set on this node"),
      })).min(1).describe("Array of { nodeId, reactions } operations"),
    },
    async ({ operations }: any) => {
      try {
        const result = await sendCommandToFigma("batch_set_reactions", { operations }, 60000);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error batch setting reactions: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}

// --- Flows (L2F_FLOWS) ---

// One solid colour only: a gradient or image cannot be expressed here.
export const BackgroundSchema = z.string().regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, "Use one solid colour as #RRGGBB or #RRGGBBAA")
  .describe("Prototype background: one solid colour as #RRGGBB or #RRGGBBAA");

const unit = z.number().min(0).max(1);
// The exact alternative to background: what get_flows returns as backgroundPaints.
export const BackgroundPaintsSchema = z.array(z.object({
  type: z.literal("SOLID"),
  color: z.object({ r: unit, g: unit, b: unit, a: unit.optional() }),
  visible: z.boolean().optional(),
  opacity: unit.optional(),
  blendMode: z.string().min(1).optional(),
})).max(1).describe("Prototype background as raw paints, exactly as get_flows returns them: [] or one SOLID paint. An alternative to background");

export const NO_FILE_KEY = "No file key is known for this file, so no prototype link can be built. A development plugin does not report one: call join_channel again with fileKey set to the file's figma.com URL or key. join_channel takes fileKey only when the server runs with L2F_FILE_KEY=1.";

// UNCONFIRMED format: compare with a prototype link copied from Figma (Share prototype).
export function buildPrototypeLink(fileKey: string, fileName: string | null | undefined, nodeId: string): string {
  const id = encodeURIComponent(nodeId.replace(/:/g, "-"));
  return `https://www.figma.com/proto/${encodeURIComponent(fileKey)}/${encodeURIComponent(fileName || "Untitled")}?node-id=${id}&starting-point-node-id=${id}`;
}

const text = (value: unknown) => ({ content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value) }] });
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

export interface FlowToolDeps {
  /** Whether the join_channel file key may be used (L2F_FILE_KEY). */
  fileKeyEnabled?: boolean;
  userFileKey?: () => string | undefined;
}

// The key for links: with L2F_FILE_KEY on, the plugin's key, else the one given to
// join_channel; with it off, only the plugin's own key.
function linkFileKey(info: unknown, deps: Required<FlowToolDeps>): { fileKey: string | null; fileKeySource: string | null } {
  if (deps.fileKeyEnabled) {
    const merged = mergeFileKey(info, deps.userFileKey(), true) as { fileKey?: string | null; fileKeySource?: string | null };
    return { fileKey: merged?.fileKey || null, fileKeySource: merged?.fileKeySource ?? null };
  }
  const pluginKey = info && typeof info === "object" ? (info as { fileKey?: unknown }).fileKey : undefined;
  return typeof pluginKey === "string" && pluginKey ? { fileKey: pluginKey, fileKeySource: "plugin" } : { fileKey: null, fileKeySource: null };
}

// Registered only when L2F_FLOWS is on (see server.ts).
export function registerFlowTools(server: McpServer, sendCommandToFigma: SendCommandFn, deps: FlowToolDeps = {}) {
  const resolved: Required<FlowToolDeps> = {
    fileKeyEnabled: deps.fileKeyEnabled ?? isEnabled("FILE_KEY"),
    userFileKey: deps.userFileKey ?? getChannelFileKey,
  };

  server.tool(
    "get_flows",
    "Read the prototype flows on a page: each flow's name, starting frame id and name, and the top-level section it sits in, plus the page's prototype background as hex (background) and as raw paints (backgroundPaints; null when it is a gradient, image or several paints). A flow whose starting frame no longer exists is listed with missing: true. The output can be passed to set_flows unchanged.",
    { pageId: z.string().min(1).describe("The page to read flows from") },
    async ({ pageId }: any) => {
      try {
        return text(await sendCommandToFigma("get_flows", { pageId }));
      } catch (error) {
        return text(`Error getting flows: ${message(error)}`);
      }
    }
  );

  server.tool(
    "set_flows",
    "Replace all prototype flows on a page. The list is assigned whole, so running the same call twice gives the same page, and an empty list clears them. Every node must be a top-level frame on that page (directly on the page or inside sections only) and every flow name unique; otherwise nothing is written and the bad ones are listed. A flow whose starting frame does not exist is refused, unless dropMissing is true: then it is left out and listed in dropped. The background is optional: one solid colour (background), or the exact paints from get_flows (backgroundPaints); null or omitted leaves it alone. The prototype device cannot be set from the plugin API.",
    {
      pageId: z.string().min(1).describe("The page whose flows are replaced"),
      flows: z.array(z.object({
        name: z.string().trim().min(1).describe("Flow name shown in Figma"),
        nodeId: z.string().min(1).describe("Top-level frame the flow starts at"),
      })).max(500).describe("The complete list of flows for the page, in order"),
      background: BackgroundSchema.nullable().optional().describe("One solid colour as #RRGGBB or #RRGGBBAA; null or omitted leaves the background alone"),
      backgroundPaints: BackgroundPaintsSchema.nullable().optional(),
      dropMissing: z.boolean().optional().describe("Leave out flows whose starting frame does not exist instead of refusing (default false)"),
    },
    async ({ pageId, flows, background, backgroundPaints, dropMissing }: any) => {
      try {
        return text(await sendCommandToFigma("set_flows", { pageId, flows, background, backgroundPaints, dropMissing }));
      } catch (error) {
        return text(`Error setting flows: ${message(error)}`);
      }
    }
  );

  server.tool(
    "get_prototype_links",
    "Build a prototype link for each flow on a page, optionally only the flows in one top-level section. Needs the file key: reported by the plugin, or given to join_channel as fileKey (only with L2F_FILE_KEY=1). The link format (https://www.figma.com/proto/<key>/<name>?node-id=...&starting-point-node-id=...) is UNCONFIRMED: compare it with a link copied from Figma before relying on it. A flow whose starting frame is missing gets link: null.",
    {
      pageId: z.string().min(1).describe("The page whose flows to link"),
      sectionId: z.string().min(1).optional().describe("Only flows whose starting frame is in this top-level section of the page"),
    },
    async ({ pageId, sectionId }: any) => {
      try {
        const { fileKey, fileKeySource } = linkFileKey(await sendCommandToFigma("get_document_info"), resolved);
        if (!fileKey) return text(NO_FILE_KEY);
        // The plugin filters by section and errors when sectionId is not a top-level section.
        const page = await sendCommandToFigma("get_flows", sectionId === undefined ? { pageId } : { pageId, sectionId }) as { fileName: string | null; flows: any[] };
        const links = page.flows
          .filter((flow) => sectionId === undefined || flow.section?.id === sectionId)
          .map((flow) => ({ ...flow, link: flow.missing ? null : buildPrototypeLink(fileKey, page.fileName, flow.nodeId) }));
        return text({ fileKeySource, links });
      } catch (error) {
        return text(`Error getting prototype links: ${message(error)}`);
      }
    }
  );
}
