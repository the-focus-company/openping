import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { PingClient } from "./convex-client.js";
import { registerTools } from "./tools.js";

const PING_API_URL = process.env.PING_API_URL;
const PING_API_TOKEN = process.env.PING_API_TOKEN;

if (!PING_API_URL || !PING_API_TOKEN) {
  console.error(
    "Error: PING_API_URL and PING_API_TOKEN environment variables are required",
  );
  console.error(
    "Usage: PING_API_URL=https://your-deployment.convex.site PING_API_TOKEN=ping_ag_... npx tsx src/index.ts",
  );
  process.exit(1);
}

const client = new PingClient(PING_API_URL, PING_API_TOKEN);
const server = new McpServer({
  name: "ping-workspace",
  version: "0.1.0",
});

registerTools(server, client);

const transport = new StdioServerTransport();
await server.connect(transport);
