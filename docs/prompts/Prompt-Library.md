# Prompt Library

**Tags:** `reference` · `prompts` · `agents` · `workflow`

Reusable prompts for driving AI agents against this project, plus an evaluation of the original prompt that produced this wiki — kept as a worked example of how prompt explicitness should scale with model capability.

## The original prompt (July 2026)

> "would you review and optimize the wiki with github standard links so that all the documentation links to the other docs, then review the code and look for obvious features to add considering this is supposed to drive figma as a designer and convert html prototypes into figma screens, we can also utiize the new animate features in figma to fine tune and design animations. Review the updates to the api and look for opportunities to facilitate the back and forth between claude and figma to accelerate deisgn. Also, evaluate this prompt and then in the wiki update it to make the best use of your fable skills and features. save the prompt you would have wrote in the wiki /prompts folder …"

### What worked

- **Mission context** — stating the *why* ("drive Figma as a designer", "convert HTML prototypes") let the agent prioritize findings against a goal instead of listing everything.
- **Bundled related goals** — wiki + code review + API research genuinely inform each other; one session produced cross-referenced output no three separate sessions would.
- **Granted autonomy** — no step-by-step recipe, which suits a capable agent with skills for wiki authoring, research fan-out, and code review.

### What a stronger prompt fixes

- **False premises**: "review and optimize the wiki" — no wiki existed. A capable model detects this and pivots to *creating* one; weaker models may hallucinate having reviewed it.
- **Ambiguous referents**: "update it" (the prompt? the wiki?), "the new animate features" (unnamed — resolved by research to Figma Motion, June 2026), "the api" (Plugin API? REST? MCP?).
- **No deliverable shape or done-criteria**: nothing says what "optimized" means (every link resolves? every page reachable from Home?), so quality depends entirely on the agent's own standards.
- **A buried self-referential task**: the prompt-evaluation ask hides at the end of a run-on sentence — easy for any model to drop.

### The calibration lesson

The two prompt variants below encode the same task at two levels of explicitness:

- [[prompts/Wiki-Audit-and-Feature-Review-Fable]] — outcome-shaped, trusts the model to decompose, parallelize, verify, and self-review. Written for Claude Fable 5 / Mythos-class models.
- [[prompts/Wiki-Audit-and-Feature-Review-Other-Models]] — the same task with the scaffolding made explicit: verification steps, anti-hallucination guards, ordered phases, and done-checklists that weaker or non-Claude models won't apply unprompted.

Rule of thumb: **capable models need intent and quality bars; other models need those plus the process.** Never delete the context/mission section — it's the part every model needs.

---

## Related

- [[prompts/Wiki-Audit-and-Feature-Review-Fable]] — the outcome-shaped variant
- [[prompts/Wiki-Audit-and-Feature-Review-Other-Models]] — the process-explicit variant
- [[Home]] — the wiki these prompts produced
- [[Roadmap]] — the feature audit output of the original prompt
