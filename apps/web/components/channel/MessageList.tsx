"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, AtSign } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface Message {
  id: string;
  type: "user" | "bot";
  author: string;
  authorInitials: string;
  content: string;
  timestamp: Date;
  botName?: string;
}

interface MessageRowProps {
  message: Message;
  showAvatar: boolean;
}

function MessageRow({ message, showAvatar }: MessageRowProps) {
  const isBot = message.type === "bot";

  return (
    <div
      className={cn(
        "group flex gap-3 px-4 py-1.5 transition-colors hover:bg-surface-2/60",
        showAvatar ? "mt-3" : "mt-0"
      )}
    >
      {/* Avatar column */}
      <div className="w-6 shrink-0 pt-0.5">
        {showAvatar ? (
          <Avatar className="h-6 w-6">
            <AvatarFallback
              className={cn(
                "text-2xs font-medium",
                isBot
                  ? "bg-ping-purple/20 text-ping-purple"
                  : "bg-surface-3 text-foreground"
              )}
            >
              {isBot ? <Bot className="h-3 w-3" /> : message.authorInitials}
            </AvatarFallback>
          </Avatar>
        ) : null}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {showAvatar && (
          <div className="flex items-baseline gap-2 pb-0.5">
            <span className={cn("text-xs font-semibold", isBot ? "text-ping-purple" : "text-foreground")}>
              {isBot ? message.botName || "KnowledgeBot" : message.author}
            </span>
            {isBot && (
              <span className="rounded border border-ping-purple/30 bg-ping-purple/10 px-1 py-px text-2xs text-ping-purple">
                AI
              </span>
            )}
            <span className="text-2xs text-white/25">
              {message.timestamp.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })}
            </span>
          </div>
        )}

        <div
          className={cn(
            "text-sm leading-relaxed",
            isBot ? "text-foreground" : "text-foreground/90"
          )}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}

interface MessageListProps {
  channelName: string;
  messages: Message[];
  memberCount?: number;
  onSend?: (content: string) => void;
}

export function MessageList({ channelName, messages, memberCount, onSend }: MessageListProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend?.(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Channel header */}
      <div className="flex items-center gap-2 border-b border-subtle px-4 py-2">
        <span className="text-sm font-medium text-foreground">#{channelName}</span>
        {memberCount !== undefined && (
          <span className="rounded bg-surface-3 px-1.5 py-px text-2xs text-muted-foreground">
            {memberCount} member{memberCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-2 scrollbar-thin">
        {messages.map((msg, i) => {
          const prev = messages[i - 1];
          const showAvatar =
            !prev ||
            prev.author !== msg.author ||
            msg.timestamp.getTime() - prev.timestamp.getTime() > 5 * 60 * 1000;

          return (
            <MessageRow key={msg.id} message={msg} showAvatar={showAvatar} />
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-subtle p-3">
        <div className="flex items-end gap-2 rounded border border-subtle bg-surface-2 px-3 py-2 focus-within:border-white/15">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message #${channelName}... or @KnowledgeBot`}
            rows={1}
            className="max-h-32 flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-white/25 focus:outline-none"
            style={{ height: "20px" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "20px";
              el.style.height = `${el.scrollHeight}px`;
            }}
          />
          <div className="flex shrink-0 items-center gap-1 pb-0.5">
            <button
              onClick={() => {
                setInput((prev) => prev + "@");
                textareaRef.current?.focus();
              }}
              className="rounded p-1 text-white/25 hover:bg-surface-3 hover:text-white/60"
            >
              <AtSign className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className={cn(
                "rounded p-1 transition-colors",
                input.trim()
                  ? "bg-ping-purple text-white hover:bg-ping-purple-hover"
                  : "text-white/20"
              )}
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <p className="mt-1 text-2xs text-white/20">
          Enter to send · Shift+Enter for new line · @mention to summon agents
        </p>
      </div>
    </div>
  );
}
