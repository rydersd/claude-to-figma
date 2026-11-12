# Spec Sync

**Tags:** `reference` · `spec-sync` · `editing` · `flagged`

Spec sync lets you edit an existing design in place instead of redrawing it. `pull_spec` writes a Figma subtree to a JSON file on disk, the **Spec**. You edit that file with ordinary file edits. Nodes keep their Figma ids, so hand tweaks and anything the file cannot express survive. Applying the edits back to Figma comes in later releases (see [What comes next](#what-comes-next)).

Off unless the server is started with `L2F_SPEC_SYNC=1` (or `L2F_ALL=1`). Set the flag in the shell that starts Claude Code; both the `.mcp.json` install and the Claude Code plugin install pass it through.

## Objects

- **Spec**: `<name>.l2f.json`. Header `{l2fSpec: 1, fileKey, fileName, pageId, rootId}` and a `tree` in [create_node_tree](Create-Node-Tree.md) node format: text content is `text`, colours are `fillColor` / `strokeColor` / `fontColor` as hex or `$var:Collection/Name`. Every node pulled from Figma carries its `id`; a node without an `id` is one to create.
- **SpecLock**: `<name>.l2f.lock.json`, beside the Spec. Do not edit it. It records what Figma held at the pull: `{l2fLock: 1, fileKey, fileName, pageId, rootId, pulledAt, specHash, supersededFrameId, pendingApply, nodes}`, where `nodes` maps each id to `{props, propsHash, parentId, children}`. `props` is the node exactly as it appears in the Spec, without `id` and `children`. Child order is kept in `children`, not in `propsHash`.
- **OpaqueNode**: a node the format cannot express, written as `{type: "$opaque", id, name, nodeType}` with no children. Groups, ellipses, lines, stars, polygons, boolean operations, sections, components, component sets, rotated nodes, grid-layout frames and instances whose main component is gone are OpaqueNodes. A frame whose children the node budget cut off is an OpaqueNode with `truncated: true`.

## `pull_spec`

`pull_spec {nodeId, path, maxNodes?, maxDepth?, replaceEdited?}`

- `nodeId`: the root. It must be a frame, text, rectangle, vector or instance, without rotation or grid layout, and not inside an instance (an id containing `;`).
- `path`: the Spec file. It must end in `.l2f.json`, and its directory must exist.
- `maxNodes` (default 2000, max 10000) and `maxDepth` (default 30, max 100) bound the walk.
- `replaceEdited` (default false): see [Refusals](#refusals).

Returns `{path, lockPath, nodeCount, opaqueCount, truncated}`, plus `backups` when old files were renamed and `note` when the budget cut something off. It never returns the tree: read the file.

```jsonc
// pull_spec {"nodeId": "12:34", "path": "checkout.l2f.json"}
{"path": "/work/specs/checkout.l2f.json", "lockPath": "/work/specs/checkout.l2f.lock.json",
 "nodeCount": 214, "opaqueCount": 9, "truncated": false}
```

A small Spec:

```jsonc
{
  "l2fSpec": 1, "fileKey": "AbC123xyz789QrStUv", "fileName": "Shop app", "pageId": "0:1", "rootId": "12:34",
  "tree": {
    "id": "12:34", "type": "frame", "name": "Checkout", "x": 120, "y": 80, "width": 390,
    "layoutSizingVertical": "HUG", "layoutMode": "VERTICAL", "itemSpacing": 16, "fillColor": "#FFFFFF",
    "children": [
      {"id": "12:35", "type": "text", "name": "Title", "text": "Your basket", "fontStyle": "Bold", "fontSize": 24, "textAutoResize": "WIDTH_AND_HEIGHT"},
      {"id": "12:36", "type": "instance", "name": "Pay button", "componentKey": "9f2c…", "properties": {"Size": "Large", "Label#4:1": "Pay now"}, "layoutSizingHorizontal": "FILL"},
      {"id": "12:40", "type": "$opaque", "name": "Logo", "nodeType": "GROUP"}
    ]
  }
}
```

### What is left out

A Spec holds only what the write path can set back, in one canonical form: numbers rounded to 2 decimals, colours as upper-case hex (`#RRGGBB`, `#RRGGBBAA` below full opacity, `#00000000` for no paint) or `$var:` references.

- **Defaults**: a value equal to what `create_node_tree` applies when the property is absent. For example frame padding 10 and `itemReverseZIndex: true` under auto-layout, size 100x100, text Inter Regular 14 in black, and no paint on frames, rectangles and vectors.
- **Values Figma derives from layout**: `x`/`y` inside an auto-layout parent (unless `layoutPositioning` is `ABSOLUTE`); `width` or `height` on a HUG or FILL axis; text `height` always, and text `width` unless `textAutoResize` is `HEIGHT` (`textAutoResize` itself is always written); text `layoutSizing*` other than FILL; auto-layout properties on a frame without auto-layout, and `counterAxisSpacing` unless the frame wraps.
- **Values the write path cannot reproduce**: anything `figma.mixed` (unequal corner radii, individual stroke weights); all style properties of text with mixed styles (only `text` and layout remain); `lineHeight` that is not in pixels, letter spacing in percent (other than 0) and fractional `fontSize`; paint lists with more than one paint, or a hidden, blended or non-solid paint; a colour bound to a variable whose `Collection/Name` does not resolve back to that variable; `strokeCap` unless every vertex agrees; `pathData` unless the vector has exactly one NONZERO path (it is written as Figma reads it back); effects with bound variables, progressive blur, "show shadow behind node" or a type other than drop shadow, inner shadow, layer blur and background blur.

An instance is a leaf: `componentKey` for a library component, `componentId` for a local one, `properties` flattened to `{"Name#id": value}` (instance-swap properties are not included), and its sizing. Its children are never read, because their ids cannot be created, moved or removed.

### Files and paths

- Relative paths resolve against `L2F_SPEC_DIR`, or the server's working directory when it is unset. `L2F_SPEC_DIR` must be an absolute path; set it in the shell that starts Claude Code, like the flags.
- An absolute path is accepted only inside that directory. Containment is checked after resolving symlinks on the parent directory, so a symlinked directory pointing outside is refused.
- A Spec or SpecLock that is a symlink is refused, never followed. An existing file is overwritten only when it parses as a Spec (or SpecLock).
- Files are written to a temp file in the same directory and renamed into place, the Spec first and then the SpecLock.

Specs of real designs belong with your work, not in this repository.

### Refusals

`pull_spec` refuses, and writes nothing, when:

- the Spec has edits that were never applied (its content no longer matches the SpecLock's `specHash`; reformatting the file or reordering keys is not an edit);
- the SpecLock has `pendingApply` set, meaning an apply started and did not finish;
- a Spec exists with no SpecLock beside it;
- the existing file is not a Spec, or either file is a symlink;
- the path breaks the rules above.

With `replaceEdited: true`, the first three are overridden: the old pair is renamed to `<file>.<timestamp>.bak` and a fresh pair is written. A file that is not a Spec is never overwritten.

**Right file, right page.** Node ids are identical in a duplicated file. Re-pulling a Spec's own root checks that the connected file and page are the ones in the Spec: by file key when both sides have one (see `L2F_FILE_KEY`), otherwise by file name. Known limit: without a file key, a copy renamed to the original's name is not detected.

## What comes next

### `plan_spec` (PR 11c)

Not available yet. It will compare the Spec, the SpecLock and live Figma property by property, and report the changes without writing anything.

### `apply_spec` (PR 11d)

Not available yet. It will carry out a plan by node id, read the result back, and update the Spec and SpecLock.
