import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Platform,
  RefreshControl,
  SectionList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import Colors from "@/constants/colors";
import { useColors } from "@/hooks/useColors";
import { useSiren } from "@/lib/useSiren";
import type { CheckIn, Camper, Broadcast } from "@/types";

interface ActivityEvent {
  id: string;
  type: "check_in" | "check_out" | "broadcast";
  camper?: Camper;
  checkIn?: CheckIn;
  broadcast?: Broadcast;
  timestamp: string;
}

export default function ParentNotificationsScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const styles = getStyles(colors);
  const { campers, checkIns, broadcasts, isLoading, refresh } = useData();
  const insets = useSafeAreaInsets();

  const activeEmergency = broadcasts.find((b) => b.emergencyActive);
  useSiren(!!activeEmergency);

  const myChildren = campers.filter((c) =>
    user?.linkedCamperIds.includes(c.id)
  );
  const childIds = myChildren.map((c) => c.id);

  const events: ActivityEvent[] = [];

  checkIns
    .filter((ci) => childIds.includes(ci.camperId))
    .forEach((ci) => {
      const camper = myChildren.find((c) => c.id === ci.camperId);
      if (!camper) return;

      events.push({
        id: ci.id + "-in",
        type: "check_in",
        camper,
        checkIn: ci,
        timestamp: ci.checkedInAt,
      });

      if (ci.checkedOutAt) {
        events.push({
          id: ci.id + "-out",
          type: "check_out",
          camper,
          checkIn: ci,
          timestamp: ci.checkedOutAt,
        });
      }
    });

  const parentBroadcasts = broadcasts.filter(
    (b) => b.audience === "parents" || b.audience === "all"
  );
  parentBroadcasts.forEach((b) => {
    events.push({
      id: "broadcast-" + b.id,
      type: "broadcast",
      broadcast: b,
      timestamp: b.sentAt,
    });
  });

  events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const renderItem = useCallback(
    ({ item }: { item: ActivityEvent }) => {
      if (item.type === "broadcast" && item.broadcast) {
        const b = item.broadcast;
        const isEmergency = b.isEmergency;
        return (
          <View style={[
            styles.eventCard,
            {
              backgroundColor: isEmergency ? Colors.danger + "10" : colors.surface,
              borderWidth: isEmergency ? 1.5 : 0,
              borderColor: isEmergency ? Colors.danger + "50" : "transparent",
            },
          ]}>
            <View style={[styles.iconCircle, { backgroundColor: isEmergency ? Colors.danger + "20" : Colors.primary + "15" }]}>
              <Ionicons name={isEmergency ? "warning" : "megaphone-outline"} size={20} color={isEmergency ? Colors.danger : Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.eventTitle, { color: isEmergency ? Colors.danger : colors.text, fontFamily: "Outfit_700Bold" }]}>
                {b.title}
              </Text>
              <Text style={[styles.eventMeta, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={2}>
                {b.message}
              </Text>
              <Text style={[styles.eventMeta, { color: colors.textMuted, marginTop: 3 }]}>
                {new Date(b.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · From {b.sentByName}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: isEmergency ? Colors.danger + "20" : Colors.primary + "15" }]}>
              <Text style={[styles.badgeText, { color: isEmergency ? Colors.danger : Colors.primary }]}>
                {isEmergency ? "!" : "📢"}
              </Text>
            </View>
          </View>
        );
      }

      const isIn = item.type === "check_in";
      const staffName = isIn
        ? item.checkIn?.checkedInByName
        : item.checkIn?.checkedOutByName;
      const date = new Date(item.timestamp);
      const isToday = date.toDateString() === new Date().toDateString();
      const isYesterday = date.toDateString() === new Date(Date.now() - 86400000).toDateString();
      const dayLabel = isToday ? "Today" : isYesterday ? "Yesterday" : date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
      const timeLabel = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      return (
        <View style={[styles.eventCard, { backgroundColor: colors.surface }]}>
          <View style={[styles.iconCircle, { backgroundColor: isIn ? Colors.success + "20" : colors.surfaceSecondary }]}>
            <Ionicons name={isIn ? "log-in-outline" : "log-out-outline"} size={20} color={isIn ? Colors.success : colors.textSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.eventTitle, { color: colors.text }]}>
              <Text style={[styles.eventName, { color: colors.text }]}>{item.camper?.firstName}</Text>
              {isIn ? " checked in" : " checked out"}
            </Text>
            <Text style={[styles.eventMeta, { color: colors.textMuted }]}>
              {dayLabel} at {timeLabel}
              {staffName ? ` · ${staffName}` : ""}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: isIn ? Colors.success + "15" : colors.surfaceSecondary }]}>
            <Text style={[styles.badgeText, { color: isIn ? Colors.success : colors.textSecondary }]}>
              {isIn ? "In" : "Out"}
            </Text>
          </View>
        </View>
      );
    },
    [colors]
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {activeEmergency && (
        <View style={styles.emergencyBanner}>
          <View style={styles.emergencyIconWrap}>
            <Ionicons name="warning" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.emergencyTitle}>{activeEmergency.title}</Text>
            <Text style={styles.emergencyMsgText} numberOfLines={2}>
              {activeEmergency.message}
            </Text>
          </View>
        </View>
      )}
      <View style={[styles.header, {
        paddingTop: activeEmergency
          ? 14
          : Platform.OS === "web" ? 67 : insets.top + 20
      }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Ionicons name="notifications-outline" size={22} color={colors.text} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Activity</Text>
        </View>
      </View>

      {myChildren.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={44} color={Colors.primary} />
          <Text style={styles.emptyTitle}>No children linked</Text>
          <Text style={styles.emptyText}>Ask camp management to link your account to your child.</Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          scrollEnabled={!!events.length}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={Colors.primary} />
          }
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={44} color={Colors.primary} />
              <Text style={styles.emptyTitle}>No activity yet</Text>
              <Text style={styles.emptyText}>Check-in, check-out events and camp announcements will appear here.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: colors.surface,
    gap: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Outfit_700Bold",
    color: colors.text,
  },
  emergencyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.danger,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  emergencyIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  emergencyTitle: {
    fontSize: 14,
    fontFamily: "Outfit_700Bold",
    color: "#fff",
  },
  emergencyMsgText: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: "rgba(255,255,255,0.85)",
    marginTop: 1,
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 10,
  },
  eventCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  eventTitle: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: colors.text,
    lineHeight: 20,
  },
  eventName: {
    fontFamily: "Outfit_600SemiBold",
  },
  eventMeta: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: colors.textMuted,
    marginTop: 3,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Outfit_700Bold",
    color: colors.text,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
});
