# Design Spec: Figma Library Integration (Discovery, Pattern Matching, Gap Workflow)

**Date:** 2026-07-31
**Status:** Approved design, pending implementation plan

## Problem

claude-to-figma can *place* a published library component (`create_component_instance` →
`figma.importComponentByKeyAsync(componentKey)`) but has no way to *discover* one. `get_local_components`
scans only local pages. When designing in a file with an enabled team library (e.g. a team component
library), Claude cannot see that Accordion, Badge, Banner, etc. exist — so it draws raw shapes
instead of placing real design-system instances.

Figma's Plugin API cannot enumerate library components (only library *variables* via
`figma.teamLibrary`). Enumeration requires the REST API:

- `GET /v1/files/:file_key/components` and `GET /v1/files/:file_key/component_sets` — published
  components/sets of a library file (token scope `library_content:read`). Fields include `key`,
  `name`, `description`, `node_id`, `thumbnail_url`, `containing_frame`, `updated_at`.
- Reference: https://developers.figma.com/docs/rest-api/component-endpoints/

## Goals

1. Claude can enumerate and search the components of configured team libraries.
2. `create_node_tree` can place library component instances inline, so generated designs use the
   design system as the primary building material.
3. When no library component or pattern fits a need, the gap becomes a first-class deliverable — a
   rationalized proposal with explorations and use cases — never a silent raw-shape imitation.

## Non-Goals (Phase 2 candidates)

- Published styles (`GET /v1/files/:key/styles`) and library variables (`figma.teamLibrary`).
- Team-wide enumeration by `team_id`.
- Lint rules flagging raw shapes that duplicate library components, or `⚠ PROPOSED` frames.

## 1. Architecture

All discovery lives in the MCP server. New module `src/claude_to_figma_mcp/tools/library.ts`:

- On first use, fetches components + component sets for each configured library file key, merges
  into an in-memory index grouped by component set (set name → variants).
- Cache is session-lifetime, keyed by file key; `refresh: true` on the tools refetches. Handle
  pagination cursors defensively if present in responses (file-level endpoints are typically
  unpaginated; team endpoints are not used in v1).
- Variant property parsing: variant names of the form `State=Default, Size=MD` are parsed into a
  property map per variant; the set aggregates `{ property → [values] }`.

The plugin changes only to support instance nodes in tree building (section 4); import-by-key
already exists.

## 2. Configuration & Auth

- `FIGMA_API_TOKEN` — Figma personal access token, scopes **File content: read** and **Library
  content: read**. Lives in the user's shell environment; `.mcp.json` references it as
  `${FIGMA_API_TOKEN}` so no secret is committed.
- `FIGMA_LIBRARY_FILE_KEYS` — comma-separated library file keys (from each library file's URL,
  `figma.com/design/<FILE_KEY>/…`).
- Missing config is a soft failure: library tools return setup instructions, not errors; `$lib:`
  resolution fails with the same instructions before dispatch to the plugin.

## 3. New MCP Tools

### `get_library_components`

Compact listing of every published component set across configured libraries: set name, variant
count, description (truncated), library name. `verbose: true` adds per-variant names, keys, and
property maps. `refresh: true` refetches. The "open the Assets panel" equivalent.

### `search_library_components({ query, limit = 5, refresh? })`

Scored, case-insensitive matching across set names, variant names, and variant property values:

| Signal | Score |
|---|---|
| Exact set/component name match | 100 |
| Name prefix match | 80 |
| Name substring match | 60 |
| All query tokens present in name | 50 |
| Partial token overlap in name | up to 30 |
| Description substring match | 20 |
| Variant property value match | +10 bonus |

Returns top `limit` results with: set name, description, ready-to-use `componentKey` (the set's
first variant, used whenever no properties narrow the choice), full property map (`State: Default | Hover | Disabled`), per-variant keys, and
`thumbnail_url` for visual verification. Plain scoring functions — no fuzzy-match dependency —
unit-testable without Figma.

## 4. Tree-Spec Integration (`instance` node type)

New node type in the `create_node_tree` spec:

```json
{
  "type": "instance",
  "component": "$lib:Badge",
  "properties": { "State": "Success" },
  "textOverrides": { "Label": "Active" },
  "name": "status-badge"
}
```

- `component` accepts a `$lib:<name>` pattern or a raw component key.
- **Server-side resolution before dispatch:** `$lib:` patterns resolve via the same scorer.
  Resolution succeeds when the top score is ≥ 60 **and** leads the runner-up by ≥ 20 (an exact
  name match always wins). Otherwise the whole tree call fails fast with the candidate list so
  Claude can correct — a wrong component is never silently placed.
- **Variant selection:** when `properties` are provided, the server picks the variant whose parsed
  property values best match; remaining/unmatched properties are still applied plugin-side via
  `setProperties` (existing non-fatal behavior).
- **Plugin-side:** `node-tree.ts` handles `type: "instance"` by reusing the extracted core of
  `createComponentInstance` (import by key, create instance, apply properties and text overrides,
  append to parent). Instances participate in auto layout like any other child and accept the same
  positional/layout fields other tree nodes get.
- Multiple configured libraries: matching runs across all; ambiguity across libraries fails with
  candidates labeled by library.

## 5. Error Handling

- REST 401/403 → "check token and scopes (`library_content:read`)"; 404 → "check library file
  key"; 429 → surface with retry-after if present. The session cache means roughly one fetch per
  library per session, so rate limits are a non-issue in practice.
- Unpublished/inaccessible key at import time → per-node error consistent with existing tree-build
  error behavior (the error names the component and key).
- All library errors are returned as tool results (Claude can react), never process crashes.

## 6. Component & Pattern Gap Workflow

Applies when library search returns no adequate match for a needed **component** (single control)
or **pattern** (reusable composition of existing components, e.g. filter bar = Search Input +
Badge group + Button).

1. **No silent fallback.** A failed `$lib:` resolution returns nearest candidates plus a directive
   into this workflow. The design must not quietly imitate a library component with raw shapes.
2. **Rationalization.** The proposal names the nearest existing components/patterns and states
   specifically why each fails the need (wrong anatomy, missing state, can't hold the content…).
   If a near-match can be stretched, it must be used instead — new components earn their existence.
3. **Complete proposal spec, built in Figma** via a standardized "Proposal" frame template
   (registered with the existing `build_page_section`/`get_section_templates` system), containing:
   - Name, type (Component | Pattern), and rationale (rejected near-matches with reasons)
   - Anatomy diagram
   - Proposed properties/variants following the library's conventions (`State=`, `Size=`, …)
   - State grid
   - 2–3 visual explorations
   - Use cases: the proposal shown in context of the current design plus other anticipated
     placements
   - Pattern proposals additionally document their composition from existing library components;
     if a pattern requires a missing component, that spawns a nested component proposal.
4. **Marked as proposed.** The in-progress design places the leading exploration flagged in the
   layer name (`⚠️ PROPOSED / <Name>`) so it cannot be mistaken for a published component.
5. **Mechanism.** A new MCP prompt `component_proposal_guide` encodes steps 1–4; the
   `node_tree_guide` prompt and design-strategy prompts gain a directive to search libraries
   before drawing raw UI. Prompts steer every session without hardcoding behavior.

## 7. Testing

- `tests/library.test.ts` — pure unit tests, no Figma (same pattern as `tests/gradients.test.ts`):
  scorer tiers and tie-breaking, variant-name property parsing, `$lib:` resolution thresholds and
  ambiguity failures against a fixture index, REST fetching/merging with mocked `fetch`, error
  mapping (401/403/404/429), missing-config soft failure.
- One live smoke test against a real library, skipped unless `FIGMA_API_TOKEN` and
  `FIGMA_LIBRARY_FILE_KEYS` are set.
- Instance-in-tree placement: integration test requiring a live plugin channel (existing
  integration-test pattern).

## 8. Documentation Updates (post-implementation)

- Wiki: `Tools-Components.md` (new tools + instance node type), `Tool-Reference.md`,
  `Getting-Started.md` (PAT + env setup), `Architecture.md` (REST discovery path),
  `Roadmap.md` (mark gap closed).
- README: setup section for the two env vars.

## Files Touched (implementation map)

| File | Change |
|---|---|
| `src/claude_to_figma_mcp/tools/library.ts` | New: fetch, cache, index, scorer, resolution |
| `src/claude_to_figma_mcp/server.ts` | Register library tools; env config read |
| `src/claude_to_figma_mcp/types.ts` | `instance` node type in tree spec schema |
| `src/claude_to_figma_mcp/tools/node-tree.ts` | `$lib:` resolution pass before dispatch |
| `src/claude_to_figma_mcp/tools/prompts.ts` | `component_proposal_guide`; library-first directives |
| `src/claude_figma_plugin/src/node-tree.ts` | Handle `instance` nodes |
| `src/claude_figma_plugin/src/components.ts` | Extract reusable instance-creation core |
| `tests/library.test.ts` | New unit tests |
