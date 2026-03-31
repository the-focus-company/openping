import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
  ActionSheetIOS,
  Platform,
} from "react-native";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { X, Check, Clock, Smile } from "lucide-react-native";

const PRESET_STATUSES = [
  { emoji: "📅", text: "In a meeting", duration: "1 hour", minutes: 60 },
  { emoji: "🚌", text: "Commuting", duration: "30 minutes", minutes: 30 },
  { emoji: "🤒", text: "Out sick", duration: "Today", minutes: 480 },
  { emoji: "🌴", text: "Vacationing", duration: "Don't Clear", minutes: 0 },
  { emoji: "🏠", text: "Working remotely", duration: "Today", minutes: 480 },
  { emoji: "🎯", text: "Focus time", duration: "2 hours", minutes: 120 },
  { emoji: "🔇", text: "Do not disturb", duration: "1 hour", minutes: 60 },
  { emoji: "🍕", text: "Lunch break", duration: "1 hour", minutes: 60 },
];

const CLEAR_OPTIONS = [
  { label: "Don't Clear", minutes: 0 },
  { label: "30 minutes", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "2 hours", minutes: 120 },
  { label: "4 hours", minutes: 240 },
  { label: "Today", minutes: 480 },
];

const EMOJI_QUICK = ["😀", "😎", "🤔", "💪", "🔥", "🚀", "💻", "☕", "🎧", "✨", "🌟", "❤️"];

interface StatusModalProps {
  visible: boolean;
  onClose: () => void;
  currentEmoji?: string;
  currentText?: string;
}

export function StatusModal({
  visible,
  onClose,
  currentEmoji,
  currentText,
}: StatusModalProps) {
  const setStatus = useMutation(api.presence.setStatus);
  const clearStatus = useMutation(api.presence.clearStatus);

  const [emoji, setEmoji] = useState(currentEmoji ?? "");
  const [text, setText] = useState(currentText ?? "");
  const [clearAfter, setClearAfter] = useState("Don't Clear");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  function handleSave() {
    if (!text.trim() && !emoji) {
      clearStatus();
    } else {
      setStatus({
        statusEmoji: emoji || undefined,
        statusMessage: text.trim() || undefined,
      });
    }
    onClose();
  }

  function handleClear() {
    clearStatus();
    onClose();
  }

  function handlePreset(preset: typeof PRESET_STATUSES[0]) {
    setStatus({
      statusEmoji: preset.emoji,
      statusMessage: preset.text,
    });
    onClose();
  }

  function showClearOptions() {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", ...CLEAR_OPTIONS.map((o) => o.label)],
          cancelButtonIndex: 0,
        },
        (index) => {
          if (index > 0) {
            setClearAfter(CLEAR_OPTIONS[index - 1].label);
          }
        },
      );
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          {/* Header */}
          <View style={s.header}>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={22} color="#fff" />
            </Pressable>
            <Text style={s.headerTitle}>Set a Status</Text>
            <Pressable onPress={handleSave} hitSlop={8}>
              <Check size={22} color="#0a7ea4" />
            </Pressable>
          </View>

          <ScrollView style={s.body} showsVerticalScrollIndicator={false}>
            {/* Custom status input */}
            <View style={s.inputRow}>
              <Pressable
                style={s.emojiBtn}
                onPress={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                <Text style={s.emojiBtnText}>{emoji || "😀"}</Text>
              </Pressable>
              <TextInput
                style={s.input}
                placeholder="What's your status?"
                placeholderTextColor="#666"
                value={text}
                onChangeText={setText}
                maxLength={100}
                autoCapitalize="sentences"
              />
              {(text || emoji) && (
                <Pressable
                  onPress={() => { setEmoji(""); setText(""); }}
                  hitSlop={8}
                >
                  <X size={16} color="#666" />
                </Pressable>
              )}
            </View>

            {/* Quick emoji picker */}
            {showEmojiPicker && (
              <View style={s.emojiGrid}>
                {EMOJI_QUICK.map((e) => (
                  <Pressable
                    key={e}
                    style={[s.emojiGridBtn, emoji === e && s.emojiGridBtnActive]}
                    onPress={() => { setEmoji(e); setShowEmojiPicker(false); }}
                  >
                    <Text style={s.emojiGridText}>{e}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Clear after */}
            <Pressable style={s.clearAfterRow} onPress={showClearOptions}>
              <Clock size={18} color="#888" />
              <View style={{ flex: 1 }}>
                <Text style={s.clearAfterLabel}>Clear after...</Text>
                <Text style={s.clearAfterValue}>{clearAfter}</Text>
              </View>
              <Text style={s.chevron}>›</Text>
            </Pressable>

            {/* Current status */}
            {currentText && (
              <Pressable style={s.currentStatus} onPress={handleClear}>
                <View style={s.currentStatusInfo}>
                  <Text style={s.currentEmoji}>{currentEmoji ?? "💬"}</Text>
                  <Text style={s.currentText}>{currentText}</Text>
                </View>
                <Text style={s.clearBtn}>Clear</Text>
              </Pressable>
            )}

            {/* Presets */}
            <Text style={s.sectionLabel}>Suggestions</Text>
            {PRESET_STATUSES.map((preset, i) => (
              <Pressable
                key={i}
                style={({ pressed }) => [s.presetRow, pressed && s.presetRowPressed]}
                onPress={() => handlePreset(preset)}
              >
                <Text style={s.presetEmoji}>{preset.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.presetText}>{preset.text}</Text>
                  <Text style={s.presetDuration}>{preset.duration}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#1c1c1e",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "85%",
    paddingBottom: 34,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333",
  },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "600" },
  body: { paddingHorizontal: 20, paddingTop: 16 },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2c2c2e",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    marginBottom: 12,
  },
  emojiBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#3a3a3c",
    justifyContent: "center",
    alignItems: "center",
  },
  emojiBtnText: { fontSize: 18 },
  input: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
  },

  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  emojiGridBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  emojiGridBtnActive: {
    backgroundColor: "#333",
  },
  emojiGridText: { fontSize: 22 },

  clearAfterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333",
    marginBottom: 12,
  },
  clearAfterLabel: { color: "#ccc", fontSize: 15 },
  clearAfterValue: { color: "#888", fontSize: 13, marginTop: 1 },
  chevron: { color: "#666", fontSize: 22 },

  currentStatus: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#222",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  currentStatusInfo: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  currentEmoji: { fontSize: 18 },
  currentText: { color: "#ccc", fontSize: 14 },
  clearBtn: { color: "#ef4444", fontSize: 13, fontWeight: "600" },

  sectionLabel: {
    color: "#888",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  presetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#222",
  },
  presetRowPressed: { backgroundColor: "#2c2c2e", borderRadius: 8 },
  presetEmoji: { fontSize: 22, width: 32, textAlign: "center" },
  presetText: { color: "#ccc", fontSize: 15 },
  presetDuration: { color: "#666", fontSize: 12, marginTop: 1 },
});
