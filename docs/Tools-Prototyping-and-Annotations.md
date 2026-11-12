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
