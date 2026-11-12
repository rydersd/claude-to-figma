#!/bin/bash
#
# store-figma-token.sh — store the Figma API token in the macOS Keychain for llm2figma.
#
# The token is typed at a hidden prompt from the `security` tool, so it never
# lands in shell history, an environment variable, or a process listing.
# Running it again replaces the stored token.
#
# Token scopes needed: File content: read, Library content: read,
# file_comments:read, file_comments:write.
#
# Usage: ./store-figma-token.sh [--check]
#   --check   skip storing; only confirm the stored token works

set -euo pipefail

SERVICE="llm2figma"
ACCOUNT="figma-api-token"

if [ "$(uname)" != "Darwin" ]; then
  echo "This needs the macOS Keychain." >&2
  exit 1
fi

if [ "${1:-}" != "--check" ]; then
  echo "Paste your Figma personal access token at the prompts (input is hidden)."
  # -U updates the item if it already exists. With -w last and no value,
  # security prompts for the password itself.
  security add-generic-password -U -s "$SERVICE" -a "$ACCOUNT" -l "llm2figma Figma API token" -w
  echo "Stored in the Keychain as service '$SERVICE', account '$ACCOUNT'."
fi

# Confirm the stored token is accepted by Figma. The token goes to curl on
# stdin as a header, never as an argument.
status=$(
  { printf 'X-Figma-Token: '; security find-generic-password -s "$SERVICE" -a "$ACCOUNT" -w; } \
    | curl -s -o /dev/null -w '%{http_code}' --max-time 15 -H @- https://api.figma.com/v1/me
) || true

case "$status" in
  200) echo "Check passed: Figma accepted the token." ;;
  403) echo "Figma rejected the token (403). It may be revoked, expired or mistyped; run this script again." >&2; exit 1 ;;
  000|"") echo "Could not reach api.figma.com to check the token." >&2; exit 1 ;;
  *)   echo "Unexpected response from Figma: HTTP $status." >&2; exit 1 ;;
esac

if grep -qs 'FIGMA_API_TOKEN' ~/.zshrc ~/.zprofile ~/.zshenv ~/.bash_profile ~/.bashrc; then
  echo
  echo "Your shell profile still mentions FIGMA_API_TOKEN:"
  grep -ls 'FIGMA_API_TOKEN' ~/.zshrc ~/.zprofile ~/.zshenv ~/.bash_profile ~/.bashrc | sed 's/^/  /'
  echo "Delete that line, open a new terminal, and revoke the old token in Figma."
fi
