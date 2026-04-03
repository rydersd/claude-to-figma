#!/bin/bash
# PostToolUse hook: passively captures build/test command outcomes
# Appends JSON lines to <git-dir>/claude/branches/<branch>/attempts.jsonl
# Must be fast (< 50ms) — just stdin parse + pattern match + file append

# Read hook input from stdin (#9: avoid forking cat)
input=$(</dev/stdin)

# Extract the command that was run
command=$(echo "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)
if [[ -z "$command" ]]; then
    echo '{"result":"continue"}'
    exit 0
fi

# Pattern match: is this a build or test command?
# (#4) Use specific patterns to avoid false positives (e.g. "cat tsconfig.json")
case "$command" in
    *"bun run build"*|*"bun build"*|*"bun run test"*|*"bun test"*|\
    *"npm run build"*|*"npm test"*|*"npm run test"*|\
    *"yarn build"*|*"yarn test"*|\
    *"pnpm build"*|*"pnpm test"*|\
    *"make "*|make|\
    tsc|tsc\ *|*" tsc "*|*" tsc"|*"npx tsc"*|\
    tsup|tsup\ *|*" tsup "*|*" tsup"|*"npx tsup"*|\
    *"swift build"*|*"swift test"*|\
    *"xcodebuild"*|\
    *"cargo build"*|*"cargo test"*|\
    *"go build"*|*"go test"*|\
    pytest|pytest\ *|*" pytest "*|*" pytest"|*"python -m pytest"*|\
    jest|jest\ *|*" jest "*|*" jest"|*"npx jest"*|\
    vitest|vitest\ *|*" vitest "*|*" vitest"|*"npx vitest"*|\
    mocha|mocha\ *|*" mocha "*|*" mocha"|*"npx mocha"*)
        # This is a build/test command — capture it
        ;;
    *)
        # Not a build/test command — skip
        echo '{"result":"continue"}'
        exit 0
        ;;
esac

# Extract exit code from hook input (#8: shell-level fallback if jq fails)
exit_code=$(echo "$input" | jq -r '.tool_result.exit_code // .tool_result.exitCode // 0' 2>/dev/null)
exit_code=${exit_code:-0}

# Get current branch (#3: handle detached HEAD — git outputs empty string, not error)
current_branch=$(git branch --show-current 2>/dev/null)
current_branch=${current_branch:-detached}
safe_branch=$(echo "$current_branch" | tr '/' '-')

# (#5) Use git rev-parse to support worktrees
GIT_DIR=$(git rev-parse --git-dir 2>/dev/null || echo ".git")
GIT_CLAUDE_DIR="$GIT_DIR/claude"

# Ensure directory exists (#10: warn on failure)
attempts_dir="$GIT_CLAUDE_DIR/branches/$safe_branch"
if ! mkdir -p "$attempts_dir" 2>/dev/null; then
    echo "post-bash-track-builds: failed to create $attempts_dir" >&2
    echo '{"result":"continue"}'
    exit 0
fi

# Build the JSON entry
timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

if [[ "$exit_code" == "0" ]]; then
    entry=$(jq -n --arg cmd "$command" --arg ts "$timestamp" \
        '{"type":"build_pass","command":$cmd,"timestamp":$ts}')
else
    # Capture first meaningful line of stderr/output for error context
    error_snippet=$(echo "$input" | jq -r '.tool_result.stderr // .tool_result.stdout // ""' 2>/dev/null | head -1 | cut -c1-200)
    entry=$(jq -n --arg cmd "$command" --arg ts "$timestamp" --arg err "$error_snippet" \
        '{"type":"build_fail","command":$cmd,"error":$err,"timestamp":$ts}')
fi

# Append atomically (#10: warn on failure)
if ! echo "$entry" >> "$attempts_dir/attempts.jsonl" 2>/dev/null; then
    echo "post-bash-track-builds: failed to append to $attempts_dir/attempts.jsonl" >&2
fi

echo '{"result":"continue"}'
