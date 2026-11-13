# Wiki Index

> Auto-maintained by Claude. Last updated: 2026-11-13. Articles: 6.
> Purpose: non-obvious knowledge about the llm2figma bridge — architecture decisions, patterns, and gotchas that wouldn't be obvious from reading code.

## Recent

- 2026-11-13: [Callouts](concepts/callouts.md) — why rail leaders never cross, the settle loop, sections that must not grow, annotations with no id, cloned connectors, re-runs that never delete. Tags: callouts, annotations, connectors
- 2026-11-12: [Dev Mode](concepts/dev-mode.md) — which Dev Mode writes Figma allows, the manifest it needs, inherited dev resources, measurement limits. Tags: dev-mode, figma
- 2026-11-12: [Spec sync](concepts/spec-sync.md) — Spec and SpecLock design, one normaliser for both sides, why absent paint means none, truncation vs deletion, the shared variable-index test trap. Tags: spec-sync, testing
- 2026-11-12: [Geometry verification](concepts/geometry-verification.md) — silent `resize()`, why containment passes on misplaced section children, plugin-side snapshots. Tags: verification, figma
- 2026-04-16: [Event Streaming](concepts/event-streaming.md) — Bidirectional events (selection/node/page) from Figma → Claude via poll tools. Tags: architecture, events, mcp
- 2026-04-16: [SF Symbol Icon Extraction](concepts/sf-symbol-icon-extraction.md) — Exact SF Symbols → Figma via `NSSymbolImageRep.outlinePath`, never PDF. Tags: icons, figma, sf-symbols

## Concepts

- [Callouts](concepts/callouts.md) — `L2F_CALLOUTS` design: rail layout and its no-crossing argument, section-relative placement, the `Callout <key>:` annotation marker, connector templates, archive on re-run, unconfirmed live behaviour.
- [Dev Mode](concepts/dev-mode.md) — `L2F_DEV_MODE` gotchas: the editor gate's Dev Mode exceptions, `dev` + `inspect` in the manifest, inherited resources and duplicates, current-page measurements, link validation without `URL`.
- [Event Streaming](concepts/event-streaming.md) — How `figma_events_subscribe` / `figma_events_poll` work; priority buffer, plugin operation guard, listener lifecycle, known limitations (undo/redo, DELETE nodeName, multiplayer REMOTE).
- [Geometry verification](concepts/geometry-verification.md) — `L2F_VERIFY` gotchas: resize read-back causes, `absoluteBoundingBox` containment and its blind spot for section offsets, snapshot expiry.
- [Spec sync](concepts/spec-sync.md) — `L2F_SPEC_SYNC` design: shared normaliser, SpecLock props equal Spec nodes, defaults that 11d must apply on create, variable refs that must resolve back, truncated OpaqueNodes; plan_spec (11c): live read through the same normaliser, forced-opaque cut-offs, minimal moves, derived-key check.
- [SF Symbol Icon Extraction](concepts/sf-symbol-icon-extraction.md) — Use `NSSymbolImageRep.outlinePath` for exact vector geometry. Do not route through PDF (Quartz flattens to image XObjects). Summary of llm-tooling pattern with forward link.

## References

_(None yet — add when summarizing external articles, papers, or repos.)_

## Outputs

_(None yet — generated artifacts like slides, diagrams, renders.)_

## Cross-References to llm-tooling

This project's wiki links to the global knowledge base at `~/Developer/GitHub/llm-tooling/` for cross-project patterns.

- Global index: `/Users/ryders/Developer/GitHub/llm-tooling/index.md`
- Icon extraction pattern: `/Users/ryders/Developer/GitHub/llm-tooling/patterns/apple-symbol-outline-extraction.md`
- Project backlink: `/Users/ryders/Developer/GitHub/llm-tooling/projects/claude-to-figma.md`

## Conventions

- `concepts/` — durable explanations of how something works or why a decision was made
- `references/` — summaries of external sources (articles, papers, repos)
- `raw/` — original clipped content, screenshots, papers (gitignored by default)
- `outputs/` — generated artifacts (HTML, diagrams, slides)
- Each article leads with frontmatter (brief, tags, created, updated) and includes a "See Also" section
- Index lines are single-line with 1-sentence summary — LLM should be able to decide whether to read the full article without reading it first
