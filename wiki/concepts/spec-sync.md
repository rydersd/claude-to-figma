# Spec sync: Spec and SpecLock design (L2F_SPEC_SYNC)

Tags: spec-sync, normaliser, files, testing

Why the Spec and SpecLock look the way they do, and the traps found while building `pull_spec` (PR 11b). Tool reference: [Spec Sync](../../docs/Spec-Sync.md). Plan: `docs/plans/2026-11-12-figma-api-catch-up.md`, section "Spec sync".

## One normaliser, both sides

`src/shared/spec.ts` is bundled into the server and the plugin. `normalizeNode` takes a node in Spec vocabulary, whether read from Figma or written by the model, and returns one canonical form. Numbers are rounded to 2 decimals, colours become upper-case hex or `$var:`, values Figma derives from layout are dropped, and values equal to `SPEC_DEFAULTS` are dropped. The plugin reader (`src/llm2figma_plugin/src/spec.ts`) leaves out only what needs Figma to judge: `figma.mixed` values, paint lists, variable resolution, stroke caps and vector paths. Everything else is in the shared function, so the comparison in 11c sees the same rules on both sides.

The SpecLock entry's `props` are byte-for-byte the Spec node minus `id` and `children` (`lockNodesFromTree`). That invariant is what makes a three-way diff possible: base, desired and live are all in the same form.

## "No paint" is a default, Figma's creation paint is not

`create_node_tree` does not write a fill when `fillColor` is absent, so Figma's own creation paint stays (white on frames in the real editor, and it differs by node type; nothing in the test mocks). A Spec cannot depend on that, so `SPEC_DEFAULTS` says an absent paint means no paint (`#00000000`, which `applyColorPaint` writes as `[]`). Consequence for 11d: when it creates a node from a Spec it must pass `SPEC_DEFAULTS` for every absent property explicitly. Otherwise a new frame comes back white, the re-lock records `#FFFFFF`, and the next plan reads the Spec's missing `fillColor` as a deletion. `itemReverseZIndex` has the same issue, because `createFrame`'s default comes from the plugin's `firstOnTop` setting.

## A variable reference must resolve back to the same variable

A bound paint is exported as `$var:Collection/Name` only when `getVariableByName` (the lookup the write path uses) returns that same variable id. A library collection can share a name with a local one, and local variables win. The reference would then bind a different variable on write, so the colour is left out instead.

## Truncation must not look like deletion

`walkTree` reports `truncatedParents`. A frame whose children were cut off becomes an OpaqueNode with `truncated: true`, and any of its children that were visited before the budget ran out are dropped. Its SpecLock entry has `children: []`, and nothing under it has a lock entry, so 11c cannot read the missing children as removals. A root whose own children are cut off is an error, not a one-node Spec.

## Test trap: the variable index is shared module state, and Bun reorders files

`getVariableByName` caches a local and a library variable index in module state. Every test file in one `bun test` run shares it, and Bun does not run files in the order they are listed: `tests/spec-sync.test.ts` ran before `tests/plugin-library.test.ts`, which asserts that it builds the index itself (`localReads === 1`, object identity). The spec tests call `resetVariableIndexesForTests()` (in `utils.ts`) before and after themselves. Any new test file that resolves `$var:` references should do the same.

## See also

- [Geometry verification](geometry-verification.md): the bounded walk and plugin-side stores this builds on.
