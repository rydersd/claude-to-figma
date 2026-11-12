# Tools Reading and Inspection

**Tags:** `reference` · `tools` · `inspection`

Tools for understanding what's on the canvas before changing it: document and selection reads, deep node info, scanning, structured queries, visual verification, and undo/redo.

## Document & selection

- `get_document_info` — current page name, ID, `editorType` (`figma`, `figjam`, `slides`, `buzz` or `dev`), and all top-level children (id, name, type). With `L2F_FILE_KEY=1` it also returns `fileKey` and `fileKeySource` (`plugin`, `user` or `null`)
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

## Geometry verification (L2F_VERIFY)

Registered only when the server runs with `L2F_VERIFY=1`. All three are reads and run in Dev Mode.

- `assert_contained` — checks that each direct child of `parentId` sits inside the parent, comparing `absoluteBoundingBox` to `absoluteBoundingBox` with a 0.5px tolerance (shadows and other render bounds are ignored). A child with no box is reported `unmeasurable` and fails the check. Returns `contained`, `outside` (with per-side `overflow`), `unmeasurable`, `rotated`, and, when `expected` is given, `displaced`, `notInExpected`, `placementUnchecked`, `placementOk` and `parentGrewSinceSnapshot` (plus `snapshotTruncated` for a snapshot). Offsets are the child's box origin minus the parent's, never node `x`/`y`: a GROUP's children are positioned relative to the group's parent. `placementOk` is `true` only when every expected child was measured and matched and, for a snapshot, no current child is missing from it; it is `null` when it cannot be decided (no parent box, a snapshot that did not read all of this parent's children, or rotated children, which are listed in `placementUnchecked`). A rotated parent makes `contained` `null` unless a child is clearly outside. Lists are capped at 100 with `listsTruncated`; `counts` are full
- `snapshot_positions` — records `{id, name, parentId, box}` for a node and its descendants (default 2,000 nodes, depth 30, with `truncated`) and returns a `snapshotId`. Snapshots live in the plugin: 30-minute expiry, at most 64, lost when the plugin reloads
- `diff_positions` — compares a snapshot with the document now. `missing` ids no longer exist, `added` ids are new in the subtree, `moved` entries changed box or parent (`reparented`, `boxChanged`). After a truncated snapshot, nodes under a parent whose children the snapshot did not finish reading are `unsnapshotted`, not `added`; snapshot nodes the re-walk does not reach are looked up by id, so `missing` still means gone. Every list is capped at 100 with `listsTruncated`; `counts` are full. An unknown or expired `snapshotId` is an error, never an empty diff

A bare containment pass does not prove placement. Section children are positioned relative to the section, so a child set to `sec.x + 160` instead of `160` lands one section-origin away, and the section auto-grows to contain it: every child is still inside. To catch that, pass `expected` to `assert_contained`, either a `snapshotId` taken before the change or a map of `{childId: {x, y}}` offsets from the parent's top-left. For a reparent, take a snapshot of a common ancestor first; `diff_positions` then shows the node as `reparented` with `boxChanged: false` when nothing drifted.

## Safety net

- `undo` — reverse up to 50 steps of plugin-driven changes
- `redo` — restore undone steps

## Connection

- `join_channel` — join a named WebSocket channel; required before anything else works. With `L2F_FILE_KEY=1` it takes an optional `fileKey` (the key or the file's figma.com URL), used when the plugin cannot report one, as a development plugin cannot

---

## Related

- [[Design-Round-Trip]] — the read → mutate → verify loop these tools enable
- [[Tools-Batch-Operations]] — acting on what a scan or query found
- [[Tools-Components]] — `introspect` and `set_properties` for semantic edits
- [[Tool-Reference]] — back to the full catalog
