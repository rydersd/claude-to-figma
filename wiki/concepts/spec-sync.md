# Spec sync: Spec and SpecLock design (L2F_SPEC_SYNC)

Tags: spec-sync, normaliser, files, testing

Why the Spec and SpecLock look the way they do, and the traps found while building `pull_spec` (PR 11b). Tool reference: [Spec Sync](../../docs/Spec-Sync.md). Plan: `docs/plans/2026-11-12-figma-api-catch-up.md`, section "Spec sync".

## One normaliser, both sides

`src/shared/spec.ts` is bundled into the server and the plugin. `normalizeNode` takes a node in Spec vocabulary, whether read from Figma or written by the model, and returns one canonical form. Numbers are rounded to 2 decimals, colours become upper-case hex or `$var:`, values Figma derives from layout are dropped, and values equal to `SPEC_DEFAULTS` are dropped. The plugin reader (`src/llm2figma_plugin/src/spec.ts`) leaves out only what needs Figma to judge: `figma.mixed` values, paint lists, variable resolution, stroke caps and vector paths. Everything else is in the shared function, so the comparison in 11c sees the same rules on both sides.

The SpecLock entry's `props` are byte-for-byte the Spec node minus `id` and `children` (`lockNodesFromTree`). That invariant is what makes a three-way diff possible: base, desired and live are all in the same form.

## Absent means default, and the default is what create really leaves

`create_node_tree` does not write a fill when `fillColor` is absent, so Figma's own creation paint stays: white on a frame, `#D9D9D9` on a rectangle. `SPEC_DEFAULTS` records those, so a frame created from a Spec without `fillColor` exports without one. The test mocks start new nodes with those creation paints; a mock that starts every node with no paint hides the mismatch.

Values Figma derives differently from create are never dropped as defaults (`NEVER_DROPPED` in `src/shared/spec.ts`): `x`/`y` outside auto-layout, `width`/`height` on FIXED axes, and padding, spacing and `itemReverseZIndex` under auto-layout (turning auto-layout on in Figma keeps padding 0 and `itemReverseZIndex` false; create makes them 10 and true). So a key absent from a pulled Spec always means its default, and a key the model deletes can be written back to that default.

## A variable reference must resolve back to the same variable

A bound paint is exported as `$var:Collection/Name` only when `getVariableByName` (the lookup the write path uses) returns that same variable id. A library collection can share a name with a local one, and local variables win. The reference would then bind a different variable on write, so the colour is left out instead.

## Truncation must not look like deletion

The export walks breadth-first. A node it does not read, because the node budget, the depth limit or the 8 MB byte budget ran out, becomes `{type: "$opaque", truncated: true, reason}` in its parent's `children`, in its place. Every child list is then complete, so 11c can never read an unread node as removed, and a budget never fails a pull. An earlier depth-first version turned the whole cut-off parent opaque and failed the pull when the cut fell under any root child but the last. The byte budget reserves room for the placeholders of children not read yet, so the tree, placeholders included, stays within 8 MB.

## Concurrent pulls to one path

Two pulls to one path could interleave between "read the existing pair" and "write the SpecLock", leaving a Spec from one pull and a SpecLock from the other. `pullSpec` holds a per-path in-process mutex for the whole pull.

## Test trap: the variable index is shared module state, and Bun reorders files

`getVariableByName` caches a local and a library variable index in module state. Every test file in one `bun test` run shares it, and Bun does not run files in the order they are listed: `tests/spec-sync.test.ts` ran before `tests/plugin-library.test.ts`, which asserts that it builds the index itself (`localReads === 1`, object identity). The spec tests call `resetVariableIndexesForTests()` (in `utils.ts`) before and after themselves. Any new test file that resolves `$var:` references should do the same.

## Planning (PR 11c): what the comparison had to get right

- **The live read must use the pull's normaliser, not a cheaper one.** `read_spec_nodes` runs the same walk as `export_spec` (`readSubtree` in the plugin's `spec.ts`) and builds entries with `lockNodesFromTree`, so an untouched node hashes exactly like its SpecLock entry. Only nodes whose hash differs send `props`; an unchanged 2,000-node design costs one hash each.
- **The read budget is the largest, and the SpecLock's cut-off nodes are forced opaque.** Reading with the pull's budget is not stable: a node added by hand early in pre-order shifts where the budget runs out. So the plan reads with `maxNodes` 10000 and sends `truncated`, a map from each cut-off id to the `reason` the SpecLock recorded; the plugin emits those placeholders, reason included, whatever the budget, so they hash the same as at the pull. A node the read newly cuts off makes it and its base descendants `unread`: never removed, never `missing`. A placeholder the live read cut off for a different budget only differs in `reason`, which is not drift.
- **The normaliser silently drops what it cannot write; the planner must not.** `normalizeNode` drops unknown keys and unwritable values (`canonicalValue` returns undefined, a fractional `fontSize`). In a Spec that would read as "key deleted" and reset the property to its default, so the planner checks raw keys against `SPEC_VOCABULARY` and raw values against `canonicalValue` first, and refuses.
- **Turning auto-layout on is the one context change that implies values.** Padding, spacing and `itemReverseZIndex` are NEVER_DROPPED under auto-layout, so a Spec that turns `layoutMode` on without them means create's defaults, which Figma would not give (it keeps padding 0). The update writes them. Geometry that becomes required in a new context (x/y after leaving auto-layout) is not implied: writing 0,0 would collapse the node.
- **"Absent from the Spec" needs a context check.** Before reading a missing key as "reset to default", the planner re-normalises the node with the base value put back. If the normaliser drops it again, Figma derives it in the new context (FILL width, x inside auto-layout) and nothing is written.
- **Minimal moves.** Per parent, the nodes kept are the longest increasing run of positions between the two orders (both filtered to their common members); the rest are moves. A swap is one move, and which of the two is reported is arbitrary but deterministic, so tests must accept either.
- **The other dimension needs a live value.** Normalised props drop derived sizes, so the server sends `sizeIds` (nodes whose Spec width or height changed, known before the read) and the plugin returns their live size.

## Prototype links (issue #40)

`reactions` is in `COMMON`, so every Spec type carries it, and it goes through the same three-way comparison as any other key; nothing in the planner is special to it except the destination check.

- **Canonical form, not a re-built one.** The value is Figma's own reaction objects, deep-copied with sorted keys and `undefined` fields dropped, and the deprecated singular `action` removed. Figma returns `action` beside `actions`, and its key order is not something to rely on; without the sort the same link would hash differently between a pull and a later read and show as drift. Defaults are not filled in (unlike `buildFullReaction` in `prototyping.ts`), because filling them would invent values Figma may not hold.
- **An allow-list decides `$unread`.** `NODE`, `BACK`, `CLOSE` and `URL` actions round-trip as plain data. Variable, conditional and media actions carry ids and expressions whose round trip through `setReactionsAsync` has not been verified, so a node holding one lists `reactions` in `$unread` rather than guessing. The same check (`canonicalValue("reactions", …)` returning undefined) makes strict mode refuse such a value written by hand.
- **The write lives in `updateNodeProperties` and `createNode`, and is first.** That keeps the vocabulary parity test true without a special case. `create_node_tree`'s Zod schema has no `reactions` key, so the tool strips it and its behaviour is unchanged. The setter runs before any other key, so a rejected list throws before anything else on that node is written, and the apply reports the whole update as `failed` truthfully.
- **Destinations are checked at plan time, only for edited links.** The server collects `destinationId`s from reactions that differ from the SpecLock (and from new nodes), drops those in the Spec, and sends the rest to `read_spec_nodes` as `destinationIds`; the plugin returns those that are not a node on the page. Unedited links are left alone: they are what Figma already holds.
- **No links to a node created in the same apply.** A new node has no id until the apply writes it into the Spec, so linking to it takes a second plan.

## See also

- [Geometry verification](geometry-verification.md): the bounded walk and plugin-side stores this builds on.
