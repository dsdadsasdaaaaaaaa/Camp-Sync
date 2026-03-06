import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Alert,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import Colors from "@/constants/colors";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/app/_layout";

function StatCard({
  icon,
  label,
  value,
  color,
  onPress,
}: {
  icon: string;
  label: string;
  value: number | string;
  color: string;
  onPress?: () => void;
}) {
  const colors = useColors();
  const styles = getStyles(colors);
  return (
    <Pressable
      style={({ pressed }) => [
        styles.statCard,
        { backgroundColor: colors.surface, opacity: pressed && onPress ? 0.85 : 1 },
      ]}
      onPress={onPress}
    >
      <View style={[styles.statIconContainer, { backgroundColor: color + "20" }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

function RecentCheckIn({
  camperId,
  camperName,
  time,
}: {
  camperId: string;
  camperName: string;
  time: string;
}) {
  const colors = useColors();
  const styles = getStyles(colors);
  return (
    <View style={styles.checkInRow}>
      <View style={[styles.checkInAvatar, { backgroundColor: Colors.primary + "20" }]}>
        <Text style={[styles.checkInInitial, { color: Colors.primary }]}>
          {camperName.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.checkInName, { color: colors.text }]}>{camperName}</Text>
        <Text style={[styles.checkInTime, { color: colors.textSecondary }]}>
          Checked in at {new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>
      <View style={styles.checkInBadge}>
        <Text style={styles.checkInBadgeText}>IN</Text>
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const { campers, checkIns, sessions, pendingUpdates, isLoading, refresh } =
    useData();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = getStyles(colors);
  const { isDark, toggleTheme, setUseSystem } = useTheme();

  const checkedInToday = checkIns.filter((ci) => {
    const today = new Date().toDateString();
    return (
      !ci.checkedOutAt &&
      new Date(ci.checkedInAt).toDateString() === today
    );
  });

  const todaySessions = sessions.filter((s) => {
    const today = new Date().toISOString().split("T")[0];
    return s.isActive && s.authorizedDates.includes(today);
  });

  const unresolved = pendingUpdates.filter((p) => !p.resolved);

  const recentCheckIns = [...checkIns]
    .filter((ci) => {
      const today = new Date().toDateString();
      return new Date(ci.checkedInAt).toDateString() === today;
    })
    .sort((a, b) => new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime())
    .slice(0, 5);

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

  const handleToggleDark = () => {
    setUseSystem(false);
    toggleTheme(!isDark);
  };

  const initials = user?.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) ?? "?";

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
        <RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={Colors.primary} />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.avatar, { backgroundColor: Colors.primary + "25" }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View>
            <Text style={[styles.greeting, { color: colors.textMuted }]}>Welcome back</Text>
            <Text style={[styles.name, { color: colors.text }]}>{user?.name}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={handleToggleDark} hitSlop={8} style={[styles.headerBtn, { backgroundColor: colors.surfaceSecondary }]}>
            <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={18} color={colors.textSecondary} />
          </Pressable>
          <Pressable onPress={handleLogout} hitSlop={8} style={[styles.headerBtn, { backgroundColor: colors.surfaceSecondary }]}>
            <Ionicons name="log-out-outline" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {unresolved.length > 0 && (
        <Pressable
          style={styles.alertBanner}
          onPress={() => router.navigate({ pathname: "/(management)/(tabs)/pending" })}
        >
          <Ionicons name="warning" size={18} color="#fff" />
          <Text style={styles.alertText}>
            {unresolved.length} wristband{unresolved.length !== 1 ? "s" : ""} need
            updating
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#fff" />
        </Pressable>
      )}

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Today's Overview</Text>
      <View style={styles.statsGrid}>
        <StatCard
          icon="people"
          label="Total Campers"
          value={campers.length}
          color={Colors.primary}
          onPress={() => router.navigate({ pathname: "/(management)/(tabs)/campers" })}
        />
        <StatCard
          icon="checkmark-circle"
          label="Checked In"
          value={checkedInToday.length}
          color={Colors.success}
        />
        <StatCard
          icon="calendar"
          label="Active Sessions"
          value={todaySessions.length}
          color={Colors.warning}
          onPress={() => router.navigate({ pathname: "/(management)/(tabs)/more" })}
        />
        <StatCard
          icon="time"
          label="Pending Updates"
          value={unresolved.length}
          color={unresolved.length > 0 ? Colors.danger : colors.textMuted}
          onPress={() => router.navigate({ pathname: "/(management)/(tabs)/pending" })}
        />
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
      <View style={styles.actionsGrid}>
        <Pressable
          style={({ pressed }) => [styles.actionCard, { backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 }]}
          onPress={() => router.navigate({ pathname: "/(management)/(tabs)/campers" })}
        >
          <View style={[styles.actionIcon, { backgroundColor: Colors.primary + "20" }]}>
            <Ionicons name="person-add" size={24} color={Colors.primary} />
          </View>
          <Text style={[styles.actionLabel, { color: colors.text }]}>Add Camper</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionCard, { backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 }]}
          onPress={() => router.navigate({ pathname: "/(management)/(tabs)/nfc" })}
        >
          <View style={[styles.actionIcon, { backgroundColor: Colors.accent + "20" }]}>
            <Ionicons name="radio" size={24} color={Colors.accent} />
          </View>
          <Text style={[styles.actionLabel, { color: colors.text }]}>NFC Wristband</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionCard, { backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 }]}
          onPress={() => router.navigate({ pathname: "/(management)/(tabs)/more" })}
        >
          <View style={[styles.actionIcon, { backgroundColor: Colors.warning + "20" }]}>
            <Ionicons name="calendar" size={24} color={Colors.warning} />
          </View>
          <Text style={[styles.actionLabel, { color: colors.text }]}>Sessions</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionCard, { backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 }]}
          onPress={() => router.navigate({ pathname: "/(management)/(tabs)/more" })}
        >
          <View style={[styles.actionIcon, { backgroundColor: "#8B5CF620" }]}>
            <Ionicons name="key" size={24} color="#8B5CF6" />
          </View>
          <Text style={[styles.actionLabel, { color: colors.text }]}>Auth Codes</Text>
        </Pressable>
      </View>

      {recentCheckIns.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Check-ins</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            {recentCheckIns.map((ci, idx) => {
              const camper = campers.find((c) => c.id === ci.camperId);
              if (!camper) return null;
              return (
                <View key={ci.id}>
                  <RecentCheckIn
                    camperId={ci.camperId}
                    camperName={`${camper.firstName} ${camper.lastName}`}
                    time={ci.checkedInAt}
                  />
                  {idx < recentCheckIns.length - 1 && (
                    <View style={[styles.separator, { backgroundColor: colors.border }]} />
                  )}
                </View>
              );
            })}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 16,
    fontFamily: "Outfit_700Bold",
    color: Colors.accent,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  greeting: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: colors.textMuted,
  },
  name: {
    fontSize: 18,
    fontFamily: "Outfit_700Bold",
    color: colors.text,
    marginTop: 1,
  },
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.warning,
    borderRadius: 14,
    padding: 14,
  },
  alertText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
    color: "#fff",
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Outfit_700Bold",
    color: colors.text,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: "44%",
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: 28,
    fontFamily: "Outfit_700Bold",
    color: colors.text,
  },
  statLabel: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: colors.textSecondary,
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  actionCard: {
    flex: 1,
    minWidth: "44%",
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: colors.text,
    textAlign: "center",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  checkInRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  checkInAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  checkInInitial: {
    fontSize: 16,
    fontFamily: "Outfit_700Bold",
    color: Colors.primary,
  },
  checkInName: {
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
    color: colors.text,
  },
  checkInTime: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: colors.textSecondary,
    marginTop: 2,
  },
  checkInBadge: {
    backgroundColor: Colors.success + "20",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  checkInBadgeText: {
    fontSize: 11,
    fontFamily: "Outfit_700Bold",
    color: Colors.success,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },
});
