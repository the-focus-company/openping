import type { Citation } from "@/components/bot/CitationPill";
import type { ReactionGroup } from "@/components/channel/MessageReactions";

export type VirtualRow =
  | { kind: "date"; label: string; messageIndex: number }
  | { kind: "message"; messageIndex: number };

export interface Message {
  id: string;
  type: "user" | "bot" | "system";
  /** Raw message type from DB (user/bot/system/integration) */
  messageType?: string;
  authorId: string;
  author: string;
  authorInitials: string;
  authorAvatarUrl?: string | null;
  content: string;
  timestamp: Date;
  citations?: Citation[];
  botName?: string;
  threadReplyCount?: number;
  threadLastReplyAt?: number;
  threadParticipants?: Array<{ _id: string; name: string; avatarUrl?: string | null }>;
  threadId?: string;
  alsoSentToChannel?: boolean;
  reactions?: ReactionGroup[];
  isEdited?: boolean;
  integrationObjectId?: string;
  integrationHistory?: Array<{ body: string; timestamp: number }>;
  integrationObject?: {
    identifier?: string;
    type?: string;
    title?: string;
    status?: string;
    url?: string;
    author?: string;
  };
  attachments?: Array<{
    storageId: string;
    filename: string;
    mimeType: string;
    size: number;
  }>;
  meetingId?: string;
  meeting?: {
    _id: string;
    title: string;
    provider: string;
    meetingUrl: string;
    status: string;
    startedBy: { name: string; avatarUrl?: string | null };
    startedAt: number;
    endedAt?: number;
    participants: Array<{
      userId: string;
      name: string;
      avatarUrl?: string | null;
      joinedAt: number;
    }>;
  };
}

export interface MessageItemProps {
  message: Message;
  showAvatar: boolean;
  showThreadLabel?: boolean;
  onOpenThread?: (messageId: string) => void;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  currentUserId?: string;
  onEditMessage?: (messageId: string, newBody: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onClickAuthor?: (authorId: string) => void;
  onClickMention?: (name: string) => void;
  /** Called when user clicks copy-link on a message (hover action or timestamp click) */
  onCopyMessageLink?: (messageId: string) => void;
  onJoinMeeting?: (meetingId: string, meetingUrl: string) => void;
  onEndMeeting?: (meetingId: string) => void;
}

export interface TypingUser {
  _id: string;
  name: string;
  avatarUrl?: string | null;
}
