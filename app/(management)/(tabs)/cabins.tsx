import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useData } from "@/contexts/DataContext";
import Colors from "@/constants/colors";
import { useColors } from "@/hooks/useColors";

interface CabinGroup {
  name: string;
  totalCampers: number;
  checkedInCount: number;
}

function CabinCard({ cabin }: { cabin: CabinGroup }) {
  const colors = useColors();
  const styles = getStyles(colors);
  const progress = cabin.totalCampers > 0 ? cabin.checkedInCount / cabin.totalCampers : 0;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 },
      ]}
      onPress={() => router.push(`/(management)/cabin/${encodeURIComponent(cabin.name)}`)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cabinIconContainer}>
          <Ionicons name="home" size={20} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cabinName, { color: colors.text }]}>{cabin.name}</Text>
          <Text style={[styles.cabinStats, { color: colors.textSecondary }]}>
            {cabin.checkedInCount} / {cabin.totalCampers} checked in
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </View>

      <View style={[styles.progressBarContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <View 
          style={[
            styles.progressBar, 
            { 
              width: `${progress * 100}%`,
              backgroundColor: progress === 1 ? Colors.success : Colors.primary 
            }
          ]} 
        />
      </View>
    </Pressable>
  );
}

export default function CabinsScreen() {
  const { campers, checkIns, isLoading } = useData();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = getStyles(colors);
  const [search, setSearch] = useState("");

  const cabins = useMemo(() => {
    const cabinMap = new Map<string, { total: number; checkedIn: number }>();
    
    campers.forEach((camper) => {
      const name = camper.cabinGroup?.trim();
      if (!name) return;
      
      const stats = cabinMap.get(name) || { total: 0, checkedIn: 0 };
      stats.total += 1;
      
      const isActive = checkIns.some(ci => ci.camperId === camper.id && !ci.checkedOutAt);
      if (isActive) {
        stats.checkedIn += 1;
      }
      
      cabinMap.set(name, stats);
    });

    return Array.from(cabinMap.entries())
      .map(([name, stats]) => ({
        name,
        totalCampers: stats.total,
        checkedInCount: stats.checkedIn,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [campers, checkIns]);

  const filteredCabins = cabins.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20) }]}>
        <Text style={[styles.title, { color: colors.text }]}>Cabins</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Cabin names are assigned through each camper's profile.
        </Text>
        
        <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search cabins..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={filteredCabins}
        keyExtractor={(item) => item.name}
        renderItem={({ item }) => <CabinCard cabin={item} />}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 100 }
        ]}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="home-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {search ? "No cabins match your search" : "No cabins yet\nAssign campers to cabin groups to get started"}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  title: {
    fontSize: 28,
    fontFamily: "Outfit_700Bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    fontFamily: "Outfit_400Regular",
  },
  listContent: {
    padding: 20,
    gap: 12,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "transparent",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  cabinIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + "15",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cabinName: {
    fontSize: 18,
    fontFamily: "Outfit_600SemiBold",
  },
  cabinStats: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
  },
  progressBarContainer: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 3,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    fontFamily: "Outfit_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
});
