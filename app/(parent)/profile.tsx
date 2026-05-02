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
  Switch,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/query-client";
import { alertMessage } from "@/lib/confirm";
import Colors from "@/constants/colors";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/app/_layout";

function parsePrefs(raw?: string | null): { checkIn: boolean; checkOut: boolean; broadcasts: boolean } {
  try {
    const p = JSON.parse(raw || "{}");
    return {
      checkIn: p.checkIn !== false,
      checkOut: p.checkOut !== false,
      broadcasts: p.broadcasts !== false,
    };
  } catch {
    return { checkIn: true, checkOut: true, broadcasts: true };
  }
}

export default function ParentProfileScreen() {
  const { user, logout, refreshUser } = useAuth() as any;
  const { isDark, toggleTheme, useSystem, setUseSystem } = useTheme();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = getStyles(colors);

  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLinkingChild, setIsLinkingChild] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showLinkChild, setShowLinkChild] = useState(false);
  const [linkCode, setLinkCode] = useState("");

  const [notifPrefs, setNotifPrefs] = useState(() => parsePrefs(user?.notificationPreferences));

  const saveNotifPref = async (key: keyof typeof notifPrefs, value: boolean) => {
    const updated = { ...notifPrefs, [key]: value };
    setNotifPrefs(updated);
    try {
      await apiRequest("PATCH", "/api/users/me/notification-preferences", { preferences: updated });
    } catch {
      setNotifPrefs(notifPrefs);
      alertMessage("Error", "Failed to save preference. Please try again.");
    }
  };

  const handleLinkChild = async () => {
    const code = linkCode.trim();
    if (!code) {
      alertMessage("Missing Code", "Please enter the auth code provided by camp.");
      return;
    }
    setIsLinkingChild(true);
    try {
      await apiRequest("POST", "/api/auth/link-child", { code });
      await refreshUser();
      setLinkCode("");
      setShowLinkChild(false);
      alertMessage("Child Linked", "Your new child has been successfully added to your account.");
    } catch (err: any) {
      alertMessage("Error", err.message || "Failed to link child. Please check the code and try again.");
    } finally {
      setIsLinkingChild(false);
    }
  };

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
      { text: "Sign Out", style: "destructive", onPress: async () => {
        await logout();
        router.replace("/(auth)/login");
      }},
    ]);
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      alertMessage("Missing Fields", "Please fill in all password fields.");
      return;
    }
    if (newPassword.length < 8) {
      alertMessage("Too Short", "New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      alertMessage("Mismatch", "New passwords do not match.");
      return;
    }

    setIsSaving(true);
    try {
      await apiRequest("POST", "/api/auth/change-password", {
        currentPassword,
        newPassword,
      });
      alertMessage("Password Changed", "Your password has been updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordSection(false);
    } catch (err: any) {
      alertMessage("Error", err.message || "Failed to change password.");
    } finally {
      setIsSaving(false);
    }
  };

  const linkedCount = (user?.linkedCamperIds ?? []).length;
  const canGoBack = router.canGoBack();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: Platform.OS === "web" ? 67 : insets.top + 20,
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 120 : 100),
        },
      ]}
    >
      <View style={styles.headerRow}>
        {canGoBack ? (
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={Colors.primary} />
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
        <Text style={[styles.title, { color: colors.text }]}>Account</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={[styles.profileCard, { backgroundColor: colors.surface }]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.name?.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.name, { color: colors.text }]}>{user?.name}</Text>
        <Text style={[styles.email, { color: colors.textSecondary }]}>{user?.email}</Text>
        <View style={styles.roleBadge}>
          <Ionicons name="person" size={12} color="#8B5CF6" />
          <Text style={styles.roleText}>Parent Account</Text>
        </View>
      </View>

      <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
        <Ionicons name="shield-checkmark-outline" size={18} color={Colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.infoTitle, { color: colors.text }]}>Linked via Auth Code</Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Your account was created using code:{"\n"}
            <Text style={styles.codeText}>{user?.authCode}</Text>
          </Text>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Role</Text>
        <View style={styles.roleRow}>
          <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
          <Text style={[styles.roleCapability, { color: colors.textSecondary }]}>View linked children's info</Text>
        </View>
        <View style={styles.roleRow}>
          <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
          <Text style={[styles.roleCapability, { color: colors.textSecondary }]}>Edit medical & emergency info</Text>
        </View>
        <View style={styles.roleRow}>
          <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
          <Text style={[styles.roleCapability, { color: colors.textSecondary }]}>See check-in/out status in real time</Text>
        </View>
        <View style={styles.roleRow}>
          <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
          <Text style={[styles.roleCapability, { color: colors.textSecondary }]}>Receive email notifications on check-in/out</Text>
        </View>
      </View>

      {/* ─── My Children ─────────────────────────────────────────────────── */}
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <View style={styles.childrenHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>My Children</Text>
          <View style={styles.childCountBadge}>
            <Text style={styles.childCountText}>{linkedCount}</Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.addChildBtn,
            { borderColor: Colors.primary + "40", opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={() => setShowLinkChild((v) => !v)}
        >
          <Ionicons name="person-add-outline" size={17} color={Colors.primary} />
          <Text style={[styles.addChildText, { color: Colors.primary }]}>Add Another Child</Text>
          <Ionicons
            name={showLinkChild ? "chevron-up" : "chevron-down"}
            size={15}
            color={Colors.primary}
            style={{ marginLeft: "auto" }}
          />
        </Pressable>

        {showLinkChild && (
          <View style={[styles.linkChildBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Text style={[styles.linkChildLabel, { color: colors.textSecondary }]}>
              Enter the parent auth code provided by camp for your child:
            </Text>
            <View style={[styles.linkChildInputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="key-outline" size={16} color={colors.textMuted} />
              <TextInput
                style={[styles.linkChildInput, { color: colors.text }]}
                value={linkCode}
                onChangeText={setLinkCode}
                placeholder="Auth code (e.g. CAMP-XXXX)"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>
            <Pressable
              style={({ pressed }) => [styles.linkChildSubmit, { opacity: pressed ? 0.85 : 1 }]}
              onPress={handleLinkChild}
              disabled={isLinkingChild}
            >
              {isLinkingChild ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="link-outline" size={16} color="#fff" />
                  <Text style={styles.linkChildSubmitText}>Link Child</Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </View>

      {/* ─── Appearance ───────────────────────────────────────────────────── */}
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Appearance</Text>
        <Text style={[styles.infoText, { color: colors.textSecondary, marginBottom: 8 }]}>
          Manually override system theme
        </Text>
        <View style={styles.themeRow}>
          <Pressable
            onPress={() => { setUseSystem(true); }}
            style={[styles.themeBtn, useSystem && { backgroundColor: Colors.primary + "20", borderColor: Colors.primary }]}
          >
            <Ionicons name="phone-portrait-outline" size={16} color={useSystem ? Colors.primary : colors.textSecondary} />
            <Text style={[styles.themeBtnText, { color: useSystem ? Colors.primary : colors.textSecondary }]}>System</Text>
          </Pressable>
          <Pressable
            onPress={() => { setUseSystem(false); toggleTheme(false); }}
            style={[styles.themeBtn, !useSystem && !isDark && { backgroundColor: Colors.primary + "20", borderColor: Colors.primary }]}
          >
            <Ionicons name="sunny-outline" size={16} color={!useSystem && !isDark ? Colors.primary : colors.textSecondary} />
            <Text style={[styles.themeBtnText, { color: !useSystem && !isDark ? Colors.primary : colors.textSecondary }]}>Light</Text>
          </Pressable>
          <Pressable
            onPress={() => { setUseSystem(false); toggleTheme(true); }}
            style={[styles.themeBtn, !useSystem && isDark && { backgroundColor: Colors.primary + "20", borderColor: Colors.primary }]}
          >
            <Ionicons name="moon-outline" size={16} color={!useSystem && isDark ? Colors.primary : colors.textSecondary} />
            <Text style={[styles.themeBtnText, { color: !useSystem && isDark ? Colors.primary : colors.textSecondary }]}>Dark</Text>
          </Pressable>
        </View>
      </View>

      {/* ─── Notifications ────────────────────────────────────────────────── */}
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Notifications</Text>

        <View style={styles.notifRow}>
          <View style={styles.notifInfo}>
            <Text style={[styles.notifLabel, { color: colors.text }]}>Check-in Alerts</Text>
            <Text style={[styles.notifSubtitle, { color: colors.textSecondary }]}>When your child checks in</Text>
          </View>
          <Switch
            value={notifPrefs.checkIn}
            onValueChange={(v) => saveNotifPref("checkIn", v)}
            trackColor={{ false: colors.border, true: Colors.success }}
            thumbColor={Platform.OS === "ios" ? undefined : "#fff"}
          />
        </View>

        <View style={styles.notifRow}>
          <View style={styles.notifInfo}>
            <Text style={[styles.notifLabel, { color: colors.text }]}>Check-out Alerts</Text>
            <Text style={[styles.notifSubtitle, { color: colors.textSecondary }]}>When your child checks out</Text>
          </View>
          <Switch
            value={notifPrefs.checkOut}
            onValueChange={(v) => saveNotifPref("checkOut", v)}
            trackColor={{ false: colors.border, true: Colors.success }}
            thumbColor={Platform.OS === "ios" ? undefined : "#fff"}
          />
        </View>

        <View style={styles.notifRow}>
          <View style={styles.notifInfo}>
            <Text style={[styles.notifLabel, { color: colors.text }]}>Camp Broadcasts</Text>
            <Text style={[styles.notifSubtitle, { color: colors.textSecondary }]}>Messages from camp staff</Text>
          </View>
          <Switch
            value={notifPrefs.broadcasts}
            onValueChange={(v) => saveNotifPref("broadcasts", v)}
            trackColor={{ false: colors.border, true: Colors.success }}
            thumbColor={Platform.OS === "ios" ? undefined : "#fff"}
          />
        </View>
      </View>

      {/* ─── Change Password ──────────────────────────────────────────────── */}
      <Pressable
        style={({ pressed }) => [styles.changePasswordToggle, { opacity: pressed ? 0.85 : 1, backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => setShowPasswordSection((v) => !v)}
      >
        <View style={styles.changePasswordLeft}>
          <Ionicons name="key-outline" size={18} color={Colors.primary} />
          <Text style={[styles.changePasswordText, { color: colors.text }]}>Change Password</Text>
        </View>
        <Ionicons
          name={showPasswordSection ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.textSecondary}
        />
      </Pressable>

      {showPasswordSection && (
        <View style={[styles.passwordCard, { backgroundColor: colors.surface, borderColor: Colors.primary + "30" }]}>
          <View style={styles.passwordField}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Current Password</Text>
            <View style={[styles.passwordInputRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <TextInput
                style={[styles.passwordInput, { color: colors.text }]}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showCurrent}
                autoCapitalize="none"
              />
              <Pressable onPress={() => setShowCurrent((v) => !v)}>
                <Ionicons name={showCurrent ? "eye-off-outline" : "eye-outline"} size={18} color={colors.textMuted} />
              </Pressable>
            </View>
          </View>

          <View style={styles.passwordField}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>New Password</Text>
            <View style={[styles.passwordInputRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <TextInput
                style={[styles.passwordInput, { color: colors.text }]}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="At least 8 characters"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showNew}
                autoCapitalize="none"
              />
              <Pressable onPress={() => setShowNew((v) => !v)}>
                <Ionicons name={showNew ? "eye-off-outline" : "eye-outline"} size={18} color={colors.textMuted} />
              </Pressable>
            </View>
          </View>

          <View style={styles.passwordField}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Confirm New Password</Text>
            <View style={[styles.passwordInputRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <TextInput
                style={[styles.passwordInput, { color: colors.text }]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Repeat new password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.savePasswordBtn, { opacity: pressed ? 0.85 : 1 }]}
            onPress={handleChangePassword}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={styles.savePasswordText}>Update Password</Text>
              </>
            )}
          </Pressable>
        </View>
      )}

      <Pressable
        style={({ pressed }) => [styles.logoutButton, { opacity: pressed ? 0.85 : 1, borderColor: Colors.danger + "30" }]}
        onPress={handleLogout}
      >
        <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
        <Text style={[styles.logoutText, { color: Colors.danger }]}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    gap: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary + "15",
  },
  title: {
    fontSize: 22,
    fontFamily: "Outfit_700Bold",
    color: colors.text,
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#8B5CF620",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatarText: {
    fontSize: 32,
    fontFamily: "Outfit_700Bold",
    color: "#8B5CF6",
  },
  name: {
    fontSize: 22,
    fontFamily: "Outfit_700Bold",
    color: colors.text,
  },
  email: {
    fontSize: 15,
    fontFamily: "Outfit_400Regular",
    color: colors.textSecondary,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#8B5CF615",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginTop: 4,
  },
  roleText: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: "#8B5CF6",
  },
  infoCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: Colors.primary + "10",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.primary + "20",
  },
  infoTitle: {
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
    color: colors.text,
  },
  infoText: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  codeText: {
    fontFamily: "Outfit_700Bold",
    color: Colors.primary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Outfit_700Bold",
    color: colors.text,
  },
  roleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  roleCapability: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: colors.text,
  },
  childrenHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  childCountBadge: {
    backgroundColor: Colors.primary + "20",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  childCountText: {
    fontSize: 13,
    fontFamily: "Outfit_700Bold",
    color: Colors.primary,
  },
  addChildBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderStyle: "dashed",
  },
  addChildText: {
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
  },
  linkChildBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  linkChildLabel: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    lineHeight: 18,
  },
  linkChildInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  linkChildInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
    letterSpacing: 1,
  },
  linkChildSubmit: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 44,
  },
  linkChildSubmitText: {
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
    color: "#fff",
  },
  themeRow: {
    flexDirection: "row",
    gap: 10,
  },
  themeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  themeBtnText: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
  },
  notifRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  notifInfo: {
    flex: 1,
    gap: 2,
  },
  notifLabel: {
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
  },
  notifSubtitle: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
  },
  changePasswordToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  changePasswordLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  changePasswordText: {
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
    color: colors.text,
  },
  passwordCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 14,
  },
  passwordField: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  passwordInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  passwordInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Outfit_400Regular",
    color: colors.text,
  },
  savePasswordBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 50,
    marginTop: 4,
  },
  savePasswordText: {
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
    color: "#fff",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.danger + "15",
    borderRadius: 16,
    height: 54,
    borderWidth: 1,
  },
  logoutText: {
    fontSize: 16,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.danger,
  },
});
