import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import Colors from "@/constants/colors";
import { useColors } from "@/hooks/useColors";
import type { Camper } from "@/types";

function ChildCard({ camper, isCheckedIn, lastCheckIn, hasPendingUpdate }: {
  camper: Camper;
  isCheckedIn: boolean;
  lastCheckIn?: { at: string; out?: string };
  hasPendingUpdate: boolean;
}) {
  const colors = useColors();
  const styles = getStyles(colors);
  return (
    <Pressable
      style={({ pressed }) => [
        styles.childCard,
        { opacity: pressed ? 0.9 : 1, backgroundColor: colors.surface },
      ]}
      onPress={() => router.push(`/(parent)/child/${camper.id}`)}
    >
      <View style={styles.cardHeader}>
        <View style={[
          styles.avatar,
          { backgroundColor: isCheckedIn ? Colors.success + "20" : Colors.primary + "20" }
        ]}>
          <Text style={[
            styles.avatarText,
            { color: isCheckedIn ? Colors.success : Colors.primary }
          ]}>
            {camper.firstName.charAt(0)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.childName, { color: colors.text }]}>{camper.firstName} {camper.lastName}</Text>
          <Text style={[styles.childCabin, { color: colors.textSecondary }]}>{camper.cabinGroup || "No cabin assigned"}</Text>
        </View>
        {hasPendingUpdate && (
          <View style={styles.pendingBadge}>
            <Ionicons name="warning" size={14} color={Colors.warning} />
            <Text style={styles.pendingBadgeText}>Wristband update needed</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </View>

      <View style={styles.statusRow}>
        <View style={[
          styles.statusPill,
          { backgroundColor: isCheckedIn ? Colors.success + "15" : colors.surfaceSecondary }
        ]}>
          <View style={[
            styles.statusDot,
            { backgroundColor: isCheckedIn ? Colors.success : colors.textMuted }
          ]} />
          <Text style={[
            styles.statusText,
            { color: isCheckedIn ? Colors.success : colors.textSecondary }
          ]}>
            {isCheckedIn ? "Currently at Camp" : "Not Checked In"}
          </Text>
        </View>
      </View>

      {lastCheckIn && (
        <View style={styles.lastCheckInRow}>
          <Ionicons name="time-outline" size={14} color={colors.textMuted} />
          <Text style={[styles.lastCheckInText, { color: colors.textSecondary }]}>
            {isCheckedIn
              ? `Checked in ${new Date(lastCheckIn.at).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })} at ${new Date(lastCheckIn.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : lastCheckIn.out
              ? `Last here: ${new Date(lastCheckIn.at).toLocaleDateString([], { month: "short", day: "numeric" })}, checked out ${new Date(lastCheckIn.out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : `Last checked in: ${new Date(lastCheckIn.at).toLocaleDateString()}`}
          </Text>
        </View>
      )}

      {camper.wristbandId && (
        <View style={styles.wristbandRow}>
          <Ionicons name="radio-outline" size={14} color={Colors.primary} />
          <Text style={styles.wristbandText}>Wristband: {camper.wristbandId}</Text>
          {hasPendingUpdate && (
            <Text style={styles.outdatedText}>• Info outdated</Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

export default function ParentChildrenScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const styles = getStyles(colors);
  const { campers, checkIns, pendingUpdates, isLoading, refresh } = useData();
  const insets = useSafeAreaInsets();

  const myChildren = campers.filter((c) =>
    Array.isArray(user?.linkedCamperIds) && user.linkedCamperIds.includes(c.id)
  );

  const hasLoadedOnce = !isLoading || campers.length > 0;

  const getActiveCheckIn = (camperId: string) =>
    checkIns.find((ci) => ci.camperId === camperId && !ci.checkedOutAt);

  const getLastCheckIn = (camperId: string) => {
    const history = checkIns
      .filter((ci) => ci.camperId === camperId)
      .sort((a, b) => new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime());
    if (history.length === 0) return undefined;
    const last = history[0];
    return { at: last.checkedInAt, out: last.checkedOutAt };
  };

  const hasPendingUpdate = (camperId: string) =>
    pendingUpdates.some((p) => p.camperId === camperId && !p.resolved);

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
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={refresh}
          tintColor={Colors.primary}
        />
      }
    >
      <View style={styles.header}>
        <Text style={[styles.greeting, { color: colors.textSecondary }]}>Hello, {user?.name?.split(" ")[0]}</Text>
        <Text style={[styles.title, { color: colors.text }]}>My Children</Text>
      </View>

      {!hasLoadedOnce ? (
        <View style={styles.empty}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : myChildren.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="people-outline" size={44} color={Colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No children linked</Text>
          <Text style={styles.emptyText}>
            Your account is not linked to any campers yet. Ask camp management to generate a parent auth code for your child.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {myChildren.map((camper) => {
            const activeCI = getActiveCheckIn(camper.id);
            return (
              <ChildCard
                key={camper.id}
                camper={camper}
                isCheckedIn={!!activeCI}
                lastCheckIn={getLastCheckIn(camper.id)}
                hasPendingUpdate={hasPendingUpdate(camper.id)}
              />
            );
          })}
        </View>
      )}

      {myChildren.length > 0 && (
        <View style={styles.activitySection}>
          <View style={styles.activityHeader}>
            <Ionicons name="notifications-outline" size={20} color={colors.text} />
            <Text style={styles.activityTitle}>Recent Activity</Text>
          </View>
          {(() => {
            const childIds = myChildren.map((c) => c.id);
            const recentActivity = checkIns
              .filter((ci) => childIds.includes(ci.camperId))
              .sort((a, b) => {
                const dateA = a.checkedOutAt || a.checkedInAt;
                const dateB = b.checkedOutAt || b.checkedInAt;
                return new Date(dateB).getTime() - new Date(dateA).getTime();
              })
              .slice(0, 10);

            if (recentActivity.length === 0) {
              return (
                <View style={styles.activityEmpty}>
                  <Ionicons name="calendar-outline" size={24} color={colors.textMuted} />
                  <Text style={styles.activityEmptyText}>No activity yet</Text>
                </View>
              );
            }

            return recentActivity.map((ci) => {
              const camper = myChildren.find((c) => c.id === ci.camperId);
              const isCheckOut = !!ci.checkedOutAt;
              const eventTime = isCheckOut ? ci.checkedOutAt! : ci.checkedInAt;
              const staffName = isCheckOut ? ci.checkedOutByName : ci.checkedInByName;
              return (
                <View key={ci.id + (isCheckOut ? "-out" : "-in")} style={styles.activityItem}>
                  <View style={[
                    styles.activityDot,
                    { backgroundColor: isCheckOut ? "#999999" : Colors.success }
                  ]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activityText}>
                      <Text style={styles.activityBold}>{camper?.firstName}</Text>
                      {isCheckOut ? " checked out" : " checked in"}
                    </Text>
                    <Text style={styles.activityMeta}>
                      {new Date(eventTime).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                      {" at "}
                      {new Date(eventTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {staffName ? ` · by ${staffName}` : ""}
                    </Text>
                  </View>
                  <Ionicons
                    name={isCheckOut ? "log-out-outline" : "log-in-outline"}
                    size={16}
                    color={isCheckOut ? "#999999" : Colors.success}
                  />
                </View>
              );
            });
          })()}
        </View>
      )}

      <View style={styles.infoCard}>
        <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
        <Text style={styles.infoText}>
          Tap a child's card to view their full information and edit details if needed.
        </Text>
      </View>
    </ScrollView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    gap: 20,
  },
  header: {
    gap: 4,
  },
  greeting: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: colors.textSecondary,
  },
  title: {
    fontSize: 28,
    fontFamily: "Outfit_700Bold",
    color: colors.text,
  },
  list: {
    gap: 14,
  },
  childCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 22,
    fontFamily: "Outfit_700Bold",
  },
  childName: {
    fontSize: 18,
    fontFamily: "Outfit_700Bold",
    color: colors.text,
  },
  childCabin: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: colors.textSecondary,
    marginTop: 2,
  },
  pendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.warning + "20",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pendingBadgeText: {
    fontSize: 10,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.warning,
  },
  statusRow: {
    flexDirection: "row",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
  },
  lastCheckInRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  lastCheckInText: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: colors.textSecondary,
  },
  wristbandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  wristbandText: {
    fontSize: 13,
    fontFamily: "Outfit_500Medium",
    color: Colors.primary,
  },
  outdatedText: {
    fontSize: 12,
    fontFamily: "Outfit_500Medium",
    color: Colors.warning,
  },
  empty: {
    alignItems: "center",
    gap: 16,
    paddingVertical: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: Colors.primary + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Outfit_700Bold",
    color: colors.text,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
  },
  activitySection: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  activityHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  activityTitle: {
    fontSize: 18,
    fontFamily: "Outfit_700Bold",
    color: colors.text,
  },
  activityEmpty: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
  },
  activityEmptyText: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: colors.textMuted,
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activityText: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: colors.text,
  },
  activityBold: {
    fontFamily: "Outfit_600SemiBold",
  },
  activityMeta: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: colors.textMuted,
    marginTop: 2,
  },
  infoCard: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: Colors.primary + "10",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.primary + "20",
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
