# Design Round Trip

**Tags:** `guide` · `workflow` · `inspection` · `performance`

Patterns for the fast back-and-forth between Claude and Figma that makes AI-driven design feel like pairing with a designer instead of dictating to a robot.

## The core loop

```
read → plan → mutate (batched) → verify visually → repeat
```

1. **Read** — `get_document_info` for orientation, then `read_my_design`/`get_selection` for what the user is pointing at
2. **Plan** — decide the full set of changes before touching the canvas
3. **Mutate** — one batched call (`create_node_tree`, `batch_mutate`, `design_query` with updates, `set_properties`) instead of many small ones
4. **Verify** — `export_node_as_image` or `screenshot_region`, and *look at the result*; numbers lie, pixels don't

## Selection as a shared pointer

The user's selection is the cheapest communication channel. `read_my_design` reads it without parameters; `set_focus`/`set_selections` write it back — use them to *show* the user what you changed or where a problem is, instead of describing node IDs.

## Semantic edits over positional edits

For components and structured frames, `introspect` returns every editable surface keyed by a semantic path (`badge.text`, `header.fill`). Working at that level survives structural changes and reads like design intent. Pair with `set_properties` for one-call application. See [[Tools-Components#introspection--semantic-editing|introspection & semantic editing]].

## Rules-based sweeps

`design_query` merges find-and-fix into one call — "every TEXT named `label` → 12px, gray" is one round-trip, not a scan plus N edits. Combine with `scan_node_styles`'s `boundVariable` flag to sweep for hardcoded colors that should be token-bound.

## Safety in iteration

- Dry-run first where offered: `migrate_instance`, `optimize_structure`, `batch_migrate`
- `undo`/`redo` (up to 50 steps) make aggressive iteration safe
- `figma_eval` for one-off inspections that no tool covers — read-only evals are risk-free

## Annotating decisions

Native annotations (`set_annotation`, `set_multiple_annotations`) let Claude leave design rationale *in the file* — spacing rules, token choices, accessibility notes — where the next designer (or the next Claude session) will find them via `get_annotations`.

---

## Related

- [[Tools-Reading-and-Inspection]] — the read and verify halves of the loop
- [[Tools-Batch-Operations]] — the mutate half, batched
- [[HTML-to-Figma#verification|HTML conversion verification]] — the loop applied to conversions
- [[Roadmap#round-trip-acceleration|Round-trip roadmap]] — planned tools to tighten this loop further
