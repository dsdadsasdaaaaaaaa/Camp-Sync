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
}: {
  session: Session;
  onDelete: () => void;
  onToggleActive: () => void;
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

      <Pressable
        onPress={onDelete}
        style={({ pressed }) => [styles.deleteSessionBtn, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Ionicons name="trash-outline" size={16} color={Colors.danger} />
        <Text style={styles.deleteSessionText}>Delete Session</Text>
      </Pressable>
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
    addSession, 
    updateSession, 
    deleteSession, 
    createAuthCode, 
    updateAuthCode,
    deleteAuthCode, 
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
            <Pressable
              style={({ pressed }) => [
                styles.addBtn,
                { opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={() => setShowResetModal(true)}
            >
              <Ionicons name="key" size={20} color="#fff" />
              <Text style={styles.addBtnText}>Reset User Password</Text>
            </Pressable>

            <View style={styles.userInfoCard}>
              <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
              <Text style={styles.userInfoText}>
                As a manager, you can reset any user's password without requiring their auth code.
              </Text>
            </View>
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
});
