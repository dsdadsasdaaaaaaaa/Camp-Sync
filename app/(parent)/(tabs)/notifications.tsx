import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Platform,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import Colors from "@/constants/colors";
import { useColors } from "@/hooks/useColors";
import type { CheckIn, Camper } from "@/types";

interface ActivityEvent {
  id: string;
  type: "check_in" | "check_out";
  camper: Camper;
  checkIn: CheckIn;
  timestamp: string;
}

export default function ParentNotificationsScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const { campers, checkIns, isLoading, refresh } = useData();
  const insets = useSafeAreaInsets();

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

  events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const renderItem = useCallback(
    ({ item }: { item: ActivityEvent }) => {
      const isIn = item.type === "check_in";
      const staffName = isIn
        ? item.checkIn.checkedInByName
        : item.checkIn.checkedOutByName;
      const date = new Date(item.timestamp);
      const isToday =
        date.toDateString() === new Date().toDateString();
      const isYesterday =
        date.toDateString() ===
        new Date(Date.now() - 86400000).toDateString();

      const dayLabel = isToday
        ? "Today"
        : isYesterday
        ? "Yesterday"
        : date.toLocaleDateString([], {
            weekday: "long",
            month: "short",
            day: "numeric",
          });

      const timeLabel = date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      return (
        <View style={[styles.eventCard, { backgroundColor: colors.surface }]}>
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: isIn
                  ? Colors.success + "20"
                  : colors.surfaceSecondary,
              },
            ]}
          >
            <Ionicons
              name={isIn ? "log-in-outline" : "log-out-outline"}
              size={20}
              color={isIn ? Colors.success : colors.textSecondary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.eventTitle, { color: colors.text }]}>
              <Text style={[styles.eventName, { color: colors.text }]}>{item.camper.firstName}</Text>
              {isIn ? " checked in" : " checked out"}
            </Text>
            <Text style={[styles.eventMeta, { color: colors.textMuted }]}>
              {dayLabel} at {timeLabel}
              {staffName ? ` · ${staffName}` : ""}
            </Text>
          </View>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: isIn
                  ? Colors.success + "15"
                  : colors.surfaceSecondary,
              },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                { color: isIn ? Colors.success : colors.textSecondary },
              ]}
            >
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
      <View
        style={[
          styles.header,
          {
            paddingTop:
              insets.top + (Platform.OS === "web" ? 67 : 20),
          },
        ]}
      >
        <Ionicons
          name="notifications-outline"
          size={22}
          color={colors.text}
        />
        <Text style={[styles.headerTitle, { color: colors.text }]}>Activity</Text>
      </View>

      {myChildren.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons
            name="people-outline"
            size={44}
            color={Colors.primary}
          />
          <Text style={styles.emptyTitle}>No children linked</Text>
          <Text style={styles.emptyText}>
            Ask camp management to link your account to your child.
          </Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          scrollEnabled={!!events.length}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refresh}
              tintColor={Colors.primary}
            />
          }
          contentContainerStyle={[
            styles.list,
            {
              paddingBottom: insets.bottom + 100,
            },
          ]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name="calendar-outline"
                size={44}
                color={Colors.primary}
              />
              <Text style={styles.emptyTitle}>No activity yet</Text>
              <Text style={styles.emptyText}>
                Check-in and check-out events will appear here.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Outfit_700Bold",
    color: "#111111",
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
    backgroundColor: "#F9FAFB",
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
    color: "#111111",
    lineHeight: 20,
  },
  eventName: {
    fontFamily: "Outfit_600SemiBold",
  },
  eventMeta: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: "#999999",
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
    color: "#111111",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: "#666666",
    textAlign: "center",
    lineHeight: 20,
  },
});
