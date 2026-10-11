---
name: draw-in-figma
description: Use when the user wants Claude to read, build or edit designs in the Figma file they have open, using the claude-to-figma (ClaudeToFigma) tools. Covers connecting, reading the file's variables and components first, building with auto layout and real component instances, and checking the result.
---

# Working in Figma with claude-to-figma

These tools act on the Figma file where the user has the **Claude to Figma Plugin** open. Every change is a real Figma edit the user sees live, and `undo` reverses it.

## 1. Connect

Just call a tool. The connection joins the open file by itself, and the relay starts by itself when this is installed as a plugin.

- "No Figma file is connected": ask the user to open the file in the Figma desktop app and run Plugins → Development → Claude to Figma Plugin. Call `setup_status` for the exact import path if the plugin isn't listed yet.
- "Several Figma files are connected": ask which file, then call `join_channel` with the channel name its plugin window shows.

## 2. Read before you write

Always learn the file's system before creating anything:

1. `get_document_info`: current page and top-level frames.
2. `read_my_design` (or `get_selection`): what the user selected. Start from it when they say "this".
3. `get_local_variables`: color, number and string tokens. Note the `Collection/Name` of each.
4. `get_local_components`: components and their `id` (local) or `publishedKey` (library).
5. `get_styles`: text and effect styles.

Tell the user what you found that you'll use, and anything the request needs that the file doesn't have.

## 3. Build with the system

- **Structure with one `create_node_tree` per section.** Use frames with `layoutMode`, `itemSpacing`, padding and `layoutSizingHorizontal`/`Vertical` (`HUG`, `FILL`, `FIXED`). Avoid absolute x/y inside auto layout.
- **Bind colors to variables.** Write `"$var:Collection/Name"` in any color field. Use hex only when the file has no matching variable, and say so.
- **Use real components.** Place them with `create_component_instance` (`componentId` for local, `componentKey` for library) using the frame's `parentId`. Set them up with `properties`, `textOverrides`, `swap_instance_variant` or `set_component_properties`. Never redraw something that exists as a component.
- **Name every layer** by its role ("Header / Actions", not "Frame 12").
- **Standard sections** (hero, feature grid, pricing and similar): try `get_section_templates` and `build_page_section` first. They use far fewer tokens.
- **Changing an existing tree:** pass `rootId` to `create_node_tree` (sync mode) rather than rebuilding. Use `design_query` or `batch_mutate` for bulk edits.
- Text defaults to Inter. Set `fontFamily` only to a font the file already uses.

Work one section at a time on large screens, and check each before the next.

## 4. Check your work

- Look at it: `export_node_as_image` (or `screenshot_region`) on the frame you built, and compare with what was asked.
- Lint it: `scan_node_styles` on the frame. Any color with `boundVariable: false` is hardcoded, so rebind it to a variable.
- Report what you built, which components and variables you used, and anything you had to approximate.

## Safety

- `figma_eval` runs arbitrary code in the file and can delete anything. Use it only when no other tool can do the job, and tell the user what the code does before running it.
- Use `delete_node`, `delete_multiple_nodes` and `prune: true` only on nodes the user asked to remove.
- Run component migrations (`migrate_instance`, `batch_migrate`) with dry-run first and show the user the result.
