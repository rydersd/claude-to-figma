# Claude to Figma Wiki

> Documentation for claude-to-figma: an MCP server that lets Claude drive Figma like a designer — building screens from HTML prototypes, iterating on live designs, and wiring prototypes and animations.

New here? Start with [[Getting-Started]] to wire up the relay, MCP server, and Figma plugin, then skim [[Tool-Reference]] to see what's callable. This wiki lives in `docs/` and ships with the code.

---

## Setup & concepts

- [[Getting-Started]] — install, register the MCP server, link the plugin, first-session checklist
- [[Architecture]] — the three-process pipeline and its runtime patterns
- [[Troubleshooting]] — connection failures, timeouts, WSL, stale plugin builds
- [[Plugin-Development]] — module map, build commands, adding a new tool

## Tool reference

- [[Tool-Reference]] — hub page: conventions, query/eval power tools, MCP prompts
- [[Tools-Reading-and-Inspection]] — document reads, scanning, queries, screenshots, undo/redo
- [[Tools-Creating-Elements]] — shapes, vectors, SVG, node trees, page sections
- [[Tools-Text]] — content, fonts, rich-text ranges, native lists
- [[Tools-Layout-and-Styling]] — auto layout, fills, strokes, effects, organization
- [[Tools-Components]] — components, variables, introspection, migration
- [[Tools-Prototyping-and-Annotations]] — reactions, connectors, annotations
- [[Tools-Batch-Operations]] — multi-node operations, `batch_mutate`, `figma_eval`

## Workflows

- [[HTML-to-Figma]] — converting HTML prototypes into Figma screens
- [[Create-Node-Tree]] — one-round-trip hierarchies, `$repeat`, `$var:` binding
- [[Animation-and-Prototyping]] — motion design with today's tools and Figma's new animation platform
- [[Design-Round-Trip]] — the read → mutate → verify loop that makes iteration fast

## Project direction

- [[Roadmap]] — prioritized feature audit (July 2026): HTML fidelity, motion tools, round-trip acceleration

## Prompts

- [[prompts/Prompt-Library]] — reusable agent prompts and the calibration lesson behind them
- [[prompts/Wiki-Audit-and-Feature-Review-Fable]] — outcome-shaped audit prompt for Mythos-class models
- [[prompts/Wiki-Audit-and-Feature-Review-Other-Models]] — process-explicit variant for other models

---

## Conventions used in this wiki

- Pages are `Title-Case-With-Dashes.md` in `docs/`; `[[Page-Name]]` links between them, `[[Page-Name#anchor|display text]]` for deep links
- Every page carries a `**Tags:**` line (first tag is the category: `guide` or `reference`) and ends with a `## Related` section
- The wiki is tracked in the main repo — it versions with the code and is reviewed in PRs
