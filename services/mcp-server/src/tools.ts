import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PingClient } from "./convex-client.js";

export function registerTools(server: McpServer, client: PingClient) {
  server.tool(
    "ping_list_channels",
    "List channels you have access to in PING",
    {},
    async () => {
      const channels = await client.listChannels();
      return {
        content: [{ type: "text", text: JSON.stringify(channels, null, 2) }],
      };
    },
  );

  server.tool(
    "ping_read_messages",
    "Read recent messages from a PING channel",
    {
      channelId: z
        .string()
        .describe("The channel ID to read messages from"),
      limit: z
        .number()
        .optional()
        .default(20)
        .describe("Number of messages to fetch (max 50)"),
    },
    async ({ channelId, limit }) => {
      const messages = await client.readMessages(channelId, limit);
      return {
        content: [{ type: "text", text: JSON.stringify(messages, null, 2) }],
      };
    },
  );

  server.tool(
    "ping_send_message",
    "Send a message to a PING channel",
    {
      channelId: z
        .string()
        .describe("The channel ID to send the message to"),
      body: z.string().describe("The message text to send"),
    },
    async ({ channelId, body }) => {
      const result = await client.sendMessage(channelId, body);
      return {
        content: [
          { type: "text", text: `Message sent: ${JSON.stringify(result)}` },
        ],
      };
    },
  );

  server.tool(
    "ping_list_conversations",
    "List your DM conversations in PING",
    {},
    async () => {
      const conversations = await client.listConversations();
      return {
        content: [
          { type: "text", text: JSON.stringify(conversations, null, 2) },
        ],
      };
    },
  );

  server.tool(
    "ping_read_conversation",
    "Read messages from a DM conversation",
    {
      conversationId: z.string().describe("The conversation ID"),
      limit: z
        .number()
        .optional()
        .default(20)
        .describe("Number of messages to fetch"),
    },
    async ({ conversationId, limit }) => {
      const messages = await client.readConversation(conversationId, limit);
      return {
        content: [{ type: "text", text: JSON.stringify(messages, null, 2) }],
      };
    },
  );

  server.tool(
    "ping_send_dm",
    "Send a direct message in a PING conversation",
    {
      conversationId: z.string().describe("The conversation ID"),
      body: z.string().describe("The message text to send"),
    },
    async ({ conversationId, body }) => {
      const result = await client.sendDM(conversationId, body);
      return {
        content: [
          { type: "text", text: `DM sent: ${JSON.stringify(result)}` },
        ],
      };
    },
  );

  server.tool(
    "ping_whoami",
    "Get your agent identity in PING",
    {},
    async () => {
      const me = await client.getMe();
      return {
        content: [{ type: "text", text: JSON.stringify(me, null, 2) }],
      };
    },
  );
}
