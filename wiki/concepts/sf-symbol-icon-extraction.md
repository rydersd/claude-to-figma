# SF Symbol Icon Extraction → Figma

> Brief: When a macOS/iPadOS app renders icons via `Image(systemName:)`, extract the exact vector outline with `NSSymbolImageRep.outlinePath` and feed the SVG into Figma. Never approximate by hand. Never route through PDF — Quartz flattens SF Symbols to image XObjects.
> Tags: icons, figma, sf-symbols, svg, vectors, design-system-sync
> Created: 2026-04-16
> Updated: 2026-04-16
> Source: [llm-tooling/patterns/apple-symbol-outline-extraction.md](/Users/ryders/Developer/GitHub/llm-tooling/patterns/apple-symbol-outline-extraction.md) (first discovered 2026-04-15 during illtool-standalone design-system sync)

## Why This Matters For claude-to-figma

The `icons-to-figma` skill currently exports SF Symbols via AppleScript UI automation of the SF Symbols app + clipboard copy. That pipeline is brittle (requires `cliclick`, Accessibility permissions, and the SF Symbols app GUI). The `outlinePath` approach is a higher-fidelity alternative that reads the vector directly from AppKit without touching the GUI.

When `claude-to-figma` is used to build a design-system mirror of a real macOS/iPadOS app, the icons in Figma **must match what the app renders**. Approximate SVGs drift in stroke weight, corner behavior, optical alignment, and negative space. If the app renders Apple's outlines, the Figma inventory must use those outlines too.

## The Pattern (summary)

Source of truth: `NSSymbolImageRep.outlinePath` — a real `NSBezierPath` that can be converted to SVG.

```swift
import AppKit

let image = NSImage(systemSymbolName: "cursorarrow", accessibilityDescription: nil)!
let configured = image.withSymbolConfiguration(
    .init(pointSize: 17, weight: .semibold)
) ?? image

let rep = configured.representations[0]
guard let outline = rep.value(forKey: "outlinePath") as? NSBezierPath else {
    fatalError("No outlinePath available for symbol")
}
```

Then convert `NSBezierPath` elements:

- `.moveTo` → `M x y`
- `.lineTo` → `L x y`
- `.curveTo` → `C x1 y1 x2 y2 x y`
- `.closePath` → `Z`

Normalize to a local origin using `outlinePath.bounds`, flip Y if your exporter requires it, emit as a single `<path d="..." />` (or multi-path SVG for composite symbols), push into Figma via existing tools.

## What Not To Do

### ❌ PDF-first extraction

Do not export the symbol as PDF and then parse the PDF. Quartz PDF generation for `NSImage(systemSymbolName:)` often flattens to `/Subtype /Image` and `/XObject` image resources instead of preserving Bézier path operators. The PDF looks vector-friendly externally but is the wrong source.

### ❌ Hand-built approximations

Drift shows up in stroke weight, corner behavior, optical alignment, fill proportions, and internal negative space. Even "simple" symbols like `circle` or `square` should come from `outlinePath`.

## Config Rules

- Use the same point size, weight, and variant as the app renders
- If a symbol doesn't resolve on the current OS, **leave the slot empty** — don't substitute a guess
- The internal resolved glyph name can differ from the system symbol name (e.g. `cursorarrow` → `pointer.arrow`). Record both for debugging

## Integration Options For This Project

Two paths to bring this into `claude-to-figma`:

1. **Upgrade `icons-to-figma` skill** — replace the SF Symbols app GUI automation with a small Swift helper binary that takes symbol name + size + weight, writes SVG to stdout. Then call that binary from the skill pipeline.
2. **New dedicated tool** — add a Figma plugin command `import_sf_symbol` that accepts a pre-rendered SVG and places it as a vector node. Keep extraction upstream.

Option 1 is the better long-term fix — it replaces the brittle part of the existing skill.

## See Also

- **Source article:** [llm-tooling/patterns/apple-symbol-outline-extraction.md](/Users/ryders/Developer/GitHub/llm-tooling/patterns/apple-symbol-outline-extraction.md) — full pattern with all examples and failure modes
- **Reference code:** `~/Developer/GitHub/illtool-standalone/apple/IllStandalone/ToolGlyphs.swift` (outside this repo) — example of SF Symbols as app UI source of truth
- **Related skill:** `/icons-to-figma` (user-invocable) — current clipboard-based pipeline that this pattern could replace
