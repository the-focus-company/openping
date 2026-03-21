#!/bin/bash

INPUT=$(cat)

TEAM_ID="8888c9ff-9144-4d8b-b8a0-48de1dc3aa66"
PROJECT_CACHE="$HOME/.claude/task-meta/linear-project-cache.json"

# Extract task details from correct paths
SUBJECT=$(echo "$INPUT" | jq -r '.tool_response.task.subject // .tool_input.subject // "Untitled"')
DESCRIPTION=$(echo "$INPUT" | jq -r '.tool_input.description // ""')
TASK_ID=$(echo "$INPUT" | jq -r '.tool_response.task.id')
PARENT_TASK_ID=$(echo "$INPUT" | jq -r '.tool_input.metadata.parentTaskId // empty')

# Derive desired project name from git branch or repo directory
PROJECT_NAME=""
if command -v git &>/dev/null && git rev-parse --is-inside-work-tree &>/dev/null 2>&1; then
  BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "")
  REPO_NAME=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "")
  # Use branch name as project context if it's not main/master
  if [ -n "$BRANCH" ] && [ "$BRANCH" != "main" ] && [ "$BRANCH" != "master" ]; then
    PROJECT_NAME="$REPO_NAME ($BRANCH)"
  else
    PROJECT_NAME="$REPO_NAME"
  fi
fi
[ -z "$PROJECT_NAME" ] && PROJECT_NAME="Claude Tasks"

# --- Resolve or create Linear project ---
resolve_project_id() {
  # Check cache first (valid for 1 hour)
  if [ -f "$PROJECT_CACHE" ]; then
    CACHED_NAME=$(jq -r '.project_name // empty' "$PROJECT_CACHE")
    CACHED_ID=$(jq -r '.project_id // empty' "$PROJECT_CACHE")
    CACHED_AT=$(jq -r '.cached_at // 0' "$PROJECT_CACHE")
    NOW=$(date +%s)
    AGE=$(( NOW - CACHED_AT ))
    if [ "$CACHED_NAME" = "$PROJECT_NAME" ] && [ -n "$CACHED_ID" ] && [ "$AGE" -lt 3600 ]; then
      echo "$CACHED_ID"
      return
    fi
  fi

  # Fetch existing projects from Linear
  PROJECTS_QUERY='query { projects(filter: { state: { eq: "started" } }, first: 50) { nodes { id name } } }'
  PROJECTS_RESPONSE=$(curl -s 'https://api.linear.app/graphql' \
    -H "Authorization: $LINEAR_API_KEY" \
    -H 'Content-Type: application/json' \
    -d "{\"query\": $(echo "$PROJECTS_QUERY" | jq -R .)}")

  # Try exact match first, then case-insensitive partial match
  MATCHED_ID=$(echo "$PROJECTS_RESPONSE" | jq -r --arg name "$PROJECT_NAME" \
    '.data.projects.nodes[] | select(.name == $name) | .id' | head -1)

  if [ -z "$MATCHED_ID" ]; then
    # Try case-insensitive match
    MATCHED_ID=$(echo "$PROJECTS_RESPONSE" | jq -r --arg name "$PROJECT_NAME" \
      '.data.projects.nodes[] | select(.name | ascii_downcase == ($name | ascii_downcase)) | .id' | head -1)
  fi

  if [ -n "$MATCHED_ID" ]; then
    # Cache and return existing project
    mkdir -p "$(dirname "$PROJECT_CACHE")"
    echo "{\"project_id\": \"$MATCHED_ID\", \"project_name\": \"$PROJECT_NAME\", \"cached_at\": $(date +%s), \"created\": false}" > "$PROJECT_CACHE"
    echo "$MATCHED_ID"
    return
  fi

  # No match found — create a new project
  CREATE_QUERY="mutation { projectCreate(input: {name: \"$PROJECT_NAME\", teamIds: [\"$TEAM_ID\"]}) { project { id name } } }"
  CREATE_RESPONSE=$(curl -s 'https://api.linear.app/graphql' \
    -H "Authorization: $LINEAR_API_KEY" \
    -H 'Content-Type: application/json' \
    -d "{\"query\": $(echo "$CREATE_QUERY" | jq -R .)}")

  NEW_ID=$(echo "$CREATE_RESPONSE" | jq -r '.data.projectCreate.project.id // empty')
  if [ -n "$NEW_ID" ]; then
    mkdir -p "$(dirname "$PROJECT_CACHE")"
    echo "{\"project_id\": \"$NEW_ID\", \"project_name\": \"$PROJECT_NAME\", \"cached_at\": $(date +%s), \"created\": true}" > "$PROJECT_CACHE"
    echo "$NEW_ID"
  fi
}

PROJECT_ID=$(resolve_project_id)

# Look up parent Linear issue UUID if this is a subtask
PARENT_ISSUE_UUID=""
if [ -n "$PARENT_TASK_ID" ]; then
  PARENT_META_FILE="$HOME/.claude/task-meta/task-$PARENT_TASK_ID.json"
  if [ -f "$PARENT_META_FILE" ]; then
    PARENT_ISSUE_UUID=$(cat "$PARENT_META_FILE" | jq -r '.linear_issue_uuid // empty')
  fi
fi

# Build extra GraphQL fields for subtask and project
GQL_EXTRA=""
if [ -n "$PARENT_ISSUE_UUID" ]; then
  GQL_EXTRA=", parentId: \"$PARENT_ISSUE_UUID\""
fi

PROJECT_FIELD=""
if [ -n "$PROJECT_ID" ]; then
  PROJECT_FIELD="projectId: \"$PROJECT_ID\", "
fi

QUERY="mutation { issueCreate(input: {${PROJECT_FIELD}teamId: \"$TEAM_ID\", title: \"$SUBJECT\", description: \"$DESCRIPTION\"$GQL_EXTRA}) { issue { id identifier } } }"

RESPONSE=$(curl -s 'https://api.linear.app/graphql' \
  -H "Authorization: $LINEAR_API_KEY" \
  -H 'Content-Type: application/json' \
  -d "{\"query\": $(echo "$QUERY" | jq -R .)}")

ISSUE_IDENTIFIER=$(echo "$RESPONSE" | jq -r '.data.issueCreate.issue.identifier // empty')
ISSUE_UUID=$(echo "$RESPONSE" | jq -r '.data.issueCreate.issue.id // empty')

if [ -n "$ISSUE_IDENTIFIER" ]; then
  # Save UUID for future subtask parent lookups
  mkdir -p "$HOME/.claude/task-meta"
  echo "{\"linear_issue_uuid\": \"$ISSUE_UUID\", \"linear_issue_identifier\": \"$ISSUE_IDENTIFIER\"}" > "$HOME/.claude/task-meta/task-$TASK_ID.json"
  PROJECT_NOTE=""
  if [ -f "$PROJECT_CACHE" ] && [ "$(jq -r '.created // false' "$PROJECT_CACHE")" = "true" ]; then
    PROJECT_NOTE=" (new project '$PROJECT_NAME' created)"
  fi
  echo "{\"systemMessage\":\"✅ Linear $ISSUE_IDENTIFIER created for task #$TASK_ID${PARENT_ISSUE_UUID:+ (subtask of parent)}${PROJECT_NOTE}\"}"
else
  echo "{\"systemMessage\":\"⚠️ Could not create Linear issue: $(echo $RESPONSE | jq -r '.errors[0].message // "unknown error"')\"}"
fi
