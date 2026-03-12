import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  FlatList,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useData } from "@/contexts/DataContext";
import { apiRequest } from "@/lib/query-client";
import { useColors } from "@/hooks/useColors";
import Colors from "@/constants/colors";
import type { Camper, CheckIn } from "@/types";

interface CabinData {
  campers: (Camper & { medical: any })[];
}

export default function CabinDetailScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const { checkIns, refresh, updateCamper } = useData();
  const colors = useColors();
  const styles = getStyles(colors);
  const insets = useSafeAreaInsets();

  const [isLoading, setIsLoading] = useState(true);
  const [cabinCampers, setCabinCampers] = useState<Camper[]>([]);
  const [activeTab, setActiveTab] = useState<"roster" | "medical" | "stats">("roster");

  const fetchCabinData = async () => {
    try {
      setIsLoading(true);
      const res = await apiRequest("GET", `/api/cabin-groups/${encodeURIComponent(name)}`);
      const data: CabinData = await res.json();
      setCabinCampers(data.campers);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to fetch cabin data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCabinData();
  }, [name]);

  const handleRename = () => {
    if (Platform.OS === "web") {
      const newName = window.prompt("Rename Cabin", name);
      if (newName && newName !== name) {
        performRename(newName);
      }
    } else {
      Alert.prompt(
        "Rename Cabin",
        "Enter a new name for this cabin group. This will update all assigned campers.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Rename",
            onPress: (newName: string | undefined) => {
              if (newName && newName.trim() && newName !== name) {
                performRename(newName.trim());
              }
            },
          },
        ],
        "plain-text",
        name
      );
    }
  };

  const performRename = async (newName: string) => {
    try {
      await apiRequest("PATCH", `/api/cabin-groups/${encodeURIComponent(name)}/rename`, { newName });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refresh();
      router.back();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to rename cabin");
    }
  };

  const checkedInCount = useMemo(() => {
    return cabinCampers.filter(c => checkIns.some(ci => ci.camperId === c.id && !ci.checkedOutAt)).length;
  }, [cabinCampers, checkIns]);

  const medicalData = useMemo(() => {
    const allergies: { name: string; camperNames: string[] }[] = [];
    const medications: { name: string; camperNames: string[] }[] = [];
    const conditions: { name: string; camperNames: string[] }[] = [];

    cabinCampers.forEach(camper => {
      const m = camper.medical || {};
      const fullName = `${camper.firstName} ${camper.lastName}`;

      (m.allergies || []).forEach((item: string) => {
        const existing = allergies.find(a => a.name.toLowerCase() === item.toLowerCase());
        if (existing) {
          if (!existing.camperNames.includes(fullName)) existing.camperNames.push(fullName);
        } else {
          allergies.push({ name: item, camperNames: [fullName] });
        }
      });

      (m.medications || []).forEach((item: string) => {
        const existing = medications.find(a => a.name.toLowerCase() === item.toLowerCase());
        if (existing) {
          if (!existing.camperNames.includes(fullName)) existing.camperNames.push(fullName);
        } else {
          medications.push({ name: item, camperNames: [fullName] });
        }
      });

      (m.conditions || []).forEach((item: string) => {
        const existing = conditions.find(a => a.name.toLowerCase() === item.toLowerCase());
        if (existing) {
          if (!existing.camperNames.includes(fullName)) existing.camperNames.push(fullName);
        } else {
          conditions.push({ name: item, camperNames: [fullName] });
        }
      });
    });

    const sortFn = (a: any, b: any) => a.name.localeCompare(b.name);
    return {
      allergies: allergies.sort(sortFn),
      medications: medications.sort(sortFn),
      conditions: conditions.sort(sortFn),
    };
  }, [cabinCampers]);

  const cabinCheckIns = useMemo(() => {
    return checkIns
      .filter(ci => cabinCampers.some(c => c.id === ci.camperId))
      .sort((a, b) => new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime());
  }, [cabinCampers, checkIns]);

  const renderRoster = () => (
    <FlatList
      data={cabinCampers}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      renderItem={({ item }) => {
        const isActive = checkIns.some(ci => ci.camperId === item.id && !ci.checkedOutAt);
        return (
          <Pressable
            style={styles.camperCard}
            onPress={() => router.push(`/(management)/camper/${item.id}`)}
          >
            <View style={styles.camperInfo}>
              <Text style={styles.camperName}>{item.firstName} {item.lastName}</Text>
              <Text style={styles.camperSub}>DOB: {item.dateOfBirth}</Text>
              {item.wristbandId && (
                <View style={styles.wristbandBadge}>
                  <Ionicons name="radio" size={12} color={colors.textSecondary} />
                  <Text style={styles.wristbandText}>{item.wristbandId}</Text>
                </View>
              )}
            </View>
            <View style={[styles.statusPill, { backgroundColor: isActive ? Colors.success + "20" : colors.surfaceSecondary }]}>
              <View style={[styles.statusDot, { backgroundColor: isActive ? Colors.success : colors.textMuted }]} />
              <Text style={[styles.statusText, { color: isActive ? Colors.success : colors.textSecondary }]}>
                {isActive ? "Present" : "Away"}
              </Text>
            </View>
          </Pressable>
        );
      }}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No campers found in this cabin.</Text>
        </View>
      }
    />
  );

  const renderMedical = () => (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <MedicalSection title="Allergies" items={medicalData.allergies} icon="alert-circle-outline" color={Colors.danger} colors={colors} styles={styles} />
      <MedicalSection title="Medications" items={medicalData.medications} icon="medical-bag" color={Colors.primary} colors={colors} styles={styles} isMCI />
      <MedicalSection title="Conditions" items={medicalData.conditions} icon="information-circle-outline" color={Colors.warning} colors={colors} styles={styles} />
    </ScrollView>
  );

  const renderStats = () => {
    const total = cabinCampers.length;
    const present = checkedInCount;
    const percent = total > 0 ? Math.round((present / total) * 100) : 0;

    return (
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.statsGrid}>
          <StatCard label="Total Campers" value={total.toString()} icon="people" color={Colors.primary} colors={colors} styles={styles} />
          <StatCard label="Checked In" value={present.toString()} icon="checkmark-circle" color={Colors.success} colors={colors} styles={styles} />
          <StatCard label="Attendance" value={`${percent}%`} icon="analytics" color={Colors.accent} colors={colors} styles={styles} />
        </View>

        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {cabinCheckIns.slice(0, 10).map((ci) => {
          const camper = cabinCampers.find(c => c.id === ci.camperId);
          if (!camper) return null;
          return (
            <View key={ci.id} style={styles.activityRow}>
              <View style={[styles.activityIcon, { backgroundColor: ci.checkedOutAt ? colors.textMuted + "20" : Colors.success + "20" }]}>
                <Ionicons 
                  name={ci.checkedOutAt ? "exit-outline" : "enter-outline"} 
                  size={16} 
                  color={ci.checkedOutAt ? colors.textMuted : Colors.success} 
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.activityText}>
                  <Text style={{ fontFamily: "Outfit_600SemiBold" }}>{camper.firstName} {camper.lastName}</Text>
                  {ci.checkedOutAt ? " checked out" : " checked in"}
                </Text>
                <Text style={styles.activitySub}>
                  {new Date(ci.checkedOutAt || ci.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(ci.checkedOutAt || ci.checkedInAt).toLocaleDateString()}
                </Text>
              </View>
            </View>
          );
        })}
        {cabinCheckIns.length === 0 && (
          <Text style={styles.emptyText}>No recent check-in activity.</Text>
        )}
      </ScrollView>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 10) }]}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => router.back()} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>{name}</Text>
            <Text style={styles.headerSub}>{cabinCampers.length} Campers • {checkedInCount} Present</Text>
          </View>
          <Pressable onPress={handleRename} style={styles.iconButton}>
            <Ionicons name="create-outline" size={24} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.tabs}>
          <TabButton label="Roster" active={activeTab === "roster"} onPress={() => setActiveTab("roster")} colors={colors} styles={styles} />
          <TabButton label="Medical" active={activeTab === "medical"} onPress={() => setActiveTab("medical")} colors={colors} styles={styles} />
          <TabButton label="Stats" active={activeTab === "stats"} onPress={() => setActiveTab("stats")} colors={colors} styles={styles} />
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {activeTab === "roster" && renderRoster()}
          {activeTab === "medical" && renderMedical()}
          {activeTab === "stats" && renderStats()}
        </View>
      )}
    </View>
  );
}

function TabButton({ label, active, onPress, colors, styles }: any) {
  return (
    <Pressable 
      onPress={onPress}
      style={[styles.tab, active && styles.activeTab]}
    >
      <Text style={[styles.tabText, active && styles.activeTabText]}>{label}</Text>
    </Pressable>
  );
}

function MedicalSection({ title, items, icon, color, colors, styles, isMCI }: any) {
  if (items.length === 0) return null;
  return (
    <View style={styles.medicalSection}>
      <View style={styles.sectionHeader}>
        {isMCI ? (
          <MaterialCommunityIcons name={icon} size={20} color={color} />
        ) : (
          <Ionicons name={icon} size={20} color={color} />
        )}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.chipGrid}>
        {items.map((item: any, idx: number) => (
          <View key={idx} style={styles.medicalChip}>
            <View style={styles.chipTop}>
              <Text style={styles.chipLabel}>{item.name}</Text>
            </View>
            <Text style={styles.chipSub}>{item.camperNames.join(", ")}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function StatCard({ label, value, icon, color, colors, styles }: any) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + "15" }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
    paddingBottom: 0,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Outfit_700Bold",
    color: colors.text,
  },
  headerSub: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: colors.textSecondary,
    marginTop: 2,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  tabs: {
    flexDirection: "row",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
    color: colors.textMuted,
  },
  activeTabText: {
    color: Colors.primary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    padding: 16,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  camperCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  camperInfo: {
    flex: 1,
  },
  camperName: {
    fontSize: 16,
    fontFamily: "Outfit_600SemiBold",
    color: colors.text,
  },
  camperSub: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: colors.textSecondary,
    marginTop: 2,
  },
  wristbandBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 4,
  },
  wristbandText: {
    fontSize: 11,
    fontFamily: "Outfit_500Medium",
    color: colors.textSecondary,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
  },
  medicalSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Outfit_700Bold",
    color: colors.text,
  },
  chipGrid: {
    gap: 12,
  },
  medicalChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
  },
  chipTop: {
    marginBottom: 4,
  },
  chipLabel: {
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
    color: colors.text,
  },
  chipSub: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: colors.textSecondary,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontFamily: "Outfit_700Bold",
    color: colors.text,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Outfit_500Medium",
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: "center",
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  activityText: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: colors.text,
  },
  activitySub: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: colors.textMuted,
    marginTop: 2,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: colors.textMuted,
  },
});
