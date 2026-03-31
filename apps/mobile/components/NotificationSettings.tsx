import { View, Text, Switch, StyleSheet } from "react-native";
import { useState } from "react";

interface NotificationSettingsProps {
  initialInbox?: boolean;
  initialAlerts?: boolean;
  onChangeInbox?: (value: boolean) => void;
  onChangeAlerts?: (value: boolean) => void;
}

export function NotificationSettings({
  initialInbox = true,
  initialAlerts = true,
  onChangeInbox,
  onChangeAlerts,
}: NotificationSettingsProps) {
  const [inbox, setInbox] = useState(initialInbox);
  const [alerts, setAlerts] = useState(initialAlerts);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Notifications</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Inbox notifications</Text>
        <Switch
          value={inbox}
          onValueChange={(v) => {
            setInbox(v);
            onChangeInbox?.(v);
          }}
          trackColor={{ false: "#333", true: "#0a7ea4" }}
          thumbColor="#fff"
        />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Proactive alerts</Text>
        <Switch
          value={alerts}
          onValueChange={(v) => {
            setAlerts(v);
            onChangeAlerts?.(v);
          }}
          trackColor={{ false: "#333", true: "#0a7ea4" }}
          thumbColor="#fff"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 16 },
  header: {
    color: "#888",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#222",
  },
  label: { color: "#fff", fontSize: 16 },
});
