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

## See also

- [Geometry verification](geometry-verification.md): the bounded walk and plugin-side stores this builds on.
