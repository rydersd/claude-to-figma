// Editor-type gate: the one place commands declare which Figma editors they run in.
// Dev Mode is read-only, so every command that changes the document is refused there.

type EditorType = "figma" | "figjam" | "slides" | "buzz" | "dev";

const ALL_EDITORS: EditorType[] = ["figma", "figjam", "slides", "buzz", "dev"];
const EDIT_EDITORS: EditorType[] = ["figma", "figjam", "slides", "buzz"];

// Commands that only read the document or the session. Anything not listed here
// (and not in COMMAND_EDITORS) is treated as mutating and refused in Dev Mode.
// figma_eval runs caller-supplied code the plugin cannot classify, and screenshot_region
// builds a temporary frame, so both count as mutating. design_query is read-only only
// without an `update` (see assertEditorAllowed).
const READ_ONLY = new Set([
  "get_document_info", "get_selection", "get_node_info", "get_nodes_info", "read_my_design",
  "get_styles", "get_local_components", "export_node_as_image", "scan_text_nodes",
  "get_annotations", "scan_nodes_by_types", "get_instance_overrides", "get_reactions",
  "get_local_variables", "get_library_variables", "get_vector_network",
  "scan_node_styles", "introspect_node", "design_query", "diff_components", "get_interactions", "get_flows",
  "subscribe_events", "unsubscribe_events", "set_focus", "set_selections",
  // L2F_VERIFY: snapshots live in a plugin-side store, never in the document.
  "assert_contained", "snapshot_positions", "diff_positions",
]);

// Per-command overrides. Later commands that need a narrower set (for example
// slide-only commands) declare it here.
export const COMMAND_EDITORS: Record<string, EditorType[]> = {};

export function allowedEditors(command: string): EditorType[] {
  return COMMAND_EDITORS[command] || (READ_ONLY.has(command) ? ALL_EDITORS : EDIT_EDITORS);
}

export function assertEditorAllowed(command: string, editorType: string, params?: any): void {
  if (command === "design_query" && editorType === "dev" && params && params.update != null) {
    throw new Error("design_query with update is not available in the dev editor");
  }
  if (!allowedEditors(command).includes(editorType as EditorType)) {
    throw new Error(`${command} is not available in the ${editorType} editor`);
  }
}
