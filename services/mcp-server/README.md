# PING MCP Server

An MCP (Model Context Protocol) server that lets AI tools like Claude Code interact with a PING workspace. It exposes PING channels, messages, and DM conversations as MCP tools over stdio transport.

## Setup

### 1. Generate an API token

Go to **PING Settings > Agents** in your workspace and create a new agent. Copy the generated API token (starts with `ping_ag_`).

### 2. Configure Claude Code

Add the following to your `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ping": {
      "command": "npx",
      "args": ["tsx", "/path/to/services/mcp-server/src/index.ts"],
      "env": {
        "PING_API_URL": "https://your-deployment.convex.site",
        "PING_API_TOKEN": "ping_ag_your-token-here"
      }
    }
  }
}
```

### 3. Environment variables

| Variable | Description |
|---|---|
| `PING_API_URL` | Your Convex deployment HTTP URL (e.g., `https://your-deployment.convex.site`) |
| `PING_API_TOKEN` | Agent API token generated from PING Settings |

## Available tools

| Tool | Description |
|---|---|
| `ping_whoami` | Get your agent identity in PING |
| `ping_list_channels` | List channels you have access to |
| `ping_read_messages` | Read recent messages from a channel |
| `ping_send_message` | Send a message to a channel |
| `ping_list_conversations` | List your DM conversations |
| `ping_read_conversation` | Read messages from a DM conversation |
| `ping_send_dm` | Send a direct message in a conversation |

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode (auto-reload)
pnpm dev

# Type-check
pnpm typecheck
```
