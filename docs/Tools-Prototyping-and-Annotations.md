# Tools Prototyping and Annotations

**Tags:** `reference` · `tools` · `prototyping` · `annotations`

Tools for wiring interactive prototypes (reactions, triggers, transitions), visualizing flows as FigJam connectors, and managing native Figma annotations.

## Reading interactions

- `get_reactions` — all prototype triggers and actions from given nodes, highlighting them in Figma; designed to feed the connector-line workflow
- `get_interactions` — clean interaction summary for a node: trigger type, action type, destination frame name/ID, transition details. Use this to inspect wiring before modifying it.

## Writing interactions

- `set_reactions` — set prototype interactions on a node (replaces the whole reactions array). Wires click-to-navigate, hover overlays, scroll-to, back, open-URL. Triggers: `ON_CLICK`, `ON_HOVER`, etc.; actions: `NAVIGATE`, `OVERLAY`, `BACK`, `URL`, …
- `add_reaction` — append one interaction without disturbing existing ones (e.g. add hover to a button that already has on-click)
- `remove_reactions` — remove all reactions, or only those matching a trigger type
- `batch_set_reactions` — wire an entire screen's navigation (nav links, card clicks, button targets) in a single call

For transition types, easing, and Smart Animate specifics, see [[Animation-and-Prototyping]].

## Flows and prototype links

Available only when the server runs with `L2F_FLOWS=1` (or `L2F_ALL=1`). A flow is a named starting point on a page.

- `get_flows` — every flow on a page: name, starting frame id and name, the top-level section it sits in, and the page's prototype background. A flow whose starting frame no longer exists is listed with `missing: true` rather than dropped.
- `set_flows` — replace all flows on a page. The list is assigned whole, so the same call twice gives the same page and `flows: []` clears them. Every node must be a top-level frame on that page (directly on the page, or inside sections only); otherwise nothing is written and the bad ones are listed. `background` is one solid colour, `#RRGGBB` or `#RRGGBBAA`. Refused in Dev Mode.
- `get_prototype_links` — one link per flow, optionally only the flows in one top-level section (`sectionId`). Needs the file key: the plugin reports it, or pass `fileKey` to `join_channel` (a development plugin does not report one; that parameter exists only with `L2F_FILE_KEY=1`). The link format, `https://www.figma.com/proto/<key>/<file name>?node-id=<id>&starting-point-node-id=<id>`, is unconfirmed: compare it with a link copied from Figma before relying on it.

The prototype device is not in the plugin API, so it is still set by hand. Feeding `get_flows` output back into `set_flows` is a no-op, which makes it a quick check after editing flows. See [File key](plans/2026-11-12-figma-api-catch-up.md#pr-2-file-key) for where the key comes from.

## Flow visualization (FigJam connectors)

- `set_default_connector` — copy a FigJam connector's appearance as the template for subsequent connections
- `create_connections` — draw connector lines between node pairs, with optional labels

The `reaction_to_connector_strategy` MCP prompt walks through converting live prototype wiring into a readable flow map: `get_reactions` → `set_default_connector` → `create_connections`.

## Annotations

- `get_annotations` — all native annotations on the document or a node, optionally with category metadata
- `set_annotation` — create/update one native annotation with markdown content and optional category
- `set_multiple_annotations` — batch create/update to avoid per-annotation round-trips
- `scan_nodes_by_types` — find annotation targets (e.g. all `INSTANCE` nodes) under a root

To convert legacy manual annotations (numbered markers + text) into native ones: scan text nodes for markers, match to targets by path/name/proximity, batch-create with `set_multiple_annotations`, then delete the legacy nodes.

---

## Related

- [[Animation-and-Prototyping]] — transitions, Smart Animate, easing, and the animation workflow
- [[Tools-Reading-and-Inspection]] — reading the screens you're wiring together
- [[Tools-Batch-Operations]] — batch patterns beyond reactions
- [[Roadmap#animation--motion|animation roadmap]] — planned deeper animation support
