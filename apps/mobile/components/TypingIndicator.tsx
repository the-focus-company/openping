import { View, Text, StyleSheet } from "react-native";

interface TypingIndicatorProps {
  userNames: string[];
}

export function TypingIndicator({ userNames }: TypingIndicatorProps) {
  if (userNames.length === 0) return null;

  let label: string;
  if (userNames.length === 1) {
    label = `${userNames[0]} is typing...`;
  } else if (userNames.length === 2) {
    label = `${userNames[0]} and ${userNames[1]} are typing...`;
  } else {
    label = `${userNames[0]} and ${userNames.length - 1} others are typing...`;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  text: {
    fontSize: 12,
    color: "#888",
    fontStyle: "italic",
  },
});
