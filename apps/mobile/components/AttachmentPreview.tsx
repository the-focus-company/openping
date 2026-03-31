import { View, Text, Image, Pressable, StyleSheet, Linking } from "react-native";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { isImageType, formatFileSize } from "@/lib/fileUpload";
import { FileText, File, FileSpreadsheet, FileArchive } from "lucide-react-native";

function getFileIcon(mimeType: string) {
  if (mimeType.includes("pdf")) return <FileText size={24} color="#ef4444" />;
  if (mimeType.includes("word") || mimeType.includes("document")) return <FileText size={24} color="#3b82f6" />;
  if (mimeType.includes("sheet") || mimeType.includes("excel") || mimeType.includes("csv")) return <FileSpreadsheet size={24} color="#22c55e" />;
  if (mimeType.includes("zip") || mimeType.includes("archive") || mimeType.includes("tar") || mimeType.includes("rar")) return <FileArchive size={24} color="#f59e0b" />;
  return <File size={24} color="#888" />;
}

interface AttachmentPreviewProps {
  storageId: string;
  filename: string;
  mimeType: string;
  size: number;
}

export function AttachmentPreview({
  storageId,
  filename,
  mimeType,
  size,
}: AttachmentPreviewProps) {
  const fileUrl = useQuery(api.files.getFileUrl, { storageId });

  if (!fileUrl) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const handlePress = () => {
    Linking.openURL(fileUrl);
  };

  if (isImageType(mimeType)) {
    return (
      <Pressable onPress={handlePress}>
        <Image
          source={{ uri: fileUrl }}
          style={styles.image}
          resizeMode="cover"
        />
      </Pressable>
    );
  }

  return (
    <Pressable style={styles.file} onPress={handlePress}>
      {getFileIcon(mimeType)}
      <View style={styles.fileInfo}>
        <Text style={styles.fileName} numberOfLines={1}>
          {filename}
        </Text>
        <Text style={styles.fileSize}>{formatFileSize(size)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loading: {
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#222",
    borderRadius: 8,
    marginTop: 6,
  },
  loadingText: {
    color: "#666",
    fontSize: 13,
  },
  image: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginTop: 6,
  },
  file: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#222",
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    gap: 8,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    color: "#ccc",
    fontWeight: "500",
  },
  fileSize: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },
});
