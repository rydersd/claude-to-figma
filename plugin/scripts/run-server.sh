#!/bin/bash
# Start the bundled claude-to-figma MCP server with Bun. Claude Code may not
# inherit your shell's PATH (for example when the desktop app starts it), so
# also look where the Bun installer and Homebrew put it.
SERVER="$(cd "$(dirname "$0")/.." && pwd)/server/server.js"
for candidate in "$(command -v bun 2>/dev/null)" "$HOME/.bun/bin/bun" /opt/homebrew/bin/bun /usr/local/bin/bun; do
  if [ -n "$candidate" ] && [ -x "$candidate" ]; then
    exec "$candidate" "$SERVER" "$@"
  fi
done
echo "claude-to-figma: Bun not found. Install it with: curl -fsSL https://bun.sh/install | bash" >&2
exit 1
