#!/bin/bash

MCP_CONFIG='{
  "mcpServers": {
    "ClaudeToFigma": {
      "command": "bun",
      "args": [
        "src/claude_to_figma_mcp/server.ts"
      ]
    }
  }
}'

bun install

# Write .mcp.json in project root for Claude Code
echo "$MCP_CONFIG" > .mcp.json
echo "✓ MCP config written to .mcp.json"