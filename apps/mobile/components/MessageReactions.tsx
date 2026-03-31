import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  StyleSheet,
} from "react-native";
import type { ReactionGroup } from "@/hooks/useReactions";

const EMOJI_LIST = [
  "👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "🙏",
  "👏", "💯", "🚀", "👀", "💪", "✅", "❌", "⭐",
  "🤔", "😍", "🙌", "💡", "👎", "😅", "🤝", "💀",
];

interface MessageReactionsProps {
  reactions: ReactionGroup[];
  onToggle: (emoji: string) => void;
  currentUserId?: string;
}

export function MessageReactions({
  reactions,
  onToggle,
  currentUserId,
}: MessageReactionsProps) {
  const [pickerVisible, setPickerVisible] = useState(false);

  if (reactions.length === 0) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillRow}
      >
        {reactions.map((r) => {
          const isActive = currentUserId
            ? r.userIds.includes(currentUserId)
            : false;
          return (
            <Pressable
              key={r.emoji}
              style={[styles.pill, isActive && styles.pillActive]}
              onPress={() => onToggle(r.emoji)}
            >
              <Text style={styles.pillEmoji}>{r.emoji}</Text>
              <Text style={[styles.pillCount, isActive && styles.pillCountActive]}>
                {r.count}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          style={styles.addButton}
          onPress={() => setPickerVisible(true)}
        >
          <Text style={styles.addButtonText}>+</Text>
        </Pressable>
      </ScrollView>

      <EmojiPickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={(emoji) => {
          onToggle(emoji);
          setPickerVisible(false);
        }}
      />
    </View>
  );
}

export function EmojiPickerModal({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
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
                onPress={() => onSelect(emoji)}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
  },
  pillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#222",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: "transparent",
  },
  pillActive: {
    borderColor: "#0a7ea4",
  },
  pillEmoji: {
    fontSize: 14,
  },
  pillCount: {
    fontSize: 12,
    color: "#ccc",
  },
  pillCountActive: {
    color: "#0a7ea4",
  },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "#222",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#333",
  },
  addButtonText: {
    fontSize: 14,
    color: "#888",
  },
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
  cancelBtn: {
    alignItems: "center",
    paddingVertical: 14,
  },
  cancelText: {
    fontSize: 16,
    color: "#0a7ea4",
    fontWeight: "600",
  },
});
