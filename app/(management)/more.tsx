import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Platform,
  RefreshControl,
  Modal,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import DatePicker from "@/components/DatePicker";
import Colors from "@/constants/colors";
import type { Session, AuthCode, UserRole } from "@/types";

type Tab = "sessions" | "codes" | "users";

function SessionCard({
  session,
  onDelete,
  onToggleActive,
  onViewRoster,
}: {
  session: Session;
  onDelete: () => void;
  onToggleActive: () => void;
  onViewRoster: () => void;
}) {
  return (
    <View style={styles.sessionCard}>
      <View style={styles.sessionHeader}>
        <View>
          <Text style={styles.sessionName}>{session.name}</Text>
          <Text style={styles.sessionDates}>
            {new Date(session.startDate).toLocaleDateString()} —{" "}
            {new Date(session.endDate).toLocaleDateString()}
          </Text>
        </View>
        <Pressable
          style={[
            styles.activeToggle,
            { backgroundColor: session.isActive ? Colors.success + "20" : Colors.light.surfaceSecondary },
          ]}
          onPress={onToggleActive}
        >
          <View
            style={[
              styles.activeDot,
              { backgroundColor: session.isActive ? Colors.success : Colors.light.textMuted },
            ]}
          />
          <Text
            style={[
              styles.activeText,
              { color: session.isActive ? Colors.success : Colors.light.textSecondary },
            ]}
          >
            {session.isActive ? "Active" : "Inactive"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.datesChips}>
        {session.authorizedDates.length === 0 ? (
          <Text style={styles.noDatesText}>No check-in dates set</Text>
        ) : (
          session.authorizedDates.slice(0, 4).map((d) => (
            <View key={d} style={styles.dateChip}>
              <Text style={styles.dateChipText}>
                {new Date(d + "T12:00:00").toLocaleDateString([], {
                  month: "short",
                  day: "numeric",
                })}
              </Text>
            </View>
          ))
        )}
        {session.authorizedDates.length > 4 && (
          <View style={styles.dateChip}>
            <Text style={styles.dateChipText}>+{session.authorizedDates.length - 4} more</Text>
          </View>
        )}
      </View>

      <View style={styles.sessionCardActions}>
        <Pressable
          onPress={onViewRoster}
          style={({ pressed }) => [styles.rosterBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="list-outline" size={15} color={Colors.primary} />
          <Text style={styles.rosterBtnText}>Roster</Text>
        </Pressable>
        <Pressable
          onPress={onDelete}
          style={({ pressed }) => [styles.deleteSessionBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="trash-outline" size={16} color={Colors.danger} />
          <Text style={styles.deleteSessionText}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

function AuthCodeCard({
  code,
  onEdit,
  onDelete,
}: {
  code: AuthCode;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const roleColors: Record<UserRole, string> = {
    management: Colors.primary,
    staff: Colors.accent,
    parent: "#8B5CF6",
  };

  const isFull = code.maxUses > 0 && code.usedCount >= code.maxUses;

  return (
    <View style={styles.codeCard}>
      <View style={styles.codeHeader}>
        <View style={[styles.roleIcon, { backgroundColor: roleColors[code.role] + "20" }]}>
          <Ionicons
            name={
              code.role === "management"
                ? "shield-checkmark"
                : code.role === "staff"
                ? "people"
                : "person"
            }
            size={18}
            color={roleColors[code.role]}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.codeValue}>{code.code}</Text>
          <Text style={styles.codeRole}>
            {code.role.charAt(0).toUpperCase() + code.role.slice(1)} ·{" "}
            {code.usedCount} / {code.maxUses === 0 ? "∞" : code.maxUses} used
          </Text>
        </View>
        <View
          style={[
            styles.usedBadge,
            { backgroundColor: isFull ? Colors.danger + "15" : Colors.success + "15" },
          ]}
        >
          <Text
            style={[
              styles.usedBadgeText,
              { color: isFull ? Colors.danger : Colors.success },
            ]}
          >
            {isFull ? "Full" : "Active"}
          </Text>
        </View>
      </View>
      
      <View style={styles.codeActions}>
        <Pressable
          onPress={onEdit}
          style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="pencil-outline" size={16} color={Colors.primary} />
          <Text style={[styles.actionBtnText, { color: Colors.primary }]}>Edit</Text>
        </Pressable>
        <Pressable
          onPress={onDelete}
          style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="trash-outline" size={16} color={Colors.danger} />
          <Text style={[styles.actionBtnText, { color: Colors.danger }]}>Revoke</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function MoreScreen() {
  const { user, logout, adminResetPassword } = useAuth();
  const { 
    sessions, 
    authCodes, 
    campers,
    checkIns,
    users,
    addSession, 
    updateSession, 
    deleteSession, 
    createAuthCode, 
    updateAuthCode,
    deleteAuthCode,
    updateUser,
    deleteUser,
    isLoading, 
    refresh 
  } = useData();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>("sessions");
  const [showNewSession, setShowNewSession] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [editingCode, setEditingCode] = useState<AuthCode | null>(null);

  const [sessionName, setSessionName] = useState("");
  const [sessionStart, setSessionStart] = useState("");
  const [sessionEnd, setSessionEnd] = useState("");
  const [authorizedDates, setAuthorizedDates] = useState<string[]>([]);
  
  const [selectedRole, setSelectedRole] = useState<UserRole>("staff");
  const [selectedCamperId, setSelectedCamperId] = useState<string | undefined>();
  const [maxUses, setMaxUses] = useState("1");

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [rosterSession, setRosterSession] = useState<Session | null>(null);

  const [editingUser, setEditingUser] = useState<typeof users[0] | null>(null);
  const [userEditName, setUserEditName] = useState("");
  const [userEditEmail, setUserEditEmail] = useState("");
  const [userEditRole, setUserEditRole] = useState<UserRole>("staff");
  const [userEditLinkedCampers, setUserEditLinkedCampers] = useState<string[]>([]);
  const [userPwdNew, setUserPwdNew] = useState("");
  const [userPwdConfirm, setUserPwdConfirm] = useState("");
  const [userResetCode, setUserResetCode] = useState("");
  const [userActionLoading, setUserActionLoading] = useState(false);
  const [userSheetTab, setUserSheetTab] = useState<"info" | "security">("info");

  const handleAddSession = async () => {
    if (!sessionName.trim() || !sessionStart.trim() || !sessionEnd.trim()) {
      Alert.alert("Missing Info", "Please fill in session name, start date, and end date.");
      return;
    }
    try {
      await addSession({
        name: sessionName.trim(),
        startDate: sessionStart.trim(),
        endDate: sessionEnd.trim(),
        authorizedDates: authorizedDates,
        isActive: true,
        createdBy: user?.id || "",
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSessionName("");
      setSessionStart("");
      setSessionEnd("");
      setAuthorizedDates([]);
      setShowNewSession(false);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const handleSaveCode = async () => {
    try {
      const uses = parseInt(maxUses) || 0;
      if (editingCode) {
        await updateAuthCode(editingCode.code, {
          role: selectedRole,
          linkedCamperId: selectedCamperId,
          maxUses: uses,
        });
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Success", "Auth code updated successfully.");
      } else {
        const code = await createAuthCode(selectedRole, uses, selectedCamperId);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          "Auth Code Created",
          `Share this code:\n\n${code}\n\nThis grants ${selectedRole} access.`,
          [{ text: "Done" }]
        );
      }
      setShowCodeModal(false);
      setEditingCode(null);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const openCodeModal = (code?: AuthCode) => {
    if (code) {
      setEditingCode(code);
      setSelectedRole(code.role);
      setSelectedCamperId(code.linkedCamperId);
      setMaxUses(code.maxUses.toString());
    } else {
      setEditingCode(null);
      setSelectedRole("staff");
      setSelectedCamperId(undefined);
      setMaxUses("1");
    }
    setShowCodeModal(true);
  };

  const handleAdminResetPassword = async () => {
    if (!resetEmail.trim()) {
      Alert.alert("Missing Info", "Please enter the user's email address.");
      return;
    }
    if (!resetNewPassword.trim() || resetNewPassword.length < 6) {
      Alert.alert("Invalid Password", "Password must be at least 6 characters.");
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      Alert.alert("Mismatch", "Passwords do not match.");
      return;
    }
    setResetLoading(true);
    try {
      await adminResetPassword(resetEmail.trim().toLowerCase(), resetNewPassword);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", `Password reset for ${resetEmail.trim()}.`);
      setShowResetModal(false);
      setResetEmail("");
      setResetNewPassword("");
      setResetConfirmPassword("");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to reset password.");
    } finally {
      setResetLoading(false);
    }
  };

  const openUserEdit = (u: typeof users[0]) => {
    setEditingUser(u);
    setUserEditName(u.name);
    setUserEditEmail(u.email);
    setUserEditRole(u.role as UserRole);
    setUserEditLinkedCampers(u.linkedCamperIds || []);
    setUserPwdNew("");
    setUserPwdConfirm("");
    setUserResetCode("");
    setUserSheetTab("info");
  };

  const closeUserEdit = () => {
    setEditingUser(null);
    setUserPwdNew("");
    setUserPwdConfirm("");
    setUserResetCode("");
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    if (!userEditName.trim()) { Alert.alert("Required", "Name cannot be empty."); return; }
    setUserActionLoading(true);
    try {
      await updateUser(editingUser.id, {
        name: userEditName.trim(),
        email: userEditEmail.trim().toLowerCase(),
        role: userEditRole,
        linkedCamperIds: userEditRole === "parent" ? userEditLinkedCampers : [],
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved", "User info updated.");
      closeUserEdit();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update user.");
    } finally {
      setUserActionLoading(false);
    }
  };

  const handleUserResetPwd = async () => {
    if (!editingUser) return;
    if (!userPwdNew.trim() || userPwdNew.length < 6) { Alert.alert("Invalid", "Password must be at least 6 characters."); return; }
    if (userPwdNew !== userPwdConfirm) { Alert.alert("Mismatch", "Passwords do not match."); return; }
    setUserActionLoading(true);
    try {
      await adminResetPassword(editingUser.email, userPwdNew);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Done", `Password reset for ${editingUser.name}.`);
      setUserPwdNew("");
      setUserPwdConfirm("");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to reset password.");
    } finally {
      setUserActionLoading(false);
    }
  };

  const handleGenerateResetCode = async () => {
    if (!editingUser) return;
    setUserActionLoading(true);
    try {
      const { apiRequest } = await import("@/lib/query-client");
      const res = await apiRequest("POST", `/api/users/${editingUser.id}/reset-code`);
      const { code, expiresInMinutes } = await res.json();
      setUserResetCode(code);
      Alert.alert(
        "Reset Code Generated",
        `Share this one-time code with ${editingUser.name}:\n\n${code}\n\nThe user can enter this code on the login screen to set a new password. Expires in ${expiresInMinutes} minutes.`,
        [{ text: "OK" }]
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to generate reset code.");
    } finally {
      setUserActionLoading(false);
    }
  };

  const handleDeleteUser = (u: typeof users[0]) => {
    if (u.id === user?.id) { Alert.alert("Not Allowed", "You cannot delete your own account."); return; }
    Alert.alert(
      "Delete User",
      `Permanently delete ${u.name}'s account? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: async () => {
          try {
            await deleteUser(u.id);
            closeUserEdit();
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to delete user.");
          }
        }},
      ]
    );
  };

  const ROLE_COLORS: Record<UserRole, string> = {
    management: Colors.danger,
    staff: Colors.primary,
    parent: Colors.success,
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

  return (
    <View style={{ flex: 1, backgroundColor: Colors.light.background }}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20) },
        ]}
      >
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Management</Text>
          <Pressable onPress={handleLogout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={20} color={Colors.light.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.tabRow}>
          {(["sessions", "codes", "users"] as Tab[]).map((t) => (
            <Pressable
              key={t}
              style={[styles.tabBtn, activeTab === t && styles.tabBtnActive]}
              onPress={() => setActiveTab(t)}
            >
              <Ionicons
                name={t === "sessions" ? "calendar-outline" : t === "codes" ? "key-outline" : "people-outline"}
                size={16}
                color={activeTab === t ? Colors.primary : Colors.light.textMuted}
              />
              <Text
                style={[styles.tabBtnText, activeTab === t && styles.tabBtnActiveText]}
              >
                {t === "sessions" ? "Sessions" : t === "codes" ? "Auth Codes" : "Users"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 100 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refresh}
            tintColor={Colors.primary}
          />
        }
      >
        {activeTab === "sessions" && (
          <>
            <Pressable
              style={({ pressed }) => [
                styles.addBtn,
                { opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={() => setShowNewSession(true)}
            >
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={styles.addBtnText}>New Session</Text>
            </Pressable>

            {sessions.length === 0 && (
              <View style={styles.empty}>
                <Ionicons name="calendar-outline" size={48} color={Colors.light.textMuted} />
                <Text style={styles.emptyTitle}>No Sessions Yet</Text>
                <Text style={styles.emptyText}>
                  Create camp sessions to authorize check-in dates for staff
                </Text>
              </View>
            )}

            {sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onDelete={() =>
                  Alert.alert("Delete Session", `Remove "${session.name}"?`, [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () => deleteSession(session.id),
                    },
                  ])
                }
                onToggleActive={() =>
                  updateSession(session.id, { isActive: !session.isActive })
                }
                onViewRoster={() => setRosterSession(session)}
              />
            ))}
          </>
        )}

        {activeTab === "codes" && (
          <>
            <Pressable
              style={({ pressed }) => [
                styles.addBtn,
                { opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={() => openCodeModal()}
            >
              <Ionicons name="key" size={20} color="#fff" />
              <Text style={styles.addBtnText}>Generate Code</Text>
            </Pressable>

            {authCodes.length === 0 && (
              <View style={styles.empty}>
                <Ionicons name="key-outline" size={48} color={Colors.light.textMuted} />
                <Text style={styles.emptyTitle}>No Auth Codes</Text>
                <Text style={styles.emptyText}>
                  Generate codes for staff and parents to register
                </Text>
              </View>
            )}

            {authCodes.map((code) => (
              <AuthCodeCard
                key={code.code}
                code={code}
                onEdit={() => openCodeModal(code)}
                onDelete={() =>
                  Alert.alert("Revoke Code", `Revoke "${code.code}"?`, [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Revoke",
                      style: "destructive",
                      onPress: () => deleteAuthCode(code.code),
                    },
                  ])
                }
              />
            ))}
          </>
        )}

        {activeTab === "users" && (
          <>
            {users.length === 0 && (
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={48} color={Colors.light.textMuted} />
                <Text style={styles.emptyTitle}>No Users Yet</Text>
                <Text style={styles.emptyText}>Registered users will appear here</Text>
              </View>
            )}
            {users.map((u) => {
              const initials = u.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
              const roleColor = ROLE_COLORS[u.role as UserRole] || Colors.light.textSecondary;
              const linkedCamperNames = (u.linkedCamperIds || [])
                .map((cid) => campers.find((c) => c.id === cid))
                .filter(Boolean)
                .map((c) => `${c!.firstName} ${c!.lastName}`)
                .join(", ");
              return (
                <Pressable
                  key={u.id}
                  style={({ pressed }) => [styles.userCard, { opacity: pressed ? 0.85 : 1 }]}
                  onPress={() => openUserEdit(u)}
                >
                  <View style={[styles.userAvatar, { backgroundColor: roleColor + "20" }]}>
                    <Text style={[styles.userAvatarText, { color: roleColor }]}>{initials}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={styles.userName}>{u.name}</Text>
                      {u.id === user?.id && (
                        <View style={[styles.rolePill, { backgroundColor: Colors.light.surfaceSecondary }]}>
                          <Text style={[styles.rolePillText, { color: Colors.light.textMuted }]}>You</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.userEmail}>{u.email}</Text>
                    {linkedCamperNames ? (
                      <Text style={styles.userMeta} numberOfLines={1}>Linked: {linkedCamperNames}</Text>
                    ) : null}
                  </View>
                  <View style={[styles.rolePill, { backgroundColor: roleColor + "15" }]}>
                    <Text style={[styles.rolePillText, { color: roleColor }]}>{u.role}</Text>
                  </View>
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>

      <Modal
        visible={showResetModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowResetModal(false);
          setResetEmail("");
          setResetNewPassword("");
          setResetConfirmPassword("");
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Reset User Password</Text>
            <Text style={styles.modalSub}>
              Enter the user's email and set a new password for them
            </Text>

            <Text style={styles.fieldLabel}>User Email</Text>
            <TextInput
              style={styles.fieldInput}
              value={resetEmail}
              onChangeText={setResetEmail}
              placeholder="user@email.com"
              placeholderTextColor={Colors.light.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />

            <Text style={styles.fieldLabel}>New Password</Text>
            <TextInput
              style={styles.fieldInput}
              value={resetNewPassword}
              onChangeText={setResetNewPassword}
              placeholder="New password"
              placeholderTextColor={Colors.light.textMuted}
              secureTextEntry
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>Confirm Password</Text>
            <TextInput
              style={styles.fieldInput}
              value={resetConfirmPassword}
              onChangeText={setResetConfirmPassword}
              placeholder="Confirm new password"
              placeholderTextColor={Colors.light.textMuted}
              secureTextEntry
              autoCapitalize="none"
            />

            <View style={styles.modalButtons}>
              <Pressable
                style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.8 : 1 }]}
                onPress={() => {
                  setShowResetModal(false);
                  setResetEmail("");
                  setResetNewPassword("");
                  setResetConfirmPassword("");
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.confirmBtn, { opacity: pressed ? 0.85 : 1 }]}
                onPress={handleAdminResetPassword}
                disabled={resetLoading}
              >
                {resetLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmBtnText}>Reset Password</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!editingUser}
        animationType="slide"
        transparent
        onRequestClose={closeUserEdit}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: "90%" }]}>
            <View style={styles.modalHandle} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <Text style={styles.modalTitle}>{editingUser?.name}</Text>
              {editingUser && editingUser.id !== user?.id && (
                <Pressable
                  onPress={() => handleDeleteUser(editingUser)}
                  style={{ padding: 6 }}
                >
                  <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                </Pressable>
              )}
            </View>
            <Text style={styles.modalSub}>{editingUser?.email}</Text>

            <View style={[styles.tabs2, { marginVertical: 12 }]}>
              {(["info", "security"] as const).map((t) => (
                <Pressable
                  key={t}
                  style={[styles.tab2, userSheetTab === t && styles.tab2Active]}
                  onPress={() => setUserSheetTab(t)}
                >
                  <Text style={[styles.tab2Text, userSheetTab === t && styles.tab2ActiveText]}>
                    {t === "info" ? "Profile & Role" : "Security"}
                  </Text>
                </Pressable>
              ))}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {userSheetTab === "info" && (
                <View style={{ gap: 12 }}>
                  <Text style={styles.fieldLabel}>Full Name</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={userEditName}
                    onChangeText={setUserEditName}
                    placeholder="Full name"
                    placeholderTextColor={Colors.light.textMuted}
                    autoCapitalize="words"
                  />
                  <Text style={styles.fieldLabel}>Email</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={userEditEmail}
                    onChangeText={setUserEditEmail}
                    placeholder="user@email.com"
                    placeholderTextColor={Colors.light.textMuted}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoCorrect={false}
                  />
                  <Text style={styles.fieldLabel}>Role</Text>
                  {(["management", "staff", "parent"] as UserRole[]).map((r) => (
                    <Pressable
                      key={r}
                      style={[styles.roleOption, userEditRole === r && styles.roleOptionSelected]}
                      onPress={() => setUserEditRole(r)}
                    >
                      <Ionicons
                        name={r === "management" ? "shield-outline" : r === "staff" ? "people-outline" : "person-outline"}
                        size={20}
                        color={userEditRole === r ? Colors.primary : Colors.light.textMuted}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.roleName}>{r.charAt(0).toUpperCase() + r.slice(1)}</Text>
                        <Text style={styles.roleDesc}>
                          {r === "management" ? "Full access to all features" : r === "staff" ? "Check-in/out and camper list" : "View linked child's info"}
                        </Text>
                      </View>
                      {userEditRole === r && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
                    </Pressable>
                  ))}
                  {userEditRole === "parent" && (
                    <>
                      <Text style={styles.fieldLabel}>Linked Campers</Text>
                      <View style={{ borderRadius: 12, borderWidth: 1, borderColor: Colors.light.border, overflow: "hidden" }}>
                        {campers.length === 0 && (
                          <Text style={{ padding: 12, fontFamily: "Outfit_400Regular", color: Colors.light.textMuted, fontSize: 13 }}>No campers available</Text>
                        )}
                        {campers.map((c) => {
                          const isLinked = userEditLinkedCampers.includes(c.id);
                          return (
                            <Pressable
                              key={c.id}
                              style={[styles.camperSelectRow, isLinked && styles.camperSelectRowActive]}
                              onPress={() => setUserEditLinkedCampers(prev =>
                                isLinked ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                              )}
                            >
                              <Text style={styles.camperSelectName}>{c.firstName} {c.lastName}</Text>
                              {isLinked && <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />}
                            </Pressable>
                          );
                        })}
                      </View>
                    </>
                  )}
                  <View style={[styles.modalButtons, { marginTop: 4 }]}>
                    <Pressable style={[styles.cancelBtn, { opacity: 1 }]} onPress={closeUserEdit}>
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.confirmBtn, { opacity: userActionLoading ? 0.7 : 1 }]}
                      onPress={handleSaveUser}
                      disabled={userActionLoading}
                    >
                      {userActionLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Save Changes</Text>}
                    </Pressable>
                  </View>
                </View>
              )}

              {userSheetTab === "security" && (
                <View style={{ gap: 12 }}>
                  <View style={styles.securitySection}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <Ionicons name="lock-closed-outline" size={16} color={Colors.light.text} />
                      <Text style={[styles.fieldLabel, { fontSize: 14 }]}>Set New Password</Text>
                    </View>
                    <TextInput
                      style={styles.fieldInput}
                      value={userPwdNew}
                      onChangeText={setUserPwdNew}
                      placeholder="New password (min 6 chars)"
                      placeholderTextColor={Colors.light.textMuted}
                      secureTextEntry
                      autoCapitalize="none"
                    />
                    <TextInput
                      style={[styles.fieldInput, { marginTop: 8 }]}
                      value={userPwdConfirm}
                      onChangeText={setUserPwdConfirm}
                      placeholder="Confirm new password"
                      placeholderTextColor={Colors.light.textMuted}
                      secureTextEntry
                      autoCapitalize="none"
                    />
                    <Pressable
                      style={[styles.confirmBtn, { marginTop: 8, opacity: userActionLoading ? 0.7 : 1 }]}
                      onPress={handleUserResetPwd}
                      disabled={userActionLoading}
                    >
                      {userActionLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Reset Password</Text>}
                    </Pressable>
                  </View>

                  <View style={styles.securitySection}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <Ionicons name="key-outline" size={16} color={Colors.light.text} />
                      <Text style={[styles.fieldLabel, { fontSize: 14 }]}>One-Time Reset Code</Text>
                    </View>
                    <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: Colors.light.textSecondary, marginBottom: 8, lineHeight: 18 }}>
                      Generate a one-time code the user can enter at login to reset their own password. Expires in 60 minutes.
                    </Text>
                    {userResetCode ? (
                      <View style={styles.resetCodeBox}>
                        <Text style={styles.resetCodeText}>{userResetCode}</Text>
                        <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: Colors.light.textSecondary, marginTop: 4 }}>
                          Share this code with the user. It expires in 60 min.
                        </Text>
                      </View>
                    ) : null}
                    <Pressable
                      style={[styles.securityBtn, { opacity: userActionLoading ? 0.7 : 1 }]}
                      onPress={handleGenerateResetCode}
                      disabled={userActionLoading}
                    >
                      {userActionLoading ? <ActivityIndicator size="small" color={Colors.primary} /> : (
                        <>
                          <Ionicons name="refresh-outline" size={16} color={Colors.primary} />
                          <Text style={[styles.confirmBtnText, { color: Colors.primary }]}>Generate Code</Text>
                        </>
                      )}
                    </Pressable>
                  </View>

                  {editingUser && editingUser.id !== user?.id && (
                    <Pressable
                      style={[styles.securityBtn, { borderColor: Colors.danger + "40", backgroundColor: Colors.danger + "08" }]}
                      onPress={() => handleDeleteUser(editingUser)}
                    >
                      <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                      <Text style={[styles.confirmBtnText, { color: Colors.danger }]}>Delete This Account</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showNewSession}
        animationType="slide"
        transparent
        onRequestClose={() => setShowNewSession(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>New Camp Session</Text>
            <Text style={styles.modalSub}>
              Set the dates when staff are authorized to check in campers
            </Text>

            <Text style={styles.fieldLabel}>Session Name</Text>
            <TextInput style={styles.fieldInput} value={sessionName} onChangeText={setSessionName} placeholder="e.g. Week 1 - Summer 2025" placeholderTextColor={Colors.light.textMuted} />

            <DatePicker
              mode="single"
              value={sessionStart}
              onChange={setSessionStart}
              label="Start Date"
              placeholder="Select start date"
              maxDate={sessionEnd || undefined}
            />

            <DatePicker
              mode="single"
              value={sessionEnd}
              onChange={setSessionEnd}
              label="End Date"
              placeholder="Select end date"
              minDate={sessionStart || undefined}
            />

            <DatePicker
              mode="multi"
              value={authorizedDates}
              onChange={setAuthorizedDates}
              label="Authorized Check-in Dates"
              placeholder="Select check-in dates"
              minDate={sessionStart || undefined}
              maxDate={sessionEnd || undefined}
            />

            <View style={styles.modalButtons}>
              <Pressable
                style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.8 : 1 }]}
                onPress={() => setShowNewSession(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.confirmBtn, { opacity: pressed ? 0.85 : 1 }]}
                onPress={handleAddSession}
              >
                <Text style={styles.confirmBtnText}>Create Session</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCodeModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowCodeModal(false);
          setEditingCode(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{editingCode ? "Edit Auth Code" : "Generate Auth Code"}</Text>
            <Text style={styles.modalSub}>
              {editingCode ? `Editing code: ${editingCode.code}` : "Select the role and usage limits"}
            </Text>

            <Text style={styles.fieldLabel}>Role</Text>
            {(["staff", "management", "parent"] as UserRole[]).map((role) => (
              <Pressable
                key={role}
                style={[
                  styles.roleOption,
                  selectedRole === role && styles.roleOptionSelected,
                ]}
                onPress={() => setSelectedRole(role)}
              >
                <Ionicons
                  name={
                    role === "management"
                      ? "shield-checkmark"
                      : role === "staff"
                      ? "people"
                      : "person"
                  }
                  size={20}
                  color={selectedRole === role ? Colors.primary : Colors.light.textMuted}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.roleName, selectedRole === role && { color: Colors.primary }]}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </Text>
                  <Text style={styles.roleDesc}>
                    {role === "management"
                      ? "Full access to all features"
                      : role === "staff"
                      ? "Check-in/out on authorized dates"
                      : "View & update their child's info"}
                  </Text>
                </View>
                {selectedRole === role && (
                  <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                )}
              </Pressable>
            ))}

            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Maximum Uses</Text>
            <Text style={styles.fieldHint}>Enter 0 for infinite uses</Text>
            <TextInput
              style={styles.fieldInput}
              value={maxUses}
              onChangeText={setMaxUses}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor={Colors.light.textMuted}
            />

            {selectedRole === "parent" && (
              <>
                <Text style={styles.fieldLabel}>Link to Camper (optional)</Text>
                <ScrollView
                  style={{ maxHeight: 120 }}
                  nestedScrollEnabled
                >
                  {campers.map((c) => (
                    <Pressable
                      key={c.id}
                      style={[
                        styles.camperSelectRow,
                        selectedCamperId === c.id && styles.camperSelectRowActive,
                      ]}
                      onPress={() =>
                        setSelectedCamperId(
                          selectedCamperId === c.id ? undefined : c.id
                        )
                      }
                    >
                      <Text style={styles.camperSelectName}>
                        {c.firstName} {c.lastName}
                      </Text>
                      {selectedCamperId === c.id && (
                        <Ionicons name="checkmark" size={16} color={Colors.primary} />
                      )}
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}

            <View style={styles.modalButtons}>
              <Pressable
                style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.8 : 1 }]}
                onPress={() => {
                  setShowCodeModal(false);
                  setEditingCode(null);
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.confirmBtn, { opacity: pressed ? 0.85 : 1 }]}
                onPress={handleSaveCode}
              >
                <Text style={styles.confirmBtnText}>{editingCode ? "Save Changes" : "Generate"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!rosterSession}
        animationType="slide"
        transparent
        onRequestClose={() => setRosterSession(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: "85%" }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{rosterSession?.name ?? ""}</Text>
            <Text style={styles.modalSub}>
              {rosterSession
                ? `${new Date(rosterSession.startDate).toLocaleDateString()} — ${new Date(rosterSession.endDate).toLocaleDateString()}`
                : ""}
            </Text>
            {rosterSession && (() => {
              const roster = checkIns
                .filter((ci) => ci.sessionId === rosterSession.id)
                .sort((a, b) => new Date(a.checkedInAt).getTime() - new Date(b.checkedInAt).getTime());
              return (
                <>
                  <View style={styles.rosterCount}>
                    <Ionicons name="people" size={16} color={Colors.primary} />
                    <Text style={styles.rosterCountText}>
                      {roster.length} {roster.length === 1 ? "camper" : "campers"} attended
                    </Text>
                  </View>
                  <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 16 }}>
                    {roster.length === 0 ? (
                      <View style={{ alignItems: "center", paddingVertical: 24, gap: 8 }}>
                        <Ionicons name="calendar-outline" size={36} color={Colors.light.textMuted} />
                        <Text style={styles.fieldHint}>No check-ins recorded for this session</Text>
                      </View>
                    ) : (
                      roster.map((ci, idx) => {
                        const camper = campers.find((c) => c.id === ci.camperId);
                        return (
                          <View key={ci.id}>
                            <View style={styles.rosterRow}>
                              <View style={styles.rosterAvatar}>
                                <Text style={styles.rosterAvatarText}>
                                  {camper?.firstName?.charAt(0)?.toUpperCase() ?? "?"}
                                </Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.rosterName}>
                                  {camper ? `${camper.firstName} ${camper.lastName}` : "Unknown Camper"}
                                </Text>
                                {camper?.cabinGroup ? (
                                  <Text style={styles.rosterCabin}>{camper.cabinGroup}</Text>
                                ) : null}
                                <Text style={styles.rosterTime}>
                                  In: {new Date(ci.checkedInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  {ci.checkedOutAt
                                    ? ` · Out: ${new Date(ci.checkedOutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                                    : ""}
                                </Text>
                              </View>
                              <View style={[
                                styles.historyBadge,
                                { backgroundColor: ci.checkedOutAt ? Colors.light.surfaceSecondary : Colors.success + "20" },
                              ]}>
                                <Text style={[
                                  styles.historyBadgeText,
                                  { color: ci.checkedOutAt ? Colors.light.textSecondary : Colors.success },
                                ]}>
                                  {ci.checkedOutAt ? "Done" : "Present"}
                                </Text>
                              </View>
                            </View>
                            {idx < roster.length - 1 && <View style={styles.divider} />}
                          </View>
                        );
                      })
                    )}
                  </ScrollView>
                </>
              );
            })()}
            <Pressable
              style={({ pressed }) => [styles.confirmBtn, { opacity: pressed ? 0.85 : 1 }]}
              onPress={() => setRosterSession(null)}
            >
              <Text style={styles.confirmBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: Colors.light.background,
    gap: 12,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Outfit_700Bold",
    color: Colors.light.text,
  },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: Colors.light.surface,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 14,
    fontFamily: "Outfit_500Medium",
    color: Colors.light.textMuted,
  },
  tabBtnActiveText: {
    color: Colors.primary,
    fontFamily: "Outfit_600SemiBold",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 50,
    marginBottom: 8,
  },
  addBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
  },
  sessionCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  sessionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  sessionName: {
    fontSize: 16,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.light.text,
  },
  sessionDates: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  activeToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  activeText: {
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
  },
  datesChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  dateChip: {
    backgroundColor: Colors.primary + "15",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dateChipText: {
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.primary,
  },
  noDatesText: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textMuted,
  },
  deleteSessionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  deleteSessionText: {
    fontSize: 13,
    fontFamily: "Outfit_500Medium",
    color: Colors.danger,
  },
  codeCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  codeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  roleIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  codeValue: {
    fontSize: 16,
    fontFamily: "Outfit_700Bold",
    color: Colors.light.text,
    letterSpacing: 0.5,
  },
  codeRole: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  usedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  usedBadgeText: {
    fontSize: 11,
    fontFamily: "Outfit_700Bold",
  },
  codeActions: {
    flexDirection: "row",
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    paddingTop: 12,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionBtnText: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.light.text,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textSecondary,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingTop: 12,
    maxHeight: "90%",
  },
  modalHandle: {
    width: 40,
    height: 5,
    backgroundColor: Colors.light.border,
    borderRadius: 2.5,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Outfit_700Bold",
    color: Colors.light.text,
  },
  modalSub: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.light.text,
    marginBottom: 8,
  },
  fieldHint: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textMuted,
    marginBottom: 8,
    marginTop: -4,
  },
  fieldInput: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 14,
    height: 48,
    fontFamily: "Outfit_400Regular",
    fontSize: 15,
    color: Colors.light.text,
    marginBottom: 16,
  },
  roleOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 10,
  },
  roleOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + "05",
  },
  roleName: {
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.light.text,
  },
  roleDesc: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  camperSelectRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  camperSelectRowActive: {
    backgroundColor: Colors.primary + "05",
  },
  camperSelectName: {
    fontSize: 14,
    fontFamily: "Outfit_500Medium",
    color: Colors.light.text,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  cancelBtnText: {
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.light.textSecondary,
  },
  confirmBtn: {
    flex: 2,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: Colors.primary,
  },
  confirmBtnText: {
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
    color: "#fff",
  },
  userInfoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: Colors.primary + "10",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.primary + "20",
  },
  userInfoText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textSecondary,
    lineHeight: 20,
  },
  sessionCardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  rosterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary + "40",
    backgroundColor: Colors.primary + "08",
  },
  rosterBtnText: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.primary,
  },
  rosterCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.primary + "10",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  rosterCountText: {
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.primary,
  },
  rosterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  rosterAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  rosterAvatarText: {
    fontSize: 15,
    fontFamily: "Outfit_700Bold",
    color: Colors.primary,
  },
  rosterName: {
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.light.text,
  },
  rosterCabin: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textSecondary,
  },
  rosterTime: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textMuted,
    marginTop: 2,
  },
  historyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  historyBadgeText: {
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.border,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarText: {
    fontSize: 16,
    fontFamily: "Outfit_700Bold",
  },
  userName: {
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.light.text,
  },
  userEmail: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  userMeta: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textMuted,
    marginTop: 1,
  },
  rolePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  rolePillText: {
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
    textTransform: "capitalize",
  },
  tabs2: {
    flexDirection: "row",
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 10,
    padding: 3,
  },
  tab2: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 8,
  },
  tab2Active: {
    backgroundColor: Colors.light.surface,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  tab2Text: {
    fontSize: 13,
    fontFamily: "Outfit_500Medium",
    color: Colors.light.textMuted,
  },
  tab2ActiveText: {
    color: Colors.primary,
    fontFamily: "Outfit_600SemiBold",
  },
  securitySection: {
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 14,
    padding: 14,
  },
  securityBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary + "40",
    backgroundColor: Colors.primary + "08",
  },
  resetCodeBox: {
    backgroundColor: Colors.light.surface,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 8,
  },
  resetCodeText: {
    fontSize: 24,
    fontFamily: "Outfit_700Bold",
    color: Colors.light.text,
    letterSpacing: 4,
  },
});
