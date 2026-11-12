# Animation and Prototyping

**Tags:** `guide` · `animation` · `prototyping` · `figma-api`

How to design motion with claude-to-figma today, and what Figma's 2025–2026 animation platform (Figma Motion, spring easing, the beta `figma.motion` Plugin API) makes possible next.

## What's new in Figma

Figma's animation surface changed dramatically at Config 2026 (June 2026):

- **Figma Motion** — a first-class keyframe timeline on the design canvas: position, scale, rotation, opacity, and anchor-point tracks; 8 Bézier curve types and 4 spring presets; reusable **animation styles** (motion presets that propagate like design-system primitives) and **motion variables** (easing tokens with modes). Timelines export to MP4, WebM, animated SVG, and GIF, and Dev Mode's Motion tab emits CSS/`@keyframes`, JSON, React, and motion.dev code.
- **`figma.motion` Plugin API (beta, Update 127)** — plugins can now read and write real animation: `figmaAnimationStyles()`, `applyAnimationStyle(styleId, {duration, timelineOffset})`, `applyManualKeyframeTrack()`, `setTimelineDuration()`, plus readable `animations`, `manualKeyframeTracks`, and `timelines` properties, and `physicalSpringToNormalized()` for spring conversion.
- **Spring easing everywhere** — prototype transitions support easing types `GENTLE`, `QUICK`, `BOUNCY`, `SLOW`, and `CUSTOM_SPRING` (parameterized by mass/stiffness/damping/initialVelocity) alongside `CUSTOM_CUBIC_BEZIER` and the classic ease curves.
- **Grid auto layout** — `layoutMode: 'GRID'` with row/column counts, sizes, spans, and auto tracks: a faithful target for CSS `display: grid` (see [[HTML-to-Figma#css-fidelity|CSS fidelity]]).

## What the tools support today

The reaction tools ([[Tools-Prototyping-and-Annotations]]) wire triggers to actions with transitions:

- **Triggers**: `ON_CLICK`, `ON_HOVER`, etc.
- **Actions**: `NAVIGATE`, `OVERLAY`, `BACK`, `URL`, …
- **Transitions**: `DISSOLVE`, `SMART_ANIMATE`, and directional types (`MOVE_IN/OUT`, `PUSH`, `SLIDE_IN/OUT`) with direction, duration, and easing

A working animation recipe with today's tools:

1. Build screen A; `clone_node` it and mutate the clone into state B (Smart Animate matches layers by name — keep names identical)
2. `set_reactions` on the trigger element: `NAVIGATE` to B with `SMART_ANIMATE` and an easing + duration
3. `batch_set_reactions` to wire a whole flow at once
4. `get_interactions` to audit the result with resolved destination names

## Known gaps (tracked on the Roadmap)

The current Zod schemas lag the Plugin API:

- Spring easing presets and `easingFunctionSpring` are not yet accepted (the plugin passes easing objects through, so this is mostly schema work)
- `SCROLL_ANIMATE` transition type is missing
- No `flowStartingPoints` support — a generated prototype can't declare its entry screen
- `CONDITIONAL` actions can't express their condition blocks
- No `figma.motion` tools yet — timeline keyframes, animation styles, and motion variables are unreachable

See [[Roadmap#animation--motion|the animation roadmap]] for the planned tool family (`set_animation`, `get_timeline`, `set_flow_starting_point`, spring easing schema).

## Fine-tuning animations with Claude

The near-term workflow this unlocks: describe motion in natural language ("cards should stagger in with a gentle spring"), have Claude apply animation styles or keyframe tracks via the beta API, export a video for review, and iterate — the same [[Design-Round-Trip|round-trip loop]] used for static design, applied to motion. CSS `@keyframes` in an HTML prototype now have a native Figma representation to map onto, extending [[HTML-to-Figma]] from static screens to animated ones.

---

## Related

- [[Tools-Prototyping-and-Annotations]] — today's reaction and interaction tools
- [[Roadmap#animation--motion|Animation roadmap]] — the planned motion tool family
- [[HTML-to-Figma]] — where CSS animation mapping will plug in
- [[Design-Round-Trip]] — the iterate-and-verify loop applied to motion
