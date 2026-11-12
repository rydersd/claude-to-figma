# Tools Reading and Inspection

**Tags:** `reference` · `tools` · `inspection`

Tools for understanding what's on the canvas before changing it: document and selection reads, deep node info, scanning, structured queries, visual verification, and undo/redo.

## Document & selection

- `get_document_info` — current page name, ID, and all top-level children (id, name, type)
- `get_selection` — detailed node data for the current Figma selection
- `read_my_design` — same as `get_selection` with no parameters; quick-read shorthand
- `get_node_info` — full details (type, size, position, styles, children) for one node
- `get_nodes_info` — full details for multiple nodes in one round-trip
- `set_focus` — selects a node and scrolls the viewport to center it
- `set_selections` — selects multiple nodes and zooms the viewport to fit them

## Scanning & querying

- `scan_text_nodes` — all text nodes under a root, chunked for large trees
- `scan_nodes_by_types` — all descendants matching given types (e.g. `TEXT`, `INSTANCE`)
- `scan_node_styles` — fill, stroke, font, layout, corner-radius, and component data for every descendant, with a `boundVariable` flag for detecting hardcoded vs token-bound colors
- `design_query` — filter nodes by type, name, component, or property values, and optionally bulk-update every match in the same call
- `introspect` — flat semantic property map of every editable surface in a component or frame (see [[Tools-Components#introspection--semantic-editing|component introspection]])

## Visual verification

- `export_node_as_image` — export a node as PNG, JPG, SVG, or PDF at optional scale (base64)
- `screenshot_region` — PNG screenshot of a rectangular canvas region at optional scale

These two close the loop in [[Design-Round-Trip]] — after a batch of mutations, export and look at the result instead of trusting the numbers.

## Safety net

- `undo` — reverse up to 50 steps of plugin-driven changes
- `redo` — restore undone steps

## Connection

- `join_channel` — join a named WebSocket channel; required before anything else works

---

## Related

- [[Design-Round-Trip]] — the read → mutate → verify loop these tools enable
- [[Tools-Batch-Operations]] — acting on what a scan or query found
- [[Tools-Components]] — `introspect` and `set_properties` for semantic edits
- [[Tool-Reference]] — back to the full catalog
