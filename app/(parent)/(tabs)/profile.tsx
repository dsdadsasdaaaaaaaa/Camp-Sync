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
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/query-client";
import Colors from "@/constants/colors";
import { useColors } from "@/hooks/useColors";

export default function ParentProfileScreen() {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const colors = useColors();
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
      { text: "Sign Out", style: "destructive", onPress: async () => {
        await logout();
        router.replace("/(auth)/login");
      }},
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
          paddingBottom: insets.bottom + 100,
        },
      ]}
    >
      <Text style={[styles.title, { color: colors.text }]}>Account</Text>

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
          <Text style={[styles.roleCapability, { color: colors.textSecondary }]}>View full check-in history</Text>
        </View>
        <View style={[styles.roleRow, { opacity: 0.5 }]}>
          <Ionicons name="close-circle" size={18} color={Colors.danger} />
          <Text style={[styles.roleCapability, { color: colors.textSecondary }]}>Check-in/out campers (staff only)</Text>
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
            <Text style={styles.fieldLabel}>Confirm New Password</Text>
            <View style={styles.passwordInputRow}>
              <TextInput
                style={styles.passwordInput}
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
        style={({ pressed }) => [
          styles.logoutButton,
          { opacity: pressed ? 0.85 : 1 },
        ]}
        onPress={handleLogout}
      >
        <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
        <Text style={[styles.logoutText, { color: Colors.danger }]}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: "Outfit_700Bold",
    color: "#111111",
  },
  profileCard: {
    backgroundColor: "#F9FAFB",
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
    color: "#111111",
  },
  email: {
    fontSize: 15,
    fontFamily: "Outfit_400Regular",
    color: "#666666",
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
    color: "#111111",
  },
  infoText: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: "#666666",
    marginTop: 4,
    lineHeight: 18,
  },
  codeText: {
    fontFamily: "Outfit_700Bold",
    color: Colors.primary,
  },
  card: {
    backgroundColor: "#F9FAFB",
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
    color: "#111111",
  },
  roleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  roleCapability: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: "#111111",
  },
  changePasswordToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  changePasswordLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  changePasswordText: {
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
    color: "#111111",
  },
  passwordCard: {
    backgroundColor: "#F9FAFB",
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
    color: "#666666",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  passwordInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 8,
  },
  passwordInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Outfit_400Regular",
    color: "#111111",
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
    borderColor: Colors.danger + "30",
  },
  logoutText: {
    fontSize: 16,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.danger,
  },
});
