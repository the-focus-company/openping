/**
 * Civic Nexus MCP Client — secure proxy for AI agent access to external tools.
 *
 * All proactive agents (scanPRReviewNudges, scanBlockedTasks, routeIncident, etc.)
 * use this module to communicate with GitHub, Linear, Slack and other services
 * through Civic Nexus guardrails.
 *
 * Civic Nexus provides:
 * - Per-tool access control (agents can only read, never delete/merge)
 * - Secret management (OAuth tokens never touch Convex env)
 * - Full audit trail of every tool call
 * - Prompt injection defense
 *
 * Env var required: CIVIC_NEXUS_URL (MCP endpoint, defaults to https://app.civic.com/hub/mcp)
 *                   CIVIC_NEXUS_API_TOKEN (API token from Civic Nexus dashboard)
 */

import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";

type ToolSet = Awaited<ReturnType<MCPClient["tools"]>>;

let _client: MCPClient | null = null;
let _toolsCache: ToolSet | null = null;

/**
 * Get or create a singleton MCP client connected to Civic Nexus.
 * Reuses the connection across tool calls within the same action.
 */
export async function getCivicNexusClient(): Promise<MCPClient> {
  if (_client) return _client;

  const token = process.env.CIVIC_NEXUS_API_TOKEN;
  if (!token) {
    throw new Error(
      "CIVIC_NEXUS_API_TOKEN not configured. " +
        "Get your token from https://app.civic.com/settings/api",
    );
  }

  const url =
    process.env.CIVIC_NEXUS_URL ?? "https://app.civic.com/hub/mcp";

  _client = await createMCPClient({
    name: "ping-workspace-agent",
    version: "1.0.0",
    transport: {
      type: "http",
      url,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    onUncaughtError: (error) => {
      console.error("[civicNexus] Uncaught MCP error");
      _client = null;
      _toolsCache = null;
    },
  });

  return _client;
}

/**
 * Execute a single tool call against Civic Nexus and return the text content.
 * Handles connection lifecycle — opens client, calls tool, closes client.
 *
 * Use this for one-shot calls from Convex actions where you don't need
 * to keep the connection open for multiple calls.
 */
export async function callCivicNexusTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<string> {
  const client = await getCivicNexusClient();

  if (!_toolsCache) {
    _toolsCache = await client.tools();
  }
  const tools = _toolsCache;

  const tool = tools[toolName];
  if (!tool) {
    const available = Object.keys(tools).join(", ");
    throw new Error(
      `Tool "${toolName}" not found in Civic Nexus. Available: ${available}`,
    );
  }

  const result = await tool.execute(args, {
    toolCallId: `ping-${Date.now()}`,
    messages: [],
  });

  // Extract text from MCP CallToolResult
  if ("content" in result && Array.isArray(result.content)) {
    const textParts = result.content
      .filter((c: { type: string }) => c.type === "text")
      .map((c: { type: "text"; text: string }) => c.text);
    return textParts.join("\n");
  }

  if ("toolResult" in result) {
    return JSON.stringify(result.toolResult);
  }

  return JSON.stringify(result);
}

/**
 * Close the MCP client connection. Call this at the end of long-running actions.
 */
/**
 * List all available tool names from Civic Nexus.
 * Useful for discovering exact tool names during integration setup.
 */
export async function listCivicNexusTools(): Promise<string[]> {
  const client = await getCivicNexusClient();
  if (!_toolsCache) {
    _toolsCache = await client.tools();
  }
  return Object.keys(_toolsCache);
}

/**
 * Close the MCP client connection. Call this at the end of long-running actions.
 */
export async function closeCivicNexusClient(): Promise<void> {
  if (_client) {
    await _client.close();
    _client = null;
    _toolsCache = null;
  }
}
