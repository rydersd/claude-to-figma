#!/bin/bash

MCP_CONFIG='{
  "mcpServers": {
    "ClaudeToFigma": {
      "command": "bunx",
      "args": [
        "claude-to-figma@latest"
      ]
    }
  }
}'

bun install

# Write .mcp.json in project root for Claude Code
echo "$MCP_CONFIG" > .mcp.json
echo "✓ MCP config written to .mcp.json"