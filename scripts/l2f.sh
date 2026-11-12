#!/usr/bin/env bash
# Start llm2figma's relay in iTerm, reusing an already-running relay.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUN_PATH="$(command -v bun || true)"
if [ -z "$BUN_PATH" ] && [ -x "$HOME/.bun/bin/bun" ]; then BUN_PATH="$HOME/.bun/bin/bun"; fi
if [ -z "$BUN_PATH" ]; then echo "Bun is missing. Install Bun before starting llm2figma." >&2; exit 1; fi

if lsof -nP -iTCP:3055 -sTCP:LISTEN >/dev/null 2>&1; then
  if [ "$(curl --silent --fail --max-time 2 http://localhost:3055/ || true)" = "WebSocket server running" ]; then
    echo "llm2figma relay is already running on port 3055. Connect the Figma plugin to it."
    exit 0
  fi
  echo "Port 3055 is occupied by another service. Stop that service before starting llm2figma." >&2
  exit 1
fi

# Resolve Bun before launching iTerm; GUI shells can have a different PATH.
printf -v RELAY_COMMAND 'cd %q && %q socket' "$REPO_ROOT" "$BUN_PATH"
osascript - "$RELAY_COMMAND" <<'APPLESCRIPT'
on run argv
  tell application "iTerm"
    activate
    create window with default profile
    tell current session of current window
      write text (item 1 of argv)
    end tell
  end tell
end run
APPLESCRIPT
