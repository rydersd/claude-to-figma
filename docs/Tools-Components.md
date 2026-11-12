# Tools Components

**Tags:** `reference` · `tools` · `components` · `design-system`

Tools for design-system work: components, instances, variants, styles, variables, semantic introspection, and bulk migration when a design system updates.

## Styles & variables

- `get_styles` — all local paint, text, effect, and grid styles
- `get_local_variables` — all local variables (design tokens) by collection; use names with `$var:Collection/Name` in any color field to create real variable bindings
- `get_local_components` — all local components with IDs, names, descriptions, and published keys

## Components & instances

- `create_component` — convert an existing frame into a component (returns ID and key)
- `create_component_instance` — place an instance by local ID or published key
- `create_component_set` — combine components into a variant set using Figma's `Property=Value` naming
- `get_instance_overrides` — extract override properties (text, fills, visibility…) from an instance
- `set_instance_overrides` — apply a source instance's overrides to one or more targets
- `swap_instance_variant` — swap an instance to a different component/variant, preserving compatible overrides
- `set_component_properties` — set exposed component properties (text, boolean, instance swap, variant) via key#id pairs

## Team library components

Two tools discover **published team-library components** (the Assets panel equivalent) over the Figma REST API, independent of the WebSocket/plugin path — see [[Architecture#rest-discovery-team-libraries|REST discovery]]. Both require `FIGMA_API_TOKEN` and `FIGMA_LIBRARY_FILE_KEYS` (see [[Getting-Started#team-library-setup|team library setup]]); without them they return setup instructions instead of erroring.

- `get_library_components {verbose?, refresh?}` — lists every component set across the configured libraries. Compact by default (name, variant count, truncated description, library); `verbose: true` adds each variant's name/key and the full `propertyValues` map. `refresh: true` refetches instead of using the session cache.

  ```json
  // get_library_components → { "verbose": false }
  {
    "totalSets": 527,
    "sets": [
      { "name": "Badge", "variants": 6, "description": "Compact status indicator", "library": "QUIX" },
      { "name": "Banner", "variants": 4, "description": "Full-width page-level message", "library": "QUIX" }
    ]
  }
  ```

- `search_library_components {query, limit?, refresh?}` — scored search by name, description, and variant property values (exact name 100 / prefix 80 / substring 60 / all query tokens 50 / partial tokens scaled / description match 20 / +10 if a property value matches). `limit` is 1–20 (default 5). Returns a ready-to-use `componentKey` per set (its first variant, or best variant match — see `chooseVariant` in [[Create-Node-Tree#library-component-instances-lib-refs|instance nodes]]) plus every variant's name/key for manual selection.

  ```json
  // search_library_components → { "query": "badge" }
  {
    "results": [
      {
        "name": "Badge",
        "score": 100,
        "description": "Compact status indicator",
        "library": "QUIX",
        "componentKey": "a1b2c3d4e5f6...",
        "propertyValues": { "State": ["Default", "Success", "Warning", "Error"] },
        "variants": [{ "name": "State=Default", "key": "..." }, { "name": "State=Success", "key": "..." }],
        "thumbnailUrl": "https://..."
      }
    ]
  }
  ```

  An empty match (`{"results": [], "note": "..."}`) means nothing in the library fits — follow the `component_proposal_guide` prompt (see below) instead of drawing a look-alike from raw shapes.

**Library-first rule**: before building any standard UI element (buttons, badges, inputs, banners, breadcrumbs, tables…) from raw frames/rectangles, call `search_library_components`. If a match scores well, place it as a real instance — via `create_component_instance` (by `componentKey`) or an `instance` node in `create_node_tree` using a `$lib:` reference (see [[Create-Node-Tree#library-component-instances-lib-refs|library component instances]]). If nothing adequate exists, follow the `component_proposal_guide` MCP prompt — it walks through confirming the gap, rationalizing against the nearest existing components, and building the proposal with the `component_proposal` `build_page_section` template rather than faking a component with raw shapes.

## Introspection & semantic editing

- `introspect` — flat property map of every editable surface in a component or frame, keyed by semantic path (`badge.text`, `header.fill`); also reports tree depth, wrapper count, and name collisions
- `set_properties` — apply changes to multiple properties by semantic key in one call (text, hex colors, variant names, booleans); each property applies independently so one failure doesn't abort the rest
- `optimize_structure` — analyze for structural inefficiencies (wrapper frames, unnamed text nodes) and optionally fix; dry-run by default

The pattern: `introspect` once → `set_properties` for everything you learned. One round-trip each way.

## Migration (design-system updates)

- `diff_components` — compare old vs new components; produces a semantic property mapping with structural diff via a 4-pass matching algorithm
- `migrate_instance` — migrate one instance to a new component, preserving overrides, with dry-run preview
- `batch_migrate` — migrate all instances of a source component across the file or a subtree, with dry-run and scope limiting

The safe sequence: `diff_components` → `migrate_instance` (dry-run) → `batch_migrate`.

---

## Related

- [[Tools-Reading-and-Inspection#scanning--querying|design_query]] — find every instance before migrating
- [[Create-Node-Tree#color-shorthand-and-variable-binding|$var: binding]] — token-bound colors in generated trees
- [[Create-Node-Tree#library-component-instances-lib-refs|Library component instances in create_node_tree]] — `$lib:` refs, variant selection, text overrides
- [[Getting-Started#team-library-setup|Team library setup]] — `FIGMA_API_TOKEN` / `FIGMA_LIBRARY_FILE_KEYS`
- [[Tools-Batch-Operations]] — bulk operations beyond component migration
- [[Design-Round-Trip]] — verifying migrations visually before committing
