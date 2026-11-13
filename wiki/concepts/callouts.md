# Callouts (L2F_CALLOUTS)

Tags: callouts, annotations, connectors, layout, figma

Design decisions and gotchas behind `place_callouts`. Tool reference: [Tools-Prototyping-and-Annotations](../../docs/Tools-Prototyping-and-Annotations.md#callouts-place_callouts). Code: `src/shared/callouts.ts` (pure layout), `src/llm2figma_plugin/src/callouts.ts` (builder), `src/llm2figma_mcp/tools/callouts.ts` (tool).

## Why rails, not lines

Callouts drawn with `create_line` were diagonals at coordinates the model chose, so they crossed the design people were trying to review. `place_callouts` keeps every label off the frame, in rails beside it, and only the leader enters the frame, to reach its target.

## Why the elbows never cross (vector leaders)

Within one rail the labels keep their targets' order. A leader is a "down" leader when its target is further along the rail than its label anchor, an "up" leader otherwise. Two leaders can only cross where their vertical spans overlap, and with order kept that happens only between two down leaders or two up leaders. Down leaders take elbow lanes moving away from the frame in rail order, up leaders take lanes moving towards it; that ordering is exactly the one in which no horizontal run crosses another leader's elbow. Targets on the same line get attach points spread `MIN_ATTACH_SEPARATION` apart in input order, so ties stay stable and cannot overlap. Leaders from different rails can still meet inside the frame (a top-rail leader dropping past a left-rail leader's run), so a final guard tests every pair of leaders, and every leader against the obstacles, and moves the lower-priority callout (top/bottom before sides) to `overflow` with `crossing` or `blocked`. In 2,000 random layouts that guard fired twice.

## The settle loop

Labels start at their ideal position (level with the target). A downward sweep enforces `gap` and skips past obstacles; an upward sweep pulls back anything that ran off the end of the rail or is too close to the label below. The downward sweep always starts again from the ideal positions, so it is the "pull back towards the target" step, and the loop stops when nothing moves. If obstacles fragment the rail so that the sweeps cannot settle, the rail falls back to a tight pack from the top, which the capacity check already proved fits.

## Sections must not grow

Section children are positioned relative to the section, and a section that grows around a stray child can swallow its neighbours. The builder positions every node with `placeAt`, which subtracts the container's absolute origin (walking past groups, whose children are relative to the group's parent), never `sec.x + offset`. It also passes the four regions outside the section to the layout as obstacles, so no rail ever leaves the section; `verification` checks the group against the section with `absoluteBoundingBox`.

## Native annotations have no id

Figma's `Annotation` has only `label`, `labelMarkdown`, `properties` and `categoryId`: no id, no plugin data. The tool marks its own with a visible prefix, `**Callout <key>:** <text>`, and recognises it with or without the bold markers in case Figma returns plain `label` text. Writing means rewriting the node's whole `annotations` array, so every other annotation is copied back (`labelMarkdown` when present, else `label`, never both, since Figma refuses both). UNCONFIRMED until a live check: that the copy round-trips losslessly (`properties` entries are copied as `{type}` only, which is all the typings declare), and that Figma returns `labelMarkdown` exactly as written, which the "unchanged" check relies on (if it normalises, a re-run rewrites an identical annotation, which is harmless).

## Ownership of annotations is recorded, not inferred

The prefix alone would let the tool rewrite or delete a person's annotation that happens to read `Callout <key>:`. So the group's plugin data stores `annotated` (key to target id) and `labels` (key to the exact markdown written). Only placed callouts are annotated. On every run, any recorded pair that is not written again (dropped key, retargeted key, overflow, unresolved target) has exactly its own annotation removed: the one whose markdown matches what was written, else the last with that prefix, since the tool appends. Unrecorded look-alikes are never touched.

## Runs are all or nothing

Nodes are tagged with plugin data in the builder the moment `figma.create*` or `clone()` returns, so even a half-built run is findable. Before anything moves, every existing part is snapshotted (parent, index, position, name, visibility, text, vector path, connector endpoints). A throw anywhere after that (layout, wiring a connector, `figma.group`, the archive) restores the snapshots, removes every node the run created, then restores layer order lowest index first. Snapshotting everything up front matters: re-appending one label to its rail shifts its siblings' indices, so a lazy snapshot records the wrong order. Targets inside instances are refused before the transaction starts.

## Connector leaders

`figma.createConnector` exists only in FigJam, but a CONNECTOR already in a Figma Design file can be cloned. With `leaderStyle: "auto"` the template is the default connector stored by `set_default_connector` (clientStorage `defaultConnectorId`), else the first connector on the current page. Each clone is wired `connectorStart = {endpointNodeId: label, magnet: <side facing the frame>}`, `connectorEnd = {endpointNodeId: target, magnet: "AUTO"}`, `ELBOWED`, end cap `CIRCLE_FILLED` (the typings' closest thing to a dot). Figma routes connector elbows itself, so the no-crossing guarantee is only for vector leaders. UNCONFIRMED: whether Figma Design lets a connector sit inside a GROUP; if `figma.group` refuses, the connectors stay beside the group and the result says `connectorsOutsideGroup`, and re-runs find them by the `frameId` in their plugin data.

## Re-runs never delete

Every part carries plugin data `{key, part, targetId, frameId}` and the group carries `{frameId}`. A re-run updates matched parts in place; parts that are no longer needed (a dropped key, a vector replaced by a connector, leaders in numbered mode) are renamed `(superseded)`, hidden and moved into `callouts/<frame>/archive`, keeping their canvas position. The only nodes ever removed are labels created in the same call purely to be measured and then found to have no room.

## Measuring labels

Labels are created first (auto layout, fixed width, HUG height, text FILL/HUG) and their size read back before layout. UNCONFIRMED: that Figma reports the new auto-layout height synchronously after `characters` is set; the contract tests model it that way.
