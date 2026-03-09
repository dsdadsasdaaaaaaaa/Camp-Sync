import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { fetch } from "expo/fetch";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import Colors from "@/constants/colors";
import { useColors } from "@/hooks/useColors";
import { useSiren } from "@/lib/useSiren";
import { getApiUrl } from "@/lib/query-client";
import { getToken } from "@/lib/auth-token";
import type { Broadcast } from "@/types";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Who has peanut allergies?",
  "Medications for Alice?",
  "Emergency contact for Bob?",
  "Any campers with diabetes?",
  "Who has an EpiPen?",
];

function MessageBubble({ message }: { message: Message }) {
  const colors = useColors();
  const styles = getStyles(colors);
  const isUser = message.role === "user";
  return (
    <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
      <View style={[styles.bubbleContent, isUser ? styles.userBubbleContent : styles.aiBubbleContent]}>
        <Text style={[styles.bubbleText, isUser ? styles.userText : styles.aiText]}>
          {message.content}
        </Text>
      </View>
    </View>
  );
}

function MedicalAIScreen({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = getStyles(colors);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showTyping, setShowTyping] = useState(false);

  const generateId = () => `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const trimmed = text.trim();
    setInput("");
    
    const userMsg: Message = { id: generateId(), role: "user", content: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    setShowTyping(true);

    try {
      const url = new URL("/api/ai/staff-query", getApiUrl()).toString();
      const token = getToken();

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ question: trimmed }),
      });

      if (!res.ok) throw new Error("Failed to get response");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullContent = "";
      let buffer = "";
      let assistantAdded = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              fullContent += parsed.content;
              if (!assistantAdded) {
                setShowTyping(false);
                setMessages(prev => [...prev, { id: generateId(), role: "assistant", content: fullContent }]);
                assistantAdded = true;
              } else {
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { ...updated[updated.length - 1], content: fullContent };
                  return updated;
                });
              }
            }
          } catch {}
        }
      }
    } catch (err: any) {
      setShowTyping(false);
      setMessages(prev => [...prev, { id: generateId(), role: "assistant", content: `Error: ${err.message || "Request failed"}` }]);
    } finally {
      setIsLoading(false);
      setShowTyping(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[styles.modalHeader, { paddingTop: Platform.OS === "web" ? 67 : Platform.OS === "ios" ? 20 : insets.top + 20 }]}>
          <View>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Medical Lookup</Text>
            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>Camper medical & emergency info</Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.securityBadge}>
          <Ionicons name="lock-closed" size={12} color={Colors.success} />
          <Text style={styles.securityText}>Limited to medical and safety lookups only</Text>
        </View>

        <KeyboardAvoidingView 
          style={{ flex: 1 }} 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
          {messages.length === 0 ? (
            <ScrollView contentContainerStyle={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Ionicons name="medical" size={40} color={Colors.danger} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>How can I help?</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Ask about allergies, medications, or emergency contacts for any camper.</Text>
              
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestions}>
                {SUGGESTIONS.map((s, i) => (
                  <Pressable key={i} style={[styles.suggestion, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => handleSend(s)}>
                    <Text style={[styles.suggestionText, { color: colors.text }]}>{s}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </ScrollView>
          ) : (
            <FlatList
              data={[...messages].reverse()}
              keyExtractor={item => item.id}
              inverted
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => <MessageBubble message={item} />}
              ListHeaderComponent={showTyping ? (
                <View style={styles.typing}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                </View>
              ) : null}
            />
          )}

          <View style={[styles.inputArea, { paddingBottom: insets.bottom + 16 }]}>
            <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Type your question..."
                placeholderTextColor={colors.textMuted}
                value={input}
                onChangeText={setInput}
                multiline
                onSubmitEditing={() => handleSend(input)}
              />
              <Pressable 
                style={[styles.sendBtn, (!input.trim() || isLoading) && styles.sendDisabled]} 
                onPress={() => handleSend(input)}
                disabled={!input.trim() || isLoading}
              >
                {isLoading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="arrow-up" size={20} color="#fff" />}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function EmergencyBanner({ broadcast }: { broadcast: Broadcast }) {
  const colors = useColors();
  return (
    <View style={emergencyStyles.banner}>
      <View style={emergencyStyles.bannerLeft}>
        <View style={emergencyStyles.sirenIcon}>
          <Ionicons name="warning" size={22} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={emergencyStyles.bannerTitle}>{broadcast.title}</Text>
          <Text style={emergencyStyles.bannerMessage} numberOfLines={2}>
            {broadcast.message}
          </Text>
        </View>
      </View>
    </View>
  );
}

const emergencyStyles = StyleSheet.create({
  banner: {
    backgroundColor: Colors.danger,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 4,
  },
  bannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sirenIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerTitle: {
    fontSize: 15,
    fontFamily: "Outfit_700Bold",
    color: "#fff",
  },
  bannerMessage: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: "rgba(255,255,255,0.9)",
    marginTop: 2,
  },
});

function BroadcastCard({ broadcast }: { broadcast: Broadcast }) {
  const colors = useColors();
  const styles = getStyles(colors);
  const isEmergency = broadcast.isEmergency;
  const timeStr = new Date(broadcast.sentAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = new Date(broadcast.sentAt).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
  const today = new Date().toDateString() === new Date(broadcast.sentAt).toDateString();

  return (
    <View
      style={[
        styles.broadcastCard,
        {
          backgroundColor: isEmergency ? Colors.danger + "10" : colors.surface,
          borderWidth: isEmergency ? 1.5 : 1,
          borderColor: isEmergency ? Colors.danger + "50" : colors.border,
        },
      ]}
    >
      <View style={[styles.broadcastIcon, { backgroundColor: isEmergency ? Colors.danger + "20" : Colors.primary + "15" }]}>
        <Ionicons
          name={isEmergency ? "warning" : "megaphone-outline"}
          size={20}
          color={isEmergency ? Colors.danger : Colors.primary}
        />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.broadcastTopRow}>
          <Text style={[styles.broadcastTitle, { color: isEmergency ? Colors.danger : colors.text }]}>
            {broadcast.title}
          </Text>
          <Text style={[styles.broadcastTime, { color: colors.textMuted }]}>
            {today ? timeStr : dateStr}
          </Text>
        </View>
        <Text style={[styles.broadcastMessage, { color: colors.textSecondary }]} numberOfLines={3}>
          {broadcast.message}
        </Text>
        <Text style={[styles.broadcastFrom, { color: colors.textMuted }]}>
          From {broadcast.sentByName}
        </Text>
      </View>
    </View>
  );
}

function StatCard({ icon, value, label, color }: { icon: string; value: string | number; label: string; color: string }) {
  const colors = useColors();
  const styles = getStyles(colors);
  return (
    <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
      <View style={[styles.statIcon, { backgroundColor: color + "15" }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

export default function StaffHomeScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const styles = getStyles(colors);
  const insets = useSafeAreaInsets();
  const { campers, checkIns, sessions, broadcasts, isLoading, refresh } = useData();

  const activeEmergency = broadcasts.find((b) => b.emergencyActive);
  useSiren(!!activeEmergency);

  const staffBroadcasts = broadcasts
    .filter((b) => b.audience === "staff" || b.audience === "all")
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const checkedInToday = checkIns.filter(
    (ci) => new Date(ci.checkedInAt) >= todayStart
  ).length;

  const currentlyIn = checkIns.filter((ci) => !ci.checkedOutAt).length;

  const activeSessions = sessions.filter((s) => {
    const now = new Date();
    return new Date(s.startDate) <= now && new Date(s.endDate) >= now;
  }).length;

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const firstName = user?.name?.split(" ")[0] ?? "there";
  const [aiVisible, setAiVisible] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {activeEmergency && <EmergencyBanner broadcast={activeEmergency} />}
      <MedicalAIScreen visible={aiVisible} onClose={() => setAiVisible(false)} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: activeEmergency
              ? 12
              : Platform.OS === "web" ? 67 : insets.top + 16,
            paddingBottom: insets.bottom + 100,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refresh}
            tintColor={Colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>
            {greeting}, {firstName}
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>Camp Overview</Text>
        </View>

        <Pressable 
          onPress={() => setAiVisible(true)}
          style={({ pressed }) => [
            styles.aiCard, 
            { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.9 : 1 }
          ]}
        >
          <View style={[styles.aiIconContainer, { backgroundColor: Colors.accent + "15" }]}>
            <Ionicons name="sparkles" size={24} color={Colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.aiTitle, { color: colors.text }]}>AI Medical Lookup</Text>
            <Text style={[styles.aiSubtitle, { color: colors.textSecondary }]}>Quick medical info for emergencies</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>

        <View style={styles.statsRow}>
          <StatCard
            icon="people"
            value={currentlyIn}
            label="At Camp"
            color={Colors.success}
          />
          <StatCard
            icon="checkmark-circle"
            value={checkedInToday}
            label="Today"
            color={Colors.primary}
          />
          <StatCard
            icon="calendar"
            value={activeSessions || sessions.length}
            label="Sessions"
            color="#8B5CF6"
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="megaphone-outline" size={18} color={colors.text} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Broadcasts</Text>
            {staffBroadcasts.length > 0 && (
              <View style={[styles.countBadge, { backgroundColor: Colors.primary + "15" }]}>
                <Text style={[styles.countText, { color: Colors.primary }]}>
                  {staffBroadcasts.length}
                </Text>
              </View>
            )}
          </View>

          {staffBroadcasts.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
              <Ionicons name="checkmark-circle-outline" size={32} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No broadcasts yet
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
                Messages from management will appear here
              </Text>
            </View>
          ) : (
            <View style={styles.broadcastList}>
              {staffBroadcasts.map((b) => (
                <BroadcastCard key={b.id} broadcast={b} />
              ))}
            </View>
          )}
        </View>

        <View style={[styles.infoRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.primary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            {campers.length} campers registered · Tap Check-in tab to manage attendance
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 18,
      gap: 20,
    },
    header: {
      gap: 3,
    },
    greeting: {
      fontSize: 14,
      fontFamily: "Outfit_400Regular",
    },
    title: {
      fontSize: 28,
      fontFamily: "Outfit_700Bold",
    },
    statsRow: {
      flexDirection: "row",
      gap: 10,
    },
    statCard: {
      flex: 1,
      borderRadius: 16,
      padding: 14,
      alignItems: "center",
      gap: 6,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
    },
    statIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    statValue: {
      fontSize: 24,
      fontFamily: "Outfit_700Bold",
    },
    statLabel: {
      fontSize: 11,
      fontFamily: "Outfit_500Medium",
      textAlign: "center",
    },
    section: {
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
    countBadge: {
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 10,
    },
    countText: {
      fontSize: 12,
      fontFamily: "Outfit_700Bold",
    },
    broadcastList: {
      gap: 10,
    },
    broadcastCard: {
      borderRadius: 16,
      padding: 14,
      flexDirection: "row",
      gap: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 1,
    },
    broadcastIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    broadcastTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 8,
    },
    broadcastTitle: {
      fontSize: 15,
      fontFamily: "Outfit_700Bold",
      flex: 1,
    },
    broadcastTime: {
      fontSize: 12,
      fontFamily: "Outfit_400Regular",
      flexShrink: 0,
      marginTop: 2,
    },
    broadcastMessage: {
      fontSize: 13,
      fontFamily: "Outfit_400Regular",
      lineHeight: 18,
      marginTop: 3,
    },
    broadcastFrom: {
      fontSize: 11,
      fontFamily: "Outfit_400Regular",
      marginTop: 5,
    },
    emptyCard: {
      borderRadius: 16,
      padding: 28,
      alignItems: "center",
      gap: 8,
    },
    emptyText: {
      fontSize: 15,
      fontFamily: "Outfit_600SemiBold",
    },
    emptySubtext: {
      fontSize: 13,
      fontFamily: "Outfit_400Regular",
      textAlign: "center",
    },
    infoRow: {
      flexDirection: "row",
      gap: 8,
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
    },
    infoText: {
      fontSize: 12,
      fontFamily: "Outfit_400Regular",
      flex: 1,
    },
    aiCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      borderRadius: 20,
      borderWidth: 1,
      gap: 16,
    },
    aiIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    aiTitle: {
      fontSize: 17,
      fontFamily: "Outfit_700Bold",
    },
    aiSubtitle: {
      fontSize: 13,
      fontFamily: "Outfit_400Regular",
      marginTop: 2,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    modalTitle: {
      fontSize: 24,
      fontFamily: "Outfit_700Bold",
    },
    modalSub: {
      fontSize: 14,
      fontFamily: "Outfit_400Regular",
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "rgba(0,0,0,0.05)",
      alignItems: "center",
      justifyContent: "center",
    },
    securityBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginHorizontal: 20,
      marginBottom: 8,
      backgroundColor: "rgba(56, 161, 105, 0.1)",
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: "rgba(56, 161, 105, 0.2)",
    },
    securityText: {
      fontSize: 11,
      fontFamily: "Outfit_400Regular",
      color: Colors.success,
    },
    emptyContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 40,
      gap: 12,
    },
    emptyIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: "rgba(229, 62, 62, 0.1)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    emptyTitle: {
      fontSize: 22,
      fontFamily: "Outfit_700Bold",
      textAlign: "center",
    },
    emptyText: {
      fontSize: 15,
      fontFamily: "Outfit_400Regular",
      textAlign: "center",
      lineHeight: 22,
    },
    suggestions: {
      marginTop: 24,
      gap: 10,
      paddingHorizontal: 20,
    },
    suggestion: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      borderWidth: 1,
    },
    suggestionText: {
      fontSize: 14,
      fontFamily: "Outfit_500Medium",
    },
    listContent: {
      padding: 16,
      gap: 12,
    },
    bubble: {
      flexDirection: "row",
      marginBottom: 4,
    },
    userBubble: {
      justifyContent: "flex-end",
    },
    aiBubble: {
      justifyContent: "flex-start",
    },
    bubbleContent: {
      maxWidth: "85%",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
    },
    userBubbleContent: {
      backgroundColor: Colors.primary,
      borderBottomRightRadius: 4,
    },
    aiBubbleContent: {
      backgroundColor: colors.surface,
      borderBottomLeftRadius: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bubbleText: {
      fontSize: 15,
      lineHeight: 20,
    },
    userText: {
      color: "#fff",
      fontFamily: "Outfit_400Regular",
    },
    aiText: {
      color: colors.text,
      fontFamily: "Outfit_400Regular",
    },
    typing: {
      padding: 12,
      alignItems: "flex-start",
    },
    inputArea: {
      paddingTop: 12,
      paddingHorizontal: 16,
      borderTopWidth: 1,
      borderTopColor: "rgba(0,0,0,0.05)",
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 24,
      borderWidth: 1,
    },
    input: {
      flex: 1,
      fontSize: 16,
      fontFamily: "Outfit_400Regular",
      maxHeight: 100,
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: Colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    sendDisabled: {
      opacity: 0.5,
    },
  });
