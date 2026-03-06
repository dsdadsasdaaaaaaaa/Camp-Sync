import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { fetch } from "expo/fetch";
import Colors from "@/constants/colors";
import { useColors } from "@/hooks/useColors";
import { getApiUrl } from "@/lib/query-client";
import { getToken } from "@/lib/auth-token";

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
  "Show me all emergency contacts for Cabin 3",
];

function MessageBubble({ message }: { message: Message }) {
  const colors = useColors();
  const styles = getStyles(colors);
  const isUser = message.role === "user";
  return (
    <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
      {!isUser && (
        <View style={styles.aiAvatar}>
          <Ionicons name="sparkles" size={14} color={Colors.accent} />
        </View>
      )}
      <View style={[styles.bubbleContent, isUser ? styles.userBubbleContent : styles.aiBubbleContent]}>
        <Text style={[styles.bubbleText, isUser ? styles.userText : styles.aiText]}>
          {message.content}
          {message.isStreaming && (
            <Text style={styles.cursor}>▋</Text>
          )}
        </Text>
      </View>
    </View>
  );
}

export default function AIAssistantScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = getStyles(colors);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const listRef = useRef<FlatList>(null);
  const abortRef = useRef<boolean>(false);

  const generateId = () => Date.now().toString() + Math.random().toString(36).substr(2, 6);

  const sendQuestion = useCallback(async (question: string) => {
    if (!question.trim() || isLoading) return;

    const trimmed = question.trim();
    setInput("");
    setIsLoading(true);
    abortRef.current = false;

    const userMsg: Message = { id: generateId(), role: "user", content: trimmed };
    const assistantId = generateId();
    const assistantMsg: Message = { id: assistantId, role: "assistant", content: "", isStreaming: true };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const url = new URL("/api/ai/query", getApiUrl()).toString();
      const token = getToken();

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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
      let fullContent = "";

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
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: fullContent, isStreaming: true }
                    : m
                )
              );
              listRef.current?.scrollToEnd({ animated: false });
            }
            if (event.done) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, isStreaming: false }
                    : m
                )
              );
            }
          } catch {}
        }
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, isStreaming: false } : m
        )
      );
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `Error: ${err.message || "Something went wrong"}`, isStreaming: false }
            : m
        )
      );
    } finally {
      setIsLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [isLoading]);

  const clearChat = () => {
    abortRef.current = true;
    setMessages([]);
    setIsLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20) },
        ]}
      >
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Ionicons name="sparkles" size={20} color={Colors.accent} />
          </View>
          <View>
            <Text style={styles.headerTitle}>AI Assistant</Text>
            <Text style={styles.headerSub}>Management only · Secure</Text>
          </View>
        </View>
        {messages.length > 0 && (
          <Pressable
            onPress={clearChat}
            style={({ pressed }) => [styles.clearBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      <View style={styles.securityBadge}>
        <Ionicons name="lock-closed" size={12} color={Colors.success} />
        <Text style={styles.securityText}>
          All data is accessed server-side only — nothing is sent from your device
        </Text>
      </View>

      {messages.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="sparkles" size={36} color={Colors.accent} />
          </View>
          <Text style={styles.emptyTitle}>Ask anything about camp</Text>
          <Text style={styles.emptySubtitle}>
            I have full access to all camper records, medical data, and check-in history.
          </Text>

          <View style={styles.suggestions}>
            {SUGGESTION_QUESTIONS.map((q, i) => (
              <Pressable
                key={i}
                style={({ pressed }) => [styles.suggestion, { opacity: pressed ? 0.7 : 1 }]}
                onPress={() => sendQuestion(q)}
              >
                <Text style={styles.suggestionText}>{q}</Text>
                <Ionicons name="arrow-forward" size={14} color={Colors.accent} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.messageList,
            { paddingBottom: insets.bottom + 120 },
          ]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <MessageBubble message={item} />}
        />
      )}

      <View
        style={[
          styles.inputContainer,
          {
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 16),
            paddingHorizontal: 16,
          },
        ]}
      >
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about campers, allergies, check-ins..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={500}
            editable={!isLoading}
            returnKeyType="send"
            onSubmitEditing={() => sendQuestion(input)}
          />
          <Pressable
            style={({ pressed }) => [
              styles.sendBtn,
              !input.trim() || isLoading ? styles.sendBtnDisabled : {},
              { opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={() => sendQuestion(input)}
            disabled={!input.trim() || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="arrow-up" size={20} color="#fff" />
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: colors.surface,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: Colors.accent + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Outfit_700Bold",
    color: colors.text,
  },
  headerSub: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: colors.textMuted,
  },
  clearBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  securityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: Colors.success + "12",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.success + "25",
  },
  securityText: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Outfit_400Regular",
    color: Colors.success,
    lineHeight: 15,
  },
  emptyState: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: Colors.accent + "15",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: "Outfit_700Bold",
    color: colors.text,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  suggestions: {
    gap: 8,
    marginTop: 8,
  },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Outfit_500Medium",
    color: colors.text,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
  },
  bubble: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 4,
  },
  userBubble: {
    justifyContent: "flex-end",
  },
  aiBubble: {
    justifyContent: "flex-start",
  },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accent + "15",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginBottom: 2,
  },
  bubbleContent: {
    maxWidth: "80%",
    borderRadius: 18,
    padding: 12,
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
    lineHeight: 21,
  },
  userText: {
    fontFamily: "Outfit_400Regular",
    color: "#fff",
  },
  aiText: {
    fontFamily: "Outfit_400Regular",
    color: colors.text,
  },
  cursor: {
    color: Colors.accent,
  },
  inputContainer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    fontFamily: "Outfit_400Regular",
    fontSize: 15,
    color: colors.text,
    maxHeight: 100,
    paddingTop: 4,
    paddingBottom: 4,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  sendBtnDisabled: {
    backgroundColor: colors.textMuted,
  },
});
