#!/bin/bash
#
# setup.sh — install dependencies and write a machine-specific .mcp.json.
#
# .mcp.json is gitignored because the absolute paths to `bun` and the repo
# differ from machine to machine. This script regenerates it for the current
# machine and stamps a `_generatedFor` block (hostname + user + timestamp) so
# scripts/preflight.sh can detect when the config no longer matches.
#
# Re-run any time you move the repo, switch machines, or upgrade bun.

set -e

# Resolve absolute paths so .mcp.json works regardless of Claude Code's launch cwd.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Resolve bun: prefer whatever's on PATH, fall back to the standard install location.
BUN_PATH="$(command -v bun || true)"
if [ -z "$BUN_PATH" ] && [ -x "$HOME/.bun/bin/bun" ]; then
  BUN_PATH="$HOME/.bun/bin/bun"
fi
if [ -z "$BUN_PATH" ]; then
  echo "✗ bun not found on PATH or at \$HOME/.bun/bin/bun" >&2
  echo "  Install it: curl -fsSL https://bun.sh/install | bash" >&2
  exit 1
fi

HOSTNAME_VAL="$(hostname)"
USER_VAL="$(whoami)"
GENERATED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

"$BUN_PATH" install

cat > "$REPO_ROOT/.mcp.json" <<EOF
{
  "mcpServers": {
    "ClaudeToFigma": {
      "type": "stdio",
      "command": "$BUN_PATH",
      "args": [
        "$REPO_ROOT/src/claude_to_figma_mcp/server.ts"
      ],
      "env": {}
    }
  },
  "_generatedFor": {
    "hostname": "$HOSTNAME_VAL",
    "user": "$USER_VAL",
    "generatedAt": "$GENERATED_AT"
  }
}
EOF

echo "✓ MCP config written to $REPO_ROOT/.mcp.json"
echo "  bun:  $BUN_PATH"
echo "  repo: $REPO_ROOT"
echo "  host: $HOSTNAME_VAL ($USER_VAL)"
