#!/bin/bash

INPUT=$(cat)
echo "$INPUT" > /tmp/hook-update-debug.json

TEAM_ID="8888c9ff-9144-4d8b-b8a0-48de1dc3aa66"
STATES_CACHE="$HOME/.claude/task-meta/linear-states-cache.json"

# Extract updated task info
TASK_ID=$(echo "$INPUT" | jq -r '.tool_input.taskId // .tool_response.task.id // empty')
NEW_STATUS=$(echo "$INPUT" | jq -r '.tool_input.status // empty')

[ -z "$TASK_ID" ] && exit 0
[ -z "$NEW_STATUS" ] && exit 0

# Load Linear issue UUID for this task
META_FILE="$HOME/.claude/task-meta/task-$TASK_ID.json"
[ ! -f "$META_FILE" ] && exit 0
ISSUE_UUID=$(cat "$META_FILE" | jq -r '.linear_issue_uuid // empty')
[ -z "$ISSUE_UUID" ] && exit 0

# --- Resolve workflow state IDs dynamically ---
resolve_status_id() {
  local STATUS_TYPE="$1"  # "todo", "in_progress", "done"

  # Check cache first (valid for 1 hour)
  if [ -f "$STATES_CACHE" ]; then
    CACHED_AT=$(jq -r '.cached_at // 0' "$STATES_CACHE")
    NOW=$(date +%s)
    AGE=$(( NOW - CACHED_AT ))
    if [ "$AGE" -lt 3600 ]; then
      CACHED_ID=$(jq -r --arg t "$STATUS_TYPE" '.states[$t] // empty' "$STATES_CACHE")
      if [ -n "$CACHED_ID" ]; then
        echo "$CACHED_ID"
        return
      fi
    fi
  fi

  # Fetch workflow states for the team
  STATES_QUERY="query { team(id: \"$TEAM_ID\") { states { nodes { id name type } } } }"
  STATES_RESPONSE=$(curl -s 'https://api.linear.app/graphql' \
    -H "Authorization: $LINEAR_API_KEY" \
    -H 'Content-Type: application/json' \
    -d "{\"query\": $(echo "$STATES_QUERY" | jq -R .)}")

  # Extract state IDs by type (Linear uses: backlog, unstarted, started, completed, cancelled)
  # Map: "unstarted" → todo, "started" → in_progress, "completed" → done
  TODO_ID=$(echo "$STATES_RESPONSE" | jq -r '.data.team.states.nodes[] | select(.type == "unstarted") | .id' | head -1)
  IN_PROGRESS_ID=$(echo "$STATES_RESPONSE" | jq -r '.data.team.states.nodes[] | select(.type == "started") | .id' | head -1)
  DONE_ID=$(echo "$STATES_RESPONSE" | jq -r '.data.team.states.nodes[] | select(.type == "completed") | .id' | head -1)

  # Cache the results
  mkdir -p "$(dirname "$STATES_CACHE")"
  jq -n \
    --arg todo "$TODO_ID" \
    --arg in_progress "$IN_PROGRESS_ID" \
    --arg done "$DONE_ID" \
    '{states: {todo: $todo, in_progress: $in_progress, done: $done}, cached_at: now | floor}' \
    > "$STATES_CACHE"

  jq -r --arg t "$STATUS_TYPE" '.states[$t] // empty' "$STATES_CACHE"
}

# Map Claude task status to Linear status type
case "$NEW_STATUS" in
  "in_progress")  LINEAR_STATUS_ID=$(resolve_status_id "in_progress") ;;
  "completed")    LINEAR_STATUS_ID=$(resolve_status_id "done") ;;
  "pending")      LINEAR_STATUS_ID=$(resolve_status_id "todo") ;;
  *) exit 0 ;;
esac

[ -z "$LINEAR_STATUS_ID" ] && { echo "{\"systemMessage\":\"⚠️ Could not resolve Linear workflow state for '$NEW_STATUS'\"}"; exit 0; }

# Update the Linear issue status
QUERY="mutation { issueUpdate(id: \"$ISSUE_UUID\", input: {stateId: \"$LINEAR_STATUS_ID\"}) { issue { identifier state { name } } } }"

RESPONSE=$(curl -s 'https://api.linear.app/graphql' \
  -H "Authorization: $LINEAR_API_KEY" \
  -H 'Content-Type: application/json' \
  -d "{\"query\": $(echo "$QUERY" | jq -R .)}")

ISSUE_ID=$(echo "$RESPONSE" | jq -r '.data.issueUpdate.issue.identifier // empty')
STATUS_NAME=$(echo "$RESPONSE" | jq -r '.data.issueUpdate.issue.state.name // empty')

if [ -n "$ISSUE_ID" ]; then
  echo "{\"systemMessage\":\"✅ $ISSUE_ID → $STATUS_NAME\"}"

  # If completed, check if parent task should also be completed
  if [ "$NEW_STATUS" = "completed" ]; then
    PARENT_TASK_ID=$(echo "$INPUT" | jq -r '.tool_input.metadata.parentTaskId // empty')
    if [ -n "$PARENT_TASK_ID" ]; then
      PARENT_META="$HOME/.claude/task-meta/task-$PARENT_TASK_ID.json"
      if [ -f "$PARENT_META" ]; then
        PARENT_UUID=$(cat "$PARENT_META" | jq -r '.linear_issue_uuid // empty')
        PARENT_IDENTIFIER=$(cat "$PARENT_META" | jq -r '.linear_issue_identifier // empty')
        echo "{\"systemMessage\":\"ℹ️ Subtask done. Check if all subtasks of $PARENT_IDENTIFIER are complete to close parent.\"}" >&2
      fi
    fi
  fi
else
  echo "{\"systemMessage\":\"⚠️ Could not update Linear issue: $(echo $RESPONSE | jq -r '.errors[0].message // "unknown"')\"}"
fi
