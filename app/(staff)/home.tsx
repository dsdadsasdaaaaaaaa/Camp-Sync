import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
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
import { useSiren } from "@/lib/useSiren";
import type { Broadcast } from "@/types";

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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {activeEmergency && <EmergencyBanner broadcast={activeEmergency} />}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: activeEmergency
              ? 12
              : Platform.OS === "web" ? 67 : Platform.OS === "ios" ? 20 : insets.top + 20,
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
  });
