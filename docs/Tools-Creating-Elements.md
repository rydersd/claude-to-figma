# Tools Creating Elements

**Tags:** `reference` · `tools` · `creation` · `vectors`

Tools that put new nodes on the canvas — from single shapes to entire page hierarchies in one round-trip.

## Single elements

- `create_rectangle` — rectangle at (x, y) with width/height, optional name and parent
- `create_frame` — frame at (x, y), optional fill/stroke colors and parent
- `create_text` — text node with content, optional font size, weight, color, width, parent
- `create_line` — line from (startX, startY) to (endX, endY), optional stroke color, weight, and start/end caps (arrows)
- `create_ellipse` — ellipse/circle with optional arc data for arcs and donuts
- `create_section` — labeled section container, optionally adopting existing nodes as children

## Vectors & SVG

- `create_vector` — vector node from an SVG path string with size and optional fill
- `create_svg` — Figma nodes from complete SVG markup (logos, icons, illustrations) in one call; handles multi-path SVGs and returns a containing frame
- `set_vector_path` — replace the SVG path data on an existing vector, with optional resize
- `get_vector_network` / `set_vector_network` — read or replace the full vector network (vertices, segments, fill regions) for programmatic path editing

## Hierarchies in one round-trip

- `create_node_tree` — builds an entire node hierarchy from a JSON spec: nested frames, `$repeat` data-driven repetition, `$var:` variable binding, hex color shorthand. The workhorse for building screens — full guide at [[Create-Node-Tree]].

## Page sections & wireframes

- `build_page_section` — builds a page section from a compact semantic spec (template name + props); the server handles zone-aware token selection and node tree generation. ~10× fewer tokens than hand-written `create_node_tree` specs.
- `get_section_templates` — lists available section templates grouped by zone, with required/optional props
- `parse_wireframe` — parses an HTML wireframe file into compact section specs for `build_page_section`; identifies sections by CSS classes and HTML comments and returns a complete page manifest

Together these three form the [[HTML-to-Figma]] pipeline.

---

## Related

- [[Create-Node-Tree]] — the JSON spec format, `$repeat`, and `$var:` binding in depth
- [[HTML-to-Figma]] — converting HTML prototypes into Figma screens
- [[Tools-Layout-and-Styling]] — turning created frames into responsive auto-layouts
- [[Tools-Text]] — refining the text nodes you created
