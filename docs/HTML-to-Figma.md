# HTML to Figma

**Tags:** `guide` · `html-conversion` · `creation` · `workflow`

Converting HTML prototypes into real, editable Figma screens — the core mission of this project. This page covers the three-stage pipeline and the CSS→Figma fidelity rules.

## The pipeline

```
HTML file → parse_wireframe → section specs → build_page_section → Figma frames
                                    ↓ (custom sections)
                              create_node_tree
```

1. **`parse_wireframe`** reads an HTML wireframe from disk, identifies sections by CSS classes and HTML comments, and emits a compact page manifest of template + props specs — about 10× cheaper in tokens than reading the raw HTML.
2. **`get_section_templates`** lists the available section templates by zone (hero, data table, nav, …) with their required and optional props.
3. **`build_page_section`** compiles each spec into Figma nodes with zone-aware token selection, dispatching through [[Create-Node-Tree|create_node_tree]] internally.

For sections no template covers, drop down to a hand-written `create_node_tree` spec, or `create_svg` for illustrations and logos.

## CSS fidelity

What translates cleanly today:

| CSS | Figma |
|---|---|
| `display: flex` + `flex-direction` | Auto layout HORIZONTAL/VERTICAL (`set_layout_mode`) |
| `gap` | `set_item_spacing` |
| `justify-content` / `align-items` | `set_axis_align` |
| `padding` | `set_padding` |
| `width: 100%` / `fit-content` / fixed | FILL / HUG / FIXED (`set_layout_sizing`) |
| `position: absolute` | `set_layout_positioning` ABSOLUTE + constraints |
| `border-radius` | `set_corner_radius` (per-corner supported) |
| `box-shadow` | `set_effects` drop shadow |
| `overflow: visible` | `set_clips_content` false |
| Font styling, `text-decoration`, lists | [[Tools-Text]] tools incl. `set_range_format` |

CSS **gradients** translate too: pass `linear-gradient(...)`/`radial-gradient(...)` strings directly as any color value in [[Create-Node-Tree]] or `set_fill_color`. **Images** (`<img>`, `background-image`) map to `fillImage` in the tree spec or the `set_image_fill` tool — the server fetches the URL and the plugin creates a real image fill, with `background-size: cover/contain` mapping to `scaleMode: FILL/FIT`. Remaining gap (tracked on the [[Roadmap]]): CSS **grid** (Figma now supports Grid auto layout natively — see [[Animation-and-Prototyping#whats-new-in-figma|what's new]]).

## Screens into a flow

After building screens, wire them into a clickable prototype with `batch_set_reactions` and visualize the flow with connectors — see [[Tools-Prototyping-and-Annotations]]. To animate transitions between HTML states, see [[Animation-and-Prototyping]].

## Verification

Always end a conversion with a visual check: `export_node_as_image` on the built frame, compare against the HTML rendering, then fix deltas with targeted tools. The [[Design-Round-Trip]] page describes this loop in depth.

---

## Related

- [[Create-Node-Tree]] — the underlying tree spec format and `$repeat`
- [[Tools-Creating-Elements#page-sections--wireframes|Section tools]] — parse_wireframe, build_page_section, get_section_templates
- [[Design-Round-Trip]] — verifying converted screens against the source HTML
- [[Roadmap#html--figma-fidelity|Fidelity roadmap]] — planned conversion improvements
