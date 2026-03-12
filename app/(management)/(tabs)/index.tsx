import React, { useCallback, useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Alert,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Animated,
  Dimensions,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import Colors from "@/constants/colors";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/app/_layout";
import type { Broadcast } from "@/types";

function StatCard({
  icon,
  label,
  value,
  color,
  onPress,
}: {
  icon: string;
  label: string;
  value: number | string;
  color: string;
  onPress?: () => void;
}) {
  const colors = useColors();
  const styles = getStyles(colors);
  return (
    <Pressable
      style={({ pressed }) => [
        styles.statCard,
        { backgroundColor: colors.surface, opacity: pressed && onPress ? 0.85 : 1 },
      ]}
      onPress={onPress}
    >
      <View style={[styles.statIconContainer, { backgroundColor: color + "20" }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

function RecentCheckIn({
  camperName,
  time,
}: {
  camperId: string;
  camperName: string;
  time: string;
}) {
  const colors = useColors();
  const styles = getStyles(colors);
  return (
    <View style={styles.checkInRow}>
      <View style={[styles.checkInAvatar, { backgroundColor: Colors.primary + "20" }]}>
        <Text style={[styles.checkInInitial, { color: Colors.primary }]}>
          {camperName.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.checkInName, { color: colors.text }]}>{camperName}</Text>
        <Text style={[styles.checkInTime, { color: colors.textSecondary }]}>
          Checked in at {new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>
      <View style={styles.checkInBadge}>
        <Text style={styles.checkInBadgeText}>IN</Text>
      </View>
    </View>
  );
}

function BroadcastCard({
  broadcast,
  isManagement,
  onDeactivate,
  onEdit,
  onDelete,
}: {
  broadcast: Broadcast;
  isManagement: boolean;
  onDeactivate?: () => void;
  onEdit?: (b: Broadcast) => void;
  onDelete?: (id: string) => void;
}) {
  const colors = useColors();
  const styles = getStyles(colors);
  const isEmergency = broadcast.isEmergency;

  const handleDelete = () => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("Delete this broadcast? This cannot be undone.")) {
        onDelete?.(broadcast.id);
      }
      return;
    }
    Alert.alert(
      "Delete Broadcast",
      "Are you sure you want to delete this broadcast? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => onDelete?.(broadcast.id),
        },
      ]
    );
  };

  return (
    <View style={[
      styles.broadcastCard,
      {
        backgroundColor: isEmergency ? Colors.danger + "10" : colors.surface,
        borderColor: isEmergency ? Colors.danger + "40" : colors.border,
      },
    ]}>
      <View style={styles.broadcastHeader}>
        <View style={[styles.broadcastBadge, { backgroundColor: isEmergency ? Colors.danger : Colors.primary }]}>
          <Ionicons name={isEmergency ? "warning" : "megaphone"} size={12} color="#fff" />
          <Text style={styles.broadcastBadgeText}>
            {isEmergency ? "EMERGENCY" : broadcast.audience === "staff" ? "Staff" : broadcast.audience === "parents" ? "Parents" : "Everyone"}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text style={[styles.broadcastTime, { color: colors.textMuted }]}>
            {new Date(broadcast.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
          {isManagement && (
            <>
              <Pressable
                onPress={() => onEdit?.(broadcast)}
                testID={`edit-broadcast-${broadcast.id}`}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 6 })}
              >
                <Ionicons name="pencil" size={16} color={colors.textMuted} />
              </Pressable>
              <Pressable
                onPress={handleDelete}
                testID={`delete-broadcast-${broadcast.id}`}
                hitSlop={12}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 6 })}
              >
                <Ionicons name="trash-outline" size={16} color={Colors.danger} />
              </Pressable>
            </>
          )}
        </View>
      </View>
      <Text style={[styles.broadcastTitle, { color: isEmergency ? Colors.danger : colors.text }]}>{broadcast.title}</Text>
      <Text style={[styles.broadcastMessage, { color: colors.textSecondary }]}>{broadcast.message}</Text>
      <Text style={[styles.broadcastSentBy, { color: colors.textMuted }]}>Sent by {broadcast.sentByName}</Text>
      {isManagement && broadcast.emergencyActive && (
        <Pressable
          style={({ pressed }) => [styles.deactivateBtn, { opacity: pressed ? 0.8 : 1 }]}
          onPress={onDeactivate}
        >
          <Ionicons name="stop-circle" size={16} color="#fff" />
          <Text style={styles.deactivateBtnText}>Deactivate Emergency</Text>
        </Pressable>
      )}
    </View>
  );
}

function BroadcastSheet({
  visible,
  onClose,
  initialEmergency,
  editingBroadcast,
  onSend,
  onEdit,
}: {
  visible: boolean;
  onClose: () => void;
  initialEmergency: boolean;
  editingBroadcast?: Broadcast | null;
  onSend: (title: string, message: string, audience: string, isEmergency: boolean) => Promise<Broadcast>;
  onEdit?: (id: string, title: string, message: string, audience: string) => Promise<Broadcast>;
}) {
  const colors = useColors();
  const styles = getStyles(colors);
  const insets = useSafeAreaInsets();
  const isEditMode = !!editingBroadcast;
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<"staff" | "parents" | "all">("all");
  const [isEmergency, setIsEmergency] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  React.useEffect(() => {
    if (visible) {
      if (editingBroadcast) {
        setTitle(editingBroadcast.title);
        setMessage(editingBroadcast.message);
        setAudience((editingBroadcast.audience as "staff" | "parents" | "all") || "all");
        setIsEmergency(editingBroadcast.isEmergency);
      } else {
        setTitle(initialEmergency ? "EMERGENCY ALERT" : "");
        setMessage("");
        setAudience("all");
        setIsEmergency(initialEmergency);
      }
      setSending(false);
      setErrorMsg("");
    }
  }, [visible, initialEmergency, editingBroadcast]);

  const handleSend = async () => {
    setErrorMsg("");
    if (!title.trim() || !message.trim()) {
      setErrorMsg("Please fill in a title and message.");
      return;
    }
    setSending(true);
    try {
      if (isEditMode && editingBroadcast && onEdit) {
        await onEdit(editingBroadcast.id, title.trim(), message.trim(), audience);
      } else {
        await onSend(title.trim(), message.trim(), audience, isEmergency);
      }
      setSending(false);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || `Failed to ${isEditMode ? "update" : "send"} broadcast. Please try again.`);
      setSending(false);
    }
  };

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex: 1000, justifyContent: "flex-end" }]}>
      <Pressable style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" } as any} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={[styles.sheetContainer, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16, paddingTop: 20 }]}>
          <View style={styles.sheetHandle} />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{isEditMode ? "Edit Broadcast" : "Send Broadcast"}</Text>
            <Pressable onPress={onClose} hitSlop={8} testID="broadcast-close">
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          {!isEditMode && (
            <View style={[styles.emergencyToggle, { backgroundColor: isEmergency ? Colors.danger + "15" : colors.surface, borderColor: isEmergency ? Colors.danger + "40" : colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: isEmergency ? Colors.danger : colors.text }]}>Emergency Alert</Text>
                <Text style={[styles.emergencySubtext, { color: colors.textSecondary }]}>
                  Bypasses silent mode, triggers siren on all devices
                </Text>
              </View>
              <Pressable
                style={[styles.toggleBtn, { backgroundColor: isEmergency ? Colors.danger : colors.border }]}
                onPress={() => {
                  const next = !isEmergency;
                  setIsEmergency(next);
                  if (next && !title) setTitle("EMERGENCY ALERT");
                }}
              >
                <View style={[styles.toggleKnob, { transform: [{ translateX: isEmergency ? 20 : 2 }] }]} />
              </Pressable>
            </View>
          )}

          <View style={[styles.formField, { marginTop: 16 }]}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Title</Text>
            <TextInput
              style={[styles.textInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
              value={title}
              onChangeText={setTitle}
              placeholder="Broadcast title..."
              placeholderTextColor={colors.textMuted}
              maxLength={100}
              testID="broadcast-title"
            />
          </View>

          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Message</Text>
            <TextInput
              style={[styles.textInput, styles.textArea, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
              value={message}
              onChangeText={setMessage}
              placeholder="Write your message here..."
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={500}
              testID="broadcast-message"
            />
          </View>

          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Audience</Text>
            <View style={styles.audienceRow}>
              {(["all", "staff", "parents"] as const).map((opt) => (
                <Pressable
                  key={opt}
                  style={[styles.audienceBtn, { backgroundColor: audience === opt ? Colors.primary : colors.surface, borderColor: audience === opt ? Colors.primary : colors.border }]}
                  onPress={() => setAudience(opt)}
                >
                  <Ionicons name={opt === "all" ? "people" : opt === "staff" ? "briefcase" : "home"} size={16} color={audience === opt ? "#fff" : colors.textSecondary} />
                  <Text style={[styles.audienceBtnText, { color: audience === opt ? "#fff" : colors.textSecondary }]}>
                    {opt === "all" ? "Everyone" : opt === "staff" ? "Staff" : "Parents"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {!!errorMsg && (
            <View style={{ backgroundColor: Colors.danger + "15", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.danger + "30", marginBottom: 8 }}>
              <Text style={{ color: Colors.danger, fontFamily: "Outfit_600SemiBold", fontSize: 13 }}>{errorMsg}</Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [styles.sendBtn, { backgroundColor: isEmergency ? Colors.danger : Colors.primary, opacity: pressed ? 0.85 : 1 }]}
            onPress={handleSend}
            disabled={sending}
            testID="broadcast-send"
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name={isEmergency ? "warning" : "megaphone"} size={20} color="#fff" />
                <Text style={styles.sendBtnText}>{isEditMode ? "Save Changes" : isEmergency ? "Send Emergency Alert" : "Send Broadcast"}</Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const { campers, checkIns, sessions, pendingUpdates, broadcasts, isLoading, refresh, sendBroadcast, editBroadcast, deleteBroadcast, deactivateEmergency } =
    useData();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = getStyles(colors);
  const { isDark, toggleTheme, setUseSystem } = useTheme();
  const [broadcastModalVisible, setBroadcastModalVisible] = useState(false);
  const [emergencyModalVisible, setEmergencyModalVisible] = useState(false);
  const [editingBroadcast, setEditingBroadcast] = useState<Broadcast | null>(null);

  const checkedInToday = checkIns.filter((ci) => {
    const today = new Date().toDateString();
    return !ci.checkedOutAt && new Date(ci.checkedInAt).toDateString() === today;
  });

  const todaySessions = sessions.filter((s) => {
    const today = new Date().toISOString().split("T")[0];
    return s.isActive && s.authorizedDates.includes(today);
  });

  const unresolved = pendingUpdates.filter((p) => !p.resolved);

  const recentCheckIns = [...checkIns]
    .filter((ci) => {
      const today = new Date().toDateString();
      return new Date(ci.checkedInAt).toDateString() === today;
    })
    .sort((a, b) => new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime())
    .slice(0, 5);

  const recentBroadcasts = broadcasts;
  const activeEmergency = broadcasts.find((b) => b.emergencyActive);


  const handleEditBroadcast = (b: Broadcast) => {
    setEditingBroadcast(b);
  };

  const handleDeleteBroadcast = async (id: string) => {
    try {
      await deleteBroadcast(id);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to delete broadcast.");
    }
  };

  const handleLogout = async () => {
    if (Platform.OS === "web") {
      await logout();
      router.replace("/(auth)/login");
      return;
    }
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: async () => {
        await logout();
        router.replace("/(auth)/login");
      }},
    ]);
  };

  const handleToggleDark = () => {
    setUseSystem(false);
    toggleTheme(!isDark);
  };

  const handleDeactivateEmergency = () => {
    Alert.alert(
      "Deactivate Emergency",
      "Are you sure you want to deactivate emergency mode? All devices will stop the alert.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Deactivate", style: "destructive", onPress: async () => {
          try {
            await deactivateEmergency();
          } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to deactivate emergency.");
          }
        }},
      ]
    );
  };

  const initials = user?.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) ?? "?";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
          paddingBottom: insets.bottom + 100,
        },
      ]}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={Colors.primary} />
      }
    >
      <View style={styles.header}>
        <Pressable style={styles.headerLeft} onPress={() => router.navigate({ pathname: "/(management)/account" })} hitSlop={8}>
          <View style={[styles.avatar, { backgroundColor: Colors.primary + "25" }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View>
            <Text style={[styles.greeting, { color: colors.textMuted }]}>Welcome back</Text>
            <Text style={[styles.name, { color: colors.text }]}>{user?.name}</Text>
          </View>
        </Pressable>
        <View style={styles.headerActions}>
          <Pressable onPress={handleToggleDark} hitSlop={8} style={[styles.headerBtn, { backgroundColor: colors.surfaceSecondary }]}>
            <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={18} color={colors.textSecondary} />
          </Pressable>
          <Pressable onPress={handleLogout} hitSlop={8} style={[styles.headerBtn, { backgroundColor: colors.surfaceSecondary }]}>
            <Ionicons name="log-out-outline" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* Active Emergency Banner */}
      {activeEmergency && (
        <Pressable style={styles.emergencyBanner} onPress={handleDeactivateEmergency}>
          <Ionicons name="warning" size={20} color="#fff" />
          <Text style={styles.emergencyBannerText}>EMERGENCY ACTIVE — Tap to deactivate</Text>
          <Ionicons name="stop-circle" size={20} color="#fff" />
        </Pressable>
      )}

      {unresolved.length > 0 && (
        <Pressable
          style={styles.alertBanner}
          onPress={() => router.navigate({ pathname: "/(management)/(tabs)/pending" })}
        >
          <Ionicons name="warning" size={18} color="#fff" />
          <Text style={styles.alertText}>
            {unresolved.length} wristband{unresolved.length !== 1 ? "s" : ""} need updating
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#fff" />
        </Pressable>
      )}

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Today's Overview</Text>
      <View style={styles.statsGrid}>
        <StatCard icon="people" label="Total Campers" value={campers.length} color={Colors.primary} onPress={() => router.navigate({ pathname: "/(management)/(tabs)/campers" })} />
        <StatCard icon="checkmark-circle" label="Checked In" value={checkedInToday.length} color={Colors.success} />
        <StatCard icon="calendar" label="Active Sessions" value={todaySessions.length} color={Colors.warning} onPress={() => router.navigate({ pathname: "/(management)/(tabs)/more" })} />
        <StatCard icon="time" label="Pending Updates" value={unresolved.length} color={unresolved.length > 0 ? Colors.danger : colors.textMuted} onPress={() => router.navigate({ pathname: "/(management)/(tabs)/pending" })} />
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
      <View style={styles.actionsGrid}>
        <Pressable style={({ pressed }) => [styles.actionCard, { backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 }]} onPress={() => router.navigate({ pathname: "/(management)/(tabs)/campers" })}>
          <View style={[styles.actionIcon, { backgroundColor: Colors.primary + "20" }]}>
            <Ionicons name="person-add" size={24} color={Colors.primary} />
          </View>
          <Text style={[styles.actionLabel, { color: colors.text }]}>Add Camper</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.actionCard, { backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 }]} onPress={() => router.navigate({ pathname: "/(management)/(tabs)/nfc" })}>
          <View style={[styles.actionIcon, { backgroundColor: Colors.accent + "20" }]}>
            <Ionicons name="radio" size={24} color={Colors.accent} />
          </View>
          <Text style={[styles.actionLabel, { color: colors.text }]}>NFC Wristband</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.actionCard, { backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 }]} onPress={() => setBroadcastModalVisible(true)}>
          <View style={[styles.actionIcon, { backgroundColor: Colors.warning + "20" }]}>
            <Ionicons name="megaphone" size={24} color={Colors.warning} />
          </View>
          <Text style={[styles.actionLabel, { color: colors.text }]}>Broadcast</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.actionCard, { backgroundColor: activeEmergency ? Colors.danger + "15" : colors.surface, opacity: pressed ? 0.85 : 1, borderWidth: activeEmergency ? 1.5 : 0, borderColor: activeEmergency ? Colors.danger + "50" : "transparent" }]} onPress={() => activeEmergency ? handleDeactivateEmergency() : setEmergencyModalVisible(true)}>
          <View style={[styles.actionIcon, { backgroundColor: Colors.danger + "20" }]}>
            <Ionicons name={activeEmergency ? "stop-circle" : "warning"} size={24} color={Colors.danger} />
          </View>
          <Text style={[styles.actionLabel, { color: activeEmergency ? Colors.danger : colors.text }]}>
            {activeEmergency ? "Stop Emergency" : "Emergency"}
          </Text>
        </Pressable>
      </View>

      {recentCheckIns.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Check-ins</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            {recentCheckIns.map((ci, idx) => {
              const camper = campers.find((c) => c.id === ci.camperId);
              if (!camper) return null;
              return (
                <View key={ci.id}>
                  <RecentCheckIn camperId={ci.camperId} camperName={`${camper.firstName} ${camper.lastName}`} time={ci.checkedInAt} />
                  {idx < recentCheckIns.length - 1 && <View style={[styles.separator, { backgroundColor: colors.border }]} />}
                </View>
              );
            })}
          </View>
        </>
      )}

      {recentBroadcasts.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Broadcasts</Text>
          <View style={{ gap: 10 }}>
            {recentBroadcasts.map((b) => (
              <BroadcastCard
                key={b.id}
                broadcast={b}
                isManagement
                onDeactivate={handleDeactivateEmergency}
                onEdit={handleEditBroadcast}
                onDelete={handleDeleteBroadcast}
              />
            ))}
          </View>
        </>
      )}

    </ScrollView>

    <BroadcastSheet
      visible={broadcastModalVisible}
      onClose={() => setBroadcastModalVisible(false)}
      onSend={sendBroadcast}
      onEdit={editBroadcast}
      initialEmergency={false}
    />
    <BroadcastSheet
      visible={emergencyModalVisible}
      onClose={() => setEmergencyModalVisible(false)}
      onSend={sendBroadcast}
      onEdit={editBroadcast}
      initialEmergency
    />
    <BroadcastSheet
      visible={!!editingBroadcast}
      onClose={() => setEditingBroadcast(null)}
      onSend={sendBroadcast}
      onEdit={editBroadcast}
      editingBroadcast={editingBroadcast}
      initialEmergency={false}
    />
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 16,
    fontFamily: "Outfit_700Bold",
    color: Colors.accent,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  greeting: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: colors.textMuted,
  },
  name: {
    fontSize: 18,
    fontFamily: "Outfit_700Bold",
    color: colors.text,
    marginTop: 1,
  },
  emergencyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.danger,
    borderRadius: 14,
    padding: 14,
  },
  emergencyBannerText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Outfit_700Bold",
    color: "#fff",
  },
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.warning,
    borderRadius: 14,
    padding: 14,
  },
  alertText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
    color: "#fff",
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Outfit_700Bold",
    color: colors.text,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: "44%",
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: 28,
    fontFamily: "Outfit_700Bold",
    color: colors.text,
  },
  statLabel: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: colors.textSecondary,
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  actionCard: {
    flex: 1,
    minWidth: "44%",
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: colors.text,
    textAlign: "center",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  checkInRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  checkInAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  checkInInitial: {
    fontSize: 16,
    fontFamily: "Outfit_700Bold",
    color: Colors.primary,
  },
  checkInName: {
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
    color: colors.text,
  },
  checkInTime: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: colors.textSecondary,
    marginTop: 2,
  },
  checkInBadge: {
    backgroundColor: Colors.success + "20",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  checkInBadgeText: {
    fontSize: 11,
    fontFamily: "Outfit_700Bold",
    color: Colors.success,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },
  broadcastCard: {
    borderRadius: 16,
    padding: 14,
    gap: 8,
    borderWidth: 1,
  },
  broadcastHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  broadcastBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  broadcastBadgeText: {
    fontSize: 10,
    fontFamily: "Outfit_700Bold",
    color: "#fff",
  },
  broadcastTime: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: colors.textMuted,
  },
  broadcastTitle: {
    fontSize: 15,
    fontFamily: "Outfit_700Bold",
    color: colors.text,
  },
  broadcastMessage: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: colors.textSecondary,
    lineHeight: 18,
  },
  broadcastSentBy: {
    fontSize: 11,
    fontFamily: "Outfit_400Regular",
    color: colors.textMuted,
  },
  deactivateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.danger,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginTop: 4,
  },
  deactivateBtnText: {
    fontSize: 13,
    fontFamily: "Outfit_700Bold",
    color: "#fff",
  },
  sheetContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
    maxHeight: 620,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: 16,
    marginTop: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: "Outfit_700Bold",
    color: colors.text,
  },
  formField: {
    gap: 8,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Outfit_400Regular",
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  audienceRow: {
    flexDirection: "row",
    gap: 8,
  },
  audienceBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  audienceBtnText: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
  },
  emergencyToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
  },
  emergencySubtext: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: colors.textSecondary,
    marginTop: 2,
  },
  toggleBtn: {
    width: 44,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#fff",
  },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 54,
    borderRadius: 16,
    marginTop: 8,
  },
  sendBtnText: {
    fontSize: 16,
    fontFamily: "Outfit_700Bold",
    color: "#fff",
  },
});
