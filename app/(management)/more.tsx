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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import Colors from "@/constants/colors";
import type { Session, AuthCode, UserRole } from "@/types";

type Tab = "sessions" | "codes";

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
  onDelete,
}: {
  code: AuthCode;
  onDelete: () => void;
}) {
  const roleColors: Record<UserRole, string> = {
    management: Colors.primary,
    staff: Colors.accent,
    parent: "#8B5CF6",
  };

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
            {code.used ? `Used by ${code.usedBy?.slice(0, 8)}...` : "Available"}
          </Text>
        </View>
        <View
          style={[
            styles.usedBadge,
            { backgroundColor: code.used ? Colors.light.surfaceSecondary : Colors.success + "20" },
          ]}
        >
          <Text
            style={[
              styles.usedBadgeText,
              { color: code.used ? Colors.light.textMuted : Colors.success },
            ]}
          >
            {code.used ? "Used" : "Active"}
          </Text>
        </View>
      </View>
      {!code.used && (
        <Pressable
          onPress={onDelete}
          style={({ pressed }) => [styles.deleteSessionBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="trash-outline" size={16} color={Colors.danger} />
          <Text style={styles.deleteSessionText}>Revoke Code</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function MoreScreen() {
  const { user, logout } = useAuth();
  const { sessions, authCodes, campers, addSession, updateSession, deleteSession, createAuthCode, deleteAuthCode, isLoading, refresh } = useData();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>("sessions");
  const [showNewSession, setShowNewSession] = useState(false);
  const [showNewCode, setShowNewCode] = useState(false);

  const [sessionName, setSessionName] = useState("");
  const [sessionStart, setSessionStart] = useState("");
  const [sessionEnd, setSessionEnd] = useState("");
  const [authorizedDates, setAuthorizedDates] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole>("staff");
  const [selectedCamperId, setSelectedCamperId] = useState<string | undefined>();

  const handleAddSession = async () => {
    if (!sessionName.trim() || !sessionStart.trim() || !sessionEnd.trim()) {
      Alert.alert("Missing Info", "Please fill in session name, start date, and end date.");
      return;
    }
    const dates = authorizedDates
      .split(",")
      .map((d) => d.trim())
      .filter((d) => d.length > 0);

    try {
      await addSession({
        name: sessionName.trim(),
        startDate: sessionStart.trim(),
        endDate: sessionEnd.trim(),
        authorizedDates: dates,
        isActive: true,
        createdBy: user?.id || "",
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSessionName("");
      setSessionStart("");
      setSessionEnd("");
      setAuthorizedDates("");
      setShowNewSession(false);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const handleCreateCode = async () => {
    try {
      const code = await createAuthCode(selectedRole, selectedCamperId);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Auth Code Created",
        `Share this code:\n\n${code}\n\nThis grants ${selectedRole} access.`,
        [{ text: "Done", onPress: () => setShowNewCode(false) }]
      );
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
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
          <Pressable onPress={logout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={20} color={Colors.light.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.tabRow}>
          {(["sessions", "codes"] as Tab[]).map((t) => (
            <Pressable
              key={t}
              style={[styles.tabBtn, activeTab === t && styles.tabBtnActive]}
              onPress={() => setActiveTab(t)}
            >
              <Ionicons
                name={t === "sessions" ? "calendar-outline" : "key-outline"}
                size={16}
                color={activeTab === t ? Colors.primary : Colors.light.textMuted}
              />
              <Text
                style={[styles.tabBtnText, activeTab === t && styles.tabBtnActiveText]}
              >
                {t === "sessions" ? "Sessions" : "Auth Codes"}
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
              onPress={() => setShowNewCode(true)}
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
      </ScrollView>

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

            <Text style={styles.fieldLabel}>Start Date</Text>
            <TextInput style={styles.fieldInput} value={sessionStart} onChangeText={setSessionStart} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.light.textMuted} />

            <Text style={styles.fieldLabel}>End Date</Text>
            <TextInput style={styles.fieldInput} value={sessionEnd} onChangeText={setSessionEnd} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.light.textMuted} />

            <Text style={styles.fieldLabel}>Authorized Check-in Dates</Text>
            <Text style={styles.fieldHint}>Comma-separated dates (YYYY-MM-DD)</Text>
            <TextInput
              style={[styles.fieldInput, { height: 72, textAlignVertical: "top" }]}
              value={authorizedDates}
              onChangeText={setAuthorizedDates}
              placeholder="2025-06-01, 2025-06-08, ..."
              placeholderTextColor={Colors.light.textMuted}
              multiline
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
        visible={showNewCode}
        animationType="slide"
        transparent
        onRequestClose={() => setShowNewCode(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Generate Auth Code</Text>
            <Text style={styles.modalSub}>Select the role this code will grant</Text>

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
                      ? "Check-in/out on authorized dates only"
                      : "View & update their child's info"}
                  </Text>
                </View>
                {selectedRole === role && (
                  <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                )}
              </Pressable>
            ))}

            {selectedRole === "parent" && (
              <>
                <Text style={styles.fieldLabel}>Link to Camper (optional)</Text>
                <ScrollView
                  style={{ maxHeight: 150 }}
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
                onPress={() => setShowNewCode(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.confirmBtn, { opacity: pressed ? 0.85 : 1 }]}
                onPress={handleCreateCode}
              >
                <Text style={styles.confirmBtnText}>Generate</Text>
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
    gap: 10,
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
    fontSize: 15,
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
    paddingVertical: 4,
    borderRadius: 8,
  },
  usedBadgeText: {
    fontSize: 11,
    fontFamily: "Outfit_700Bold",
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
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    gap: 14,
    maxHeight: "90%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.light.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: "Outfit_700Bold",
    color: Colors.light.text,
  },
  modalSub: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textSecondary,
    marginTop: -6,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.light.text,
  },
  fieldHint: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textMuted,
    marginTop: -8,
  },
  fieldInput: {
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: "Outfit_400Regular",
    fontSize: 15,
    color: Colors.light.text,
  },
  roleOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  roleOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + "08",
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
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 6,
  },
  camperSelectRowActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + "08",
  },
  camperSelectName: {
    fontSize: 14,
    fontFamily: "Outfit_500Medium",
    color: Colors.light.text,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  cancelBtnText: {
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.light.textSecondary,
  },
  confirmBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnText: {
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
    color: "#fff",
  },
});
