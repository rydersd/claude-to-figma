# Spec Sync

**Tags:** `reference` · `spec-sync` · `editing` · `flagged`

Spec sync lets you edit an existing design in place instead of redrawing it. `pull_spec` writes a Figma subtree to a JSON file on disk, the **Spec**. You edit that file with ordinary file edits. Nodes keep their Figma ids, so hand tweaks and anything the file cannot express survive. Applying the edits back to Figma comes in later releases (see [What comes next](#what-comes-next)).

Off unless the server is started with `L2F_SPEC_SYNC=1` (or `L2F_ALL=1`). Set the flag in the shell that starts Claude Code; both the `.mcp.json` install and the Claude Code plugin install pass it through.

## Objects

- **Spec**: `<name>.l2f.json`. Header `{l2fSpec: 1, fileKey, fileName, pageId, rootId}` and a `tree` in [create_node_tree](Create-Node-Tree.md) node format: text content is `text`, colours are `fillColor` / `strokeColor` / `fontColor` as hex or `$var:Collection/Name`. Every node pulled from Figma carries its `id`; a node without an `id` is one to create.
- **SpecLock**: `<name>.l2f.lock.json`, beside the Spec. Do not edit it. It records what Figma held at the pull: `{l2fLock: 1, fileKey, fileName, pageId, rootId, pulledAt, specHash, supersededFrameId, pendingApply, nodes}`, where `nodes` maps each id to `{props, propsHash, parentId, children}`. `props` is the node as it appears in the Spec, without `id` and `children`, except that a vector's `pathData` is stored as `pathHash` (a hash of the canonical path) to keep the lock small; `propsHash` is the hash of that stored form (`hashProps(lockProps(props))` in `src/shared/spec.ts`). Child order is kept in `children`, not in `propsHash`.
- **OpaqueNode**: a node the format cannot express, written as `{type: "$opaque", id, name, nodeType, reason}` with no children. Groups, ellipses, lines, stars, polygons, boolean operations, sections, components and component sets (`reason: "unsupported type"`), rotated nodes (`"rotated"`), grid-layout frames (`"grid layout"`), text whose characters carry more than one style (`"mixed-style text"`) and instances whose main component is gone (`"main component missing"`) are OpaqueNodes.
- **Truncated OpaqueNode**: a node the export did not read because a budget ran out, `{type: "$opaque", id, name, nodeType, truncated: true, reason}` with `reason` one of `"node budget"`, `"depth limit"`, `"byte budget"`. It sits in its parent's `children` in its place, so every child list in a Spec is complete and a node that was not read never looks removed.

## `pull_spec`

`pull_spec {nodeId, path, maxNodes?, maxDepth?, replaceEdited?}`

- `nodeId`: the root. It must be a frame, text, rectangle, vector or instance, without rotation or grid layout, and not inside an instance (an id containing `;`).
- `path`: the Spec file. It must end in `.l2f.json`, and its directory must exist.
- `maxNodes` (default 2000, max 10000) and `maxDepth` (default 30, max 100) bound the walk. The Spec tree is also capped at 8 MB of serialised JSON, truncated placeholders included.
- `replaceEdited` (default false): see [Refusals](#refusals).

Returns `{path, lockPath, nodeCount, opaqueCount, truncated}`, plus `backups` when old files were renamed and `note` when a budget cut something off. It never returns the tree: read the file.

The walk is breadth-first, so a budget cuts the deepest, last-reached nodes, never a whole sibling. A node that is not read becomes a truncated OpaqueNode in its parent's `children`. Running out of budget never fails a pull; only a root that cannot be read does (an OpaqueNode root, or a root larger than 8 MB on its own).

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
    "layoutSizingVertical": "HUG", "layoutMode": "VERTICAL", "paddingTop": 24, "paddingRight": 24, "paddingBottom": 24,
    "paddingLeft": 24, "itemSpacing": 16, "itemReverseZIndex": false, "fillColor": "#F7F7F7",
    "children": [
      {"id": "12:35", "type": "text", "text": "Your basket", "fontStyle": "Bold", "fontSize": 24, "textAutoResize": "WIDTH_AND_HEIGHT"},
      {"id": "12:36", "type": "instance", "name": "Pay button", "componentSetKey": "9f2c…", "height": 48, "layoutSizingHorizontal": "FILL", "properties": {"Size": "Large", "Label#4:1": "Pay now"}},
      {"id": "12:40", "type": "$opaque", "name": "Logo", "nodeType": "GROUP", "reason": "unsupported type"}
    ]
  }
}
```

### What a Spec holds

`SPEC_VOCABULARY` in `src/shared/spec.ts` is the one table of the keys each type may carry. Every key in it is written back by both `createNode` and `updateNodeProperties` in `node-tree.ts` (FILL on a frame by `applyDeferredFill(node, spec, only, {checkParent: true})`), and a parity test checks each one (`tests/spec-sync.test.ts`, "writable vocabulary parity"). Every type has `name`, `visible`, `x`, `y`, `opacity`, `layoutPositioning`, `layoutSizingHorizontal` and `layoutSizingVertical`, plus:

| Type | Keys |
|---|---|
| frame | `width`, `height`, `fillColor`, `strokeColor`, `strokeWeight`, `strokeAlign`, `effects`, `cornerRadius`, `clipsContent`, `layoutMode`, `layoutWrap`, `paddingTop/Right/Bottom/Left`, `primaryAxisAlignItems`, `counterAxisAlignItems`, `itemSpacing`, `counterAxisSpacing`, `itemReverseZIndex` |
| rectangle | `width`, `height`, `fillColor`, `strokeColor`, `strokeWeight`, `strokeAlign`, `effects`, `cornerRadius` |
| vector | `width`, `height`, `fillColor`, `strokeColor`, `strokeWeight`, `strokeAlign`, `effects`, `strokeCap`, `pathData` |
| text | `text`, `fontFamily`, `fontStyle`, `fontSize`, `fontColor`, `lineHeight`, `letterSpacing`, `textCase`, `textAlignHorizontal`, `textAutoResize`, `width`, `height`, `effects` |
| instance | `componentKey` or `componentId`, or `componentSetKey` or `componentSetId`; `properties`, `width`, `height` |

Values are in one canonical form: numbers rounded to 2 decimals, colours as upper-case hex (`#RRGGBB`, `#RRGGBBAA` below full opacity, `#00000000` for no paint) or a variable reference. A paint bound to a variable is `"$var:Collection/Name"`, or `{"$var": "Collection/Name", "opacity": 0.3}` when the paint's opacity is below 1; create and update accept both forms.

**An instance is a leaf.** A variant is named by its component set: `componentSetKey` (library) or `componentSetId` (a local set, which has no importable key), with the VARIANT values in `properties` choosing the variant. A variant instance never carries `componentKey`, so changing a VARIANT value is a property edit and never fights a variant key. Any other instance has `componentKey` (library) or `componentId` (local). `properties` is flattened to `{"Name#id": value}` (instance-swap properties are not included). Its children are never read, because their ids cannot be created, moved or removed.

### Absent means default (rule D)

A key that is absent from a Spec node means that property's `SPEC_DEFAULTS` value: what `create_node_tree` ends up with when the property is not passed, Figma's own creation paints included (a new frame is white `#FFFFFF`, a new rectangle `#D9D9D9`, new text black). A value equal to its default is left out, so the Spec stays short. The export never leaves out a value Figma might derive differently from create:

- `x` and `y` are written whenever the node is not placed by an auto-layout parent (a page child, a child of a frame without auto-layout, or `layoutPositioning: ABSOLUTE`), even at 0.
- `width` and `height` are written whenever that axis is FIXED, even at 100; on instances always (FIXED axes); on text as the text box decides (below).
- `paddingTop/Right/Bottom/Left`, `itemSpacing` and `itemReverseZIndex` are written whenever `layoutMode` is not NONE (`counterAxisSpacing` when the frame wraps). Turning auto-layout on in Figma keeps padding 0 and `itemReverseZIndex` false, while create makes them 10 and true.

What is left out as derived, never compared:

- `x`/`y` inside an auto-layout parent (unless `ABSOLUTE`).
- `width` or `height` on a HUG or FILL axis.
- Text: `width` unless `textAutoResize` is `HEIGHT`, `NONE` or `TRUNCATE`; `height` unless it is `NONE` or `TRUNCATE`; `textAutoResize` itself is always written; `layoutSizing*` other than FILL.
- Auto-layout properties on a frame without auto-layout.
- `name` on text with `autoRename` (the name follows the characters). An absent `name` on text means "named by its text".

### Not synced

Values the write path cannot reproduce are left out of an otherwise editable node: anything `figma.mixed` (unequal corner radii, individual stroke weights); `lineHeight` that is not in pixels, letter spacing in percent (other than 0) and fractional `fontSize`; paint lists with more than one paint, or a hidden, blended or non-solid paint; a colour bound to a variable whose `Collection/Name` does not resolve back to that variable; `strokeCap` unless every vertex agrees; `pathData` unless the vector has exactly one NONZERO path (it is written as Figma reads it back); effects with bound variables, progressive blur, "show shadow behind node" or a type other than drop shadow, inner shadow, layer blur and background blur. Not in the format at all: rotation, per-corner radii, constraints, min/max size, text decoration and other text styles outside the table, instance-swap properties, a vector's full network (several paths, per-vertex caps that differ), and anything inside an instance.

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

**Right file, right page.** Node ids are identical in a duplicated file. Re-pulling a Spec's own root checks that the connected file and page are the ones in the Spec: by file key when both sides have one (see `L2F_FILE_KEY`), otherwise by file name. Known limit: without a file key, a copy renamed to the original's name is not detected. With `replaceEdited: true` and a file key recorded in the Spec, only the key is checked, so a renamed file or a node moved to another page can be re-pulled; the new pair records the new name and page. If the Spec has a key but the connected file's key cannot be read, the re-pull is refused. Without a recorded key the name and page checks stay.

**One pull per path at a time.** Pulls to the same Spec path in one server are serialised, from reading the existing pair to writing the SpecLock, so two pulls never leave a Spec from one and a SpecLock from the other.

## What comes next

### `plan_spec` (PR 11c)

Not available yet. It will compare the Spec, the SpecLock and live Figma property by property, and report the changes without writing anything.

### `apply_spec` (PR 11d)

Not available yet. It will carry out a plan by node id, read the result back, and update the Spec and SpecLock.
