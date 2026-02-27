import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Platform,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useData } from "@/contexts/DataContext";
import Colors from "@/constants/colors";
import type { PendingWristbandUpdate } from "@/types";

function PendingCard({
  update,
  camperName,
  onUpdate,
  onViewCamper,
}: {
  update: PendingWristbandUpdate;
  camperName: string;
  onUpdate: () => void;
  onViewCamper: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);

  const handleUpdate = async () => {
    router.push({
      pathname: "/(management)/camper/[id]",
      params: { id: update.camperId, autoProgram: "true" },
    });
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {update.camperName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.camperName}>{update.camperName}</Text>
          <Text style={styles.requestedBy}>
            Updated by {update.requestedByName}
          </Text>
          <Text style={styles.timeAgo}>
            {new Date(update.requestedAt).toLocaleString()}
          </Text>
        </View>
        <View style={styles.warningBadge}>
          <Ionicons name="warning" size={14} color={Colors.warning} />
          <Text style={styles.warningText}>Outdated</Text>
        </View>
      </View>

      <View style={styles.infoRow}>
        <Ionicons name="radio-outline" size={16} color={Colors.light.textMuted} />
        <Text style={styles.infoText}>
          The wristband was programmed before the latest info update. Reprogram to sync.
        </Text>
      </View>

      <View style={styles.buttonRow}>
        <Pressable
          style={({ pressed }) => [
            styles.viewButton,
            { opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={onViewCamper}
        >
          <Ionicons name="person-outline" size={16} color={Colors.light.textSecondary} />
          <Text style={styles.viewButtonText}>View Camper</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.updateButton,
            { opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={handleUpdate}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="radio" size={16} color="#fff" />
              <Text style={styles.updateButtonText}>Update Wristband</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function ResolvedCard({ update }: { update: PendingWristbandUpdate }) {
  return (
    <View style={[styles.card, styles.resolvedCard]}>
      <View style={styles.cardHeader}>
        <View style={[styles.avatar, { backgroundColor: Colors.success + "20" }]}>
          <Text style={[styles.avatarText, { color: Colors.success }]}>
            {update.camperName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.camperName}>{update.camperName}</Text>
          <Text style={styles.requestedBy}>
            Resolved by {update.resolvedByName}
          </Text>
          <Text style={styles.timeAgo}>
            {update.resolvedAt
              ? new Date(update.resolvedAt).toLocaleString()
              : ""}
          </Text>
        </View>
        <View style={[styles.warningBadge, { backgroundColor: Colors.success + "20" }]}>
          <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
          <Text style={[styles.warningText, { color: Colors.success }]}>Updated</Text>
        </View>
      </View>
    </View>
  );
}

export default function PendingUpdatesScreen() {
  const { pendingUpdates, campers, resolvePendingUpdate, isLoading, refresh } =
    useData();
  const insets = useSafeAreaInsets();
  const [showResolved, setShowResolved] = useState(false);

  const unresolved = pendingUpdates.filter((p) => !p.resolved);
  const resolved = pendingUpdates.filter((p) => p.resolved);

  const displayed = showResolved ? resolved : unresolved;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.light.background }}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20) },
        ]}
      >
        <Text style={styles.headerTitle}>Wristband Updates</Text>
        <Text style={styles.headerSub}>
          {unresolved.length} pending · {resolved.length} resolved
        </Text>

        <View style={styles.toggleRow}>
          <Pressable
            style={[styles.toggleBtn, !showResolved && styles.toggleBtnActive]}
            onPress={() => setShowResolved(false)}
          >
            <Text
              style={[
                styles.toggleBtnText,
                !showResolved && styles.toggleBtnActiveText,
              ]}
            >
              Pending ({unresolved.length})
            </Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, showResolved && styles.toggleBtnActive]}
            onPress={() => setShowResolved(true)}
          >
            <Text
              style={[
                styles.toggleBtnText,
                showResolved && styles.toggleBtnActiveText,
              ]}
            >
              Resolved ({resolved.length})
            </Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={displayed}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 100 },
        ]}
        scrollEnabled={!!displayed.length}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refresh}
            tintColor={Colors.primary}
          />
        }
        renderItem={({ item }) => {
          if (item.resolved) {
            return <ResolvedCard update={item} />;
          }
          return (
            <PendingCard
              update={item}
              camperName={item.camperName}
              onUpdate={() => resolvePendingUpdate(item.id)}
              onViewCamper={() =>
                router.push({
                  pathname: "/(management)/camper/[id]",
                  params: { id: item.camperId },
                })
              }
            />
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons
              name={showResolved ? "checkmark-circle-outline" : "radio-outline"}
              size={52}
              color={Colors.light.textMuted}
            />
            <Text style={styles.emptyTitle}>
              {showResolved ? "No resolved updates" : "All wristbands up to date"}
            </Text>
            <Text style={styles.emptyText}>
              {showResolved
                ? "Resolved updates will appear here"
                : "When camper info changes after check-in, updates will appear here"}
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
    paddingBottom: 16,
    backgroundColor: Colors.light.background,
    gap: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Outfit_700Bold",
    color: Colors.light.text,
  },
  headerSub: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textSecondary,
  },
  toggleRow: {
    flexDirection: "row",
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12,
    padding: 4,
    marginTop: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  toggleBtnActive: {
    backgroundColor: Colors.light.surface,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleBtnText: {
    fontSize: 14,
    fontFamily: "Outfit_500Medium",
    color: Colors.light.textMuted,
  },
  toggleBtnActiveText: {
    color: Colors.primary,
    fontFamily: "Outfit_600SemiBold",
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 12,
  },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    padding: 16,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1.5,
    borderColor: Colors.warning + "30",
    marginBottom: 4,
  },
  resolvedCard: {
    borderColor: Colors.success + "30",
    opacity: 0.85,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.warning + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 18,
    fontFamily: "Outfit_700Bold",
    color: Colors.warning,
  },
  camperName: {
    fontSize: 16,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.light.text,
  },
  requestedBy: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  timeAgo: {
    fontSize: 11,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textMuted,
    marginTop: 1,
  },
  warningBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.warning + "20",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  warningText: {
    fontSize: 11,
    fontFamily: "Outfit_700Bold",
    color: Colors.warning,
  },
  infoRow: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 10,
    padding: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textSecondary,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  viewButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.light.surfaceSecondary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  viewButtonText: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.light.textSecondary,
  },
  updateButton: {
    flex: 1.5,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  updateButtonText: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: "#fff",
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
    color: Colors.light.text,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textSecondary,
    textAlign: "center",
    paddingHorizontal: 20,
    lineHeight: 20,
  },
});
