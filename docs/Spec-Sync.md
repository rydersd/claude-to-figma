# Spec Sync

**Tags:** `reference` · `spec-sync` · `editing` · `flagged`

Spec sync lets you edit an existing design in place instead of redrawing it. `pull_spec` writes a Figma subtree to a JSON file on disk, the **Spec**. You edit that file with ordinary file edits. Nodes keep their Figma ids, so hand tweaks and anything the file cannot express survive. `plan_spec` then shows, property by property, what applying the edits would change. Applying them back to Figma comes in a later release (see [What comes next](#what-comes-next)).

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

## `plan_spec`

`plan_spec {path}`

Compares three versions of every node, property by property: the **base** (the SpecLock, what Figma held at the pull), the **desired** state (the Spec, with your edits) and **live** Figma (read through the plugin's `read_spec_nodes`). It writes nothing: not to Figma, not to the Spec or SpecLock. The result is a **Plan**, kept on the server under an explicit `planId`.

| Spec vs base | Figma vs base | Result |
|---|---|---|
| same | same | unchanged |
| differs | same | `update` of that property |
| same | differs | `drift`: kept as Figma has it, reported |
| differs | differs, equal to the Spec | converged, no operation |
| differs | differs otherwise | `conflict` on that property: reported, skipped |

Structure (parent and child order) is compared the same three ways:

| Case | Result |
|---|---|
| Spec node with no `id` | `create`, with its index path in the Spec and its whole subtree |
| Spec changed its parent or sibling order, Figma did not | `move` |
| Figma changed its parent or order, the Spec did not | `drift` |
| Both moved it, to different places | `conflict` |
| Id deleted from the Spec, unchanged in Figma | `remove` (the topmost node only; descendants travel with it) |
| Id deleted from the Spec, changed in Figma (itself, a descendant, or a node added inside it) | `conflict` |
| Id deleted from the Spec, already gone from Figma | converged |
| Id in the Spec, gone from the live subtree | `missing` (a conflict) |
| Node added in Figma by hand | left alone, reported as `drift` (`kind: "added"`) |

Order changes are minimal: when siblings are reordered, only the nodes that left the longest run in the original order are moved (swapping two siblings is one move, and no update on the parent). A hand-added sibling does not count as a reorder of the others.

Details:

- **Absent means default.** A property you delete from a Spec node is set back to its default, if the SpecLock had a value for it. A property left out because Figma derives it in its new context (a `width` after you set `layoutSizingHorizontal: "FILL"`, `x`/`y` after a move into auto-layout) is not reset.
- **Width and height travel together.** An update that changes only one of them carries the other at its live value, because Figma resizes both at once.
- **Value forms.** A bound colour at full opacity can be written as `"$var:Collection/Name"` or `{"$var": "Collection/Name", "opacity": 1}`; both compare equal. When the SpecLock stores a vector's path as `pathHash`, the Spec's `pathData` is compared by the same hash, and an update carries the `pathData`.
- **Truncation never deletes.** A node the node budget cut off (an OpaqueNode with `truncated: true`) is never removed, and nothing below it is. The live read treats the SpecLock's cut-off nodes the same way, whatever the budget. If the live design has grown past the budget, the nodes it could not read are counted as `unread`, and any edit to them is reported as a conflict.

### Errors

`plan_spec` refuses, before asking Figma, and names each offending node by its place in the Spec (`tree.children[2].children[0]`) and id, when the Spec:

- repeats an `id`, or has an `id` the SpecLock does not know (a new node has no `id`);
- has an `id` containing `;` (a node inside an instance);
- changes the root's `id`, a node's `type`, or the header (`fileKey`, `fileName`, `pageId`, `rootId`);
- edits an OpaqueNode other than moving or deleting it, or gives children to anything but a frame;
- has a key the node's type cannot write (for example `fontSize` on a rectangle);
- places an existing node under a new one (apply the new parent first, pull, then move into it);
- deletes a property that has no default (for example an instance's `componentKey`).

It also refuses when the SpecLock records an unfinished apply (`pendingApply`; pull again), when the Spec or SpecLock is missing, a symlink or not valid JSON, and when the connected file or page is not the Spec's (as for [Refusals](#refusals)).

### Result

```jsonc
// plan_spec {"path": "checkout.l2f.json"}
{"planId": "plan-6f1c…", "path": "/work/specs/checkout.l2f.json",
 "counts": {"operations": 3, "updates": 2, "properties": 2, "creates": 0, "moves": 1, "removes": 0,
            "drift": 1, "conflicts": 0, "converged": 0, "unread": 0, "liveNodes": 214},
 "operations": [
   {"op": "update", "id": "12:35", "name": "Title", "keys": ["text"]},
   {"op": "update", "id": "12:38", "name": "Total", "keys": ["fillColor"]},
   {"op": "move", "id": "12:36", "name": "Pay button", "parentId": "12:34", "index": 1}],
 "drift": [{"id": "12:39", "name": "Note", "kind": "property", "keys": ["opacity"]}],
 "conflicts": [], "truncated": false, "expiresAt": "2026-11-12T10:30:00.000Z",
 "note": "Drift is what changed in Figma since the pull; ..."}
```

Each list (`operations`, `drift`, `conflicts`) holds at most 100 entries; `truncated` is true when any was cut, and `counts` are always complete. `drift` and `conflicts` entries are `{id, name, kind, keys?, detail?}`, with `kind` one of `property`, `structure`, `added`, `type`, `missing`, `remove`, `unread`.

The full Plan stays on the server: up to 8 Plans, each for 30 minutes and at most 4 MB. It records the Spec's hash, a hash of the SpecLock, the channel, the target file and page, every operation in full (values included), and the live `propsHash`, parent and children seen for every node an operation touches, so that applying it can refuse if anything changed since. A `planId` is always explicit; there is no "latest plan". An expired or unknown `planId` is an error, never an empty plan.

To take drift into the Spec, pull again (`replaceEdited: true` if the Spec has unapplied edits; it backs them up as `.bak` files).

## What comes next

### `apply_spec` (PR 11d)

Not available yet. It will carry out a plan by node id, read the result back, and update the Spec and SpecLock.
