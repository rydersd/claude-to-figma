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
#
# Usage:
#   bun setup            # project scope: tools available when Claude Code starts in this repo
#   bun setup --user     # also register for your user, so every project sees the tools
#   bun setup --launcher # install l2f and the compatible c2f launcher (macOS/iTerm)

set -e

REGISTER_USER=0
INSTALL_LAUNCHER=0
for arg in "$@"; do
  case "$arg" in
    --user) REGISTER_USER=1 ;;
    --launcher) INSTALL_LAUNCHER=1 ;;
    *) echo "✗ Unknown option: $arg (supported: --user, --launcher)" >&2; exit 1 ;;
  esac
done

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

"$BUN_PATH" "$SCRIPT_DIR/write-mcp-config.ts" "$REPO_ROOT" "$BUN_PATH" "$HOSTNAME_VAL" "$USER_VAL" "$GENERATED_AT"

echo "✓ MCP config written to $REPO_ROOT/.mcp.json"
echo "  bun:  $BUN_PATH"
echo "  repo: $REPO_ROOT"
echo "  host: $HOSTNAME_VAL ($USER_VAL)"

SERVER_TS="$REPO_ROOT/src/llm2figma_mcp/server.ts"

if [ "$INSTALL_LAUNCHER" -eq 1 ]; then
  LAUNCHER_DIR="$HOME/.local/bin"
  mkdir -p "$LAUNCHER_DIR"
  printf '#!/usr/bin/env bash\nexec bash %q "$@"\n' "$SCRIPT_DIR/l2f.sh" > "$LAUNCHER_DIR/l2f"
  printf '#!/usr/bin/env bash\nexec "$(dirname "$0")/l2f" "$@"\n' > "$LAUNCHER_DIR/c2f"
  chmod +x "$LAUNCHER_DIR/l2f" "$LAUNCHER_DIR/c2f"
  echo "✓ Installed l2f and compatible c2f launcher in $LAUNCHER_DIR (add it to PATH if needed)"
fi

# The draw-in-figma skill (auto layout, real components, read before writing)
# ships with the Claude Code plugin; a clone install gets it as a symlink into
# the user's skills folder so every session can load it. Idempotent: an
# existing link to this repo is kept, anything else at that path is left alone.
SKILL_SRC="$REPO_ROOT/plugin/skills/draw-in-figma"
SKILLS_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills"
SKILL_DST="$SKILLS_DIR/draw-in-figma"
if [ -d "$SKILL_SRC" ]; then
  if [ -L "$SKILL_DST" ] && [ "$(readlink "$SKILL_DST")" = "$SKILL_SRC" ]; then
    echo "✓ draw-in-figma skill already linked in $SKILLS_DIR"
  elif [ -e "$SKILL_DST" ] || [ -L "$SKILL_DST" ]; then
    echo "  $SKILL_DST already exists and is not a link to this repo; left it as it is."
  else
    mkdir -p "$SKILLS_DIR"
    ln -s "$SKILL_SRC" "$SKILL_DST"
    echo "✓ Linked the draw-in-figma skill into $SKILLS_DIR"
  fi
fi

# setup only rewrites its own entries. A token under another scope or server
# name is left alone, so say where one remains on every exit, including the
# failure paths below. The file name only, never a value.
warn_leftover_token() {
  local claude_json="${CLAUDE_CONFIG_DIR:-$HOME}/.claude.json"
  if grep -qs 'FIGMA_API_TOKEN' "$claude_json"; then
    echo ""
    echo "  $claude_json still mentions FIGMA_API_TOKEN."
    echo "  Delete that entry and revoke the old token in Figma; llm2figma reads the token from the Keychain only."
  fi
}
trap warn_leftover_token EXIT

if [ "$REGISTER_USER" -eq 1 ]; then
  if ! command -v claude >/dev/null 2>&1; then
    echo "✗ claude CLI not found, so the user-scope server was not registered." >&2
    echo "  Install Claude Code, then re-run: bun setup --user" >&2
    exit 1
  fi
  # Build the new entry from any existing user-scope LLM2Figma or legacy
  # ClaudeToFigma entry, keeping its env (library file keys, never the token)
  # and connection flags such as --server=…; only the bun and server paths are
  # replaced. Entries are never printed: they are passed to claude only.
  CLAUDE_JSON="${CLAUDE_CONFIG_DIR:-$HOME}/.claude.json"
  NEW_ENTRY="$("$BUN_PATH" "$SCRIPT_DIR/write-mcp-config.ts" --user-entry "$CLAUDE_JSON" "$BUN_PATH" "$SERVER_TS")"
  PREVIOUS_ENTRY="$("$BUN_PATH" "$SCRIPT_DIR/write-mcp-config.ts" --user-get "$CLAUDE_JSON" LLM2Figma)"
  if [ -n "$PREVIOUS_ENTRY" ]; then
    claude mcp remove --scope user LLM2Figma >/dev/null 2>&1 || true
  fi
  if ! claude mcp add-json --scope user LLM2Figma "$NEW_ENTRY" ||
     [ -z "$("$BUN_PATH" "$SCRIPT_DIR/write-mcp-config.ts" --user-get "$CLAUDE_JSON" LLM2Figma)" ]; then
    if [ -n "$PREVIOUS_ENTRY" ]; then
      claude mcp add-json --scope user LLM2Figma "$PREVIOUS_ENTRY" >/dev/null 2>&1 ||
        echo "  Could not restore the previous LLM2Figma entry either." >&2
    fi
    echo "✗ claude mcp add-json failed, so llm2figma is not registered for your user." >&2
    echo "  Fix the error above, then re-run: bun setup --user" >&2
    exit 1
  fi
  # Remove the legacy duplicate only after the replacement is registered.
  claude mcp remove --scope user ClaudeToFigma >/dev/null 2>&1 || true
  if [ -n "$("$BUN_PATH" "$SCRIPT_DIR/write-mcp-config.ts" --user-get "$CLAUDE_JSON" ClaudeToFigma)" ]; then
    echo "✗ llm2figma is registered, but the old ClaudeToFigma entry could not be removed." >&2
    echo "  Remove it yourself: claude mcp remove --scope user ClaudeToFigma" >&2
    exit 1
  fi
  echo "✓ Registered llm2figma for your user: available in every project"
else
  echo ""
  echo "  The tools are only available when Claude Code starts in this repo."
  echo "  To use them from any project, run: bun setup --user"
fi
