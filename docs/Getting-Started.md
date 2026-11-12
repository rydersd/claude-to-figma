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

`get_library_components`, `search_library_components`, and `$lib:` refs in [[Create-Node-Tree#library-component-instances-lib-refs|create_node_tree instance nodes]] read published components straight from the Figma REST API (`api.figma.com`), not through the plugin/WebSocket path — see [[Architecture#rest-discovery-team-libraries|REST discovery]]. Two environment variables enable them:

1. **Create a personal access token** — Figma → Settings → Security → Personal access tokens → generate one with these scopes:
   - **File content: read**
   - **Library content: read**
2. **Find your library file keys** — open each library file in Figma and copy the key out of its URL: `figma.com/design/<FILE_KEY>/...`
3. **Export both in your shell profile** (e.g. `~/.zshrc`):

   ```bash
   export FIGMA_API_TOKEN="figd_..."
   export FIGMA_LIBRARY_FILE_KEYS="abc123,def456"
   ```

4. **Pass them through `.mcp.json`** — the `ClaudeToFigma` server entry's `env` block references the shell variables (never hardcode the token):

   ```json
   {
     "mcpServers": {
       "ClaudeToFigma": {
         "command": "bun",
         "args": ["src/claude_to_figma_mcp/server.ts"],
         "env": {
           "FIGMA_API_TOKEN": "${FIGMA_API_TOKEN}",
           "FIGMA_LIBRARY_FILE_KEYS": "${FIGMA_LIBRARY_FILE_KEYS}"
         }
       }
     }
   }
   ```

5. **Restart the MCP server** so it picks up the new environment.

Without these two variables set, `get_library_components` and `search_library_components` return setup instructions instead of a component list — this is a soft failure, not a crash. The server indexes each configured file key once per session (REST calls to `/v1/files/:key/components`, `/component_sets`, and `/meta`) and caches the result; pass `refresh: true` to either tool to refetch after a library update.

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
