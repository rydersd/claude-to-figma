import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SendCommandFn } from "../types.js";

const EffectSchema = z.object({
  type: z.enum(["DROP_SHADOW", "INNER_SHADOW", "LAYER_BLUR", "BACKGROUND_BLUR"]).describe("Effect type"),
  visible: z.boolean().optional().describe("Whether effect is visible (default true)"),
  color: z.union([
    z.string(),
    z.object({ r: z.number(), g: z.number(), b: z.number(), a: z.number().optional() }),
  ]).optional().describe("Shadow color as hex or RGBA (for shadow types only)"),
  offset: z.object({ x: z.number(), y: z.number() }).optional().describe("Shadow offset in pixels (for shadow types only)"),
  radius: z.number().min(0).optional().describe("Blur radius in pixels"),
  spread: z.number().optional().describe("Shadow spread in pixels (for shadow types only)"),
  blendMode: z.string().optional().describe("Blend mode for the effect"),
});

export function registerTools(server: McpServer, sendCommandToFigma: SendCommandFn) {
  server.tool("set_effects", "Set effects on a node: drop shadow, inner shadow, layer blur, background blur. Replaces all existing effects. Pass an empty array to clear effects.", {
    nodeId: z.string().describe("The ID of the node"),
    effects: z.array(EffectSchema).describe("Array of effects to apply. For shadows: type, color, offset, radius, spread. For blurs: type, radius."),
  }, async ({ nodeId, effects }: any) => {
    try {
      const result = await sendCommandToFigma("set_effects", { nodeId, effects });
      const typedResult = result as { name: string; effectCount: number };
      return { content: [{ type: "text", text: `Set ${typedResult.effectCount} effect(s) on "${typedResult.name}"` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting effects: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("set_opacity", "Set the opacity of a node (0 = fully transparent, 1 = fully opaque)", {
    nodeId: z.string().describe("The ID of the node"),
    opacity: z.number().min(0).max(1).describe("Opacity value (0-1)"),
  }, async ({ nodeId, opacity }: any) => {
    try {
      const result = await sendCommandToFigma("set_opacity", { nodeId, opacity });
      const typedResult = result as { name: string; opacity: number };
      return { content: [{ type: "text", text: `Set opacity of "${typedResult.name}" to ${typedResult.opacity}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting opacity: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("set_blend_mode", "Set the blend mode of a node", {
    nodeId: z.string().describe("The ID of the node"),
    blendMode: z.enum([
      "PASS_THROUGH", "NORMAL", "DARKEN", "MULTIPLY", "LINEAR_BURN", "COLOR_BURN",
      "LIGHTEN", "SCREEN", "LINEAR_DODGE", "COLOR_DODGE", "OVERLAY", "SOFT_LIGHT",
      "HARD_LIGHT", "DIFFERENCE", "EXCLUSION", "HUE", "SATURATION", "COLOR", "LUMINOSITY",
    ]).describe("Blend mode"),
  }, async ({ nodeId, blendMode }: any) => {
    try {
      const result = await sendCommandToFigma("set_blend_mode", { nodeId, blendMode });
      const typedResult = result as { name: string; blendMode: string };
      return { content: [{ type: "text", text: `Set blend mode of "${typedResult.name}" to ${typedResult.blendMode}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting blend mode: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("set_layout_positioning", "Set a child node to absolute or auto positioning within an auto-layout frame. ABSOLUTE is the 'Ignore auto layout' toggle — the node floats above siblings without affecting flow. Use with set_constraints to pin position.", {
    nodeId: z.string().describe("The ID of the child node"),
    positioning: z.enum(["ABSOLUTE", "AUTO"]).describe("ABSOLUTE = ignore auto-layout (float), AUTO = participate in auto-layout flow"),
    constraints: z.object({
      horizontal: z.enum(["MIN", "MAX", "CENTER", "STRETCH", "SCALE"]).optional().describe("Horizontal constraint (MIN=left, MAX=right, CENTER, STRETCH, SCALE)"),
      vertical: z.enum(["MIN", "MAX", "CENTER", "STRETCH", "SCALE"]).optional().describe("Vertical constraint (MIN=top, MAX=bottom, CENTER, STRETCH, SCALE)"),
    }).optional().describe("Optional constraints to set when positioning is ABSOLUTE"),
  }, async ({ nodeId, positioning, constraints }: any) => {
    try {
      const result = await sendCommandToFigma("set_layout_positioning", { nodeId, positioning, constraints });
      const typedResult = result as { name: string; layoutPositioning: string };
      return { content: [{ type: "text", text: `Set layout positioning of "${typedResult.name}" to ${typedResult.layoutPositioning}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting layout positioning: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("set_rotation", "Set the rotation of a node in degrees", {
    nodeId: z.string().describe("The ID of the node"),
    rotation: z.number().min(-180).max(180).describe("Rotation angle in degrees (-180 to 180)"),
  }, async ({ nodeId, rotation }: any) => {
    try {
      const result = await sendCommandToFigma("set_rotation", { nodeId, rotation });
      const typedResult = result as { name: string; rotation: number };
      return { content: [{ type: "text", text: `Set rotation of "${typedResult.name}" to ${typedResult.rotation}°` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting rotation: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("create_ellipse", "Create an ellipse (circle or oval) with optional fill color and arc data for arcs/donuts", {
    x: z.number().optional().describe("X position (default 0)"),
    y: z.number().optional().describe("Y position (default 0)"),
    width: z.number().positive().optional().describe("Width (default 100)"),
    height: z.number().positive().optional().describe("Height (default 100)"),
    name: z.string().optional().describe("Node name (default 'Ellipse')"),
    parentId: z.string().optional().describe("Parent node ID"),
    fillColor: z.union([
      z.string(),
      z.object({ r: z.number(), g: z.number(), b: z.number(), a: z.number().optional() }),
    ]).optional().describe("Fill color as hex string or RGBA object"),
    arcData: z.object({
      startingAngle: z.number().optional().describe("Starting angle in radians (default 0)"),
      endingAngle: z.number().optional().describe("Ending angle in radians (default 2π for full circle)"),
      innerRadius: z.number().min(0).max(1).optional().describe("Inner radius ratio 0-1 (0 = filled, >0 = donut)"),
    }).optional().describe("Arc data for creating arcs, pies, or donut shapes"),
  }, async ({ x, y, width, height, name, parentId, fillColor, arcData }: any) => {
    try {
      const result = await sendCommandToFigma("create_ellipse", { x, y, width, height, name, parentId, fillColor, arcData });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating ellipse: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("set_constraints", "Set horizontal and vertical constraints (pinning) on a node for responsive behavior", {
    nodeId: z.string().describe("The ID of the node"),
    horizontal: z.enum(["MIN", "MAX", "CENTER", "STRETCH", "SCALE"]).optional().describe("Horizontal constraint: MIN=pin left, MAX=pin right, CENTER=center, STRETCH=stretch, SCALE=scale"),
    vertical: z.enum(["MIN", "MAX", "CENTER", "STRETCH", "SCALE"]).optional().describe("Vertical constraint: MIN=pin top, MAX=pin bottom, CENTER=center, STRETCH=stretch, SCALE=scale"),
  }, async ({ nodeId, horizontal, vertical }: any) => {
    if (horizontal === undefined && vertical === undefined) {
      return { content: [{ type: "text", text: "Error: At least one of horizontal or vertical constraint must be provided" }] };
    }
    try {
      const result = await sendCommandToFigma("set_constraints", { nodeId, horizontal, vertical });
      const typedResult = result as { name: string; constraints: { horizontal: string; vertical: string } };
      return { content: [{ type: "text", text: `Set constraints on "${typedResult.name}" to H=${typedResult.constraints.horizontal}, V=${typedResult.constraints.vertical}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting constraints: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("set_min_max_size", "Set min/max width and height on a node. Used with auto-layout FILL sizing to constrain how children grow/shrink.", {
    nodeId: z.string().describe("The ID of the node"),
    minWidth: z.number().min(0).nullable().optional().describe("Minimum width in pixels (null to clear)"),
    maxWidth: z.number().min(0).nullable().optional().describe("Maximum width in pixels (null to clear)"),
    minHeight: z.number().min(0).nullable().optional().describe("Minimum height in pixels (null to clear)"),
    maxHeight: z.number().min(0).nullable().optional().describe("Maximum height in pixels (null to clear)"),
  }, async ({ nodeId, minWidth, maxWidth, minHeight, maxHeight }: any) => {
    try {
      const result = await sendCommandToFigma("set_min_max_size", { nodeId, minWidth, maxWidth, minHeight, maxHeight });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting min/max size: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("set_mask", "Set a node as a mask layer — it clips subsequent siblings to its shape. Optionally group the mask with specified sibling nodes first (best practice to contain the mask effect).", {
    nodeId: z.string().describe("The ID of the node to use as a mask (typically a shape like rectangle, ellipse, or vector)"),
    isMask: z.boolean().optional().describe("Whether to enable (true, default) or disable (false) masking"),
    groupWithIds: z.array(z.string()).optional().describe("Optional array of sibling node IDs to group with the mask node before applying. Groups the mask + siblings so the mask effect is contained."),
    groupName: z.string().optional().describe("Optional name for the created group"),
  }, async ({ nodeId, isMask, groupWithIds, groupName }: any) => {
    try {
      const result = await sendCommandToFigma("set_mask", { nodeId, isMask, groupWithIds, groupName });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting mask: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("create_svg", "Create Figma nodes from a complete SVG string. Handles multi-path SVGs (logos, icons, illustrations) in one call — no need to split paths. Returns a frame containing the parsed SVG elements.", {
    svg: z.string().describe("Complete SVG markup string (e.g. '<svg ...>...</svg>')"),
    name: z.string().optional().describe("Name for the created frame"),
    x: z.number().optional().describe("X position"),
    y: z.number().optional().describe("Y position"),
    width: z.number().positive().optional().describe("Target width (must set both width and height to resize)"),
    height: z.number().positive().optional().describe("Target height (must set both width and height to resize)"),
    parentId: z.string().optional().describe("Parent node ID"),
    insertAt: z.number().int().min(0).optional().describe("Index to insert at within parent"),
  }, async ({ svg, name, x, y, width, height, parentId, insertAt }: any) => {
    try {
      const result = await sendCommandToFigma("create_svg", { svg, name, x, y, width, height, parentId, insertAt });
      const typedResult = result as { id: string; name: string; x: number; y: number; width: number; height: number; childCount: number };
      return { content: [{ type: "text", text: `Created SVG "${typedResult.name}" (${typedResult.id}) with ${typedResult.childCount} child node(s) at (${typedResult.x}, ${typedResult.y}), size ${typedResult.width}x${typedResult.height}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating SVG: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("create_component_set", "Combine multiple component nodes into a component set (variants). Each component becomes a variant. Component names should follow Figma's variant naming convention: 'Property1=Value1, Property2=Value2'. All components must share the same parent.", {
    componentIds: z.array(z.string()).min(2).describe("Array of COMPONENT node IDs to combine. Must be at least 2. Use create_component to convert frames first if needed."),
    name: z.string().optional().describe("Optional name for the component set"),
  }, async ({ componentIds, name }: any) => {
    try {
      const result = await sendCommandToFigma("create_component_set", { componentIds, name });
      const typedResult = result as { id: string; name: string; variantCount: number; variants: Array<{ id: string; name: string }> };
      let text = `Created component set "${typedResult.name}" with ${typedResult.variantCount} variants:\n`;
      text += typedResult.variants.map((v: any) => `- ${v.name} (${v.id})`).join("\n");
      return { content: [{ type: "text", text }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating component set: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
}
