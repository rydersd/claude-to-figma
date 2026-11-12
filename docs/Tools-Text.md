# Tools Text

**Tags:** `reference` · `tools` · `text` · `typography`

Tools for reading and editing text: content replacement, fonts, alignment, native lists, and character-range rich formatting.

## Content

- `scan_text_nodes` — all text nodes under a root, with chunked responses for large trees
- `set_text_content` — replace the text of a single node, loading the required font automatically
- `set_multiple_text_contents` — replace text on many nodes in one call, each by node ID

## Fonts & sizing

- `set_font_family` — change font family and style (e.g. "Inter", "Bold")
- `set_text_auto_resize` — how the node resizes to fit content: `NONE`, `WIDTH_AND_HEIGHT`, `HEIGHT`, or `TRUNCATE`

## Alignment & decoration

- `set_text_align` — horizontal (LEFT, CENTER, RIGHT, JUSTIFIED) and/or vertical (TOP, CENTER, BOTTOM) alignment
- `set_text_decoration` — underline, strikethrough, or none (now a `batch_mutate` op — see [[Tools-Batch-Operations#mixed-mutations-batch_mutate|batch_mutate]])

## Paragraph & node-level formatting

- `set_text_format` — line height, paragraph indent/spacing, letter spacing, text case (including SMALL_CAPS), leading trim, hanging punctuation/list, list spacing, truncation, max lines
- `set_text_list` — native Figma ordered/unordered list formatting with per-line type and indentation for nested lists

## Rich text (character ranges)

- `set_range_format` — formatting for specific character ranges: font family/size/style, color, text case, decoration, letter spacing, line height, list type, indentation, and hyperlinks. This is the tool for mixed bold spans, colored words, and inline links inside a single text node.

## Workflow tips

- Scan first, then batch: `scan_text_nodes` → `set_multiple_text_contents` beats one-at-a-time edits by an order of magnitude on large screens
- Verify with a targeted `export_node_as_image` after bulk text changes (see [[Design-Round-Trip]])

---

## Related

- [[Tools-Creating-Elements#single-elements|create_text]] — creating text nodes in the first place
- [[Tools-Batch-Operations]] — `batch_mutate` also supports `set_text` operations
- [[Design-Round-Trip]] — verifying text changes visually
- [[Tool-Reference]] — back to the full catalog
