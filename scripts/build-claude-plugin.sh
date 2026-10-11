#!/bin/bash
#
# build-claude-plugin.sh — refresh the self-contained Claude Code plugin in plugin/.
#
# The installed plugin has no node_modules, so the MCP server and relay are
# bundled into single files, and the Figma plugin files are copied alongside.
# Run after changing anything under src/ (bun run build does this too), and
# commit the results under plugin/.

set -e
cd "$(dirname "$0")/.."

bun build src/claude_to_figma_mcp/server.ts --target=bun --outfile plugin/server/server.js
bun build src/socket.ts --target=bun --outfile plugin/server/relay.js

mkdir -p plugin/figma-plugin
cp src/claude_figma_plugin/manifest.json src/claude_figma_plugin/code.js src/claude_figma_plugin/ui.html plugin/figma-plugin/

echo "✓ plugin/ rebuilt. Commit plugin/server and plugin/figma-plugin with your change."
