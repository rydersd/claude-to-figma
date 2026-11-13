---
name: draw-in-figma
description: Use when the user wants Claude to read, build or edit designs in the Figma file they have open, using the llm2figma (LLM2Figma) tools. Covers connecting, reading the file's variables and components first, building with auto layout and real component instances, and checking the result.
---

# Working in Figma with llm2figma

These tools act on the Figma file where the user has the **llm2figma** plugin open. Every change is a real Figma edit the user sees live, and `undo` reverses it.

## 1. Connect

Just call a tool. The connection joins the open file by itself, and the relay starts by itself when this is installed as a plugin.

- "No Figma file is connected": ask the user to open the file in the Figma desktop app and run Plugins → Development → llm2figma. Call `setup_status` for the exact import path if the plugin isn't listed yet.
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

- **Structure with one `create_node_tree` per section.** Use frames with `layoutMode`, `itemSpacing`, padding and `layoutSizingHorizontal`/`Vertical` (`HUG`, `FILL`, `FIXED`). Avoid absolute x/y inside auto layout. Any frame with more than one child gets auto layout; absolute x/y is only for diagrams and connectors. If the result has `layoutWarnings`, fix those frames before moving on, or tell the user why they are absolute.
- **Bind colors to variables.** Write `"$var:Collection/Name"` in any color field. Use hex only when the file has no matching variable, and say so.
- **Use real components.** Place them with `create_component_instance` (`componentId` for local, `componentKey` for library) using the frame's `parentId`. Set them up with `properties`, `textOverrides`, `swap_instance_variant` or `set_component_properties`. Never redraw something that exists as a component. When you have built the same element three times, make it a component and swap the copies for instances.
- **Name every layer** by its role ("Header / Actions", not "Frame 12").
- **Standard sections** (hero, feature grid, pricing and similar): try `get_section_templates` and `build_page_section` first. They use far fewer tokens.
- **Changing an existing tree:** pass `rootId` to `create_node_tree` (sync mode) rather than rebuilding. Use `design_query` or `batch_mutate` for bulk edits.
- Text defaults to Inter. Set `fontFamily` only to a font the file already uses.

Work one section at a time on large screens, and check each before the next.

## Callouts and design reviews

- Use `place_callouts` for callouts, review notes and annotated walkthroughs (it needs the server flag `L2F_CALLOUTS`). It puts the labels in rails beside the frame, joins each to its target with an orthogonal leader, and adds each one to the target's native annotations so developers see it in Dev Mode. Never draw callouts with `create_line` or diagonal vectors across the design: they cover what people are reviewing.
- Give each callout a stable `key`, and to change the callouts call `place_callouts` again with the full list: callouts are matched by key and updated in place, and ones you leave out are archived, never deleted.
- Tell the user about anything in `overflow`: those callouts had no room beside the frame. Above 12 callouts it switches to numbered badges and a numbered list on its own.
- Paste one FigJam connector into the file to get draggable leaders: with a connector to clone (or one chosen with `set_default_connector`), leaders are real connectors that stay attached when things move. Figma routes their elbows, so only drawn leaders are guaranteed never to cross.

## 4. Check your work

- Look at it: `export_node_as_image` (or `screenshot_region`) on the frame you built, and compare with what was asked.
- Lint it: `scan_node_styles` on the frame. Any color with `boundVariable: false` is hardcoded, so rebind it to a variable.
- Report what you built, which components and variables you used, and anything you had to approximate.

## Safety

- `figma_eval` runs arbitrary code in the file and can delete anything. Use it only when no other tool can do the job, and tell the user what the code does before running it.
- Use `delete_node`, `delete_multiple_nodes` and `prune: true` only on nodes the user asked to remove.
- Run component migrations (`migrate_instance`, `batch_migrate`) with dry-run first and show the user the result.

## Report tool problems

When an llm2figma tool errors, returns wrong or partial results, lacks something you needed, or forces a `figma_eval` workaround, tell the user, then file it on GitHub with the `l2f-feedback` label: search open issues first (`gh issue list -R rydersd/claude-to-figma --label l2f-feedback --search "<tool>"`) and comment on a match, otherwise `gh issue create -R rydersd/claude-to-figma --label l2f-feedback`. Include the tool, the call, what happened against what you expected, and the workaround. The repository is public: describe only the tool's behaviour, never file names or keys, layer names, client, company or project names, or design content.
