#!/bin/bash
#
# preflight.sh — verify .mcp.json matches the current machine; regenerate if not.
#
# Run before `bun socket` (or any command that depends on the MCP server) to
# self-heal config drift across machines. Compares the `_generatedFor` block
# in .mcp.json against the current hostname + user; if missing or mismatched,
# re-runs scripts/setup.sh.
#
# Exits 0 on success (config valid or successfully regenerated), 1 on failure.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MCP_CONFIG="$REPO_ROOT/.mcp.json"

CURRENT_HOST="$(hostname)"
CURRENT_USER="$(whoami)"

needs_regen() {
  local reason="$1"
  echo "⚠ Preflight: $reason — regenerating .mcp.json for $CURRENT_HOST ($CURRENT_USER)"
  "$SCRIPT_DIR/setup.sh"
}

if [ ! -f "$MCP_CONFIG" ]; then
  needs_regen ".mcp.json missing"
  exit 0
fi

# Extract _generatedFor fields with a simple grep — avoid jq dependency.
STAMPED_HOST="$(grep -o '"hostname"[[:space:]]*:[[:space:]]*"[^"]*"' "$MCP_CONFIG" | head -1 | sed 's/.*"\([^"]*\)"$/\1/')"
STAMPED_USER="$(grep -o '"user"[[:space:]]*:[[:space:]]*"[^"]*"' "$MCP_CONFIG" | head -1 | sed 's/.*"\([^"]*\)"$/\1/')"

if [ -z "$STAMPED_HOST" ] || [ -z "$STAMPED_USER" ]; then
  needs_regen ".mcp.json has no _generatedFor stamp"
  exit 0
fi

if [ "$STAMPED_HOST" != "$CURRENT_HOST" ] || [ "$STAMPED_USER" != "$CURRENT_USER" ]; then
  needs_regen "host/user mismatch (stamped: $STAMPED_HOST/$STAMPED_USER, current: $CURRENT_HOST/$CURRENT_USER)"
  exit 0
fi

echo "✓ Preflight: .mcp.json valid for $CURRENT_HOST ($CURRENT_USER)"
