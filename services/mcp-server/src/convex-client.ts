/**
 * Simple HTTP client for the PING Agent API.
 * Communicates with Convex HTTP endpoints — does NOT use the Convex JS client.
 */
export class PingClient {
  constructor(
    private baseUrl: string,
    private apiToken: string,
  ) {}

  private async request(path: string, method = "GET", body?: unknown) {
    const url = new URL(path, this.baseUrl);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiToken}`,
      "Content-Type": "application/json",
    };
    const res = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const error = await res.text();
      throw new Error(`PING API error ${res.status}: ${error}`);
    }
    const json = await res.json();
    return json.data;
  }

  async getMe() {
    return this.request("/api/agent/v1/me");
  }

  async listChannels() {
    return this.request("/api/agent/v1/channels");
  }

  async readMessages(channelId: string, limit = 50) {
    return this.request(
      `/api/agent/v1/channel-messages?channelId=${channelId}&limit=${limit}`,
    );
  }

  async sendMessage(channelId: string, body: string) {
    return this.request("/api/agent/v1/channel-messages", "POST", {
      channelId,
      body,
    });
  }

  async listConversations() {
    return this.request("/api/agent/v1/conversations");
  }

  async readConversation(conversationId: string, limit = 50) {
    return this.request(
      `/api/agent/v1/conversation-messages?conversationId=${conversationId}&limit=${limit}`,
    );
  }

  async sendDM(conversationId: string, body: string) {
    return this.request("/api/agent/v1/conversation-messages", "POST", {
      conversationId,
      body,
    });
  }
}
