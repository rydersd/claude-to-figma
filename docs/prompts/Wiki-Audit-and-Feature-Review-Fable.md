# Wiki Audit and Feature Review Fable

**Tags:** `reference` · `prompts` · `agents`

The prompt as it should have been written for Claude Fable 5 (or another Mythos-class agent with skills, subagents, and web research available). Outcome-shaped: it states intent, deliverables, and quality bars, and leaves decomposition, parallelization, and verification to the model.

## The prompt

```text
Context: this repo drives Figma like a designer through an MCP server — its mission
is converting HTML prototypes into Figma screens and making Claude↔Figma iteration
fast enough to design interactively. Figma shipped major animation features recently
(a keyframe timeline and new plugin APIs); we want to exploit them.

Do four things, in whatever order and with whatever parallelism makes sense:

1. Wiki: our docs are scattered (README, AGENTS.md, CLAUDE.md). Build a proper
   cross-linked wiki in docs/ using GitHub wiki conventions ([[Page]] links).
   Quality bar: every page reachable from Home, every link resolves (validate
   mechanically, not by eye), and the tool docs must reflect the code as it is
   today — the README has drifted, so enumerate tools from source, not from
   existing docs.

2. Feature audit: review the code against the mission and propose the obvious
   next features, prioritized by effort-to-impact. Ground every claim in the
   source (file:line) — if you find something implemented-but-broken, verify it
   before reporting it. I care most about: HTML→Figma fidelity gaps, animation
   support, and anything that tightens the read→mutate→verify loop.

3. API research: find what's actually new in the Figma Plugin/REST/MCP APIs
   (2025–2026), especially animation — use current web sources, not training
   data, and cite them. Fold what you find into both the wiki and the audit.

4. Prompts: evaluate this prompt itself. Save the version you'd have written
   in docs/prompts/, plus a variant optimized for less capable models that
   makes explicit the things they wouldn't do unprompted (verification,
   staleness checks, done-criteria).

Deliverables: the docs/ wiki, a Roadmap page with the prioritized features,
and the two prompt files. Don't commit — leave the tree for my review.
Lead your summary with what you'd fix first and why.
```

## Why it's shaped this way

- **Intent before instructions** — the mission paragraph does more work than any process step; it's what lets the model rank findings instead of listing them.
- **Quality bars, not procedures** — "validate mechanically, not by eye" and "enumerate tools from source" name the standard and let the model choose the method (a link-check script, a grep of `server.tool(` registrations).
- **Known traps disclosed** — "the README has drifted" and "verify before reporting" convert the two likeliest failure modes (documenting stale docs, repeating an unverified subagent claim) into explicit checks.
- **Parallelism permitted, not prescribed** — a Fable-class agent will fan out research and code review as background agents on its own; saying "whatever parallelism makes sense" unlocks that without micromanaging it.
- **Ends with the report shape** — "lead with what you'd fix first" forces a prioritized conclusion rather than a tour of everything done.

---

## Related

- [[prompts/Prompt-Library]] — evaluation of the original prompt this replaces
- [[prompts/Wiki-Audit-and-Feature-Review-Other-Models]] — the same task with process scaffolding for other models
- [[Roadmap]] — what running this prompt actually produced
