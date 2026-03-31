import { useState } from "react";
import { View, Text, Image, Pressable, useWindowDimensions, StyleSheet, Linking } from "react-native";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { AttachmentPreview } from "./AttachmentPreview";
import { isImageType } from "@/lib/fileUpload";
import { ChevronUp } from "lucide-react-native";

interface Attachment {
  storageId: string;
  filename: string;
  mimeType: string;
  size: number;
}

interface CollapsibleAttachmentsProps {
  attachments: Attachment[];
}

const GRID_COLS = 4;
const GRID_MAX = 8; // 4x2
const GAP = 2;

function ImageTile({ storageId, size }: { storageId: string; size: number }) {
  const fileUrl = useQuery(api.files.getFileUrl, { storageId });
  if (!fileUrl) {
    return (
      <View style={{ width: size, height: size, backgroundColor: "#222", borderRadius: 4 }} />
    );
  }
  return (
    <Pressable onPress={() => Linking.openURL(fileUrl)}>
      <Image
        source={{ uri: fileUrl }}
        style={{ width: size, height: size, borderRadius: 4 }}
        resizeMode="cover"
      />
    </Pressable>
  );
}

export function CollapsibleAttachments({ attachments }: CollapsibleAttachmentsProps) {
  const [expanded, setExpanded] = useState(false);
  const { width } = useWindowDimensions();

  if (!attachments || attachments.length === 0) return null;

  const images = attachments.filter((a) => isImageType(a.mimeType));
  const files = attachments.filter((a) => !isImageType(a.mimeType));

  // Content area aligned with message text: screen - 16px right padding - 66px left (16 container + 40 avatar + 10 gap)
  const leftOffset = 66; // 16px paddingHorizontal + 40px avatar + 10px gap
  const contentWidth = width - 16 - leftOffset;
  const tileSize = Math.floor((contentWidth - GAP * (GRID_COLS - 1)) / GRID_COLS);

  const visibleImages = images.slice(0, GRID_MAX);
  const remainingCount = images.length - GRID_MAX;
  const showOverlay = remainingCount > 0 && !expanded;
  const displayImages = expanded ? images : visibleImages;

  return (
    <View style={[styles.container, { marginLeft: leftOffset, marginRight: 16 }]}>
      {/* Photo Grid */}
      {displayImages.length > 0 && (
        <View style={styles.grid}>
          {displayImages.map((img, idx) => {
            const isLast = !expanded && idx === visibleImages.length - 1 && showOverlay;
            return (
              <View
                key={img.storageId || idx}
                style={{
                  width: tileSize,
                  height: tileSize,
                  marginRight: (idx + 1) % GRID_COLS === 0 ? 0 : GAP,
                  marginBottom: GAP,
                }}
              >
                <ImageTile storageId={img.storageId} size={tileSize} />
                {isLast && (
                  <Pressable
                    style={[StyleSheet.absoluteFill, styles.overlay]}
                    onPress={() => setExpanded(true)}
                  >
                    <Text style={styles.overlayText}>+{remainingCount}</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      )}

      {expanded && images.length > GRID_MAX && (
        <Pressable style={styles.toggleBtn} onPress={() => setExpanded(false)}>
          <ChevronUp size={14} color="#0a7ea4" />
          <Text style={styles.toggleText}>Show less</Text>
        </Pressable>
      )}

      {/* Non-image files */}
      {files.map((att, idx) => (
        <AttachmentPreview
          key={att.storageId || `f-${idx}`}
          storageId={att.storageId}
          filename={att.filename}
          mimeType={att.mimeType}
          size={att.size}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
  },
  overlay: {
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  overlayText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
  },
  toggleText: {
    fontSize: 13,
    color: "#0a7ea4",
  },
});
