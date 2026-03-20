#!/bin/bash

INPUT=$(cat)
echo "$INPUT" > /tmp/hook-update-debug.json

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

# Map Claude task status to Linear status ID
case "$NEW_STATUS" in
  "in_progress")  LINEAR_STATUS_ID="75d92b66-1151-496d-920a-e2d9d8a2c109" ;;  # In Progress
  "completed")    LINEAR_STATUS_ID="0ba65637-fadc-4166-bc37-7b5313623787" ;;  # Done
  "pending")      LINEAR_STATUS_ID="3fbfde89-2150-4417-a016-ba365014af9d" ;;  # Todo
  *) exit 0 ;;
esac

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
