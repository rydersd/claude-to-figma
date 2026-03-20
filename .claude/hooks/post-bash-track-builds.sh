#!/bin/bash
# PostToolUse hook: passively captures build/test command outcomes
# Appends JSON lines to .git/claude/branches/<branch>/attempts.jsonl
# Must be fast (< 50ms) — just stdin parse + pattern match + file append

# Read hook input from stdin
input=$(cat)

# Extract the command that was run
command=$(echo "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)
if [[ -z "$command" ]]; then
    echo '{"result":"continue"}'
    exit 0
fi

# Pattern match: is this a build or test command?
# Match common build/test patterns
case "$command" in
    *"bun run build"*|*"bun build"*|*"bun test"*|\
    *"npm run build"*|*"npm test"*|*"npm run test"*|\
    *"yarn build"*|*"yarn test"*|\
    *"pnpm build"*|*"pnpm test"*|\
    *"make "*|make|\
    *"tsc"*|*"tsup"*|\
    *"swift build"*|*"swift test"*|\
    *"xcodebuild"*|\
    *"cargo build"*|*"cargo test"*|\
    *"go build"*|*"go test"*|\
    *"pytest"*|*"python -m pytest"*|\
    *"jest"*|*"vitest"*|*"mocha"*)
        # This is a build/test command — capture it
        ;;
    *)
        # Not a build/test command — skip
        echo '{"result":"continue"}'
        exit 0
        ;;
esac

# Extract exit code from hook input
exit_code=$(echo "$input" | jq -r '.tool_result.exit_code // .tool_result.exitCode // 0' 2>/dev/null)

# Get current branch
current_branch=$(git branch --show-current 2>/dev/null || echo "detached")
safe_branch=$(echo "$current_branch" | tr '/' '-')

# Ensure directory exists
attempts_dir=".git/claude/branches/$safe_branch"
mkdir -p "$attempts_dir"

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

# Append atomically
echo "$entry" >> "$attempts_dir/attempts.jsonl"

echo '{"result":"continue"}'
