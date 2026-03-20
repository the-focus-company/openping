# Claude Code Hooks — Linear Sync

Automatically syncs Claude Code tasks to Linear (PING project).

## What it does

- **TaskCreate** → creates a Linear issue in PING
- **TaskCreate** with `metadata: { parentTaskId: "N" }` → creates a subtask linked to parent
- **TaskUpdate** status changes → syncs to Linear (`pending→Todo`, `in_progress→In Progress`, `completed→Done`)

## Setup

1. Get your Linear API key: **Linear → Settings → API → Personal API keys**

2. Add it to your `~/.claude/settings.json`:
   ```json
   {
     "env": {
       "LINEAR_API_KEY": "lin_api_your_key_here"
     }
   }
   ```

3. That's it — hooks run automatically when you use Claude Code in this repo.

## Usage

```
# Create a parent task (creates 8LI-XX in Linear)
TaskCreate("Build login page", "...")

# Create a subtask linked to task #5 (creates child issue in Linear)
TaskCreate("Add email validation", "...", metadata: { parentTaskId: "5" })

# Update status (syncs to Linear)
TaskUpdate(taskId: "5", status: "in_progress")
TaskUpdate(taskId: "5", status: "completed")
```
