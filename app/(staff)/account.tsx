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
import { apiRequest } from "@/lib/query-client";
import Colors from "@/constants/colors";
import { useColors } from "@/hooks/useColors";

export default function StaffAccountScreen() {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = getStyles(colors);
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const handleLogout = async () => {
    if (Platform.OS === "web") {
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
      await apiRequest("POST", "/api/auth/change-password", {
        currentPassword,
        newPassword,
      });
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

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20),
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 40),
        },
      ]}
    >
      <Text style={[styles.title, { color: colors.text }]}>Account</Text>

      <View style={[styles.profileCard, { backgroundColor: colors.surface }]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.name?.charAt(0)?.toUpperCase() ?? "S"}
          </Text>
        </View>
        <Text style={[styles.name, { color: colors.text }]}>{user?.name ?? "Staff Member"}</Text>
        <View style={styles.roleBadge}>
          <Ionicons name="people" size={13} color={Colors.accent} />
          <Text style={styles.roleText}>Staff</Text>
        </View>
        <Text style={[styles.email, { color: colors.textSecondary }]}>{user?.email ?? ""}</Text>
      </View>

      <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
        <View style={styles.infoRow}>
          <Ionicons name="shield-checkmark-outline" size={18} color={Colors.primary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>All check-in data is encrypted and synced securely</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.infoRow}>
          <Ionicons name="wifi-outline" size={18} color={Colors.primary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>Wristband scanning works offline via NFC</Text>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [styles.changePasswordToggle, { opacity: pressed ? 0.85 : 1, backgroundColor: colors.surface }]}
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
        <View style={[styles.passwordCard, { backgroundColor: colors.surface }]}>
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
                <Ionicons
                  name={showCurrent ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={colors.textMuted}
                />
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
                <Ionicons
                  name={showNew ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={colors.textMuted}
                />
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
        style={({ pressed }) => [styles.signOutBtn, { opacity: pressed ? 0.85 : 1 }]}
        onPress={handleLogout}
      >
        <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
        <Text style={[styles.signOutText, { color: Colors.danger }]}>Sign Out</Text>
      </Pressable>

      <Text style={[styles.version, { color: colors.textMuted }]}>CampSync v1.0</Text>
    </ScrollView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: "Outfit_700Bold",
    color: colors.text,
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.accent + "20",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatarText: {
    fontSize: 28,
    fontFamily: "Outfit_700Bold",
    color: Colors.accent,
  },
  name: {
    fontSize: 22,
    fontFamily: "Outfit_700Bold",
    color: colors.text,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.accent + "15",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  roleText: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.accent,
  },
  email: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: colors.textSecondary,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: colors.textSecondary,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
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
    borderColor: Colors.primary + "30",
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
    color: Colors.danger,
  },
  version: {
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: colors.textMuted,
  },
});
