---
name: setup
description: Set up or troubleshoot the claude-to-figma connection between Claude Code and the Figma desktop app.
disable-model-invocation: true
---

# Set up Claude to Figma

Walk the user through this one step at a time, checking each before moving on.

1. Call `setup_status` and read its `next` field.
2. If the relay isn't running and Bun is missing, ask the user to install Bun with `curl -fsSL https://bun.sh/install | bash`, then restart Claude Code.
3. If no Figma file is connected, the user needs the Figma **desktop app** (development plugins don't run in the browser):
   - First time only: Plugins → Development → Import plugin from manifest…, then choose the `figmaPluginManifest` path from `setup_status`. Give them the exact path to paste.
   - Every time: open the design file and run Plugins → Development → Claude to Figma Plugin. It connects by itself.
4. Call `setup_status` again. When it says "Ready", call `get_document_info` and tell the user the page name and what's on it, so they can see it works.

If the user also set up claude-to-figma from the repo before (`bun setup --user`), they have the tools twice. Suggest removing the old entry with `claude mcp remove ClaudeToFigma` and restarting.
