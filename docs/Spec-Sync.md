# Spec Sync

**Tags:** `reference` · `spec-sync` · `editing` · `flagged`

Spec sync lets you edit an existing design in place instead of redrawing it. `pull_spec` writes a Figma subtree to a JSON file on disk, the **Spec**. You edit that file with ordinary file edits. Nodes keep their Figma ids, so hand tweaks and anything the file cannot express survive. `plan_spec` then shows, property by property, what applying the edits would change, and `apply_spec` carries that Plan out in Figma (see [`apply_spec`](#apply_spec)).

Off unless the server is started with `L2F_SPEC_SYNC=1` (or `L2F_ALL=1`). Set the flag in the shell that starts Claude Code; both the `.mcp.json` install and the Claude Code plugin install pass it through.

## Objects

- **Spec**: `<name>.l2f.json`. Header `{l2fSpec: 1, fileKey, fileName, pageId, rootId}` and a `tree` in [create_node_tree](Create-Node-Tree.md) node format: text content is `text`, colours are `fillColor` / `strokeColor` / `fontColor` as hex or `$var:Collection/Name`. Every node pulled from Figma carries its `id`; a node without an `id` is one to create.
- **SpecLock**: `<name>.l2f.lock.json`, beside the Spec. Do not edit it. It records what Figma held at the pull: `{l2fLock: 1, fileKey, fileName, pageId, rootId, pulledAt, specHash, supersededFrameId, pendingApply, nodes}`, where `nodes` maps each id to `{props, propsHash, parentId, children}`. `props` is the node as it appears in the Spec, without `id` and `children`, except that a vector's `pathData` is stored as `pathHash` (a hash of the canonical path) to keep the lock small; `propsHash` is the hash of that stored form (`hashProps(lockProps(props))` in `src/shared/spec.ts`). Child order is kept in `children`, not in `propsHash`.
- **OpaqueNode**: a node the format cannot express, written as `{type: "$opaque", id, name, nodeType, reason}` with no children. Groups, ellipses, lines, stars, polygons, boolean operations, sections, components and component sets (`reason: "unsupported type"`), rotated nodes (`"rotated"`), grid-layout frames (`"grid layout"`), text whose characters carry more than one style (`"mixed-style text"`) and instances whose main component is gone (`"main component missing"`) are OpaqueNodes.
- **`$unread`**: on an editable node, `"$unread": ["fillColor", "strokeWeight"]` (sorted) lists the keys whose Figma value the format cannot express (see [Not synced](#not-synced)), so the export left them out. An absent key listed there does **not** mean its default: Figma holds something the Spec cannot show. It is written by the pull only, and is part of the node's props, its SpecLock entry and its `propsHash`.
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

`SPEC_VOCABULARY` in `src/shared/spec.ts` is the one table of the keys each type may carry. Every key in it is written back by both `createNode` and `updateNodeProperties` in `node-tree.ts` (FILL on a frame by `applyDeferredFill(node, spec, only, {checkParent: true})`), and a parity test checks each one (`tests/spec-sync.test.ts`, "writable vocabulary parity"). Every type has `name`, `visible`, `x`, `y`, `opacity`, `layoutPositioning`, `layoutSizingHorizontal`, `layoutSizingVertical` and `reactions` (see [Prototype links](#prototype-links-reactions)), plus:

| Type | Keys |
|---|---|
| frame | `width`, `height`, `fillColor`, `strokeColor`, `strokeWeight`, `strokeAlign`, `effects`, `cornerRadius`, `clipsContent`, `layoutMode`, `layoutWrap`, `paddingTop/Right/Bottom/Left`, `primaryAxisAlignItems`, `counterAxisAlignItems`, `itemSpacing`, `counterAxisSpacing`, `itemReverseZIndex` |
| rectangle | `width`, `height`, `fillColor`, `strokeColor`, `strokeWeight`, `strokeAlign`, `effects`, `cornerRadius` |
| vector | `width`, `height`, `fillColor`, `strokeColor`, `strokeWeight`, `strokeAlign`, `effects`, `strokeCap`, `pathData` |
| text | `text`, `fontFamily`, `fontStyle`, `fontSize`, `fontColor`, `lineHeight`, `letterSpacing`, `textCase`, `textAlignHorizontal`, `textAutoResize`, `width`, `height`, `effects` |
| instance | `componentKey` or `componentId`, or `componentSetKey` or `componentSetId`; `properties`, `width`, `height` |

Values are in one canonical form: numbers rounded to 2 decimals, colours as upper-case hex (`#RRGGBB`, `#RRGGBBAA` below full opacity, `#00000000` for no paint) or a variable reference. A paint bound to a variable is `"$var:Collection/Name"`, or `{"$var": "Collection/Name", "opacity": 0.3}` when the paint's opacity is below 1; create and update accept both forms.

**An instance is a leaf.** A variant is named by its component set: `componentSetKey` (library) or `componentSetId` (a local set, which has no importable key), with the VARIANT values in `properties` choosing the variant. A variant instance never carries `componentKey`, so changing a VARIANT value is a property edit and never fights a variant key. Any other instance has `componentKey` (library) or `componentId` (local). `properties` is flattened to `{"Name#id": value}` (instance-swap properties are not included). Its children are never read, because their ids cannot be created, moved or removed.

### Prototype links (`reactions`)

`reactions` is Figma's own list of reaction objects as plain JSON, so retargeting a button means editing its `destinationId` in the Spec:

```jsonc
"reactions": [
  {"actions": [{"destinationId": "12:80", "navigation": "NAVIGATE", "preserveScrollPosition": false,
                "transition": null, "type": "NODE"}],
   "trigger": {"type": "ON_CLICK"}}
]
```

- **Canonical form.** Each reaction is `{actions, trigger}` only: the deprecated singular `action` is dropped (or stands in for `actions` when that is missing), fields that are `undefined` are dropped, and keys are sorted at every level, so the order Figma returns keys in never changes the Spec or a hash. Numbers and `null` are kept as Figma has them. An empty list is the default, so a node without prototype links has no `reactions` key; deleting the key plans an update to `[]`.
- **What a Spec carries.** Actions of type `NODE` (navigate, overlay, swap, scroll-to), `BACK`, `CLOSE` and `URL`, with any trigger. A node holding anything else (`SET_VARIABLE`, `SET_VARIABLE_MODE`, `CONDITIONAL`, `UPDATE_MEDIA_RUNTIME`, a reaction without a trigger, an unknown reaction key or a value that is not plain JSON) lists `reactions` in its `$unread`, so it is never written. Written by hand in a Spec, such a value is an error.
- **Writing.** An update writes the whole list with `await node.setReactionsAsync(list)`, before any other key of that node, so a list Figma rejects leaves the node untouched and the update is `failed`. Updates run after the creates, in the same undo step. A created node gets its reactions right after it is created. The read-back decides `partial`, as for every key.
- **Destinations.** A `destinationId` may point outside the pulled subtree. `plan_spec` asks the plugin about each destination outside the Spec that a changed or new node links to, and refuses, naming the linking node, when it is not a node on the Spec's page. A node created in the same apply has no id yet, so it cannot be linked to in that plan: apply it first (the apply writes its id into the Spec), then link to it and plan again.

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

Values the write path cannot reproduce are left out of an otherwise editable node, and their keys listed in the node's `$unread`: anything `figma.mixed` (unequal corner radii, individual stroke weights); `lineHeight` that is not in pixels, letter spacing in percent (other than 0) and fractional `fontSize`; paint lists with more than one paint, or a hidden, blended or non-solid paint; a colour bound to a variable whose `Collection/Name` does not resolve back to that variable; `strokeCap` unless every vertex agrees; `pathData` unless the vector has exactly one NONZERO path (it is written as Figma reads it back); effects with bound variables, progressive blur, "show shadow behind node" or a type other than drop shadow, inner shadow, layer blur and background blur; `reactions` holding an action type other than `NODE`, `BACK`, `CLOSE` and `URL` (see [Prototype links](#prototype-links-reactions)). A line height of `AUTO` is the default and simply absent, not unread. Not in the format at all (and not listed in `$unread`): rotation, per-corner radii, constraints, min/max size, text decoration and other text styles outside the table, instance-swap properties, a vector's full network (several paths, per-vertex caps that differ), and anything inside an instance.

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
| Id deleted from the Spec, and it is an OpaqueNode or holds one | `conflict` (`kind: "remove"`): its contents were never read; delete it in Figma |
| Id deleted from the Spec, and Figma now has a node inside it the Spec does not also remove (added by hand, moved in from elsewhere, a node the Spec keeps, an OpaqueNode, a node the read cut off) | `conflict` (`kind: "remove"`) naming the nodes that would be lost. A node the plan moves out first (with its subtree) does not count |
| Id deleted from the Spec, changed in Figma (itself or a descendant) | `conflict` |
| Id deleted from the Spec, already gone from Figma | converged |
| Id in the Spec, gone from the live subtree | `missing` (a conflict), even when the Spec did not touch the node: deleting it in Figma is not taken as drift. Delete it from the Spec too (converged), or pull |
| Node added in Figma by hand | left alone, reported as `drift` (`kind: "added"`) |

Order changes are minimal: when siblings are reordered, only the nodes that left the longest run in the original order are moved (swapping two siblings is one move, and no update on the parent). A hand-added sibling does not count as a reorder of the others.

Details:

- **Absent means default.** A property you delete from a Spec node is set back to its `SPEC_DEFAULTS` value (a frame's fill to `#FFFFFF`, a rectangle's to `#D9D9D9`, `visible` to true), if the SpecLock had a value for it. Deleting one whose SpecLock value already is the default (`x: 0`, a FIXED `width: 100`) plans nothing. A property left out because Figma derives it in its new context (a `width` after you set `layoutSizingHorizontal: "FILL"`, `x`/`y` after a move into auto-layout) is not reset. Deleting a property with no default (`name` on text that has a name, `componentKey`, `pathData`, an instance's `properties` or one of its keys) is an error.
- **Unread values (`$unread`).** A key listed in a node's `$unread` is never written: setting it in the Spec, even to its default, is a conflict ("Figma holds a value the Spec cannot express"), never an update. A key entering or leaving the live `$unread` (Figma turns a solid fill into a gradient, or back) is drift on that key. Removing or editing `$unread` itself, or giving it to a new node, is an error.
- **Instance `properties` key by key.** Each component property is compared on its own: a Spec edit to `A#1` and a Figma edit to `B#2` are one update (setting `A#1` only) and one drift (`properties.B#2`), not a conflict. An update's `properties` holds only the keys to write.
- **Turning auto-layout off.** When the Spec sets `layoutMode` to `NONE` (or deletes it), the children's `x`/`y` absent from the Spec mean "keep": Figma leaves each child where auto-layout put it, and the plan writes no position. Set `x`/`y` on a child to place it.
- **Turning auto-layout on.** When the Spec sets `layoutMode` (or `layoutWrap: "WRAP"`) and leaves padding, `itemSpacing`, `counterAxisSpacing` or `itemReverseZIndex` out, the update writes create's defaults (padding 10, `itemReverseZIndex` true), because Figma would keep padding 0. Geometry (`x`, `y`, `width`, `height`) that becomes required in a new context is never implied; Figma keeps the node where it is.
- **Width and height travel together.** An update that changes only one of them carries the other at its live value, because Figma resizes both at once.
- **Value forms.** Every value goes through the same normaliser as the pull (`canonicalValue` in `src/shared/spec.ts`): a bound colour at full opacity can be written as `"$var:Collection/Name"` or `{"$var": "Collection/Name", "opacity": 1}` and both compare equal; below full opacity the object form is kept. A value the normaliser cannot write (a colour that is not one, `null`, a fractional `fontSize`) is an error, not a silent reset to the default. The SpecLock stores a vector's path as `pathHash` (`lockProps`), so the Spec's `pathData` is compared by the same hash, and an update carries the `pathData`.
- **Truncation never deletes.** A node a budget cut off (an OpaqueNode with `truncated: true`) is never removed, and nothing below it is. The live read reads the SpecLock's cut-off nodes as the same placeholders, with the reason the SpecLock recorded, whatever the budget; a placeholder the live read cut off for a different budget is not drift. If the live design has grown past the budget, the nodes it could not read are counted as `unread`, and any edit to them is reported as a conflict.
- **OpaqueNodes are never edited or removed.** Moving or reordering one is planned; editing it is an error; dropping it, or a node that holds one, from the Spec is a `remove` conflict.

### Errors

`plan_spec` refuses, before asking Figma, and names each offending node by its place in the Spec (`tree.children[2].children[0]`) and id, when the Spec:

- repeats an `id`, or has an `id` the SpecLock does not know (a new node has no `id`);
- has an `id` containing `;` (a node inside an instance);
- changes the root's `id`, a node's `type`, or the header (`fileKey`, `fileName`, `pageId`, `rootId`);
- edits an OpaqueNode other than moving it, or gives children to anything but a frame;
- has a key the node's type cannot write per `SPEC_VOCABULARY` (for example `fontSize` on a rectangle), or a value it cannot write (the Spec is normalised in strict mode, `normalizeNode(node, parent, {strict: true})`, which refuses instead of dropping);
- removes or edits a node's `$unread`, or gives one to a new node;
- places an existing node under a new one (apply the new parent first, pull, then move into it);
- deletes a property that has no default (for example an instance's `componentKey`, its `properties`, or one key of them).

After the live read, it also refuses when a changed or new node's `reactions` link to a `destinationId` outside the Spec that is not a node on the Spec's page (see [Prototype links](#prototype-links-reactions)).

Every value, key list and type string quoted in an error is clipped to about 80 characters, and lists stop at 10 items with a count of the rest.

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

## `apply_spec`

`apply_spec {planId, allowRemovals?, onConflict?}`

Carries out one Plan by node id, reads the whole subtree back, and updates the Spec and SpecLock. The loop is: `pull_spec`, edit the Spec, `plan_spec`, `apply_spec`.

- `planId`: from `plan_spec`. There is no "latest plan".
- `allowRemovals` (default false): without it, removals are listed under `skipped` and nothing moves.
- `onConflict` (default `"skip"`): conflicts are left as Figma has them and listed under `skipped`. `"spec"` writes the Spec's value for **property** conflicts (structure conflicts are always skipped). A key in a node's `$unread` is never written either way.

### Before anything is written

The server refuses, writing nothing, when the Spec or the SpecLock changed since the plan (the Spec's hash and the SpecLock's hash are both recorded in the Plan), when the SpecLock already records an unfinished apply, or when the server is on a different relay channel than the plan was made on. It then writes `pendingApply: <planId>` to the SpecLock and sends `apply_spec_ops` to the plugin (120 s timeout, progress every 50 operations).

The plugin checks the file and page (as for [Refusals](#refusals)), then, in the same run as the writes and before any of them, re-reads every node the Plan touches and compares its `propsHash`, parent and child order with what `plan_spec` saw. Any difference refuses the whole run with nothing written; the server then clears `pendingApply` and says to plan again. It also clears it when the command provably never reached Figma: not sent (no relay, no channel), or the plugin answered with an error (the Dev Mode gate, an old plugin that does not know `apply_spec_ops`), since the command throws only before its first write. These are told apart by the rejection's delivery stage (`commandDelivery` in `src/llm2figma_mcp/connection.ts`), not by its message.

### What the plugin does

`figma.commitUndo()` before the first write and after the last, so one undo in Figma reverts the apply (and anything done by hand in the file while it ran). The tool never calls `triggerUndo`.

1. **Creates**, each a new subtree under an existing parent, through `createNode` with `onBindFailure: "keep"`: a node whose colour variable cannot be bound is kept, renamed `<name> (failed)`, and reported under `failed`. Every key absent from a created node is written as its `SPEC_DEFAULTS` value, so the new node is what "absent means default" says. A new text node without a `name` gets Figma's auto-rename, so it stays named by its text.
2. **Updates**, through `resolveAndBind` and `updateNodeProperties` with `only` set to the listed keys, then `applyDeferredFill(node, spec, only, {checkParent: true})`. No other setter fires: a text edit leaves the font alone, a fill edit leaves a bound stroke alone. `reactions` is written first, with `await node.setReactionsAsync(list)`; the creates have already run, so every id they made exists.
3. **Moves**, and the place of each created node, per parent in the Spec's child order: only the nodes that moved are inserted, each right after its previous Spec sibling (or before the first one, when it has none), so nodes added by hand keep their places. Each insert is read back. A reparent into a frame without auto-layout (or of an `ABSOLUTE` node) keeps the node's absolute position: its `relativeTransform` is set from its old `absoluteTransform` and the new parent's, then asserted. Keys that depend on the parent (`x`, `y`, `layoutPositioning`, `layoutSizingHorizontal`, `layoutSizingVertical`) on a node that also moves are written after the move, against the new parent, with `applyDeferredFill(..., {checkParent: true})` for FILL. A move whose node reached its new parent but whose index or kept position did not hold is reported under `partial` with what happened, never under `failed`.
4. **Removals**, last, and only with `allowRemovals: true`: the topmost node is moved into a page-level frame `l2f/superseded` at the same absolute position and renamed `<name> (superseded YYYY-MM-DD)`. Its descendants travel with it. The holder is created when missing (no auto-layout, no clipping, no fill, hidden, so superseded nodes leave the view; show it in the layers panel to see them) and its id is kept in the SpecLock as `supersededFrameId`. A recorded holder that is no longer a page-level frame without auto-layout is left as it is, and a fresh one (`l2f/superseded 2`, ...) is made. A removed node that reached the holder but did not keep its position is `partial`, not `failed`. Nothing on this path calls `remove()`.

One failed operation is recorded and the rest continue. Then the plugin re-reads the **whole** subtree, because a text edit reflows HUG ancestors and siblings.

### After the run

The server re-reads the Spec. If it was edited while the apply ran, it stops: Figma holds the applied Plan, the Spec and SpecLock are left alone, and `pendingApply` stays set. The error lists the ids it created: pull again rather than re-applying the edits from a `.bak` copy, which would create those nodes a second time. Otherwise it writes each created node's `id` into the Spec at its index path (the Spec is rewritten only when something was created), then rewrites the SpecLock from the read-back, never from the Spec, and clears `pendingApply`.

Per node and property, the read-back becomes the new base where it agrees with the Spec. Where they disagree the old base is kept, so the next plan shows the same thing again: an edit that was skipped, partial or failed reappears, drift stays drift (it is never turned into an update that reverts it), and a conflict stays a conflict. A node the Spec dropped but that is still in Figma (a skipped removal) keeps its entry, so the removal is proposed again; a node added by hand stays out of the SpecLock, so it is still reported as added. A value Figma changed as a side effect of the apply (a child a resized frame's constraints moved) is reported as drift on the next plan.

If the command times out or the plugin reloads, `pendingApply` stays set: `plan_spec` and `apply_spec` refuse, and `pull_spec` refuses unless `replaceEdited: true`, until a pull.

### Result

```jsonc
// apply_spec {"planId": "plan-6f1c…"}
{"planId": "plan-6f1c…", "path": "/work/specs/checkout.l2f.json",
 "applied": {"created": [{"path": [2], "id": "12:90"}], "updated": [{"id": "12:35", "keys": ["text"]}],
             "moved": ["12:36"], "removed": []},
 "counts": {"created": 1, "updated": 1, "moved": 1, "removed": 0, "skipped": 0, "partial": 0, "failed": 0},
 "skipped": [], "partial": [], "failed": [],
 "undo": "One undo in Figma (Cmd/Ctrl+Z) reverts this apply, ...", "truncated": false}
```

- `skipped`: removals without `allowRemovals`, and conflicts (`{id, name, kind, keys?, reason}`).
- `partial`: `{id, keys}`, touched properties whose read-back is not the value asked for (a resize Figma constrained, a font it substituted). Every property of a created node counts as touched.
- `failed`: `{op, id or path, keys?, error}`; a failed create leaves its Spec node without an id, so the next plan creates it again.

Each list holds at most 100 entries (`truncated` when one was cut); `counts` are complete.

### Checking an apply

With `L2F_VERIFY=1` as well, `snapshot_positions` on the root before `apply_spec` and `diff_positions` after show that node ids survived (nothing `missing`), which nodes moved, and the reflow the edits caused.
