import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Check, Copy, ChevronUp, ChevronDown } from "lucide-react-native";

interface CodeBlockProps {
  code: string;
  language?: string;
}

const COLLAPSE_THRESHOLD = 10;

export function CodeBlock({ code, language }: CodeBlockProps) {
  const lines = code.split("\n");
  const isLong = lines.length > COLLAPSE_THRESHOLD;
  const [expanded, setExpanded] = useState(!isLong);
  const [copied, setCopied] = useState(false);

  const displayCode = expanded ? code : lines.slice(0, COLLAPSE_THRESHOLD).join("\n");

  const handleCopy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.language}>{language || "code"}</Text>
        <Pressable onPress={handleCopy} hitSlop={8}>
          {copied ? (
            <Check size={14} color="#4ade80" />
          ) : (
            <Copy size={14} color="#666" />
          )}
        </Pressable>
      </View>
      <View style={styles.codeWrap}>
        <Text style={styles.code} selectable>
          {displayCode}
        </Text>
      </View>
      {isLong && (
        <Pressable
          style={styles.toggleBtn}
          onPress={() => setExpanded(!expanded)}
        >
          <Text style={styles.toggleText}>
            {expanded
              ? "Hide"
              : `Show ${lines.length - COLLAPSE_THRESHOLD} more lines`}
          </Text>
          {expanded ? (
            <ChevronUp size={14} color="#0a7ea4" />
          ) : (
            <ChevronDown size={14} color="#0a7ea4" />
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#1a1a2e",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    marginVertical: 6,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  language: {
    fontSize: 11,
    fontFamily: "monospace",
    color: "rgba(255,255,255,0.3)",
  },
  codeWrap: {
    padding: 12,
  },
  code: {
    fontFamily: "monospace",
    fontSize: 13,
    color: "#e0e0e0",
    lineHeight: 20,
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  toggleText: {
    fontSize: 12,
    color: "#0a7ea4",
  },
});
