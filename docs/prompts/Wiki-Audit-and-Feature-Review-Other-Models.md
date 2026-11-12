# Wiki Audit and Feature Review Other Models

**Tags:** `reference` · `prompts` · `agents`

The same task as [[prompts/Wiki-Audit-and-Feature-Review-Fable]], rewritten for models that need the scaffolding made explicit — Claude Opus 4.8, Sonnet 5, Haiku 4.5, or non-Claude models. Everything a Mythos-class model does unprompted (verify claims, detect stale docs, distrust training data for recent APIs, validate links mechanically, prioritize) is spelled out as instructions, because these are exactly the steps other models skip.

## The prompt

```text
You are working in the claude-to-figma repo: an MCP server that lets an AI agent
drive Figma (convert HTML prototypes into Figma screens, iterate on designs).
Complete the four phases below IN ORDER. Do not skip the verification steps —
they are the point.

PHASE 0 — Ground truth (do this before writing anything):
- The docs may be stale. Enumerate the ACTUAL tool surface from source:
  grep for tool registrations in src/claude_to_figma_mcp/tools/*.ts and the
  command dispatcher cases in src/claude_figma_plugin/src/main.ts.
- Diff that list against README.md. Keep a list of tools that exist in code
  but not in docs, and vice versa. Any tool that exists on the MCP side but
  has no dispatcher case in the plugin is a BUG — verify by grep, then record it.
- There is no existing wiki. Do not claim to have "reviewed" one. You are
  creating docs/ from scratch.

PHASE 1 — Wiki:
- Create docs/ with: Home.md (index), _Sidebar.md, _Footer.md, a Getting
  Started page, an Architecture page, tool reference pages grouped by task,
  deep-dive pages for the HTML→Figma pipeline and animation, and a Roadmap.
- Use GitHub wiki link syntax [[Page-Name]] (file names Title-Case-With-Dashes.md).
  Every page: an H1, an intro paragraph, and a "## Related" section with 3–6
  links and a one-line reason each.
- Every page must be linked from Home.md. AFTER writing, verify links with a
  script that extracts every [[...]] target and checks a matching .md file
  exists. Fix all failures. Do not declare done while any link is broken.

PHASE 2 — Feature audit:
- Read the plugin modules and MCP tool files. For each proposed feature, you
  MUST cite the file (and line where possible) proving what exists today.
  If you cannot point to code, label the claim ASSUMED, not confirmed.
- Focus areas, in priority order: (a) HTML→CSS features the converter drops
  (images, gradients, shadows, grid, absolute positioning, fonts, component
  instances); (b) animation/prototyping gaps vs the Figma Plugin API's
  Reaction/Transition/Easing types; (c) tools that would cut round-trips in
  the read→mutate→verify loop (batch exports, event push, diffing).
- Output: a prioritized table with feature, why, evidence, effort (S/M/L).

PHASE 3 — API research:
- Your training data on Figma APIs is probably OUT OF DATE. Search the web for
  Figma Plugin API changelog 2025–2026, Figma Config 2026 announcements, and
  the figma.motion / Motion timeline APIs. Cite a URL for every claim about a
  new API. If you cannot verify a capability with a current source, say so
  explicitly rather than asserting it.
- Update the wiki's animation page and the Roadmap with what you verified.

PHASE 4 — Report:
- End with: (1) the single fix you would make first and why, (2) the top 5
  features by effort-to-impact, (3) anything you could not verify.
- Do not commit or push. Leave changes in the working tree.

Definition of done — all must be true:
[ ] Tool docs generated from source, not copied from the README
[ ] Link-check script run, zero broken [[links]]
[ ] Every audit claim has a file citation or an ASSUMED label
[ ] Every API claim has a 2025–2026 source URL
[ ] The four-part report is the final output
```

## What was added for these models, and why

| Addition | The failure it prevents |
|---|---|
| Phase 0 ground-truth pass | Documenting the stale README as if it were the code; missing undocumented tools |
| "No existing wiki — do not claim to have reviewed one" | Hallucinated compliance with a false premise |
| Mandatory file citations / `ASSUMED` labels | Confident audit findings that don't survive a look at the source |
| "Training data is probably out of date" + URL-per-claim | Answering 2026 API questions from 2024 memory |
| Mechanical link-check with an explicit fail condition | "Looks right" link QA; broken wikis that render fine in a diff view |
| Ordered phases and a done-checklist | Dropping the buried tasks (prompt evaluation was lost in the original run-on ask) |
| Fixed report shape | A tour of work done instead of a decision-ready summary |

Keep the mission/context paragraph verbatim across all variants — intent is the one input every model needs.

---

## Related

- [[prompts/Wiki-Audit-and-Feature-Review-Fable]] — the outcome-shaped variant this scaffolds
- [[prompts/Prompt-Library]] — evaluation of the original prompt and the calibration rule
- [[Roadmap]] — reference output: what a correct run of this prompt should resemble
