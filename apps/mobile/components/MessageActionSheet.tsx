import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
} from "react-native";
import { SmilePlus, MessageCircle, CornerUpRight, Link, Info } from "lucide-react-native";

const EMOJI_LIST = [
  "👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "🙏",
  "👏", "💯", "🚀", "👀", "💪", "✅", "❌", "⭐",
  "🤔", "😍", "🙌", "💡", "👎", "😅", "🤝", "💀",
];

interface MessageActionSheetProps {
  visible: boolean;
  onClose: () => void;
  onReaction: (emoji: string) => void;
  onReply: () => void;
  onForward: () => void;
  onCopyLink: () => void;
  messageDate: number;
}

export function MessageActionSheet({
  visible,
  onClose,
  onReaction,
  onReply,
  onForward,
  onCopyLink,
  messageDate,
}: MessageActionSheetProps) {
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  const formattedDate = new Date(messageDate).toLocaleString([], {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  function handleClose() {
    setEmojiPickerOpen(false);
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          {emojiPickerOpen ? (
            <>
              <View style={styles.emojiHeader}>
                <Text style={styles.emojiHeaderText}>Choose a reaction</Text>
              </View>
              <ScrollView contentContainerStyle={styles.emojiGrid}>
                {EMOJI_LIST.map((emoji) => (
                  <Pressable
                    key={emoji}
                    style={({ pressed }) => [
                      styles.emojiBtn,
                      pressed && styles.emojiBtnPressed,
                    ]}
                    onPress={() => {
                      onReaction(emoji);
                      handleClose();
                    }}
                  >
                    <Text style={styles.emojiText}>{emoji}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable style={styles.cancelBtn} onPress={handleClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </>
          ) : (
            <>
              {/* Action buttons row */}
              <View style={styles.actionsRow}>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => setEmojiPickerOpen(true)}
                >
                  <View style={styles.actionIconWrap}>
                    <SmilePlus size={20} color="#fff" />
                  </View>
                  <Text style={styles.actionLabel}>React</Text>
                </Pressable>

                <Pressable
                  style={styles.actionBtn}
                  onPress={() => {
                    onReply();
                    onClose();
                  }}
                >
                  <View style={styles.actionIconWrap}>
                    <MessageCircle size={20} color="#fff" />
                  </View>
                  <Text style={styles.actionLabel}>Reply</Text>
                </Pressable>

                <Pressable
                  style={styles.actionBtn}
                  onPress={() => {
                    onForward();
                    onClose();
                  }}
                >
                  <View style={styles.actionIconWrap}>
                    <CornerUpRight size={20} color="#fff" />
                  </View>
                  <Text style={styles.actionLabel}>Forward</Text>
                </Pressable>

                <Pressable
                  style={styles.actionBtn}
                  onPress={() => {
                    onCopyLink();
                    onClose();
                  }}
                >
                  <View style={styles.actionIconWrap}>
                    <Link size={20} color="#fff" />
                  </View>
                  <Text style={styles.actionLabel}>Copy Link</Text>
                </Pressable>
              </View>

              {/* Info line */}
              <View style={styles.listActions}>
                <View style={styles.listItem}>
                  <Info size={18} color="#999" />
                  <Text style={styles.listLabel}>Sent {formattedDate}</Text>
                </View>
              </View>

              {/* Cancel */}
              <Pressable style={styles.cancelBtn} onPress={handleClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </>
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#1c1c1e",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingTop: 12,
    paddingBottom: 34,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333",
  },
  actionBtn: {
    alignItems: "center",
    gap: 6,
    minWidth: 70,
  },
  actionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#2c2c2e",
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 12,
    color: "#999",
  },
  listActions: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333",
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  listLabel: {
    fontSize: 15,
    color: "#ccc",
  },
  cancelBtn: {
    alignItems: "center",
    paddingVertical: 14,
  },
  cancelText: {
    fontSize: 16,
    color: "#0a7ea4",
    fontWeight: "600",
  },
  emojiHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333",
  },
  emojiHeaderText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ccc",
    textAlign: "center",
  },
  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    padding: 12,
    gap: 4,
  },
  emojiBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiBtnPressed: {
    backgroundColor: "#333",
  },
  emojiText: {
    fontSize: 28,
  },
});
