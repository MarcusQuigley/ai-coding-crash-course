#!/bin/bash
# Stop hook: don't let Claude finish while typecheck or tests fail.
input=$(cat)

# Already continuing because of this hook? Let Claude stop, to avoid a loop.
if [ "$(jq -r '.stop_hook_active' <<<"$input")" = "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR" || exit 0

# Nothing changed (e.g. Claude only answered a question)? Skip the checks.
if [ -z "$(git status --porcelain)" ]; then
  exit 0
fi

if ! output=$(npm run typecheck 2>&1 && npm test 2>&1); then
  echo "Typecheck or tests failed. Fix them before saying you're done:" >&2
  echo "$output" | tail -30 >&2
  exit 2
fi

exit 0