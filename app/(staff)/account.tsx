import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { apiRequest } from "@/lib/query-client";
import Colors from "@/constants/colors";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/app/_layout";
import type { Session } from "@/types";

type Tab = "sessions" | "account";

function SessionCard({ session }: { session: Session }) {
  const colors = useColors();
  const styles = getStyles(colors);
  const now = new Date();
  const start = new Date(session.startDate);
  const end = new Date(session.endDate);
  const isActive = session.isActive;
  const isPast = end < now;
  const isUpcoming = start > now;

  const statusLabel = isActive ? "Active" : isPast ? "Past" : isUpcoming ? "Upcoming" : "Inactive";
  const statusColor = isActive ? Colors.success : isPast ? colors.textMuted : Colors.primary;

  return (
    <View style={[styles.sessionCard, { backgroundColor: colors.surface }]}>
      <View style={styles.sessionCardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sessionName, { color: colors.text }]}>{session.name}</Text>
          <Text style={[styles.sessionDates, { color: colors.textSecondary }]}>
            {start.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })} —{" "}
            {end.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + "18" }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      {session.authorizedDates.length > 0 && (
        <View style={styles.datesWrap}>
          {session.authorizedDates.slice(0, 5).map((d) => (
            <View key={d} style={[styles.dateChip, { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={[styles.dateChipText, { color: colors.textSecondary }]}>
                {new Date(d + "T12:00:00").toLocaleDateString([], { month: "short", day: "numeric" })}
              </Text>
            </View>
          ))}
          {session.authorizedDates.length > 5 && (
            <View style={[styles.dateChip, { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={[styles.dateChipText, { color: colors.textSecondary }]}>
                +{session.authorizedDates.length - 5}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export default function StaffAccountScreen() {
  const { user, logout } = useAuth();
  const { sessions, isLoading, refresh } = useData();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = getStyles(colors);
  const { isDark, toggleTheme, setUseSystem } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>("sessions");

  const handleToggleDark = () => {
    setUseSystem(false);
    toggleTheme(!isDark);
  };

  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const handleLogout = async () => {
    if (Platform.OS === "web") {
      const confirmed = typeof window !== "undefined" && window.confirm
        ? window.confirm("Are you sure you want to sign out?")
        : true;
      if (!confirmed) return;
      await logout();
      router.replace("/(auth)/login");
      return;
    }
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Missing Fields", "Please fill in all password fields.");
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert("Too Short", "New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Mismatch", "New passwords do not match.");
      return;
    }
    setIsSaving(true);
    try {
      await apiRequest("POST", "/api/auth/change-password", { currentPassword, newPassword });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Password Changed", "Your password has been updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordSection(false);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to change password.");
    } finally {
      setIsSaving(false);
    }
  };

  const sortedSessions = [...sessions].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
  });

  const paddingTop = Platform.OS === "web" ? 67 : insets.top + 16;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop }]}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={[styles.screenTitle, { color: colors.text }]}>Account</Text>
          <Pressable
            style={({ pressed }) => [styles.signOutHeaderBtn, { opacity: pressed ? 0.7 : 1 }]}
            onPress={handleLogout}
            testID="staff-sign-out"
          >
            <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
            <Text style={[styles.signOutHeaderText, { color: Colors.danger }]}>Sign Out</Text>
          </Pressable>
        </View>

        <View style={[styles.tabBar, { backgroundColor: colors.surfaceSecondary }]}>
          {(["sessions", "account"] as Tab[]).map((tab) => (
            <Pressable
              key={tab}
              style={[styles.tabBtn, activeTab === tab && { backgroundColor: colors.surface }]}
              onPress={() => setActiveTab(tab)}
            >
              <Ionicons
                name={tab === "sessions" ? (activeTab === tab ? "calendar" : "calendar-outline") : (activeTab === tab ? "person" : "person-outline")}
                size={15}
                color={activeTab === tab ? Colors.primary : colors.textMuted}
              />
              <Text style={[styles.tabBtnText, { color: activeTab === tab ? Colors.primary : colors.textMuted }]}>
                {tab === "sessions" ? "Sessions" : "Account"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {activeTab === "sessions" ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          {isLoading && sessions.length === 0 ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
          ) : sortedSessions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={40} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No sessions yet</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Camp sessions will appear here when management creates them.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Camp Sessions</Text>
                <View style={[styles.countBadge, { backgroundColor: Colors.primary + "15" }]}>
                  <Text style={[styles.countText, { color: Colors.primary }]}>{sessions.length}</Text>
                </View>
              </View>
              <Text style={[styles.sectionNote, { color: colors.textMuted }]}>
                View-only — contact management to make changes
              </Text>
              {sortedSessions.map((s) => <SessionCard key={s.id} session={s} />)}
            </>
          )}
        </ScrollView>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.profileCard, { backgroundColor: colors.surface }]}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.name?.charAt(0)?.toUpperCase() ?? "S"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.userName, { color: colors.text }]}>{user?.name ?? "Staff Member"}</Text>
              <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{user?.email ?? ""}</Text>
            </View>
            <View style={[styles.roleBadge, { backgroundColor: Colors.accent + "15" }]}>
              <Ionicons name="people" size={12} color={Colors.accent} />
              <Text style={[styles.roleText, { color: Colors.accent }]}>Staff</Text>
            </View>
          </View>

          <View style={[styles.settingsCard, { backgroundColor: colors.surface }]}>
            <Pressable
              style={({ pressed }) => [styles.settingsRow, { opacity: pressed ? 0.8 : 1 }]}
              onPress={handleToggleDark}
            >
              <View style={[styles.settingsIcon, { backgroundColor: (isDark ? "#FFC107" : "#8B5CF6") + "18" }]}>
                <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={18} color={isDark ? "#FFC107" : "#8B5CF6"} />
              </View>
              <Text style={[styles.settingsLabel, { color: colors.text }]}>{isDark ? "Light Mode" : "Dark Mode"}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <Pressable
              style={({ pressed }) => [styles.settingsRow, { opacity: pressed ? 0.8 : 1 }]}
              onPress={() => setShowPasswordSection((v) => !v)}
            >
              <View style={[styles.settingsIcon, { backgroundColor: Colors.primary + "15" }]}>
                <Ionicons name="key-outline" size={18} color={Colors.primary} />
              </View>
              <Text style={[styles.settingsLabel, { color: colors.text }]}>Change Password</Text>
              <Ionicons name={showPasswordSection ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
            </Pressable>
          </View>

          {showPasswordSection && (
            <View style={[styles.passwordCard, { backgroundColor: colors.surface }]}>
              <PasswordField
                label="Current Password"
                value={currentPassword}
                onChange={setCurrentPassword}
                show={showCurrent}
                onToggle={() => setShowCurrent(v => !v)}
                placeholder="Enter current password"
              />
              <PasswordField
                label="New Password"
                value={newPassword}
                onChange={setNewPassword}
                show={showNew}
                onToggle={() => setShowNew(v => !v)}
                placeholder="At least 8 characters"
              />
              <PasswordField
                label="Confirm New Password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                show={false}
                onToggle={() => {}}
                placeholder="Repeat new password"
                hideToggle
              />
              <Pressable
                style={({ pressed }) => [styles.saveBtn, { opacity: pressed ? 0.85 : 1 }]}
                onPress={handleChangePassword}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                    <Text style={styles.saveBtnText}>Update Password</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
            <View style={styles.infoRow}>
              <Ionicons name="shield-checkmark-outline" size={16} color={Colors.primary} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>Check-in data is encrypted and synced securely</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.infoRow}>
              <Ionicons name="wifi-outline" size={16} color={Colors.primary} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>Wristband scanning works offline via NFC</Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.signOutBtn, { opacity: pressed ? 0.85 : 1 }]}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
            <Text style={[styles.signOutText, { color: Colors.danger }]}>Sign Out</Text>
          </Pressable>

          <Text style={[styles.version, { color: colors.textMuted }]}>CampSync v1.0</Text>
        </ScrollView>
      )}
    </View>
  );
}

function PasswordField({
  label, value, onChange, show, onToggle, placeholder, hideToggle,
}: {
  label: string; value: string; onChange: (v: string) => void;
  show: boolean; onToggle: () => void; placeholder: string; hideToggle?: boolean;
}) {
  const colors = useColors();
  const styles = getStyles(colors);
  return (
    <View style={styles.passwordField}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <View style={[styles.passwordInputRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
        <TextInput
          style={[styles.passwordInput, { color: colors.text }]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={!show && !hideToggle}
          autoCapitalize="none"
        />
        {!hideToggle && (
          <Pressable onPress={onToggle}>
            <Ionicons name={show ? "eye-off-outline" : "eye-outline"} size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  screenTitle: {
    fontSize: 28,
    fontFamily: "Outfit_700Bold",
  },
  tabBar: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 9,
  },
  tabBtnText: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Outfit_700Bold",
    flex: 1,
  },
  sectionNote: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    marginTop: -6,
  },
  countBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
  },
  countText: {
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
  },
  sessionCard: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  sessionCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  sessionName: {
    fontSize: 16,
    fontFamily: "Outfit_700Bold",
  },
  sessionDates: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
  },
  datesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  dateChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dateChipText: {
    fontSize: 12,
    fontFamily: "Outfit_500Medium",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Outfit_700Bold",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.accent + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 22,
    fontFamily: "Outfit_700Bold",
    color: Colors.accent,
  },
  userName: {
    fontSize: 17,
    fontFamily: "Outfit_700Bold",
  },
  userEmail: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    marginTop: 2,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  roleText: {
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
  },
  settingsCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  settingsIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
  },
  passwordCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.primary + "30",
    gap: 14,
  },
  passwordField: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  passwordInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    gap: 8,
  },
  passwordInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Outfit_400Regular",
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 50,
    marginTop: 4,
  },
  saveBtnText: {
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
    color: "#fff",
  },
  infoCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    lineHeight: 18,
  },
  signOutHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: Colors.danger + "10",
    borderWidth: 1,
    borderColor: Colors.danger + "30",
  },
  signOutHeaderText: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.danger + "50",
    backgroundColor: Colors.danger + "08",
  },
  signOutText: {
    fontSize: 16,
    fontFamily: "Outfit_600SemiBold",
  },
  version: {
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
  },
});
