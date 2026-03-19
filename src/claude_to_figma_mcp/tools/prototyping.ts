import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SendCommandFn } from "../types.js";

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
