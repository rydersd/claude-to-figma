# Getting Started

**Tags:** `guide` · `setup` · `mcp` · `figma-plugin`

Everything you need to go from a fresh clone to Claude Code driving Figma: install dependencies, start the WebSocket relay, register the MCP server, and link the Figma plugin.

## Prerequisites

Install [Bun](https://bun.sh) if you haven't already:

```bash
curl -fsSL https://bun.sh/install | bash
```

On Windows (PowerShell):

```bash
powershell -c "irm bun.sh/install.ps1|iex"
```

## Quick setup

```bash
bun setup        # installs dependencies and writes .mcp.json
bun socket       # starts the WebSocket relay on port 3055 (keep running)
```

Then in Figma: **Plugins → Development → Link existing plugin** and select `src/claude_figma_plugin/manifest.json`. Run the plugin, join a channel, and start issuing commands from Claude Code. See [[Architecture]] for how the three processes talk to each other.

## Registering the MCP server manually

Add the server to your project's `.mcp.json` (or `~/.claude/.mcp.json` for global access):

```json
{
  "mcpServers": {
    "claude-to-figma": {
      "command": "/opt/homebrew/bin/node",
      "args": ["/path-to-repo/dist/server.js"]
    }
  }
}
```

> **Note:** Use the absolute path to `node` (the output of `which node`) to avoid PATH resolution issues when Claude Code launches the server.

Or via the CLI:

```bash
claude mcp add claude-to-figma -- /opt/homebrew/bin/node /path-to-repo/dist/server.js
```

To run from source with Bun instead of the built output:

```json
{
  "mcpServers": {
    "claude-to-figma": {
      "command": "bun",
      "args": ["/path-to-repo/src/claude_to_figma_mcp/server.ts"]
    }
  }
}
```

## Team library setup

`get_library_components`, `search_library_components`, and `$lib:` refs in [[Create-Node-Tree#library-component-instances-lib-refs|create_node_tree instance nodes]] read published components straight from the Figma REST API (`api.figma.com`), not through the plugin/WebSocket path — see [[Architecture#rest-discovery-team-libraries|REST discovery]]. They need a token in the macOS Keychain and one environment variable:

1. **Create a personal access token** — Figma → Settings → Security → Personal access tokens → generate one with these scopes:
   - **File content: read**
   - **Library content: read**
   - **file_comments:read**
   - **file_comments:write** (for the upcoming comments tools)
2. **Store it in the Keychain** — from the repo, run `bun run token`. It prompts for the token with hidden input (so it never lands in shell history), stores it as service `llm2figma`, account `figma-api-token`, and checks it against Figma. Run it again to replace the token; `bun run token -- --check` only re-checks. The server reads the Keychain on each REST call, so a new token works without a restart.
3. **Find your library file keys** — open each library file in Figma and copy the key out of its URL: `figma.com/design/<FILE_KEY>/...`
4. **Pass the keys through `.mcp.json`** — in the `LLM2Figma` server entry's `env` block (the keys are not secret; the token never goes here):

   ```json
   {
     "mcpServers": {
       "LLM2Figma": {
         "command": "bun",
         "args": ["src/llm2figma_mcp/server.ts"],
         "env": {
           "FIGMA_LIBRARY_FILE_KEYS": "abc123,def456"
         }
       }
     }
   }
   ```

5. **Restart the MCP server** so it picks up the file keys. `setup_status` reports `figmaTokenInKeychain` (whether the item exists, never its value).

**Upgrading from the old setup:** delete the `export FIGMA_API_TOKEN=...` line from your shell profile (`~/.zshrc` and similar), open a new terminal, and revoke the old token in Figma. `bun setup` removes `FIGMA_API_TOKEN` from `.mcp.json` when it rewrites it. It does not clean other places: if you ever registered the server yourself (user or local scope, or under another name), search `~/.claude.json` for `FIGMA_API_TOKEN` and delete it; `bun setup` tells you when that file still mentions it.

**macOS only:** on Linux or WSL there is no Keychain, so the library tools soft-fail with a message.

Without the token or the file keys, `get_library_components` and `search_library_components` return setup instructions instead of a component list — this is a soft failure, not a crash. The server indexes each configured file key once per session (REST calls to `/v1/files/:key/components`, `/component_sets`, and `/meta`) and caches the result; pass `refresh: true` to either tool to refetch after a library update.

## Feature flags

New tool families ship behind server-side flags. Export `L2F_<FEATURE>=1` in the shell that starts Claude Code (for example `L2F_FLOWS=1`), or `L2F_ALL=1` for all of them, then restart the MCP server. `bun setup` and the Claude Code plugin both pass these variables through to the server; unset means off. `L2F_COMMENTS_WRITE` is the exception: `L2F_ALL` does not enable it, so set it on its own. Flags: `FILE_KEY`, `COMMENTS`, `COMMENTS_WRITE`, `FLOWS`, `VARIABLES_WRITE`, `COMPONENT_PROPERTIES`, `GRID_LAYOUT`, `VERIFY`, `CODE_MAP`, `DEV_MODE`, `SLIDES`, `TEXT_PATH`.

After this change the plugin manifest also declares the `slides` and `buzz` editors and the private plugin API, so remove and re-import the plugin in Figma (a reload keeps the old permissions). In Dev Mode the plugin refuses commands that change the document. FigJam is not supported for now: the manifest no longer lists the `figjam` editor, because Figma's manifest docs mark `"editorType": ["figjam", "dev"]` as unsupported and Dev Mode was chosen.

## Plugin settings

The plugin's **Settings tab** persists across sessions via Figma client storage:

- **First on top** — new auto-layout frames default to first-child-on-top stacking (`itemReverseZIndex`)
- **Auto-connect** — automatically connects to the WebSocket relay when the plugin launches

## First session checklist

1. `bun socket` is running
2. The plugin is open in Figma and connected to a channel
3. From Claude Code, call `join_channel` with the same channel name
4. Call `get_document_info` to confirm the pipeline works end to end

If any step fails, see [[Troubleshooting]].

---

## Related

- [[Architecture]] — how the MCP server, relay, and plugin fit together
- [[Tool-Reference]] — the full catalog of tools you can call once connected
- [[Tools-Components#team-library-components|get_library_components / search_library_components]] — what the team library tools return
- [[Troubleshooting]] — connection issues, WSL setup, timeout errors
- [[Plugin-Development]] — rebuilding the plugin after source changes
