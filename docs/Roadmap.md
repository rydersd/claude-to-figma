# Roadmap

**Tags:** `reference` · `roadmap` · `html-conversion` · `animation`

Proposed features from a July 2026 audit of the codebase against the project mission — drive Figma like a designer, convert HTML prototypes into Figma screens, and accelerate the Claude↔Figma iteration loop — cross-checked against Figma's 2025–2026 API updates.

## ~~Fix first: broken undo/redo~~ — Done (July 2026)

The `undo`/`redo` MCP tools sent commands the plugin dispatcher had no case for, always failing with "Unknown command". Fixed: `main.ts` now dispatches both to `figma.triggerUndo()`/`figma.triggerRedo()` in a count loop (max 50).

## HTML → Figma fidelity

The biggest gaps between an HTML prototype and what the pipeline can reproduce:

| Feature | Why | Effort |
|---|---|---|
| ~~Image fills~~ (URL/base64/file) | **Done (July 2026).** New `set_image_fill` tool (url/filePath/base64 → server fetches bytes → plugin creates the fill) and `fillImage` in the `create_node_tree` spec with server-side URL prefetch; fetch failures surface as `imageWarnings` without failing the tree. 6MB cap; Figma rejects >4096px. Unit-tested in `tests/images.test.ts`. | ~~M~~ |
| ~~Gradient fills~~ | **Done (July 2026).** Every color field in `create_node_tree` and `set_fill_color` now accepts gradient objects (`{type, angle, stops}`) or CSS strings (`linear-gradient(135deg, #667eea, #764ba2)`, `radial-gradient(...)`), parsed in the plugin with CSS angle conventions. Unit-tested in `tests/gradients.test.ts`. | ~~S/M~~ |
| ~~Effects, per-corner radius, absolute children in `create_node_tree`~~ | **Done (July 2026).** The tree spec now supports `effects`, per-corner radii, `strokeAlign`, and `layoutPositioning: ABSOLUTE` in both create and sync modes — see [[Create-Node-Tree#appearance-fields-frames-and-rectangles|appearance fields]]. | ~~S~~ |
| **Generic HTML/CSS converter** | `parse_wireframe` is regex-based and hardcoded to one design system's `ds-*` classes. A real DOM+computed-style pass (or headless-browser capture) emitting tree specs would make [[HTML-to-Figma]] work on any page. | L |
| **Grid auto layout** | Figma now supports `layoutMode: 'GRID'` (rows/columns/spans/auto-tracks) — the faithful target for CSS `display: grid`. Add to layout tools and the tree spec. | M |
| ~~Component instances in `create_node_tree`~~ | **Done (July 2026).** New `instance` node type: `{"type":"instance","component":"$lib:Name"` (or a raw `componentKey`) `,"properties":{...},"textOverrides":{...}}` places a real published component instance instead of a detached look-alike. Part of the library integration below — see [[Create-Node-Tree#library-component-instances-lib-refs|library component instances]]. | ~~M~~ |
| **Font discovery** | No `listAvailableFontsAsync` tool — Claude guesses font names. A `list_fonts` tool plus a CSS font-stack resolver would remove a constant conversion failure mode. | S |

## Team library integration

**Done (July 2026).** Real published team-library components are now discoverable and placeable without leaving the tree-spec workflow:

- `tools/library.ts` fetches and indexes published component sets over the Figma REST API (`GET /v1/files/:key/components` + `/component_sets` + `/meta`), grouping variants by their containing state group and caching per file key for the session — see [[Architecture#rest-discovery-team-libraries|REST discovery]].
- `get_library_components` and `search_library_components` MCP tools expose that index (scored search: exact/prefix/substring/token/description matches, +10 for a matching property value); both soft-fail with setup instructions when `FIGMA_API_TOKEN`/`FIGMA_LIBRARY_FILE_KEYS` aren't configured.
- `create_node_tree`'s `instance` node type resolves `$lib:<name>` refs server-side (unique exact match, or top score ≥60 with a ≥20-point lead over the runner-up — otherwise a controlled error listing candidates) and the plugin imports, places, sets properties, and applies text overrides; sync mode updates matched instances in place.
- `component_proposal_guide` prompt + library-first directives in `node_tree_guide`/`design_strategy`, and a `component_proposal` `build_page_section` template, close the gap workflow when no library match fits — see [[Tools-Components#team-library-components|library-first rule]].
- Verified live against a production team library: 527 component sets indexed.

**Phase 2 (not yet built):**

| Feature | Why | Effort |
|---|---|---|
| **Published styles (paint/text/effect/grid)** | Only component sets are indexed today; published shared styles from team libraries aren't discoverable or bindable the way local styles are via `get_styles`. | M |
| **`teamLibrary` variables** | `get_local_variables` only sees local variable collections; published library variable collections (via `figma.teamLibrary` APIs) would extend `$var:` binding across files. | M |
| **`team_id` enumeration** | File keys must be supplied manually today (`FIGMA_LIBRARY_FILE_KEYS`). A `team_id`-based discovery call could enumerate a team's published libraries automatically. | S/M |
| **`⚠️ PROPOSED /` frame lint** | Nothing currently flags a `component_proposal` frame (or a "⚠️ PROPOSED / " layer) that's shipped un-reviewed; a lint pass over `design_query`/`scan_node_styles` output would catch it before publish. | S |

## Animation & motion

Figma Motion and the beta `figma.motion` API (see [[Animation-and-Prototyping#whats-new-in-figma|what's new]]) open a new tool family:

| Feature | Why | Effort |
|---|---|---|
| **Spring easing + `SCROLL_ANIMATE` in reaction schemas** | The plugin already passes easing objects through; the Zod schemas just don't accept `GENTLE/QUICK/BOUNCY/SLOW/CUSTOM_SPRING` or spring parameters. Mostly schema work. | S/M |
| **`set_flow_starting_point`** | Generated prototypes can't declare their entry screen (`figma.currentPage.flowStartingPoints`). | S |
| **Motion timeline tools** (`set_animation`, `get_timeline`, apply/remove animation styles, keyframe tracks) | The beta `figma.motion` API makes keyframe animation scriptable — natural-language motion design ("stagger these cards in with a gentle spring") becomes a tool call. | M |
| **Video/GIF fills** | `buildReaction` already sets `resetVideoPosition`, but nothing can create a video fill (`figma.createVideoAsync` unused; requires paid plan — gate with a clear error). | S |

## Round-trip acceleration

| Feature | Why | Effort |
|---|---|---|
| **Batch multi-node image export** | Reviewing an N-screen flow costs N `export_node_as_image` round-trips. One `export_nodes_as_images` call with progress updates fixes it. | S |
| **Event push (Figma → Claude)** | Iteration is pull-only; a designer nudging things in Figma is invisible until re-scan. Plugin subscribes to `selectionchange`/throttled `documentchange`, relay already supports push; add a `get_figma_events` buffer tool. | M |
| **Spec↔canvas diff** | `create_node_tree` sync mode can reconcile but has no dry-run "what differs" report. Add `diffOnly: true`, optionally with server-side pixel diff of two exports. | M |
| **Style & variable creation** | The system reads tokens and binds `$var:` refs but can't mint them — converting a prototype should create its palette/typography as real variables and styles. | M |
| **Page management** | No `create_page`/`set_current_page` — multi-screen prototypes all land on one page. | S |
| **Comments read/write** | Design critique lives in comments; the MCP server can hit the REST API directly (`/v1/files/:key/comments`) with a PAT, no plugin round-trip. | M |

## Token efficiency

Done (July 2026). Three changes cut the fixed per-session cost (schema loaded just for having the server attached) and the per-call response cost:

- **Slimmer descriptions** — `create_node_tree`'s ~2,000-char description (a manual embedded in a schema) is now one sentence plus a pointer to the new `node_tree_guide` MCP prompt, which loads the full spec only on request.
- **Summarized responses** — `create_node_tree` returns counts + `rootId` + errors by default (the full per-node map only with `verbose: true`); `scan_text_nodes` and `scan_node_styles` gained a `fields` projection and dropped pretty-print indentation.
- **Consolidated setters** — eight single-property tools (`set_opacity`, `set_rotation`, `set_blend_mode`, `set_corner_radius`, `set_effects`, `set_padding`, `set_item_spacing`, `set_text_decoration`) folded into `batch_mutate` ops, shrinking the top-level surface from 104 to 95 tools. The plugin keeps all capabilities; only the MCP registration surface is leaner.

## Suggested order

~~undo/redo fix (done)~~ → ~~tree-spec effects/corners/absolute (done)~~ → ~~gradients (done)~~ → ~~image fills (done)~~ → ~~team library integration: discovery, search, `$lib:` instances (done)~~ → batch export → font discovery → spring easings → page management → generic HTML converter → event push → variable creation → comments → spec diff → video fills → library phase 2 (published styles, `teamLibrary` variables, `team_id` enumeration, PROPOSED-frame lint).

Features 1–4 of the HTML section together close most of the conversion fidelity gap; the small wins (undo fix, batch export, fonts) are the best effort-to-impact ratio for iteration speed.

---

## Related

- [[HTML-to-Figma]] — the pipeline these fidelity features feed
- [[Tools-Components#team-library-components|Team library components]] — what shipped in the library integration
- [[Create-Node-Tree#library-component-instances-lib-refs|Library component instances]] — the `$lib:` node type
- [[Animation-and-Prototyping]] — context for the motion tool family
- [[Design-Round-Trip]] — the loop the acceleration features tighten
- [[Plugin-Development#adding-a-new-tool-checklist|Adding a new tool]] — how to implement any of these
