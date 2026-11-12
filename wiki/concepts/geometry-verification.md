# Geometry verification (L2F_VERIFY)

Tags: verification, resize, sections, figma

Gotchas behind `assert_contained`, `snapshot_positions`, `diff_positions` and the resize read-back. Tool reference: [Tools-Reading-and-Inspection](../../docs/Tools-Reading-and-Inspection.md#geometry-verification-l2f_verify).

## `resize()` fails silently

Figma applies what it can and throws nothing. A `minHeight`, a HUG or FILL axis, a `maxWidth` or a text node's auto-resize can each keep a dimension where it was. The only evidence is reading `width` and `height` back, which `resize_node` and `batch_mutate` now do (`requested`, `applied`, `partial`, `cause`). When no known cause fits, the result says "unexplained" rather than guessing. The cause is read after the resize, so it describes the node's state at that moment.

## Containment passes on the bug it should catch

Section children are positioned relative to the section. Setting `child.x = sec.x + 160` instead of `160` puts the child one section-origin away; the section auto-grows to contain it, so a containment check on the boxes passes. Only an offset check against an expectation catches it: `assert_contained` with `expected` (a snapshot id, or `{childId: {x, y}}` offsets from the parent's top-left). The comparison is always `absoluteBoundingBox` of the child against `absoluteBoundingBox` of the parent.

`absoluteBoundingBox` is used, not `absoluteRenderBounds`: render bounds include shadows, which would fail containment for a card whose drop shadow overhangs. A diagonal vector's box is a superset of its ink, so a box that is contained proves the ink is contained; the diagonal false positive matters for overlap and padding checks (PR 11), not here.

## Snapshots are plugin memory

The snapshot store lives in the plugin (30 minutes, 64 entries, oldest evicted) and is lost on plugin reload. An unknown id is reported as "snapshot expired", never as an empty diff, because an empty diff would read as "nothing moved". Ids are always passed explicitly; there is no "latest".

`diff_positions` looks up any snapshot id that left the subtree, so a reparent out of the snapshot root reads as `moved` with `reparented: true`, not `missing`. `missing` means the node no longer exists, which is also how suggest-auto-layout's absorbed rectangles show up, usually beside an `added` wrapper.
