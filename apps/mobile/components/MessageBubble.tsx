import { useState, useMemo } from "react";
import { View, Text, Pressable, Image, Linking, StyleSheet } from "react-native";
import {
  MessageReactions,
  EmojiPickerModal,
} from "@/components/MessageReactions";
import { ThreadIndicator } from "@/components/ThreadIndicator";
import { CodeBlock } from "@/components/CodeBlock";
import type { ReactionGroup } from "@/hooks/useReactions";

interface MessageBubbleProps {
  authorName: string;
  authorAvatarUrl?: string | null;
  body: string;
  timestamp: number;
  isOwn?: boolean;
  type?: "user" | "bot" | "system" | "integration";
  messageId?: string;
  reactions?: ReactionGroup[];
  onToggleReaction?: (emoji: string) => void;
  currentUserId?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  onMentionPress?: (name: string) => void;
  threadReplyCount?: number;
  threadLastReplyAuthor?: string;
  threadLastReplyAvatarUrl?: string | null;
  threadLastReplyAt?: number;
  onThreadPress?: () => void;
  /** When false, hides avatar/name/time for grouped consecutive messages */
  showHeader?: boolean;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Parse message body into segments: text and code blocks
interface TextSegment {
  type: "text";
  content: string;
}
interface CodeSegment {
  type: "code";
  language?: string;
  content: string;
}
type Segment = TextSegment | CodeSegment;

function parseBody(body: string): Segment[] {
  const segments: Segment[] = [];
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(body)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: body.slice(lastIndex, match.index) });
    }
    segments.push({
      type: "code",
      language: match[1] || undefined,
      content: match[2].replace(/\n$/, ""),
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < body.length) {
    segments.push({ type: "text", content: body.slice(lastIndex) });
  }

  return segments;
}

// Inline formatting: code, links, bold, italic, strikethrough, @mentions
// @mentions: @Word + optional capitalized continuation words (e.g. @Rafał Wyderka)
const INLINE_REGEX = /(`[^`]+`|https?:\/\/[^\s<>)"']+|\*\*(.+?)\*\*|\*(.+?)\*|~~(.+?)~~|@(\w+(?:\s[A-Z\u00C0-\u024F]\w*)*))/g;

function renderInlineText(text: string, onMentionPress?: (name: string) => void) {
  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  INLINE_REGEX.lastIndex = 0;
  while ((match = INLINE_REGEX.exec(text)) !== null) {
    // Push preceding plain text
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }

    const full = match[0];
    const key = `m${match.index}`;

    if (full.startsWith("`")) {
      result.push(
        <Text key={key} style={styles.inlineCode}>
          {full.slice(1, -1)}
        </Text>,
      );
    } else if (full.startsWith("http")) {
      result.push(
        <Text key={key} style={styles.link} onPress={() => Linking.openURL(full)}>
          {full}
        </Text>,
      );
    } else if (full.startsWith("**")) {
      result.push(
        <Text key={key} style={styles.bold}>
          {match[2]}
        </Text>,
      );
    } else if (full.startsWith("*")) {
      result.push(
        <Text key={key} style={styles.italic}>
          {match[3]}
        </Text>,
      );
    } else if (full.startsWith("~~")) {
      result.push(
        <Text key={key} style={styles.strikethrough}>
          {match[4]}
        </Text>,
      );
    } else if (full.startsWith("@")) {
      const mentionName = match[5];
      result.push(
        <Text
          key={key}
          style={styles.mention}
          onPress={onMentionPress ? () => onMentionPress(mentionName) : undefined}
        >
          {full}
        </Text>,
      );
    }

    lastIndex = match.index + full.length;
  }

  // Push remaining plain text
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result;
}

export function MessageBubble({
  authorName,
  authorAvatarUrl,
  body,
  timestamp,
  isOwn = false,
  type = "user",
  reactions,
  onToggleReaction,
  currentUserId,
  onPress,
  onLongPress,
  onMentionPress,
  threadReplyCount,
  threadLastReplyAuthor,
  threadLastReplyAvatarUrl,
  threadLastReplyAt,
  onThreadPress,
  showHeader = true,
}: MessageBubbleProps) {
  const [pickerVisible, setPickerVisible] = useState(false);

  const segments = useMemo(() => parseBody(body), [body]);

  const handleLongPress = () => {
    if (onLongPress) {
      onLongPress();
    } else if (onToggleReaction) {
      setPickerVisible(true);
    }
  };

  if (type === "system") {
    return (
      <View style={styles.systemContainer}>
        <Text style={styles.systemText}>{body}</Text>
      </View>
    );
  }

  const hasReactions = reactions && reactions.length > 0 && onToggleReaction;
  const hasThread = threadReplyCount != null && threadReplyCount > 0 && onThreadPress;

  const initials = authorName ? authorName.charAt(0).toUpperCase() : "?";

  const bodyContent = (
    <View>
      {segments.map((seg, i) =>
        seg.type === "code" ? (
          <CodeBlock key={i} code={seg.content} language={seg.language} />
        ) : (
          <Text key={i} style={styles.body}>
            {renderInlineText(seg.content, onMentionPress)}
          </Text>
        ),
      )}
    </View>
  );

  return (
    <Pressable onPress={onPress} onLongPress={handleLongPress}>
      <View style={[showHeader ? styles.container : styles.containerCompact, isOwn && styles.ownContainer]}>
        {showHeader ? (
          <View style={styles.row}>
            {authorAvatarUrl ? (
              <Image source={{ uri: authorAvatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
            <View style={styles.contentColumn}>
              <View style={styles.header}>
                <Text style={[styles.author, type === "bot" && styles.botAuthor]}>
                  {authorName}
                  {type === "bot" ? " (bot)" : ""}
                </Text>
                <Text style={styles.time}>{formatTime(timestamp)}</Text>
              </View>
              {bodyContent}
              {hasReactions && (
                <MessageReactions
                  reactions={reactions}
                  onToggle={onToggleReaction}
                  currentUserId={currentUserId}
                />
              )}
              {hasThread && (
                <ThreadIndicator
                  replyCount={threadReplyCount}
                  lastReplyAuthor={threadLastReplyAuthor}
                  lastReplyAvatarUrl={threadLastReplyAvatarUrl}
                  lastReplyAt={threadLastReplyAt}
                  onPress={onThreadPress}
                />
              )}
            </View>
          </View>
        ) : (
          <View style={styles.compactRow}>
            {bodyContent}
            {hasReactions && (
              <MessageReactions
                reactions={reactions}
                onToggle={onToggleReaction}
                currentUserId={currentUserId}
              />
            )}
            {hasThread && (
              <ThreadIndicator
                replyCount={threadReplyCount}
                lastReplyAuthor={threadLastReplyAuthor}
                lastReplyAvatarUrl={threadLastReplyAvatarUrl}
                lastReplyAt={threadLastReplyAt}
                onPress={onThreadPress}
              />
            )}
          </View>
        )}
      </View>
      {onToggleReaction && (
        <EmojiPickerModal
          visible={pickerVisible}
          onClose={() => setPickerVisible(false)}
          onSelect={(emoji) => {
            onToggleReaction(emoji);
            setPickerVisible(false);
          }}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  containerCompact: {
    paddingHorizontal: 16,
    paddingVertical: 2,
  },
  ownContainer: {},
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  avatarInitials: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  contentColumn: {
    flex: 1,
  },
  compactRow: {
    // 40px avatar + 10px gap = 50px left margin to align with content
    marginLeft: 50,
  },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 2,
    gap: 8,
  },
  author: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  botAuthor: {
    color: "#0a7ea4",
  },
  time: {
    fontSize: 12,
    color: "#666",
  },
  body: {
    fontSize: 15,
    color: "#e0e0e0",
    lineHeight: 22,
  },
  inlineCode: {
    fontFamily: "monospace",
    fontSize: 13,
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "#f0abfc",
    borderRadius: 3,
    paddingHorizontal: 4,
  },
  link: {
    color: "#0a7ea4",
    textDecorationLine: "underline" as const,
  },
  bold: {
    fontWeight: "700" as const,
    color: "#fff",
  },
  italic: {
    fontStyle: "italic" as const,
  },
  strikethrough: {
    textDecorationLine: "line-through" as const,
    color: "#999",
  },
  mention: {
    color: "#0a7ea4",
    fontWeight: "600" as const,
    backgroundColor: "rgba(10,126,164,0.15)",
    borderRadius: 3,
    paddingHorizontal: 2,
  },
  systemContainer: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    alignItems: "center",
  },
  systemText: {
    fontSize: 13,
    color: "#666",
    fontStyle: "italic",
  },
});
