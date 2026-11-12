# Tools Layout and Styling

**Tags:** `reference` · `tools` · `auto-layout` · `styling`

Tools for auto layout, spacing, visual styling, and node organization — the bulk of what turns raw shapes into a designed screen.

## Auto layout & spacing

- `set_layout_mode` — switch a frame to HORIZONTAL, VERTICAL, or NONE auto-layout, with optional wrap
- `set_axis_align` — primary axis (e.g. space-between) and counter axis (e.g. center) alignment
- `set_layout_sizing` — horizontal/vertical sizing modes: FIXED, HUG, FILL
- `set_layout_positioning` — set a child to ABSOLUTE (float above siblings) or AUTO (participate in flow), with optional pin constraints
- `set_constraints` — horizontal/vertical constraints (MIN/MAX/CENTER/STRETCH/SCALE) for responsive behavior
- `set_min_max_size` — min/max width/height, used with FILL sizing to constrain growth
- `set_padding` and `set_item_spacing` — now `batch_mutate` ops (see [[Tools-Batch-Operations#mixed-mutations-batch_mutate|batch_mutate]])

## Fills, strokes & corners

- `set_fill_color` — solid fill via RGBA (0–1), or a gradient via the `gradient` parameter (CSS gradient string or `{type, angle, stops}` object)
- `set_image_fill` — image fill from a URL, local file path, or base64 data; the server fetches the bytes (6MB cap, Figma rejects >4096px) and `scaleMode` maps from CSS (`FILL`=cover, `FIT`=contain, `TILE`=repeat)
- `remove_fill` — clear all fills
- `set_stroke_color` — solid stroke color and optional weight
- `set_stroke_dash` — dash pattern (array of dash/gap lengths)
- `set_stroke_properties` — weight, end cap, join style, alignment, and dash pattern in one call

## Effects & appearance

- `set_mask` — make a node a mask that clips subsequent siblings, with optional grouping
- `set_corner_radius`, `set_effects`, `set_opacity`, `set_blend_mode`, `set_rotation` — single-property setters, now `batch_mutate` ops (see [[Tools-Batch-Operations#mixed-mutations-batch_mutate|batch_mutate]]). At creation time, frames and rectangles also take `effects` and per-corner radii directly in [[Create-Node-Tree]].

## Organization & geometry

- `move_node` — reposition to new (x, y)
- `resize_node` — change width and height. With `L2F_VERIFY=1` it reads the size back: Figma's `resize()` applies what it can and throws nothing, so the result reports `requested`, `applied`, `partial` and a `cause` (`layoutSizing*` HUG or FILL, `minWidth`/`minHeight`, `maxWidth`/`maxHeight`, text auto-resize, or "unexplained"); see [verification](Tools-Reading-and-Inspection.md#geometry-verification-l2f_verify)
- `clone_node` — duplicate with an optional offset
- `delete_node` / `delete_multiple_nodes` — remove nodes
- `insert_child_at` — move a node into a parent at a specific index
- `reorder_child` — change z-order within the current parent
- `group_nodes` — wrap multiple nodes in a group
- `set_clips_content` — whether a frame clips children (set false for floating badges and overflow patterns)
- `rename_node` — rename a single node

## CSS → Figma mental model

When translating HTML/CSS (see [[HTML-to-Figma]]): `display:flex` → `set_layout_mode`, `gap` → `set_item_spacing`, `justify-content`/`align-items` → `set_axis_align`, `padding` → `set_padding`, `width:100%` → FILL sizing, `position:absolute` → `set_layout_positioning`, `box-shadow` → `set_effects`, `border-radius` → `set_corner_radius`.

---

## Related

- [[Tools-Creating-Elements]] — the frames these tools shape
- [[HTML-to-Figma#css-fidelity|CSS fidelity notes]] — what translates cleanly and what doesn't
- [[Tools-Batch-Operations]] — applying the same styling across many nodes
- [[Tools-Components]] — promote a styled frame to a reusable component
