# Tool Reference

**Tags:** `reference` · `mcp` · `tools`

The hub for all MCP tools the server exposes. Tools are grouped by what a designer is doing: reading the canvas, creating elements, editing text, styling and layout, working with components, wiring prototypes, or batching changes.

## Categories

| Category | Covers |
|---|---|
| [[Tools-Reading-and-Inspection]] | Document/selection reads, node info, scanning, queries, screenshots, undo/redo |
| [[Tools-Creating-Elements]] | Shapes, frames, text, vectors, SVG import, node trees, page sections, wireframe parsing |
| [[Tools-Text]] | Text content, fonts, alignment, rich-text range formatting, lists |
| [[Tools-Layout-and-Styling]] | Auto layout, padding, sizing, fills, strokes, effects, constraints, organization |
| [[Tools-Components]] | Components, instances, variables, styles, migration, semantic introspection |
| [[Tools-Prototyping-and-Annotations]] | Reactions, interactions, FigJam connectors, native annotations |
| [[Tools-Batch-Operations]] | Multi-node operations, mixed mutations, `figma_eval` |

## Conventions shared by all tools

- **Join first** — call `join_channel` before any other tool; nothing works without a channel (see [[Getting-Started#first-session-checklist|first session checklist]])
- **Colors** — RGBA floats (0–1), hex strings (`#RRGGBB`), or variable references (`$var:Collection/Name`)
- **Batching** — prefer `set_multiple_text_contents`, `delete_multiple_nodes`, `batch_mutate` over repeated single calls
- **Validation** — all parameters are Zod-validated; bad input returns a structured error without touching Figma
- **Timeouts** — 30s per command (60s for `create_node_tree`); progress updates keep long operations alive

## Query & Eval

Two power tools cut across every category:

- `design_query` — query nodes by type, name, component, or property values and optionally bulk-update all matches in one call — replaces the scan → introspect → mutate loop
- `figma_eval` — **executes arbitrary JavaScript in the Figma plugin sandbox.** Full read/write/delete access to the document. Code runs as the body of an async function with `figma`, `hexToFigmaColor`, `introspectNode`, and other helpers in scope; use `return` for results. The escape hatch when no dedicated tool fits.

## Team library

Two tools discover published components from configured Figma team libraries over the REST API (see [[Architecture#rest-discovery-team-libraries|REST discovery]]); details and example output in [[Tools-Components#team-library-components|Tools-Components]]:

- `get_library_components {verbose?, refresh?}` — lists every component set across the configured libraries
- `search_library_components {query, limit?, refresh?}` — scored search returning ready-to-place `componentKey`s, consumed by `create_component_instance` or `$lib:` refs in [[Create-Node-Tree#library-component-instances-lib-refs|create_node_tree instance nodes]]

Both require a Figma token in the macOS Keychain + `FIGMA_LIBRARY_FILE_KEYS` (see [[Getting-Started#team-library-setup|team library setup]]) and soft-fail with setup instructions otherwise.

## MCP prompts

The server also ships guided strategies invocable as MCP prompts:

- `design_strategy` — best practices for working with Figma designs
- `read_design_strategy` — best practices for reading designs
- `text_replacement_strategy` — systematic text replacement
- `annotation_conversion_strategy` — converting manual annotations to native ones
- `swap_overrides_instances` — transferring overrides between instances
- `component_migration_strategy` — the diff–test–apply migration workflow
- `reaction_to_connector_strategy` — converting prototype reactions to connector lines
- `node_tree_guide` — full spec reference for [[Create-Node-Tree]] (colors, gradients, images, effects, `$repeat`, sync mode, `$lib:` instances), kept out of the tool description to save per-session tokens
- `component_proposal_guide` — workflow for proposing a new design-system component or pattern when `search_library_components` finds no adequate match

---

## Related

- [[Getting-Started]] — connect before you call anything
- [[Create-Node-Tree]] — deep dive on the highest-leverage creation tool
- [[HTML-to-Figma]] — the wireframe-to-screens workflow built on these tools
- [[Design-Round-Trip]] — combining read, write, and verify tools into fast loops
