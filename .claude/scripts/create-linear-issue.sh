#!/bin/bash

INPUT=$(cat)

# Extract task details from correct paths
SUBJECT=$(echo "$INPUT" | jq -r '.tool_response.task.subject // .tool_input.subject // "Untitled"')
DESCRIPTION=$(echo "$INPUT" | jq -r '.tool_input.description // ""')
TASK_ID=$(echo "$INPUT" | jq -r '.tool_response.task.id')
PARENT_TASK_ID=$(echo "$INPUT" | jq -r '.tool_input.metadata.parentTaskId // empty')

# Look up parent Linear issue UUID if this is a subtask
PARENT_ISSUE_UUID=""
if [ -n "$PARENT_TASK_ID" ]; then
  PARENT_META_FILE="$HOME/.claude/task-meta/task-$PARENT_TASK_ID.json"
  if [ -f "$PARENT_META_FILE" ]; then
    PARENT_ISSUE_UUID=$(cat "$PARENT_META_FILE" | jq -r '.linear_issue_uuid // empty')
  fi
fi

# Build extra GraphQL fields for subtask
GQL_EXTRA=""
if [ -n "$PARENT_ISSUE_UUID" ]; then
  GQL_EXTRA=", parentId: \"$PARENT_ISSUE_UUID\""
fi

QUERY="mutation { issueCreate(input: {projectId: \"6a643248-0f25-4afd-8586-4570c118c535\", teamId: \"8888c9ff-9144-4d8b-b8a0-48de1dc3aa66\", title: \"$SUBJECT\", description: \"$DESCRIPTION\"$GQL_EXTRA}) { issue { id identifier } } }"

RESPONSE=$(curl -s 'https://api.linear.app/graphql' \
  -H "Authorization: $LINEAR_API_KEY" \
  -H 'Content-Type: application/json' \
  -d "{\"query\": $(echo "$QUERY" | jq -R .)}")

ISSUE_IDENTIFIER=$(echo "$RESPONSE" | jq -r '.data.issueCreate.issue.identifier // empty')
ISSUE_UUID=$(echo "$RESPONSE" | jq -r '.data.issueCreate.issue.id // empty')

if [ -n "$ISSUE_IDENTIFIER" ]; then
  # Save UUID for future subtask parent lookups
  echo "{\"linear_issue_uuid\": \"$ISSUE_UUID\", \"linear_issue_identifier\": \"$ISSUE_IDENTIFIER\"}" > "$HOME/.claude/task-meta/task-$TASK_ID.json"
  echo "{\"systemMessage\":\"✅ Linear $ISSUE_IDENTIFIER created for task #$TASK_ID${PARENT_ISSUE_UUID:+ (subtask of parent)}\"}"
else
  echo "{\"systemMessage\":\"⚠️ Could not create Linear issue: $(echo $RESPONSE | jq -r '.errors[0].message // "unknown error"')\"}"
fi
