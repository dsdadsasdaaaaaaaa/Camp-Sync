import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Platform,
  Alert,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useData } from "@/contexts/DataContext";
import { useColors } from "@/hooks/useColors";
import Colors from "@/constants/colors";
import type { Camper } from "@/types";

function CamperCard({
  camper,
  isCheckedIn,
  hasPendingUpdate,
  onPress,
  onDelete,
}: {
  camper: Camper;
  isCheckedIn: boolean;
  hasPendingUpdate: boolean;
  onPress: () => void;
  onDelete: () => void;
}) {
  const colors = useColors();
  return (
    <View style={[styles.camperCard, { backgroundColor: colors.surface }]}>
      <Pressable
        style={({ pressed }) => [
          styles.camperCardContent,
          { opacity: pressed ? 0.85 : 1 },
        ]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`View ${camper.firstName} ${camper.lastName}`}
        testID={`camper-card-${camper.id}`}
      >
        <View style={[styles.camperAvatar, { backgroundColor: Colors.primary + "20" }]}>
          {camper.photoData ? (
            <Image
              source={{ uri: camper.photoData }}
              style={styles.camperAvatarImg}
            />
          ) : (
            <Text style={[styles.camperInitial, { color: Colors.primary }]}>
              {camper.firstName.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.camperNameRow}>
            <Text style={[styles.camperName, { color: colors.text }]}>
              {camper.firstName} {camper.lastName}
            </Text>
            {hasPendingUpdate && (
              <Ionicons name="warning" size={14} color={Colors.warning} />
            )}
          </View>
          <Text style={[styles.camperCabin, { color: colors.textSecondary }]}>{camper.cabinGroup || "No cabin assigned"}</Text>
          <View style={styles.camperTags}>
            <View
              style={[
                styles.tag,
                {
                  backgroundColor: isCheckedIn
                    ? Colors.success + "20"
                    : colors.surfaceSecondary,
                },
              ]}
            >
              <View
                style={[
                  styles.tagDot,
                  {
                    backgroundColor: isCheckedIn
                      ? Colors.success
                      : colors.textMuted,
                  },
                ]}
              />
              <Text
                style={[
                  styles.tagText,
                  {
                    color: isCheckedIn
                      ? Colors.success
                      : colors.textSecondary,
                  },
                ]}
              >
                {isCheckedIn ? "Checked In" : "Not Present"}
              </Text>
            </View>
            {camper.wristbandId && (
              <View style={[styles.tag, { backgroundColor: Colors.primary + "15" }]}>
                <Ionicons name="radio" size={10} color={Colors.primary} />
                <Text style={[styles.tagText, { color: Colors.primary }]}>
                  {camper.wristbandId}
                </Text>
              </View>
            )}
          </View>
        </View>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={colors.textMuted}
        />
      </Pressable>
      <Pressable
        onPress={onDelete}
        style={({ pressed }) => [
          styles.deleteButton,
          { opacity: pressed ? 0.7 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${camper.firstName} ${camper.lastName}`}
        hitSlop={4}
      >
        <Ionicons name="trash-outline" size={16} color={Colors.danger} />
      </Pressable>
    </View>
  );
}

export default function CampersScreen() {
  const { campers, checkIns, pendingUpdates, deleteCamper, isLoading, refresh } = useData();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    return campers.filter((c) => {
      return (
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        c.cabinGroup?.toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [campers, search]);

  const getActiveCheckIn = (camperId: string) =>
    checkIns.find((ci) => ci.camperId === camperId && !ci.checkedOutAt);

  const hasPendingUpdate = (camperId: string) =>
    pendingUpdates.some((p) => p.camperId === camperId && !p.resolved);

  const handleDelete = useCallback(
    (camper: Camper) => {
      Alert.alert(
        "Delete Camper",
        `Remove ${camper.firstName} ${camper.lastName} from the system? This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              await deleteCamper(camper.id);
            },
          },
        ]
      );
    },
    [deleteCamper]
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20), backgroundColor: colors.background },
        ]}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Campers</Text>
            <Text style={[styles.headerSub, { color: colors.textSecondary }]}>{campers.length} registered</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.addButton, { opacity: pressed ? 0.85 : 1 }]}
            onPress={() => router.push("/(management)/camper/new")}
          >
            <Ionicons name="add" size={22} color="#fff" />
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        </View>

        <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search campers..."
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
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        scrollEnabled={!!filtered.length}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={Colors.primary} />
        }
        renderItem={({ item }) => (
          <CamperCard
            camper={item}
            isCheckedIn={!!getActiveCheckIn(item.id)}
            hasPendingUpdate={hasPendingUpdate(item.id)}
            onPress={() => router.push(`/(management)/camper/${item.id}`)}
            onDelete={() => handleDelete(item)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={52} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {search ? "No campers found" : "No campers yet"}
            </Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {search ? "Try a different search" : "Add campers using the button above"}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Outfit_700Bold",
  },
  headerSub: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    marginTop: 2,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Outfit_400Regular",
    fontSize: 15,
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 10,
  },
  camperCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    paddingRight: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 8,
  },
  camperCardContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
    borderRadius: 16,
  },
  camperAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  camperAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  camperInitial: {
    fontSize: 20,
    fontFamily: "Outfit_700Bold",
  },
  camperNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  camperName: {
    fontSize: 16,
    fontFamily: "Outfit_600SemiBold",
  },
  camperCabin: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    marginTop: 2,
  },
  camperTags: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
    flexWrap: "wrap",
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  tagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tagText: {
    fontSize: 11,
    fontFamily: "Outfit_600SemiBold",
  },
  deleteButton: {
    padding: 10,
    borderRadius: 10,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Outfit_600SemiBold",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    textAlign: "center",
  },
});
