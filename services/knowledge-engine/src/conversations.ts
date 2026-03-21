/**
 * In-memory conversation context store for follow-up question support.
 * Tracks previous query turns so the engine can expand/refine queries
 * using prior context within the same conversation.
 */

import type { ConversationContext, ConversationTurn } from "./types.js";
import { v4 as uuidv4 } from "uuid";

/** Max turns to keep per conversation. */
const MAX_TURNS = 20;
/** Conversation TTL in milliseconds (30 minutes). */
const CONVERSATION_TTL_MS = 30 * 60 * 1000;

const conversations = new Map<string, ConversationContext>();

setInterval(() => {
  const now = Date.now();
  for (const [id, ctx] of conversations) {
    if (now - new Date(ctx.last_activity).getTime() > CONVERSATION_TTL_MS) {
      conversations.delete(id);
    }
  }
}, 60_000);

export function getOrCreateConversation(
  conversationId?: string,
): ConversationContext {
  if (conversationId && conversations.has(conversationId)) {
    return conversations.get(conversationId)!;
  }

  const id = conversationId ?? uuidv4();
  const ctx: ConversationContext = {
    id,
    turns: [],
    created_at: new Date().toISOString(),
    last_activity: new Date().toISOString(),
  };
  conversations.set(id, ctx);
  return ctx;
}

export function addTurn(
  conversationId: string,
  turn: ConversationTurn,
): void {
  const ctx = conversations.get(conversationId);
  if (!ctx) return;

  ctx.turns.push(turn);
  if (ctx.turns.length > MAX_TURNS) {
    ctx.turns = ctx.turns.slice(-MAX_TURNS);
  }
  ctx.last_activity = new Date().toISOString();
}

/**
 * Build an expanded query string that incorporates prior conversation context.
 * Prepends a summary of previous turns so the search engine can resolve
 * pronouns and references from follow-up questions.
 */
export function buildContextualQuery(
  conversationId: string,
  currentQuery: string,
): string {
  const ctx = conversations.get(conversationId);
  if (!ctx || ctx.turns.length === 0) return currentQuery;

  const recentTurns = ctx.turns.slice(-3);
  const contextPrefix = recentTurns
    .map((t) => `Previous question: "${t.query}"`)
    .join(" | ");

  return `${contextPrefix} | Current question: "${currentQuery}"`;
}

export function getConversation(
  id: string,
): ConversationContext | undefined {
  return conversations.get(id);
}

export function deleteConversation(id: string): boolean {
  return conversations.delete(id);
}
