// Server instructions: the MCP client puts these in the model's context for
// every session, so they steer tool choice without the user asking. Only
// flagged tools that are actually registered are mentioned.
import { isEnabled } from "../shared/flags";

export function serverInstructions(env: Record<string, string | undefined> = process.env): string {
  const lines = [
    "llm2figma edits the Figma file that has the llm2figma plugin open.",
    "- If several files are connected, call join_channel with the channel the user gives, and check figma.root.name or the file key before the first write.",
  ];
  if (isEnabled("SPEC_SYNC", env)) {
    lines.push(
      "- To change an existing frame (text, colours, sizes, spacing, order, adding or removing layers), use spec sync by default, not figma_eval scripts: pull_spec {nodeId, path} → edit the .l2f.json file → plan_spec {path} → apply_spec {planId} → plan_spec again (0 operations means done). Edit only the lines you need; for a large Spec, search the file instead of reading all of it. Removals need allowRemovals: true.",
      "- Use figma_eval or the batch tools instead for what a Spec cannot express: prototype links (reactions), layers inside instances, OpaqueNodes (groups, sections, ellipses, rotated nodes, mixed-style text), and building new screens from scratch (create_node_tree).",
    );
  }
  if (isEnabled("VERIFY", env)) {
    lines.push("- Before a bulk or structural edit outside spec sync, take snapshot_positions of the affected root; afterwards diff_positions shows anything missing, added or moved.");
  }
  return lines.join("\n");
}
