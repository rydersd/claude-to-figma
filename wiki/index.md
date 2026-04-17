# Wiki Index

> Auto-maintained by Claude. Last updated: 2026-04-16. Articles: 2.
> Purpose: non-obvious knowledge about the claude-to-figma bridge — architecture decisions, patterns, and gotchas that wouldn't be obvious from reading code.

## Recent

- 2026-04-16: [Event Streaming](concepts/event-streaming.md) — Bidirectional events (selection/node/page) from Figma → Claude via poll tools. Tags: architecture, events, mcp
- 2026-04-16: [SF Symbol Icon Extraction](concepts/sf-symbol-icon-extraction.md) — Exact SF Symbols → Figma via `NSSymbolImageRep.outlinePath`, never PDF. Tags: icons, figma, sf-symbols

## Concepts

- [Event Streaming](concepts/event-streaming.md) — How `figma_events_subscribe` / `figma_events_poll` work; priority buffer, plugin operation guard, listener lifecycle, known limitations (undo/redo, DELETE nodeName, multiplayer REMOTE).
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
