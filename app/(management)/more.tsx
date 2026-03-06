import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  Pressable,
  TextInput,
  Alert,
  Platform,
  RefreshControl,
  Modal,
  ActivityIndicator,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { fetch } from "expo/fetch";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import type { Session, AuthCode, UserRole } from "@/types";
import DatePicker from "@/components/DatePicker";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";
import { getToken } from "@/lib/auth-token";
import { useColors } from "@/hooks/useColors";

type Tab = "sessions" | "codes" | "users" | "ai";

// ── AI Types ──────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

const SUGGESTION_QUESTIONS = [
  "Who has peanut allergies checking in today?",
  "Which campers are currently checked in?",
  "List all campers with medical conditions",
  "Who hasn't been checked in yet this session?",
  "Which campers don't have wristbands?",
];

function MessageBubble({ message }: { message: Message }) {
  const colors = useColors();
  const styles = getStyles(colors);
  const isUser = message.role === "user";
  return (
    <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
      {!isUser && (
        <View style={styles.aiAvatar}>
          <Ionicons name="sparkles" size={13} color={Colors.accent} />
        </View>
      )}
      <View style={[styles.bubbleContent, isUser ? styles.userBubbleContent : styles.aiBubbleContent]}>
        <Text style={[styles.bubbleText, { color: isUser ? "#fff" : colors.text }]}>
          {message.content}
          {message.isStreaming && <Text style={{ color: Colors.accent }}>▋</Text>}
        </Text>
      </View>
    </View>
  );
}

function TypingIndicator() {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 16, marginBottom: 8 }}>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.accent + "20", alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="sparkles" size={13} color={Colors.accent} />
      </View>
      <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 18, borderBottomLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: colors.border }}>
        <Text style={{ color: colors.textSecondary, fontSize: 22, letterSpacing: 2, lineHeight: 22 }}>···</Text>
      </View>
    </View>
  );
}

// ── Session Card ──────────────────────────────────────────────────────────────
function SessionCard({
  session,
  onEdit,
  onDelete,
  onToggleActive,
  onViewRoster,
}: {
  session: Session;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  onViewRoster: () => void;
}) {
  const colors = useColors();
  const styles = getStyles(colors);
  return (
    <View style={[styles.sessionCard, { backgroundColor: colors.surface }]}>
      <View style={styles.sessionHeader}>
        <View>
          <Text style={[styles.sessionName, { color: colors.text }]}>{session.name}</Text>
          <Text style={[styles.sessionDates, { color: colors.textSecondary }]}>
            {new Date(session.startDate).toLocaleDateString()} —{" "}
            {new Date(session.endDate).toLocaleDateString()}
          </Text>
        </View>
        <Pressable
          style={[styles.activeToggle, { backgroundColor: session.isActive ? Colors.success + "20" : colors.surfaceSecondary }]}
          onPress={onToggleActive}
        >
          <View style={[styles.activeDot, { backgroundColor: session.isActive ? Colors.success : colors.textMuted }]} />
          <Text style={[styles.activeText, { color: session.isActive ? Colors.success : colors.textSecondary }]}>
            {session.isActive ? "Active" : "Inactive"}
          </Text>
        </Pressable>
      </View>
      <View style={styles.datesChips}>
        {session.authorizedDates.length === 0 ? (
          <Text style={[styles.noDatesText, { color: colors.textMuted }]}>No check-in dates set</Text>
        ) : (
          session.authorizedDates.slice(0, 4).map((d) => (
            <View key={d} style={[styles.dateChip, { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={[styles.dateChipText, { color: colors.textSecondary }]}>
                {new Date(d + "T12:00:00").toLocaleDateString([], { month: "short", day: "numeric" })}
              </Text>
            </View>
          ))
        )}
        {session.authorizedDates.length > 4 && (
          <View style={[styles.dateChip, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={[styles.dateChipText, { color: colors.textSecondary }]}>+{session.authorizedDates.length - 4} more</Text>
          </View>
        )}
      </View>
      <View style={[styles.sessionCardActions, { borderTopColor: colors.border }]}>
        <Pressable onPress={onViewRoster} style={({ pressed }) => [styles.rosterBtn, { opacity: pressed ? 0.7 : 1 }]}>
          <Ionicons name="list-outline" size={15} color={Colors.primary} />
          <Text style={styles.rosterBtnText}>Roster</Text>
        </Pressable>
        <Pressable onPress={onEdit} style={({ pressed }) => [styles.rosterBtn, { opacity: pressed ? 0.7 : 1 }]}>
          <Ionicons name="pencil-outline" size={15} color={Colors.primary} />
          <Text style={styles.rosterBtnText}>Edit</Text>
        </Pressable>
        <Pressable onPress={onDelete} style={({ pressed }) => [styles.deleteSessionBtn, { opacity: pressed ? 0.7 : 1 }]}>
          <Ionicons name="trash-outline" size={16} color={Colors.danger} />
          <Text style={styles.deleteSessionText}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Auth Code Card ────────────────────────────────────────────────────────────
function AuthCodeCard({ code, onEdit, onDelete }: { code: AuthCode; onEdit: () => void; onDelete: () => void }) {
  const colors = useColors();
  const styles = getStyles(colors);
  const roleColors: Record<UserRole, string> = { management: colors.danger, staff: colors.primary, parent: "#8B5CF6" };
  const isFull = code.maxUses > 0 && code.usedCount >= code.maxUses;
  return (
    <View style={[styles.codeCard, { backgroundColor: colors.surface }]}>
      <View style={styles.codeHeader}>
        <View style={[styles.roleIcon, { backgroundColor: roleColors[code.role] + "20" }]}>
          <Ionicons
            name={code.role === "management" ? "shield-checkmark" : code.role === "staff" ? "people" : "person"}
            size={18}
            color={roleColors[code.role]}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.codeValue, { color: colors.text }]}>{code.code}</Text>
          <Text style={[styles.codeRole, { color: colors.textSecondary }]}>{code.role.charAt(0).toUpperCase() + code.role.slice(1)} · {code.usedCount} / {code.maxUses === 0 ? "∞" : code.maxUses} used</Text>
        </View>
        <View style={[styles.usedBadge, { backgroundColor: isFull ? Colors.danger + "15" : Colors.success + "15" }]}>
          <Text style={[styles.usedBadgeText, { color: isFull ? Colors.danger : Colors.success }]}>{isFull ? "Full" : "Active"}</Text>
        </View>
      </View>
      <View style={[styles.codeActions, { borderTopColor: colors.border }]}>
        <Pressable onPress={onEdit} style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.7 : 1 }]}>
          <Ionicons name="pencil-outline" size={16} color={Colors.primary} />
          <Text style={[styles.actionBtnText, { color: Colors.primary }]}>Edit</Text>
        </Pressable>
        <Pressable onPress={onDelete} style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.7 : 1 }]}>
          <Ionicons name="trash-outline" size={16} color={Colors.danger} />
          <Text style={[styles.actionBtnText, { color: Colors.danger }]}>Revoke</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function MoreScreen() {
  const { user, logout, adminResetPassword } = useAuth();
  const { sessions, authCodes, campers, checkIns, users, addSession, updateSession, deleteSession, createAuthCode, updateAuthCode, deleteAuthCode, updateUser, deleteUser, isLoading, refresh } = useData();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = getStyles(colors);
  const bottomTabBarHeight = useBottomTabBarHeight();

  const [activeTab, setActiveTab] = useState<Tab>("sessions");

  // Sessions
  const [showNewSession, setShowNewSession] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [sessionStart, setSessionStart] = useState("");
  const [sessionEnd, setSessionEnd] = useState("");
  const [authorizedDates, setAuthorizedDates] = useState<string[]>([]);
  const [rosterSession, setRosterSession] = useState<Session | null>(null);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [editSessionName, setEditSessionName] = useState("");
  const [editSessionStart, setEditSessionStart] = useState("");
  const [editSessionEnd, setEditSessionEnd] = useState("");
  const [editSessionDates, setEditSessionDates] = useState<string[]>([]);

  // Auth Codes
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [editingCode, setEditingCode] = useState<AuthCode | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>("staff");
  const [selectedCamperId, setSelectedCamperId] = useState<string | undefined>();
  const [maxUses, setMaxUses] = useState("1");

  // Users
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

  // AI
  const [messages, setMessages] = useState<Message[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const listRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const abortRef = useRef<boolean>(false);
  const generateId = () => Date.now().toString() + Math.random().toString(36).substr(2, 6);

  const sendQuestion = useCallback(async (question: string) => {
    if (!question.trim() || aiLoading) return;
    const trimmed = question.trim();
    setAiInput("");
    setAiLoading(true);
    abortRef.current = false;

    const userMsg: Message = { id: generateId(), role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setShowTyping(true);

    const assistantId = generateId();
    let assistantAdded = false;
    let fullContent = "";

    try {
      const url = new URL("/api/ai/query", getApiUrl()).toString();
      const token = getToken();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "text/event-stream", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: trimmed }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Request failed" }));
        throw new Error(err.message || "Request failed");
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        if (abortRef.current) break;
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.content) {
              fullContent += event.content;
              if (!assistantAdded) {
                setShowTyping(false);
                setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: fullContent, isStreaming: true }]);
                assistantAdded = true;
              } else {
                setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: fullContent } : m));
              }
            }
            if (event.done || event.error) {
              setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, isStreaming: false } : m));
            }
          } catch {}
        }
      }
      setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, isStreaming: false } : m));
    } catch (err: any) {
      setShowTyping(false);
      if (!assistantAdded) {
        setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: `Something went wrong. Please try again.`, isStreaming: false }]);
      } else {
        setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: fullContent || "Something went wrong. Please try again.", isStreaming: false } : m));
      }
    } finally {
      setShowTyping(false);
      setAiLoading(false);
    }
  }, [aiLoading]);

  const clearChat = () => { abortRef.current = true; setMessages([]); setAiLoading(false); setShowTyping(false); };

  // Sessions
  const handleAddSession = async () => {
    if (!sessionName.trim() || !sessionStart.trim() || !sessionEnd.trim()) {
      Alert.alert("Missing Info", "Please fill in session name, start date, and end date.");
      return;
    }
    try {
      await addSession({ name: sessionName.trim(), startDate: sessionStart.trim(), endDate: sessionEnd.trim(), authorizedDates, isActive: true, createdBy: user?.id || "" });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSessionName(""); setSessionStart(""); setSessionEnd(""); setAuthorizedDates([]); setShowNewSession(false);
    } catch (err: any) { Alert.alert("Error", err.message); }
  };

  const openEditSession = (session: Session) => {
    setEditingSession(session);
    setEditSessionName(session.name);
    setEditSessionStart(session.startDate);
    setEditSessionEnd(session.endDate);
    setEditSessionDates(session.authorizedDates);
  };

  const handleEditSession = async () => {
    if (!editingSession) return;
    if (!editSessionName.trim() || !editSessionStart.trim() || !editSessionEnd.trim()) {
      Alert.alert("Missing Info", "Please fill in session name, start date, and end date.");
      return;
    }
    try {
      await updateSession(editingSession.id, { name: editSessionName.trim(), startDate: editSessionStart.trim(), endDate: editSessionEnd.trim(), authorizedDates: editSessionDates });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditingSession(null);
    } catch (err: any) { Alert.alert("Error", err.message); }
  };

  // Auth Codes
  const handleSaveCode = async () => {
    try {
      const uses = parseInt(maxUses) || 0;
      if (editingCode) {
        await updateAuthCode(editingCode.code, { role: selectedRole, linkedCamperId: selectedCamperId, maxUses: uses });
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Success", "Auth code updated.");
      } else {
        const code = await createAuthCode(selectedRole, uses, selectedCamperId);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Auth Code Created", `Share this code:\n\n${code}\n\nThis grants ${selectedRole} access.`, [{ text: "Done" }]);
      }
      setShowCodeModal(false); setEditingCode(null);
    } catch (err: any) { Alert.alert("Error", err.message); }
  };

  const openCodeModal = (code?: AuthCode) => {
    if (code) { setEditingCode(code); setSelectedRole(code.role); setSelectedCamperId(code.linkedCamperId); setMaxUses(code.maxUses.toString()); }
    else { setEditingCode(null); setSelectedRole("staff"); setSelectedCamperId(undefined); setMaxUses("1"); }
    setShowCodeModal(true);
  };

  // Users
  const openUserEdit = (u: typeof users[0]) => {
    setEditingUser(u); setUserEditName(u.name); setUserEditEmail(u.email); setUserEditRole(u.role as UserRole);
    setUserEditLinkedCampers(u.linkedCamperIds || []); setUserPwdNew(""); setUserPwdConfirm(""); setUserResetCode(""); setUserSheetTab("info");
  };
  const closeUserEdit = () => { setEditingUser(null); setUserPwdNew(""); setUserPwdConfirm(""); setUserResetCode(""); };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    if (!userEditName.trim()) { Alert.alert("Required", "Name cannot be empty."); return; }
    setUserActionLoading(true);
    try {
      await updateUser(editingUser.id, { name: userEditName.trim(), email: userEditEmail.trim().toLowerCase(), role: userEditRole, linkedCamperIds: userEditRole === "parent" ? userEditLinkedCampers : [] });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved", "User info updated."); closeUserEdit();
    } catch (err: any) { Alert.alert("Error", err.message || "Failed to update user."); }
    finally { setUserActionLoading(false); }
  };

  const handleUserResetPwd = async () => {
    if (!editingUser) return;
    if (!userPwdNew.trim() || userPwdNew.length < 6) { Alert.alert("Invalid", "Password must be at least 6 characters."); return; }
    if (userPwdNew !== userPwdConfirm) { Alert.alert("Mismatch", "Passwords do not match."); return; }
    setUserActionLoading(true);
    try {
      await adminResetPassword(editingUser.email, userPwdNew);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Done", `Password reset for ${editingUser.name}.`); setUserPwdNew(""); setUserPwdConfirm("");
    } catch (err: any) { Alert.alert("Error", err.message || "Failed to reset password."); }
    finally { setUserActionLoading(false); }
  };

  const handleGenerateResetCode = async () => {
    if (!editingUser) return;
    setUserActionLoading(true);
    try {
      const { apiRequest } = await import("@/lib/query-client");
      const res = await apiRequest("POST", `/api/users/${editingUser.id}/reset-code`);
      const { code, expiresInMinutes } = await res.json();
      setUserResetCode(code);
      Alert.alert("Reset Code Generated", `Share this one-time code with ${editingUser.name}:\n\n${code}\n\nExpires in ${expiresInMinutes} minutes.`, [{ text: "OK" }]);
    } catch (err: any) { Alert.alert("Error", err.message || "Failed to generate reset code."); }
    finally { setUserActionLoading(false); }
  };

  const handleDeleteUser = (u: typeof users[0]) => {
    if (u.id === user?.id) { Alert.alert("Not Allowed", "You cannot delete your own account."); return; }
    Alert.alert("Delete User", `Permanently delete ${u.name}'s account?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try { await deleteUser(u.id); closeUserEdit(); await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
        catch (err: any) { Alert.alert("Error", err.message || "Failed to delete user."); }
      }},
    ]);
  };

  const ROLE_COLORS: Record<UserRole, string> = { management: Colors.danger, staff: Colors.primary, parent: Colors.success };

  const handleLogout = async () => {
    if (Platform.OS === "web") { await logout(); router.replace("/(auth)/login"); return; }
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: async () => { await logout(); router.replace("/(auth)/login"); }},
    ]);
  };

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "sessions", label: "Sessions", icon: "calendar-outline" },
    { key: "codes", label: "Codes", icon: "key-outline" },
    { key: "users", label: "Users", icon: "people-outline" },
    { key: "ai", label: "AI", icon: "sparkles-outline" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Fixed header */}
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20), backgroundColor: colors.surface }]}>
        <View style={styles.headerTop}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Management</Text>
          <Pressable onPress={() => router.push("/(management)/account")} hitSlop={10} style={styles.logoutBtn}>
            <Ionicons name="person-circle-outline" size={24} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
          {TABS.map((t) => (
            <Pressable
              key={t.key}
              style={[styles.tabBtn, activeTab === t.key && [styles.tabBtnActive, { borderBottomColor: Colors.primary }]]}
              onPress={() => setActiveTab(t.key)}
            >
              <Ionicons
                name={t.icon as any}
                size={15}
                color={activeTab === t.key ? Colors.primary : colors.textMuted}
              />
              <Text style={[styles.tabBtnText, { color: activeTab === t.key ? Colors.primary : colors.textMuted }]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* AI Tab — uses its own layout */}
      {activeTab === "ai" && (
        <KeyboardAvoidingView
          style={{ flex: 1, marginBottom: bottomTabBarHeight }}
          behavior="padding"
          keyboardVerticalOffset={0}
        >
          {/* Security banner */}
          <View style={[styles.aiSecurityBadge, { backgroundColor: colors.surfaceSecondary }]}>
            <Ionicons name="lock-closed" size={11} color={Colors.success} />
            <Text style={[styles.aiSecurityText, { color: colors.textSecondary }]}>Data accessed server-side only</Text>
            {(messages.length > 0 || showTyping) && (
              <Pressable onPress={clearChat} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, marginLeft: "auto", padding: 4 }]}>
                <Ionicons name="trash-outline" size={15} color={colors.textSecondary} />
              </Pressable>
            )}
          </View>

          {/* Empty state */}
          {messages.length === 0 && !showTyping ? (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.aiEmpty}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.aiEmptyIcon}>
                <Ionicons name="sparkles" size={30} color={Colors.accent} />
              </View>
              <Text style={[styles.aiEmptyTitle, { color: colors.text }]}>Ask about camp</Text>
              <Text style={[styles.aiEmptySub, { color: colors.textSecondary }]}>Full access to camper records, medical data, and check-in history.</Text>
              <View style={styles.aiSuggestions}>
                {SUGGESTION_QUESTIONS.map((q, i) => (
                  <Pressable
                    key={i}
                    style={({ pressed }) => [styles.aiSuggestion, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                    onPress={() => { sendQuestion(q); inputRef.current?.focus(); }}
                  >
                    <Text style={[styles.aiSuggestionText, { color: colors.text }]}>{q}</Text>
                    <Ionicons name="arrow-forward" size={13} color={Colors.accent} />
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          ) : (
            /* Messages list — inverted so newest appears at bottom */
            <FlatList
              ref={listRef}
              data={[...messages].reverse()}
              keyExtractor={(item) => item.id}
              inverted={messages.length > 0}
              contentContainerStyle={styles.aiMessageList}
              showsVerticalScrollIndicator={false}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={showTyping ? <TypingIndicator /> : null}
              renderItem={({ item }) => <MessageBubble message={item} />}
            />
          )}

          {/* Input bar */}
          <View style={[styles.aiInputContainer, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + 8, paddingHorizontal: 14 }]}>
            <View style={[styles.aiInputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TextInput
                ref={inputRef}
                style={[styles.aiInput, { color: colors.text }]}
                value={aiInput}
                onChangeText={setAiInput}
                placeholder="Ask about campers, allergies, check-ins..."
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={500}
                editable={!aiLoading}
                blurOnSubmit={false}
                returnKeyType="send"
                onSubmitEditing={() => { sendQuestion(aiInput); inputRef.current?.focus(); }}
              />
              <Pressable
                style={({ pressed }) => [
                  styles.aiSendBtn,
                  { backgroundColor: !aiInput.trim() || aiLoading ? colors.textMuted : Colors.primary, opacity: pressed ? 0.85 : 1 },
                ]}
                onPress={() => { sendQuestion(aiInput); inputRef.current?.focus(); }}
                disabled={!aiInput.trim() || aiLoading}
              >
                {aiLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="arrow-up" size={18} color="#fff" />}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Sessions / Codes / Users tabs — shared ScrollView */}
      {activeTab !== "ai" && (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={Colors.primary} />}
        >
          {/* ── SESSIONS ── */}
          {activeTab === "sessions" && (
            <>
              <Pressable style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.85 : 1 }]} onPress={() => setShowNewSession(true)}>
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.addBtnText}>New Session</Text>
              </Pressable>
              {sessions.length === 0 && (
                <View style={styles.empty}>
                  <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>No Sessions Yet</Text>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Create camp sessions to authorize check-in dates for staff</Text>
                </View>
              )}
              {sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onEdit={() => openEditSession(session)}
                  onDelete={() => Alert.alert("Delete Session", `Remove "${session.name}"?`, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => deleteSession(session.id) }])}
                  onToggleActive={() => updateSession(session.id, { isActive: !session.isActive })}
                  onViewRoster={() => setRosterSession(session)}
                />
              )) || []}
            </>
          )}

          {/* ── AUTH CODES ── */}
          {activeTab === "codes" && (
            <>
              <Pressable style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.85 : 1 }]} onPress={() => openCodeModal()}>
                <Ionicons name="key" size={20} color="#fff" />
                <Text style={styles.addBtnText}>Generate Code</Text>
              </Pressable>
              {authCodes.length === 0 && (
                <View style={styles.empty}>
                  <Ionicons name="key-outline" size={48} color={colors.textMuted} />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>No Auth Codes</Text>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Generate codes for staff and parents to register</Text>
                </View>
              )}
              {authCodes.map((code) => (
                <AuthCodeCard
                  key={code.code}
                  code={code}
                  onEdit={() => openCodeModal(code)}
                  onDelete={() => Alert.alert("Revoke Code", `Revoke "${code.code}"?`, [{ text: "Cancel", style: "cancel" }, { text: "Revoke", style: "destructive", onPress: () => deleteAuthCode(code.code) }])}
                />
              )) || []}
            </>
          )}

          {/* ── USERS ── */}
          {activeTab === "users" && (
            <>
              {users.length === 0 && (
                <View style={styles.empty}>
                  <Ionicons name="people-outline" size={48} color={colors.textMuted} />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>No Users Yet</Text>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Registered users will appear here</Text>
                </View>
              )}
              {users.map((u) => {
                const initials = u.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
                const roleColor = ROLE_COLORS[u.role as UserRole] || colors.textSecondary;
                const linkedCamperNames = (u.linkedCamperIds || []).map((cid) => campers.find((c) => c.id === cid)).filter(Boolean).map((c) => `${c!.firstName} ${c!.lastName}`).join(", ");
                return (
                  <Pressable key={u.id} style={({ pressed }) => [styles.userCard, { backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 }]} onPress={() => openUserEdit(u)}>
                    <View style={[styles.userAvatar, { backgroundColor: roleColor + "20" }]}>
                      <Text style={[styles.userAvatarText, { color: roleColor }]}>{initials}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={[styles.userName, { color: colors.text }]}>{u.name}</Text>
                        {u.id === user?.id && (
                          <View style={[styles.rolePill, { backgroundColor: colors.surfaceSecondary }]}>
                            <Text style={[styles.rolePillText, { color: colors.textMuted }]}>You</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{u.email}</Text>
                      {linkedCamperNames ? <Text style={[styles.userMeta, { color: colors.textMuted }]} numberOfLines={1}>Linked: {linkedCamperNames}</Text> : null}
                    </View>
                    <View style={[styles.rolePill, { backgroundColor: roleColor + "15" }]}>
                      <Text style={[styles.rolePillText, { color: roleColor }]}>{u.role}</Text>
                    </View>
                  </Pressable>
                );
              }) || []}
            </>
          )}
        </ScrollView>
      )}

      {/* ── MODALS ── */}

      {/* New Session */}
      <Modal visible={showNewSession} animationType="slide" transparent onRequestClose={() => setShowNewSession(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowNewSession(false)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: colors.background }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>New Camp Session</Text>
            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>Set the dates when staff are authorized to check in campers</Text>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Session Name</Text>
            <TextInput style={[styles.fieldInput, { color: colors.text, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} value={sessionName} onChangeText={setSessionName} placeholder="e.g. Week 1 - Summer 2025" placeholderTextColor={colors.textMuted} />
            <DatePicker mode="single" value={sessionStart} onChange={setSessionStart} label="Start Date" placeholder="Select start date" maxDate={sessionEnd || undefined} />
            <DatePicker mode="single" value={sessionEnd} onChange={setSessionEnd} label="End Date" placeholder="Select end date" minDate={sessionStart || undefined} />
            <DatePicker mode="multi" value={authorizedDates} onChange={setAuthorizedDates} label="Authorized Check-in Dates" placeholder="Select check-in dates" minDate={sessionStart || undefined} maxDate={sessionEnd || undefined} />
            <View style={styles.modalButtons}>
              <Pressable style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.8 : 1 }]} onPress={() => setShowNewSession(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.confirmBtn, { opacity: pressed ? 0.85 : 1 }]} onPress={handleAddSession}>
                <Text style={styles.confirmBtnText}>Create Session</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Edit Session Modal */}
      <Modal visible={!!editingSession} animationType="slide" transparent onRequestClose={() => setEditingSession(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setEditingSession(null)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: colors.background }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Session</Text>
            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>Update the session name, dates, and authorized check-in days</Text>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Session Name</Text>
            <TextInput style={[styles.fieldInput, { color: colors.text, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} value={editSessionName} onChangeText={setEditSessionName} placeholder="e.g. Week 1 - Summer 2025" placeholderTextColor={colors.textMuted} />
            <DatePicker mode="single" value={editSessionStart} onChange={setEditSessionStart} label="Start Date" placeholder="Select start date" maxDate={editSessionEnd || undefined} />
            <DatePicker mode="single" value={editSessionEnd} onChange={setEditSessionEnd} label="End Date" placeholder="Select end date" minDate={editSessionStart || undefined} />
            <DatePicker mode="multi" value={editSessionDates} onChange={setEditSessionDates} label="Authorized Check-in Dates" placeholder="Select check-in dates" minDate={editSessionStart || undefined} maxDate={editSessionEnd || undefined} />
            <View style={styles.modalButtons}>
              <Pressable style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.8 : 1 }]} onPress={() => setEditingSession(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.confirmBtn, { opacity: pressed ? 0.85 : 1 }]} onPress={handleEditSession}>
                <Text style={styles.confirmBtnText}>Save Changes</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Auth Code Modal */}
      <Modal visible={showCodeModal} animationType="slide" transparent onRequestClose={() => { setShowCodeModal(false); setEditingCode(null); }}>
        <Pressable style={styles.modalOverlay} onPress={() => { setShowCodeModal(false); setEditingCode(null); }}>
          <Pressable style={[styles.modalSheet, { backgroundColor: colors.background }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>{editingCode ? "Edit Auth Code" : "Generate Auth Code"}</Text>
            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>{editingCode ? `Editing code: ${editingCode.code}` : "Select the role and usage limits"}</Text>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Role</Text>
            {(["staff", "management", "parent"] as UserRole[]).map((role) => (
              <Pressable key={role} style={[styles.roleOption, { backgroundColor: colors.surface }, selectedRole === role && styles.roleOptionSelected]} onPress={() => setSelectedRole(role)}>
                <Ionicons name={role === "management" ? "shield-checkmark" : role === "staff" ? "people" : "person"} size={20} color={selectedRole === role ? Colors.primary : colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.roleName, { color: colors.text }, selectedRole === role && { color: Colors.primary }]}>{role.charAt(0).toUpperCase() + role.slice(1)}</Text>
                  <Text style={styles.roleDesc}>{role === "management" ? "Full access to all features" : role === "staff" ? "Check-in/out on authorized dates" : "View & update their child's info"}</Text>
                </View>
                {selectedRole === role && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
              </Pressable>
            ))}
            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Maximum Uses</Text>
            <Text style={styles.fieldHint}>Enter 0 for infinite uses</Text>
            <TextInput style={[styles.fieldInput, { color: colors.text, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} value={maxUses} onChangeText={setMaxUses} keyboardType="number-pad" placeholder="1" placeholderTextColor={colors.textMuted} />
            {selectedRole === "parent" && (
              <>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Link to Camper (optional)</Text>
                <ScrollView style={{ maxHeight: 120 }} nestedScrollEnabled>
                  {campers.map((c) => (
                    <Pressable key={c.id} style={[styles.camperSelectRow, selectedCamperId === c.id && styles.camperSelectRowActive]} onPress={() => setSelectedCamperId(selectedCamperId === c.id ? undefined : c.id)}>
                      <Text style={styles.camperSelectName}>{c.firstName} {c.lastName}</Text>
                      {selectedCamperId === c.id && <Ionicons name="checkmark" size={16} color={Colors.primary} />}
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}
            <View style={styles.modalButtons}>
              <Pressable style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.8 : 1 }]} onPress={() => { setShowCodeModal(false); setEditingCode(null); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.confirmBtn, { opacity: pressed ? 0.85 : 1 }]} onPress={handleSaveCode}>
                <Text style={styles.confirmBtnText}>{editingCode ? "Save Changes" : "Generate"}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* User Edit Modal */}
      <Modal visible={!!editingUser} animationType="slide" transparent onRequestClose={closeUserEdit}>
        <Pressable style={styles.modalOverlay} onPress={closeUserEdit}>
          <Pressable style={[styles.modalSheet, { maxHeight: "90%", backgroundColor: colors.background }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{editingUser?.name}</Text>
              {editingUser && editingUser.id !== user?.id && (
                <Pressable onPress={() => handleDeleteUser(editingUser)} style={{ padding: 6 }}>
                  <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                </Pressable>
              )}
            </View>
            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>{editingUser?.email}</Text>
            <View style={[styles.tabs2, { marginVertical: 12 }]}>
              {(["info", "security"] as const).map((t) => (
                <Pressable key={t} style={[styles.tab2, userSheetTab === t && styles.tab2Active]} onPress={() => setUserSheetTab(t)}>
                  <Text style={[styles.tab2Text, userSheetTab === t && styles.tab2ActiveText]}>{t === "info" ? "Profile & Role" : "Security"}</Text>
                </Pressable>
              ))}
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {userSheetTab === "info" && (
                <View style={{ gap: 12 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Full Name</Text>
                  <TextInput style={[styles.fieldInput, { color: colors.text, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} value={userEditName} onChangeText={setUserEditName} placeholder="Full name" placeholderTextColor={colors.textMuted} autoCapitalize="words" />
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Email</Text>
                  <TextInput style={[styles.fieldInput, { color: colors.text, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} value={userEditEmail} onChangeText={setUserEditEmail} placeholder="user@email.com" placeholderTextColor={colors.textMuted} autoCapitalize="none" keyboardType="email-address" autoCorrect={false} />
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Role</Text>
                  {(["management", "staff", "parent"] as UserRole[]).map((r) => (
                    <Pressable key={r} style={[styles.roleOption, { backgroundColor: colors.surface }, userEditRole === r && styles.roleOptionSelected]} onPress={() => setUserEditRole(r)}>
                      <Ionicons name={r === "management" ? "shield-outline" : r === "staff" ? "people-outline" : "person-outline"} size={20} color={userEditRole === r ? Colors.primary : colors.textMuted} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.roleName}>{r.charAt(0).toUpperCase() + r.slice(1)}</Text>
                        <Text style={styles.roleDesc}>{r === "management" ? "Full access to all features" : r === "staff" ? "Check-in/out and camper list" : "View linked child's info"}</Text>
                      </View>
                      {userEditRole === r && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
                    </Pressable>
                  ))}
                  {userEditRole === "parent" && (
                    <>
                      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Linked Campers</Text>
                      <View style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
                        {campers.length === 0 && <Text style={{ padding: 12, fontFamily: "Outfit_400Regular", color: colors.textMuted, fontSize: 13 }}>No campers available</Text>}
                        {campers.map((c) => {
                          const isLinked = userEditLinkedCampers.includes(c.id);
                          return (
                            <Pressable key={c.id} style={[styles.camperSelectRow, isLinked && styles.camperSelectRowActive]} onPress={() => setUserEditLinkedCampers((prev) => isLinked ? prev.filter((id) => id !== c.id) : [...prev, c.id])}>
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
                    <Pressable style={[styles.confirmBtn, { opacity: userActionLoading ? 0.7 : 1 }]} onPress={handleSaveUser} disabled={userActionLoading}>
                      {userActionLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Save Changes</Text>}
                    </Pressable>
                  </View>
                </View>
              )}
              {userSheetTab === "security" && (
                <View style={{ gap: 12 }}>
                  <View style={styles.securitySection}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <Ionicons name="lock-closed-outline" size={16} color={colors.text} />
                      <Text style={[styles.fieldLabel, { fontSize: 14 }]}>Set New Password</Text>
                    </View>
                    <TextInput style={[styles.fieldInput, { color: colors.text, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} value={userPwdNew} onChangeText={setUserPwdNew} placeholder="New password (min 6 chars)" placeholderTextColor={colors.textMuted} secureTextEntry autoCapitalize="none" />
                    <TextInput style={[styles.fieldInput, { marginTop: 8, color: colors.text, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} value={userPwdConfirm} onChangeText={setUserPwdConfirm} placeholder="Confirm new password" placeholderTextColor={colors.textMuted} secureTextEntry autoCapitalize="none" />
                    <Pressable style={[styles.confirmBtn, { marginTop: 8, opacity: userActionLoading ? 0.7 : 1 }]} onPress={handleUserResetPwd} disabled={userActionLoading}>
                      {userActionLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Reset Password</Text>}
                    </Pressable>
                  </View>
                  <View style={styles.securitySection}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <Ionicons name="key-outline" size={16} color={colors.text} />
                      <Text style={[styles.fieldLabel, { fontSize: 14 }]}>One-Time Reset Code</Text>
                    </View>
                    <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: colors.textSecondary, marginBottom: 8, lineHeight: 18 }}>
                      Generate a one-time code the user can enter at login to reset their own password. Expires in 60 minutes.
                    </Text>
                    {userResetCode ? (
                      <View style={styles.resetCodeBox}>
                        <Text style={styles.resetCodeText}>{userResetCode}</Text>
                        <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>Share this code. It expires in 60 min.</Text>
                      </View>
                    ) : null}
                    <Pressable style={[styles.securityBtn, { opacity: userActionLoading ? 0.7 : 1 }]} onPress={handleGenerateResetCode} disabled={userActionLoading}>
                      {userActionLoading ? <ActivityIndicator size="small" color={Colors.primary} /> : (
                        <>
                          <Ionicons name="refresh-outline" size={16} color={Colors.primary} />
                          <Text style={[styles.confirmBtnText, { color: Colors.primary }]}>Generate Code</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                  {editingUser && editingUser.id !== user?.id && (
                    <Pressable style={[styles.securityBtn, { borderColor: Colors.danger + "40", backgroundColor: Colors.danger + "08" }]} onPress={() => handleDeleteUser(editingUser)}>
                      <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                      <Text style={[styles.confirmBtnText, { color: Colors.danger }]}>Delete This Account</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Roster Modal */}
      <Modal visible={!!rosterSession} animationType="slide" transparent onRequestClose={() => setRosterSession(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setRosterSession(null)}>
          <Pressable style={[styles.modalSheet, { maxHeight: "85%", backgroundColor: colors.background }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>{rosterSession?.name ?? ""}</Text>
            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>{rosterSession ? `${new Date(rosterSession.startDate).toLocaleDateString()} — ${new Date(rosterSession.endDate).toLocaleDateString()}` : ""}</Text>
            {rosterSession && (() => {
              const roster = checkIns.filter((ci) => ci.sessionId === rosterSession.id).sort((a, b) => new Date(a.checkedInAt).getTime() - new Date(b.checkedInAt).getTime());
              return (
                <>
                  <View style={styles.rosterCount}>
                    <Ionicons name="people" size={16} color={Colors.primary} />
                    <Text style={styles.rosterCountText}>{roster.length} {roster.length === 1 ? "camper" : "campers"} attended</Text>
                  </View>
                  <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 16 }}>
                    {roster.length === 0 ? (
                      <View style={{ alignItems: "center", paddingVertical: 24, gap: 8 }}>
                        <Ionicons name="calendar-outline" size={36} color={colors.textMuted} />
                        <Text style={styles.fieldHint}>No check-ins recorded for this session</Text>
                      </View>
                    ) : (
                      roster.map((ci, idx) => {
                        const camper = campers.find((c) => c.id === ci.camperId);
                        return (
                          <View key={ci.id}>
                            <View style={styles.rosterRow}>
                              <View style={styles.rosterAvatar}>
                                <Text style={styles.rosterAvatarText}>{camper?.firstName?.charAt(0)?.toUpperCase() ?? "?"}</Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.rosterName, { color: colors.text }]}>{camper ? `${camper.firstName} ${camper.lastName}` : "Unknown Camper"}</Text>
                                {camper?.cabinGroup ? <Text style={[styles.rosterCabin, { color: colors.textSecondary }]}>{camper.cabinGroup}</Text> : null}
                                <Text style={[styles.rosterTime, { color: colors.textMuted }]}>In: {new Date(ci.checkedInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{ci.checkedOutAt ? ` · Out: ${new Date(ci.checkedOutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}</Text>
                              </View>
                              <View style={[styles.historyBadge, { backgroundColor: ci.checkedOutAt ? colors.surfaceSecondary : Colors.success + "20" }]}>
                                <Text style={[styles.historyBadgeText, { color: ci.checkedOutAt ? colors.textSecondary : Colors.success }]}>{ci.checkedOutAt ? "Done" : "Present"}</Text>
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
            <Pressable style={({ pressed }) => [styles.confirmBtn, { opacity: pressed ? 0.85 : 1 }]} onPress={() => setRosterSession(null)}>
              <Text style={styles.confirmBtnText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 12, backgroundColor: colors.surface, gap: 12 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { fontSize: 28, fontFamily: "Outfit_700Bold", color: colors.text },
  logoutBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  tabRow: { flexDirection: "row", backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 4 },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 9, borderRadius: 10 },
  tabBtnActive: { backgroundColor: colors.surface, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  tabBtnText: { fontSize: 12, fontFamily: "Outfit_500Medium", color: colors.textMuted },
  tabBtnActiveText: { color: Colors.primary, fontFamily: "Outfit_600SemiBold" },
  content: { paddingHorizontal: 20, paddingTop: 12, gap: 12 },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.primary, borderRadius: 14, height: 50, marginBottom: 8 },
  addBtnText: { color: "#fff", fontSize: 15, fontFamily: "Outfit_600SemiBold" },
  // Sessions
  sessionCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  sessionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  sessionName: { fontSize: 16, fontFamily: "Outfit_600SemiBold", color: colors.text },
  sessionDates: { fontSize: 13, fontFamily: "Outfit_400Regular", color: colors.textSecondary, marginTop: 2 },
  activeToggle: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  activeDot: { width: 7, height: 7, borderRadius: 3.5 },
  activeText: { fontSize: 12, fontFamily: "Outfit_600SemiBold" },
  datesChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  dateChip: { backgroundColor: Colors.primary + "15", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  dateChipText: { fontSize: 12, fontFamily: "Outfit_600SemiBold", color: Colors.primary },
  noDatesText: { fontSize: 13, fontFamily: "Outfit_400Regular", color: colors.textMuted },
  deleteSessionBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: 4 },
  deleteSessionText: { fontSize: 13, fontFamily: "Outfit_500Medium", color: Colors.danger },
  sessionCardActions: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  rosterBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: Colors.primary + "40", backgroundColor: Colors.primary + "08" },
  rosterBtnText: { fontSize: 13, fontFamily: "Outfit_600SemiBold", color: Colors.primary },
  // Auth Codes
  codeCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  codeHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  roleIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  codeValue: { fontSize: 16, fontFamily: "Outfit_700Bold", color: colors.text, letterSpacing: 0.5 },
  codeRole: { fontSize: 12, fontFamily: "Outfit_400Regular", color: colors.textSecondary, marginTop: 2 },
  usedBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  usedBadgeText: { fontSize: 11, fontFamily: "Outfit_700Bold" },
  codeActions: { flexDirection: "row", gap: 16, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionBtnText: { fontSize: 13, fontFamily: "Outfit_600SemiBold" },
  // Users
  userCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderRadius: 16, padding: 14, marginBottom: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  userAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  userAvatarText: { fontSize: 16, fontFamily: "Outfit_700Bold" },
  userName: { fontSize: 15, fontFamily: "Outfit_600SemiBold", color: colors.text },
  userEmail: { fontSize: 13, fontFamily: "Outfit_400Regular", color: colors.textSecondary, marginTop: 1 },
  userMeta: { fontSize: 12, fontFamily: "Outfit_400Regular", color: colors.textMuted, marginTop: 1 },
  rolePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  rolePillText: { fontSize: 12, fontFamily: "Outfit_600SemiBold", textTransform: "capitalize" },
  // Empty
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: "Outfit_600SemiBold", color: colors.text },
  emptyText: { fontSize: 14, fontFamily: "Outfit_400Regular", color: colors.textSecondary, textAlign: "center", paddingHorizontal: 40 },
  // Modals
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingTop: 12, maxHeight: "90%" },
  modalHandle: { width: 40, height: 5, backgroundColor: colors.border, borderRadius: 2.5, alignSelf: "center", marginBottom: 16 },
  modalTitle: { fontSize: 20, fontFamily: "Outfit_700Bold", color: colors.text },
  modalSub: { fontSize: 14, fontFamily: "Outfit_400Regular", color: colors.textSecondary, marginBottom: 20, lineHeight: 20 },
  fieldLabel: { fontSize: 14, fontFamily: "Outfit_600SemiBold", color: colors.text, marginBottom: 8 },
  fieldHint: { fontSize: 12, fontFamily: "Outfit_400Regular", color: colors.textMuted, marginBottom: 8, marginTop: -4 },
  fieldInput: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, height: 48, fontFamily: "Outfit_400Regular", fontSize: 15, color: colors.text, marginBottom: 16 },
  roleOption: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
  roleOptionSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + "05" },
  roleName: { fontSize: 15, fontFamily: "Outfit_600SemiBold", color: colors.text },
  roleDesc: { fontSize: 12, fontFamily: "Outfit_400Regular", color: colors.textSecondary, marginTop: 2 },
  camperSelectRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  camperSelectRowActive: { backgroundColor: Colors.primary + "05" },
  camperSelectName: { fontSize: 14, fontFamily: "Outfit_500Medium", color: colors.text },
  modalButtons: { flexDirection: "row", gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, height: 50, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.surfaceSecondary },
  cancelBtnText: { fontSize: 15, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary },
  confirmBtn: { flex: 2, height: 50, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: Colors.primary },
  confirmBtnText: { fontSize: 15, fontFamily: "Outfit_600SemiBold", color: "#fff" },
  tabs2: { flexDirection: "row", backgroundColor: colors.surfaceSecondary, borderRadius: 10, padding: 3 },
  tab2: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 8 },
  tab2Active: { backgroundColor: colors.surface, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 },
  tab2Text: { fontSize: 13, fontFamily: "Outfit_500Medium", color: colors.textMuted },
  tab2ActiveText: { color: Colors.primary, fontFamily: "Outfit_600SemiBold" },
  securitySection: { backgroundColor: colors.surfaceSecondary, borderRadius: 14, padding: 14 },
  securityBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 48, borderRadius: 12, borderWidth: 1, borderColor: Colors.primary + "40", backgroundColor: Colors.primary + "08" },
  resetCodeBox: { backgroundColor: colors.surface, borderRadius: 10, padding: 12, alignItems: "center", borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  resetCodeText: { fontSize: 24, fontFamily: "Outfit_700Bold", color: colors.text, letterSpacing: 4 },
  rosterCount: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.primary + "10", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 16 },
  rosterCountText: { fontSize: 14, fontFamily: "Outfit_600SemiBold", color: Colors.primary },
  rosterRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  rosterAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary + "20", alignItems: "center", justifyContent: "center" },
  rosterAvatarText: { fontSize: 15, fontFamily: "Outfit_700Bold", color: Colors.primary },
  rosterName: { fontSize: 14, fontFamily: "Outfit_600SemiBold", color: colors.text },
  rosterCabin: { fontSize: 12, fontFamily: "Outfit_400Regular", color: colors.textSecondary },
  rosterTime: { fontSize: 12, fontFamily: "Outfit_400Regular", color: colors.textMuted, marginTop: 2 },
  historyBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  historyBadgeText: { fontSize: 12, fontFamily: "Outfit_600SemiBold" },
  divider: { height: 1, backgroundColor: colors.border },
  // AI
  aiSecurityBadge: { flexDirection: "row", alignItems: "center", gap: 6, marginHorizontal: 16, marginBottom: 6, backgroundColor: Colors.success + "10", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: Colors.success + "20" },
  aiSecurityText: { flex: 1, fontSize: 11, fontFamily: "Outfit_400Regular", lineHeight: 14 },
  aiEmpty: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24, paddingVertical: 32, gap: 10 },
  aiEmptyIcon: { width: 60, height: 60, borderRadius: 16, backgroundColor: Colors.accent + "18", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  aiEmptyTitle: { fontSize: 20, fontFamily: "Outfit_700Bold", textAlign: "center" },
  aiEmptySub: { fontSize: 13, fontFamily: "Outfit_400Regular", textAlign: "center", lineHeight: 18, marginBottom: 8 },
  aiSuggestions: { width: "100%", gap: 8, marginTop: 4 },
  aiSuggestion: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, gap: 8 },
  aiSuggestionText: { flex: 1, fontSize: 13, fontFamily: "Outfit_400Regular" },
  aiMessageList: { paddingHorizontal: 14, paddingTop: 12, gap: 10, flexGrow: 1 },
  bubble: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  userBubble: { justifyContent: "flex-end" },
  aiBubble: { justifyContent: "flex-start" },
  aiAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.accent + "18", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  bubbleContent: { maxWidth: "78%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  userBubbleContent: { backgroundColor: Colors.primary, borderBottomRightRadius: 3 },
  aiBubbleContent: { backgroundColor: colors.surfaceSecondary, borderBottomLeftRadius: 3, borderWidth: 1, borderColor: colors.border },
  bubbleText: { fontSize: 15, fontFamily: "Outfit_400Regular", lineHeight: 21 },
  aiInputContainer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  aiInputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1 },
  aiInput: { flex: 1, fontFamily: "Outfit_400Regular", fontSize: 15, maxHeight: 100, paddingTop: 3, paddingBottom: 3 },
  aiSendBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  aiSendBtnDisabled: {},
});
