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
  return (
    <Pressable
      style={({ pressed }) => [
        styles.statCard,
        { opacity: pressed && onPress ? 0.85 : 1 },
      ]}
      onPress={onPress}
    >
      <View style={[styles.statIconContainer, { backgroundColor: color + "20" }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
  return (
    <View style={styles.checkInRow}>
      <View style={styles.checkInAvatar}>
        <Text style={styles.checkInInitial}>
          {camperName.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.checkInName}>{camperName}</Text>
        <Text style={styles.checkInTime}>
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

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.light.background }}
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
        <View>
          <Text style={styles.greeting}>Good day,</Text>
          <Text style={styles.name}>{user?.name}</Text>
          <View style={styles.roleBadge}>
            <Ionicons name="shield-checkmark" size={12} color={Colors.accent} />
            <Text style={styles.roleText}>Management</Text>
          </View>
        </View>
        <Pressable onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={22} color={Colors.light.textSecondary} />
        </Pressable>
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

      <Text style={styles.sectionTitle}>Today's Overview</Text>
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
          color={unresolved.length > 0 ? Colors.danger : Colors.light.textMuted}
          onPress={() => router.navigate({ pathname: "/(management)/(tabs)/pending" })}
        />
      </View>

      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsGrid}>
        <Pressable
          style={({ pressed }) => [styles.actionCard, { opacity: pressed ? 0.85 : 1 }]}
          onPress={() => router.navigate({ pathname: "/(management)/(tabs)/campers" })}
        >
          <View style={[styles.actionIcon, { backgroundColor: Colors.primary + "20" }]}>
            <Ionicons name="person-add" size={24} color={Colors.primary} />
          </View>
          <Text style={styles.actionLabel}>Add Camper</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionCard, { opacity: pressed ? 0.85 : 1 }]}
          onPress={() => router.navigate({ pathname: "/(management)/(tabs)/nfc" })}
        >
          <View style={[styles.actionIcon, { backgroundColor: Colors.accent + "20" }]}>
            <Ionicons name="radio" size={24} color={Colors.accent} />
          </View>
          <Text style={styles.actionLabel}>NFC Wristband</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionCard, { opacity: pressed ? 0.85 : 1 }]}
          onPress={() => router.navigate({ pathname: "/(management)/(tabs)/more" })}
        >
          <View style={[styles.actionIcon, { backgroundColor: Colors.warning + "20" }]}>
            <Ionicons name="calendar" size={24} color={Colors.warning} />
          </View>
          <Text style={styles.actionLabel}>Sessions</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionCard, { opacity: pressed ? 0.85 : 1 }]}
          onPress={() => router.navigate({ pathname: "/(management)/(tabs)/more" })}
        >
          <View style={[styles.actionIcon, { backgroundColor: "#8B5CF620" }]}>
            <Ionicons name="key" size={24} color="#8B5CF6" />
          </View>
          <Text style={styles.actionLabel}>Auth Codes</Text>
        </Pressable>
      </View>

      {recentCheckIns.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Recent Check-ins</Text>
          <View style={styles.card}>
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
                    <View style={styles.separator} />
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

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  greeting: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textSecondary,
  },
  name: {
    fontSize: 26,
    fontFamily: "Outfit_700Bold",
    color: Colors.light.text,
    marginTop: 2,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.accent + "20",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  roleText: {
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.accent,
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
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
    color: Colors.light.text,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: "44%",
    backgroundColor: Colors.light.surface,
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
    color: Colors.light.text,
  },
  statLabel: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textSecondary,
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  actionCard: {
    flex: 1,
    minWidth: "44%",
    backgroundColor: Colors.light.surface,
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
    color: Colors.light.text,
    textAlign: "center",
  },
  card: {
    backgroundColor: Colors.light.surface,
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
    color: Colors.light.text,
  },
  checkInTime: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textSecondary,
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
    backgroundColor: Colors.light.border,
  },
});
