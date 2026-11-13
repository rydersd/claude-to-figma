// Server instructions: the MCP client puts these in the model's context for
// every session, so they steer tool choice without the user asking. Only
// flagged tools that are actually registered are mentioned.
import { isEnabled } from "../shared/flags";

export const FEEDBACK_REPO = "rydersd/claude-to-figma";
export const FEEDBACK_LABEL = "l2f-feedback";

export function serverInstructions(env: Record<string, string | undefined> = process.env): string {
  const lines = [
    "llm2figma edits the Figma file that has the llm2figma plugin open.",
    "- If several files are connected, call join_channel with the channel the user gives, and check figma.root.name or the file key before the first write.",
    "- Build with auto layout: any frame holding more than one child gets layoutMode, itemSpacing and padding, and its children use layoutSizingHorizontal/Vertical (HUG, FILL or FIXED) instead of x/y. Absolute x/y is only for diagrams, connectors and placing top-level frames on the canvas. create_node_tree reports frames that hold several children without auto layout under layoutWarnings: fix them or say why they are absolute.",
    "- Use components: before drawing a button, input, card, row or any other standard element, look for one (get_local_components, search_library_components) and place instances (create_component_instance, or instance nodes in create_node_tree); never redraw an existing component. When you have built the same element three times, make it a component and replace the copies with instances.",
  ];
  if (isEnabled("SPEC_SYNC", env)) {
    lines.push(
      "- To change an existing frame (text, colours, sizes, spacing, order, prototype links (reactions), adding or removing layers), use spec sync by default, not figma_eval scripts: pull_spec {nodeId, path} → edit the .l2f.json file → plan_spec {path} → apply_spec {planId} → plan_spec again (0 operations means done). Edit only the lines you need; for a large Spec, search the file instead of reading all of it. Removals need allowRemovals: true.",
      "- Use figma_eval or the batch tools instead for what a Spec cannot express: layers inside instances, OpaqueNodes (groups, sections, ellipses, rotated nodes, mixed-style text), and building new screens from scratch (create_node_tree).",
    );
  }
  if (isEnabled("VERIFY", env)) {
    lines.push("- Before a bulk or structural edit outside spec sync, take snapshot_positions of the affected root; afterwards diff_positions shows anything missing, added or moved.");
  }
  if (isEnabled("CALLOUTS", env)) {
    lines.push("- For callouts, review notes or annotated walkthroughs, use place_callouts: labels in rails beside the frame, orthogonal leaders, and native annotations for Dev Mode. Never draw callouts with create_line or diagonal vectors over the design. To change them, call it again with the full list and stable keys; tell the user about anything in overflow.");
  }
  lines.push(
    `- When llm2figma gets in the way (a tool errors, returns wrong or partial results, is missing something you needed, or you had to work around it with figma_eval), say so plainly in your reply to the user, then file a GitHub issue: first look for an open one (gh issue list -R ${FEEDBACK_REPO} --label ${FEEDBACK_LABEL} --search "<tool>"), and comment there if it exists; otherwise gh issue create -R ${FEEDBACK_REPO} --label ${FEEDBACK_LABEL} with the tool, what you called, what happened against what you expected, and your workaround. The repository is public: describe only the tool's behaviour, never file names or keys, node or layer names, client, company or project names, or design content.`,
  );
  return lines.join("\n");
}
