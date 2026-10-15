import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import Toast from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import {
  deleteCloudData,
  getSyncMeta,
  isSyncEnabled,
  setSyncEnabled,
  syncNow,
  SyncMeta,
} from "../lib/sync";

export default function SettingsScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [syncMeta, setSyncMeta] = useState<SyncMeta>({
    lastSyncedAt: null,
    lastError: null,
    pendingCount: 0,
    inProgress: false,
  });
  const [syncing, setSyncing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Toast State
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
  };

  const refreshState = async () => {
    try {
      const [isEnabled, meta] = await Promise.all([
        isSyncEnabled(),
        getSyncMeta(),
      ]);
      setEnabled(isEnabled);
      setSyncMeta(meta);
    } catch (err) {
      console.error("Failed to load sync settings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshState();
  }, []);

  const handleToggleSync = async (nextVal: boolean) => {
    try {
      setEnabled(nextVal);
      await setSyncEnabled(nextVal);
      await refreshState();
      showToast(nextVal ? "Cloud sync enabled" : "Cloud sync disabled");
    } catch (err: any) {
      setEnabled(!nextVal);
      Alert.alert("Error", err?.message || "Failed to toggle cloud sync");
    }
  };

  const handleSyncNow = async () => {
    if (syncing || !enabled) return;
    setSyncing(true);
    try {
      const res = await syncNow();
      await refreshState();
      if (res.skippedOffline) {
        showToast("You are offline. Sync will resume when online.");
      } else if (res.success) {
        showToast(
          `Synced! ${res.pushedCount} pushed, ${res.pulledCount} pulled.`
        );
      } else {
        Alert.alert("Sync Error", res.error || "Sync encountered an issue.");
      }
    } catch (err: any) {
      Alert.alert("Sync Error", err?.message || "Failed to perform sync");
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteCloudData = () => {
    Alert.alert(
      "Delete Cloud Data?",
      "This will remove all your synced meals and targets from NutriCal cloud servers. Your local entries on this device will NOT be deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Cloud Data",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteCloudData();
              await refreshState();
              showToast("Cloud data deleted successfully");
            } catch (err: any) {
              Alert.alert(
                "Delete Failed",
                err?.message || "Could not delete cloud data"
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const formatLastSynced = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    try {
      const d = new Date(dateStr);
      return `${d.toLocaleDateString("en-GB")} ${d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0d5ef5" />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={["#0d5ef5", "#4ECDC4"]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <StatusBar barStyle="light-content" />

      {/* Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Sync Settings Card */}
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextContainer}>
              <View style={styles.iconTitleRow}>
                <Icon
                  name="cloud-upload-outline"
                  size={22}
                  color="#0d5ef5"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.cardTitle}>Cloud Sync</Text>
              </View>
              <Text style={styles.cardSubtitle}>
                Bi-directional sync with conflict resolution
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={handleToggleSync}
              trackColor={{ false: "#e2e8f0", true: "#4ECDC4" }}
              thumbColor={enabled ? "#0d5ef5" : "#cbd5e1"}
            />
          </View>

          {/* Plain Language Explanation */}
          <View style={styles.explanationBox}>
            <Icon
              name="information-circle-outline"
              size={18}
              color="#475569"
              style={{ marginRight: 6, marginTop: 1 }}
            />
            <Text style={styles.explanationText}>
              Sync is <Text style={{ fontWeight: "700" }}>OFF</Text> by default.
              When enabled, your logged meals and daily nutrition targets are
              securely uploaded to your account so they seamlessly stay in sync
              across your devices.
            </Text>
          </View>

          {/* Metadata Section */}
          <View style={styles.metaSection}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Status</Text>
              <Text
                style={[
                  styles.metaValue,
                  { color: enabled ? "#10b981" : "#64748b" },
                ]}
              >
                {enabled ? "Enabled" : "Disabled (Local only)"}
              </Text>
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Last Synced</Text>
              <Text style={styles.metaValue}>
                {formatLastSynced(syncMeta.lastSyncedAt)}
              </Text>
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Pending Changes</Text>
              <Text style={styles.metaValue}>
                {syncMeta.pendingCount}{" "}
                {syncMeta.pendingCount === 1 ? "item" : "items"}
              </Text>
            </View>

            {user && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Account</Text>
                <Text style={styles.metaValue} numberOfLines={1}>
                  {user.email || "Active User"}
                </Text>
              </View>
            )}

            {syncMeta.lastError && (
              <View style={styles.errorBox}>
                <Icon
                  name="warning-outline"
                  size={16}
                  color="#dc2626"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.errorText}>{syncMeta.lastError}</Text>
              </View>
            )}
          </View>

          {/* Manual Sync Button */}
          <TouchableOpacity
            style={[
              styles.syncNowButton,
              (!enabled || syncing) && styles.disabledButton,
            ]}
            onPress={handleSyncNow}
            disabled={!enabled || syncing}
            activeOpacity={0.8}
          >
            {syncing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon
                  name="sync-outline"
                  size={18}
                  color="#fff"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.syncNowText}>Sync Now</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Delete Cloud Data Button */}
          <TouchableOpacity
            style={styles.deleteCloudButton}
            onPress={handleDeleteCloudData}
            disabled={deleting}
            activeOpacity={0.7}
          >
            {deleting ? (
              <ActivityIndicator size="small" color="#dc2626" />
            ) : (
              <>
                <Icon
                  name="trash-outline"
                  size={17}
                  color="#dc2626"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.deleteCloudText}>Delete My Cloud Data</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Security & Offline-First Information */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Privacy & Offline Reliability</Text>
          <Text style={styles.infoParagraph}>
            • Logging meals, editing targets, and viewing history always work
            offline without waiting for internet connectivity.
          </Text>
          <Text style={styles.infoParagraph}>
            • When sync is enabled, changes are automatically pushed when the app
            is open or foregrounded.
          </Text>
          <Text style={styles.infoParagraph}>
            • Turning sync off stops all background uploading while keeping your
            local data intact.
          </Text>
        </View>
      </ScrollView>

      <Toast
        message={toastMessage}
        visible={toastVisible}
        onDismiss={() => setToastVisible(false)}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleTextContainer: {
    flex: 1,
    paddingRight: 12,
  },
  iconTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
  },
  cardSubtitle: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  explanationBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  explanationText: {
    flex: 1,
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
  },
  metaSection: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  metaLabel: {
    fontSize: 14,
    color: "#64748b",
  },
  metaValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
    maxWidth: "60%",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  errorText: {
    fontSize: 12,
    color: "#dc2626",
    flex: 1,
  },
  syncNowButton: {
    backgroundColor: "#0d5ef5",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    marginTop: 18,
  },
  disabledButton: {
    backgroundColor: "#cbd5e1",
  },
  syncNowText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  deleteCloudButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fff5f5",
  },
  deleteCloudText: {
    color: "#dc2626",
    fontSize: 14,
    fontWeight: "600",
  },
  infoParagraph: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 20,
    marginTop: 8,
  },
});
