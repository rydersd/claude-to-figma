# Tools Batch Operations

**Tags:** `reference` · `tools` · `batch` · `performance`

Tools that act on many nodes in one round-trip. On a 30-second command timeout, batching is the difference between a screen built in three calls and a session full of timeouts.

## Batch tools

- `batch_rename` — rename multiple nodes via `{nodeId, name}` mappings
- `batch_reparent` — move multiple nodes under a new parent at an optional index
- `batch_set_fill_color` — same fill color across multiple nodes
- `batch_clone` — duplicate one source node to multiple positions with optional per-clone names
- `delete_multiple_nodes` — remove many nodes by ID array
- `set_multiple_text_contents` — replace text across many nodes (see [[Tools-Text]])
- `set_multiple_annotations` — batch annotations (see [[Tools-Prototyping-and-Annotations]])
- `batch_set_reactions` — wire navigation across a whole screen (see [[Tools-Prototyping-and-Annotations]])

## Mixed mutations: batch_mutate

`batch_mutate` executes a heterogeneous array of operations in a single round-trip: `rename`, `set_fill`, `set_stroke`, `move`, `resize`, `delete`, `set_text`, `set_visible`, `set_font`, `set_text_align`, `set_vector_path`, `set_opacity`, `set_rotation`, `set_blend_mode`, `set_corner_radius`, `set_effects`, `set_padding`, `set_item_spacing`, `set_text_decoration`. Each operation runs independently — one failure won't abort the others. This is the tool for "apply this list of 40 tweaks" moments.

The last eight ops (`set_opacity` through `set_text_decoration`) were previously standalone tools. They were folded into `batch_mutate` to keep the top-level tool surface lean — fewer registered tools means less schema loaded into every session's context. See [[Roadmap#token-efficiency|token efficiency]] for the rationale.

## Query-then-update: design_query

`design_query` combines the find and the fix: filter nodes by type, name, component, or property values, and apply property updates to every match in the same call. It replaces the scan → introspect → mutate loop entirely for rule-based changes ("make every `TEXT` node named `label` 12px gray").

## Escape hatch: figma_eval

When no dedicated tool fits, `figma_eval` runs arbitrary JavaScript in the plugin sandbox with full document access (`figma`, `hexToFigmaColor`, `introspectNode` helpers in scope). Powerful and dangerous — it can delete anything. Prefer dedicated tools when they exist; use `undo` (up to 50 steps) if an eval goes wrong.

## When to batch

- Any time you'd otherwise call the same tool 3+ times in a loop
- Large trees: pair with chunked scans (`scan_text_nodes`) so both the read and the write scale
- After a `design_query` or `introspect`, feed the results straight into `batch_mutate` or `set_properties`

---

## Related

- [[Tools-Reading-and-Inspection#scanning--querying|Scanning tools]] — find the nodes to batch over
- [[Tools-Components#introspection--semantic-editing|set_properties]] — the semantic-key alternative for components
- [[Architecture#key-runtime-patterns|Timeouts and chunking]] — why batching matters
- [[Design-Round-Trip]] — verify a batch visually before the next one
