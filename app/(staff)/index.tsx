import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Platform,
  Alert,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import Colors from "@/constants/colors";
import NFCScanner from "@/components/NFCScanner";
import type { Camper, WristbandPayload } from "@/types";

function CamperCheckInCard({
  camper,
  isCheckedIn,
  sessionId,
  checkInId,
  onCheckIn,
  onCheckOut,
}: {
  camper: Camper;
  isCheckedIn: boolean;
  sessionId: string;
  checkInId?: string;
  onCheckIn: () => void;
  onCheckOut: () => void;
}) {
  return (
    <View style={styles.camperCard}>
      <View style={styles.camperInfo}>
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
          <Text style={styles.camperName}>{camper.firstName} {camper.lastName}</Text>
          <Text style={styles.camperCabin}>{camper.cabinGroup || "No cabin"}</Text>
          {camper.medical.allergies && camper.medical.allergies.toLowerCase() !== "none" && (
            <View style={styles.allergyTag}>
              <Ionicons name="warning" size={11} color={Colors.danger} />
              <Text style={styles.allergyText}>
                Allergy: {camper.medical.allergies.slice(0, 30)}
                {camper.medical.allergies.length > 30 ? "..." : ""}
              </Text>
            </View>
          )}
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.actionButton,
          isCheckedIn
            ? styles.checkoutButton
            : styles.checkinButton,
          { opacity: pressed ? 0.85 : 1 },
        ]}
        onPress={isCheckedIn ? onCheckOut : onCheckIn}
      >
        <Ionicons
          name={isCheckedIn ? "log-out-outline" : "checkmark"}
          size={18}
          color="#fff"
        />
        <Text style={styles.actionButtonText}>
          {isCheckedIn ? "Check Out" : "Check In"}
        </Text>
      </Pressable>
    </View>
  );
}

export default function StaffCheckInScreen() {
  const { user, logout } = useAuth();
  const {
    campers,
    sessions,
    checkIns,
    canStaffCheckIn,
    getTodaySessions,
    checkInCamper,
    checkOutCamper,
    getActiveCheckIn,
    isLoading,
    refresh,
  } = useData();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [nfcScanVisible, setNfcScanVisible] = useState(false);

  const todaySessions = getTodaySessions();
  const activeSession = todaySessions[0];
  const canCheckIn = canStaffCheckIn();

  const filtered = campers.filter(
    (c) =>
      `${c.firstName} ${c.lastName}`
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      c.cabinGroup?.toLowerCase().includes(search.toLowerCase())
  );

  const handleCheckIn = async (camper: Camper) => {
    if (!activeSession) {
      Alert.alert("No Active Session", "There is no authorized session for today.");
      return;
    }
    Alert.alert(
      "Confirm Check-in",
      `Check in ${camper.firstName} ${camper.lastName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Check In",
          onPress: async () => {
            try {
              await checkInCamper(camper.id, activeSession.id);
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (err: any) {
              Alert.alert("Error", err.message);
            }
          },
        },
      ]
    );
  };

  const handleNfcPayload = (payload: WristbandPayload) => {
    setNfcScanVisible(false);
    const camper = campers.find((c) => c.id === payload.camperId);
    if (!camper) {
      Alert.alert(
        "Camper Not Found",
        `${payload.firstName} ${payload.lastName} is not registered in this CampSync system.`
      );
      return;
    }
    const activeCheckIn = getActiveCheckIn(camper.id);
    if (activeCheckIn) {
      handleCheckOut(camper, activeCheckIn.id);
    } else {
      handleCheckIn(camper);
    }
  };

  const handleCheckOut = async (camper: Camper, checkInId: string) => {
    Alert.alert(
      "Confirm Check-out",
      `Check out ${camper.firstName} ${camper.lastName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Check Out",
          onPress: async () => {
            try {
              await checkOutCamper(checkInId);
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (err: any) {
              Alert.alert("Error", err.message);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.light.background }}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20) },
        ]}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Welcome,</Text>
            <Text style={styles.name}>{user?.name}</Text>
          </View>
          <Pressable onPress={logout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={20} color={Colors.light.textSecondary} />
          </Pressable>
        </View>

        {!canCheckIn ? (
          <View style={styles.lockBanner}>
            <Ionicons name="lock-closed" size={18} color="#fff" />
            <Text style={styles.lockText}>
              Check-in is not authorized today. Contact management to schedule a session.
            </Text>
          </View>
        ) : (
          <View style={styles.sessionRow}>
            <View style={[styles.sessionBanner, { flex: 1 }]}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
              <Text style={styles.sessionText}>
                {activeSession?.name} — Active
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.nfcBtn,
                { opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={() => setNfcScanVisible(true)}
            >
              <Ionicons name="radio" size={20} color="#fff" />
            </Pressable>
          </View>
        )}

        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={18} color={Colors.light.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search campers..."
            placeholderTextColor={Colors.light.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color={Colors.light.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 100 },
        ]}
        scrollEnabled={!!filtered.length}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refresh}
            tintColor={Colors.primary}
          />
        }
        renderItem={({ item }) => {
          const activeCheckIn = getActiveCheckIn(item.id);
          return (
            <CamperCheckInCard
              camper={item}
              isCheckedIn={!!activeCheckIn}
              sessionId={activeSession?.id || ""}
              checkInId={activeCheckIn?.id}
              onCheckIn={() => handleCheckIn(item)}
              onCheckOut={() =>
                activeCheckIn
                  ? handleCheckOut(item, activeCheckIn.id)
                  : undefined
              }
            />
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={52} color={Colors.light.textMuted} />
            <Text style={styles.emptyTitle}>No campers found</Text>
            <Text style={styles.emptyText}>
              {search ? "Try a different search" : "Campers will appear here once added"}
            </Text>
          </View>
        }
      />

      {nfcScanVisible && (
        <NFCScanner
          visible={nfcScanVisible}
          mode="read"
          onPayloadRead={handleNfcPayload}
          onError={(msg) => {
            setNfcScanVisible(false);
            Alert.alert("NFC Error", msg);
          }}
          onCancel={() => setNfcScanVisible(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: Colors.light.background,
    gap: 12,
  },
  headerTop: {
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
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  lockBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.danger,
    borderRadius: 14,
    padding: 14,
  },
  lockText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Outfit_500Medium",
    color: "#fff",
    lineHeight: 18,
  },
  sessionRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "stretch",
  },
  sessionBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.success + "15",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.success + "30",
  },
  sessionText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.success,
  },
  nfcBtn: {
    width: 50,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Outfit_400Regular",
    fontSize: 15,
    color: Colors.light.text,
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 10,
  },
  camperCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 8,
  },
  camperInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 18,
    fontFamily: "Outfit_700Bold",
  },
  camperName: {
    fontSize: 16,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.light.text,
  },
  camperCabin: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  allergyTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  allergyText: {
    fontSize: 11,
    fontFamily: "Outfit_500Medium",
    color: Colors.danger,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 46,
    borderRadius: 12,
  },
  checkinButton: {
    backgroundColor: Colors.primary,
  },
  checkoutButton: {
    backgroundColor: Colors.danger,
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
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
  },
});
