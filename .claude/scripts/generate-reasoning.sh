#!/bin/bash
set -e

# Usage: generate-reasoning.sh <commit-hash> <commit-message>
# Reads from current branch's attempts file, writes to commit-keyed reasoning
#
# This script is called by the /commit skill after each commit to capture
# what was tried during development (build failures, fixes, etc.)

COMMIT_HASH="$1"
COMMIT_MSG="$2"

# (#5) Use git rev-parse to support worktrees
GIT_DIR=$(git rev-parse --git-dir 2>/dev/null || echo ".git")
GIT_CLAUDE_DIR="$GIT_DIR/claude"

if [[ -z "$COMMIT_HASH" ]]; then
    echo "Usage: generate-reasoning.sh <commit-hash> <commit-message>"
    exit 1
fi

# Get current branch (#3: handle detached HEAD — git outputs empty string, not error)
current_branch=$(git branch --show-current 2>/dev/null)
current_branch=${current_branch:-detached}
safe_branch=$(echo "$current_branch" | tr '/' '-')

# Branch-keyed attempts file
ATTEMPTS_FILE="$GIT_CLAUDE_DIR/branches/$safe_branch/attempts.jsonl"
OUTPUT_DIR="$GIT_CLAUDE_DIR/commits/$COMMIT_HASH"

if ! mkdir -p "$OUTPUT_DIR" 2>/dev/null; then
    echo "generate-reasoning: failed to create $OUTPUT_DIR" >&2
    exit 1
fi

# (#2) Start reasoning file with quoted heredoc to prevent injection,
# then write variables separately with printf
cat > "$OUTPUT_DIR/reasoning.md" << 'EOF'
# Commit: COMMIT_HASH_PLACEHOLDER

## Branch
BRANCH_PLACEHOLDER

## What was committed
COMMIT_MSG_PLACEHOLDER

## What was tried
EOF

# Replace placeholders with actual values safely using sed
sed -i.bak "s|COMMIT_HASH_PLACEHOLDER|${COMMIT_HASH:0:8}|" "$OUTPUT_DIR/reasoning.md"
sed -i.bak "s|BRANCH_PLACEHOLDER|$current_branch|" "$OUTPUT_DIR/reasoning.md"
# Use a different delimiter for commit msg since it may contain special chars
printf '%s\n' "$COMMIT_MSG" > "$OUTPUT_DIR/.commit_msg_tmp"
# Use awk to replace the placeholder safely (handles all special characters)
awk -v msg="$(cat "$OUTPUT_DIR/.commit_msg_tmp")" '{gsub(/COMMIT_MSG_PLACEHOLDER/, msg); print}' "$OUTPUT_DIR/reasoning.md" > "$OUTPUT_DIR/reasoning.md.new"
mv "$OUTPUT_DIR/reasoning.md.new" "$OUTPUT_DIR/reasoning.md"
rm -f "$OUTPUT_DIR/.commit_msg_tmp" "$OUTPUT_DIR/reasoning.md.bak"

# (#6) Atomically move attempts file before processing to prevent truncation race
TEMP_ATTEMPTS="$ATTEMPTS_FILE.processing"
if [[ -f "$ATTEMPTS_FILE" ]] && [[ -s "$ATTEMPTS_FILE" ]]; then
    mv "$ATTEMPTS_FILE" "$TEMP_ATTEMPTS" 2>/dev/null || true
fi

# Parse attempts and add to reasoning
if [[ -f "$TEMP_ATTEMPTS" ]] && [[ -s "$TEMP_ATTEMPTS" ]]; then
    # Group failures - extract first line of error for each
    failures=$(jq -r 'select(.type == "build_fail") | "- `\(.command | split(" ") | .[0:3] | join(" "))...`: \(.error | split("\n")[0] | .[0:100])"' "$TEMP_ATTEMPTS" 2>/dev/null || echo "")

    if [[ -n "$failures" ]]; then
        echo "" >> "$OUTPUT_DIR/reasoning.md"
        echo "### Failed attempts" >> "$OUTPUT_DIR/reasoning.md"
        echo "$failures" >> "$OUTPUT_DIR/reasoning.md"
    fi

    # Count attempts (use -s slurp since file is JSONL)
    fail_count=$(jq -s '[.[] | select(.type == "build_fail")] | length' "$TEMP_ATTEMPTS" 2>/dev/null || echo "0")
    pass_count=$(jq -s '[.[] | select(.type == "build_pass")] | length' "$TEMP_ATTEMPTS" 2>/dev/null || echo "0")

    echo "" >> "$OUTPUT_DIR/reasoning.md"
    echo "### Summary" >> "$OUTPUT_DIR/reasoning.md"
    if [[ "$fail_count" -gt 0 ]]; then
        echo "Build passed after **$fail_count failed attempt(s)** and $pass_count successful build(s)." >> "$OUTPUT_DIR/reasoning.md"
    else
        echo "Build passed on first try ($pass_count successful build(s))." >> "$OUTPUT_DIR/reasoning.md"
    fi

    # Remove the processed attempts file
    rm -f "$TEMP_ATTEMPTS"
else
    echo "" >> "$OUTPUT_DIR/reasoning.md"
    echo "_No build attempts recorded for this commit._" >> "$OUTPUT_DIR/reasoning.md"
fi

# Add files changed
echo "" >> "$OUTPUT_DIR/reasoning.md"
echo "## Files changed" >> "$OUTPUT_DIR/reasoning.md"
git diff-tree --no-commit-id --name-only -r "$COMMIT_HASH" 2>/dev/null | sed 's/^/- /' >> "$OUTPUT_DIR/reasoning.md" || echo "- (unable to determine files)" >> "$OUTPUT_DIR/reasoning.md"

echo "Reasoning saved to $OUTPUT_DIR/reasoning.md"
