# Create Node Tree

**Tags:** `reference` · `creation` · `node-tree` · `performance`

`create_node_tree` builds an entire node hierarchy from one JSON spec in a single round-trip — the highest-leverage tool in the catalog for building screens. This page covers the spec format, `$repeat` data-driven repetition, and `$var:` variable binding.

## Why one round-trip matters

Each tool call crosses stdio → WebSocket → plugin and back. A 60-node screen built element-by-element is 60 round-trips against a 30s-per-command budget; as one tree spec it is a single call (with a 60s timeout and progress updates every 5 nodes to keep the timer alive — see [[Architecture#key-runtime-patterns|runtime patterns]]).

## Spec format

A nested tree of node specs. Frames are the only nodes with children; leaves are text, rectangles, vectors, and library component instances:

```json
{
  "type": "frame",
  "name": "Card",
  "width": 320, "height": 200,
  "layoutMode": "VERTICAL", "paddingTop": 16, "itemSpacing": 8,
  "fillColor": "#ffffff",
  "cornerRadius": 12,
  "effects": [{"type": "DROP_SHADOW", "color": "#00000029", "offset": {"x": 0, "y": 4}, "radius": 12}],
  "children": [
    {"type": "text", "text": "Title", "fontSize": 16, "fontWeight": 600},
    {"type": "text", "text": "Body copy", "fontSize": 13, "fontColor": "#666666"}
  ]
}
```

## Appearance fields (frames and rectangles)

- **`effects`** — array of `DROP_SHADOW`, `INNER_SHADOW`, `LAYER_BLUR`, `BACKGROUND_BLUR`; a CSS `box-shadow` maps to one `DROP_SHADOW` with color, offset, radius, and spread. Shadow colors accept hex or RGBA (not `$var:` refs).
- **Per-corner radii** — `topLeftRadius`, `topRightRadius`, `bottomRightRadius`, `bottomLeftRadius` override `cornerRadius` per corner (CSS `border-radius: 8px 8px 0 0`).
- **`strokeAlign`** — `INSIDE`, `OUTSIDE`, or `CENTER`.
- **`layoutPositioning: "ABSOLUTE"`** — on any child of an auto-layout frame (frames, rectangles, and text), floats it at its `x`/`y` like CSS `position: absolute`. Falls back to in-flow if the parent isn't auto-layout.
- **`fillImage`** — `{"url": "https://...", "scaleMode": "FILL"}` (or `filePath`/`base64`). The server prefetches URLs before the tree crosses the WebSocket; a failed fetch strips that fill and reports it in `imageWarnings` instead of failing the tree. `scaleMode` maps from CSS: FILL = `cover` (default), FIT = `contain`, TILE = `repeat`. Replaces `fillColor` when both are set.

All of these also work in sync mode — the reconciler updates them in place.

## Library component instances (`$lib:` refs)

An `instance` node places a real published component from a configured team library — not a raw look-alike — so design-system updates propagate normally:

```json
{
  "type": "frame",
  "width": 400, "height": 200,
  "layoutMode": "VERTICAL",
  "children": [
    {
      "type": "instance",
      "component": "$lib:Badge",
      "properties": { "State": "Success" },
      "textOverrides": { "Label": "Active" },
      "name": "status-badge"
    }
  ]
}
```

- **`component`** — either `"$lib:<Name>"`, resolved server-side against the configured libraries (see [[Tools-Components#team-library-components|get_library_components / search_library_components]]), or a raw `componentKey` passed straight through. A unique exact set-name match always wins; otherwise the top score must be ≥60 with a ≥20 lead over the runner-up, or the whole tree fails with a `LibraryRefError` listing candidates — a wrong component is never silently placed. If nothing matches, the error also points at the `component_proposal_guide` prompt.
- **`properties`** — sets component/variant properties (e.g. `{"State": "Success"}`); also used to pick the best-matching variant when a `$lib:` ref resolves to a component *set*.
- **`textOverrides`** — replaces text content by child text-node name, applied after the instance is placed.
- **`name`** — renames the placed instance (defaults to the component's name).

**Caveat — no `$repeat` placeholders in `component`:** `$lib:` resolution runs once, before `$repeat` expansion, so `component` must be a static string — never `"$lib:$[0]"` or similar. `properties` and `textOverrides`, by contrast, *may* contain `$[N]`/`$key` placeholders inside a `$repeat` template (e.g. `{"State": "$[0]"}` for a per-row status column): the server resolves a valid (if not row-correct) `componentKey` for the import using the template as-is, and the plugin applies the real per-row `properties`/`textOverrides` after substitution — via `instance.setProperties()` — so each repeated row ends up on its correct variant.

Sync mode (`rootId`) also supports `instance` nodes: matched instances get `setProperties`/text-override updates in place, same as create mode. Matching is by `name`+type, and a placed instance inherits the component's name unless you set `name` explicitly — so an unnamed instance spec re-matches on `"" + "::instance"` instead of the placed instance's actual name, causing re-syncs to create a duplicate instead of updating in place; name instances you intend to re-sync.

## Color shorthand and variable binding

Three ways to express any color:

| Form | Example | Result |
|---|---|---|
| Hex shorthand | `"#3d6daa"` | Solid fill, converted to Figma's 0–1 RGBA |
| RGBA object | `{"r": 0.24, "g": 0.43, "b": 0.67, "a": 1}` | Solid fill, explicit |
| Variable reference | `"$var:Colors/Brand/Primary"` | A **real variable binding** — not a resolved value — so the node tracks the token through mode switches |
| CSS gradient string | `"linear-gradient(135deg, #667eea, #764ba2)"` | Gradient fill; CSS angle conventions (0° = to top, 90° = to right), `radial-gradient(...)` also supported |
| Gradient object | `{"angle": 135, "stops": [{"position": 0, "color": "#667eea"}, {"position": 1, "color": "#764ba2"}]}` | Gradient fill, explicit stops |

Discover available variable names with `get_local_variables` (see [[Tools-Components#styles--variables|styles & variables]]).

## $repeat: data-driven repetition

For tables, lists, and grids, `$repeat` expands a template over a data array:

```json
{
  "$repeat": {
    "data": [
      {"name": "Alice", "role": "Design"},
      {"name": "Bob", "role": "Engineering"}
    ],
    "template": {
      "type": "frame",
      "layout": {"mode": "HORIZONTAL", "itemSpacing": 12},
      "children": [
        {"type": "text", "text": "{{name}}"},
        {"type": "text", "text": "{{role}}", "fill": "#888888"}
      ]
    }
  }
}
```

Each data row stamps one instance of the template with its fields substituted.

## Going higher-level

For common page patterns, `build_page_section` wraps `create_node_tree` behind named templates with props (~10× fewer tokens), and `parse_wireframe` generates those section specs straight from an HTML file — see [[HTML-to-Figma]].

---

## Related

- [[Tools-Creating-Elements]] — single-element tools when a full tree is overkill
- [[HTML-to-Figma]] — the wireframe pipeline built on top of this tool
- [[Tools-Layout-and-Styling]] — refining generated frames after creation
- [[Tools-Components#styles--variables|get_local_variables]] — finding token names for `$var:` bindings
- [[Tools-Components#team-library-components|get_library_components / search_library_components]] — finding `$lib:` names and componentKeys
- [[Getting-Started#team-library-setup|Team library setup]] — enabling `$lib:` refs with a PAT and library file keys
