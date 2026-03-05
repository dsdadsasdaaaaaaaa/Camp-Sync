import React, { useState, useMemo } from "react";
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
  Modal,
  ScrollView,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
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

function MedicalInfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  if (!value || value.toLowerCase() === "none" || value.trim() === "") return null;
  return (
    <View style={styles.medRow}>
      <View style={styles.medIconWrap}>
        <Ionicons name={icon} size={16} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.medLabel}>{label}</Text>
        <Text style={styles.medValue}>{value}</Text>
      </View>
    </View>
  );
}

function EmergencyLookupModal({
  visible,
  onClose,
  campers,
}: {
  visible: boolean;
  onClose: () => void;
  campers: Camper[];
}) {
  const insets = useSafeAreaInsets();
  const [emSearch, setEmSearch] = useState("");
  const [selectedCamper, setSelectedCamper] = useState<Camper | null>(null);

  const filtered = campers.filter(
    (c) =>
      `${c.firstName} ${c.lastName}`
        .toLowerCase()
        .includes(emSearch.toLowerCase()) ||
      c.cabinGroup?.toLowerCase().includes(emSearch.toLowerCase())
  );

  const handleClose = () => {
    setEmSearch("");
    setSelectedCamper(null);
    onClose();
  };

  const handleBack = () => {
    setSelectedCamper(null);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={[styles.modalContainer, { paddingTop: Platform.OS === "web" ? 67 : insets.top + 10 }]}>
        <View style={styles.modalHeader}>
          {selectedCamper ? (
            <Pressable onPress={handleBack} style={styles.modalBackBtn}>
              <Ionicons name="chevron-back" size={22} color={Colors.primary} />
            </Pressable>
          ) : (
            <View style={{ width: 36 }} />
          )}
          <Text style={styles.modalTitle}>
            {selectedCamper ? `${selectedCamper.firstName} ${selectedCamper.lastName}` : "Emergency Lookup"}
          </Text>
          <Pressable onPress={handleClose} style={styles.modalCloseBtn}>
            <Ionicons name="close" size={22} color={Colors.light.textSecondary} />
          </Pressable>
        </View>

        {!selectedCamper ? (
          <>
            <View style={styles.modalSearchContainer}>
              <Ionicons name="search-outline" size={18} color={Colors.light.textMuted} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search by name or cabin..."
                placeholderTextColor={Colors.light.textMuted}
                value={emSearch}
                onChangeText={setEmSearch}
                autoFocus
              />
              {emSearch.length > 0 && (
                <Pressable onPress={() => setEmSearch("")}>
                  <Ionicons name="close-circle" size={18} color={Colors.light.textMuted} />
                </Pressable>
              )}
            </View>
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 20 }}
              scrollEnabled={!!filtered.length}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [styles.emCamperRow, { opacity: pressed ? 0.7 : 1 }]}
                  onPress={() => setSelectedCamper(item)}
                >
                  <View style={[styles.emAvatar, { backgroundColor: Colors.accent + "20" }]}>
                    <Text style={[styles.avatarText, { color: Colors.accent }]}>
                      {item.firstName.charAt(0)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.camperName}>{item.firstName} {item.lastName}</Text>
                    <Text style={styles.camperCabin}>{item.cabinGroup || "No cabin"}</Text>
                  </View>
                  {item.medical.allergies && item.medical.allergies.toLowerCase() !== "none" && (
                    <View style={styles.emAllergyBadge}>
                      <Ionicons name="warning" size={12} color={Colors.danger} />
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={18} color={Colors.light.textMuted} />
                </Pressable>
              )}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons name="search" size={40} color={Colors.light.textMuted} />
                  <Text style={styles.emptyTitle}>No campers found</Text>
                  <Text style={styles.emptyText}>Try a different search term</Text>
                </View>
              }
            />
          </>
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.medSection}>
              <View style={styles.medSectionHeader}>
                <Ionicons name="alert-circle" size={18} color={Colors.danger} />
                <Text style={styles.medSectionTitle}>Allergies & Conditions</Text>
              </View>
              <View style={styles.medCard}>
                <MedicalInfoRow icon="warning-outline" label="Allergies" value={selectedCamper.medical.allergies} />
                <MedicalInfoRow icon="medkit-outline" label="Medications" value={selectedCamper.medical.medications} />
                <MedicalInfoRow icon="fitness-outline" label="Conditions" value={selectedCamper.medical.conditions} />
                <MedicalInfoRow icon="water-outline" label="Blood Type" value={selectedCamper.medical.bloodType} />
                {!selectedCamper.medical.allergies && !selectedCamper.medical.medications && !selectedCamper.medical.conditions && !selectedCamper.medical.bloodType && (
                  <Text style={styles.medNoData}>No medical alerts on file</Text>
                )}
              </View>
            </View>

            <View style={styles.medSection}>
              <View style={styles.medSectionHeader}>
                <Ionicons name="call" size={18} color={Colors.primary} />
                <Text style={styles.medSectionTitle}>Emergency Contact</Text>
              </View>
              <View style={styles.medCard}>
                {selectedCamper.medical.emergencyContacts?.length > 0 ? (
                  selectedCamper.medical.emergencyContacts.map((ec, i) => (
                    <View key={i}>
                      <MedicalInfoRow icon="person-outline" label={i === 0 ? "Contact Name" : `Contact ${i + 1}`} value={ec.name} />
                      {ec.relationship ? <MedicalInfoRow icon="people-outline" label="Relationship" value={ec.relationship} /> : null}
                      <MedicalInfoRow icon="call-outline" label="Phone" value={ec.phone} />
                      {ec.email ? <MedicalInfoRow icon="mail-outline" label="Email" value={ec.email} /> : null}
                    </View>
                  ))
                ) : (
                  <MedicalInfoRow icon="person-outline" label="Contact" value="None on file" />
                )}
              </View>
            </View>

            <View style={styles.medSection}>
              <View style={styles.medSectionHeader}>
                <Ionicons name="medical" size={18} color={Colors.accent} />
                <Text style={styles.medSectionTitle}>Doctor & Insurance</Text>
              </View>
              <View style={styles.medCard}>
                <MedicalInfoRow icon="person-circle-outline" label="Doctor" value={selectedCamper.medical.doctorName} />
                <MedicalInfoRow icon="call-outline" label="Doctor Phone" value={selectedCamper.medical.doctorPhone} />
                <MedicalInfoRow icon="shield-checkmark-outline" label="Insurance" value={selectedCamper.medical.insuranceProvider} />
              </View>
            </View>

            {selectedCamper.medical.notes && selectedCamper.medical.notes.toLowerCase() !== "none" && selectedCamper.medical.notes.trim() !== "" && (
              <View style={styles.medSection}>
                <View style={styles.medSectionHeader}>
                  <Ionicons name="document-text" size={18} color={Colors.warning} />
                  <Text style={styles.medSectionTitle}>Additional Notes</Text>
                </View>
                <View style={styles.medCard}>
                  <Text style={styles.medNotesText}>{selectedCamper.medical.notes}</Text>
                </View>
              </View>
            )}

            <View style={styles.medSection}>
              <View style={styles.medSectionHeader}>
                <Ionicons name="information-circle" size={18} color={Colors.light.textMuted} />
                <Text style={styles.medSectionTitle}>Camper Details</Text>
              </View>
              <View style={styles.medCard}>
                <MedicalInfoRow icon="calendar-outline" label="Date of Birth" value={selectedCamper.dateOfBirth} />
                <MedicalInfoRow icon="home-outline" label="Cabin" value={selectedCamper.cabinGroup} />
              </View>
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
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
    updateCamper,
    getActiveCheckIn,
    isLoading,
    refresh,
  } = useData();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [selectedCabin, setSelectedCabin] = useState<string | null>(null);
  const [nfcScanVisible, setNfcScanVisible] = useState(false);
  const [emergencyLookupVisible, setEmergencyLookupVisible] = useState(false);

  // Wristband-erase checkout state
  const [eraseTarget, setEraseTarget] = useState<{ camper: Camper; checkInId: string } | null>(null);
  const [eraseVisible, setEraseVisible] = useState(false);

  const todaySessions = getTodaySessions();
  const activeSession = todaySessions[0];
  const canCheckIn = canStaffCheckIn();

  const cabinGroups = useMemo(() => {
    const groups = campers.map((c) => c.cabinGroup).filter((g): g is string => !!g && g.trim() !== "");
    return [...new Set(groups)].sort();
  }, [campers]);

  const filtered = useMemo(() => campers.filter((c) => {
    const matchesSearch =
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      c.cabinGroup?.toLowerCase().includes(search.toLowerCase());
    const matchesCabin = !selectedCabin || c.cabinGroup === selectedCabin;
    return matchesSearch && matchesCabin;
  }), [campers, search, selectedCabin]);

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

  const handleCheckOut = async (camper: Camper, checkInId: string) => {
    if (camper.wristbandId) {
      // Camper has a wristband — require NFC erase first
      Alert.alert(
        "Check Out",
        `Check out ${camper.firstName} ${camper.lastName}? You'll need to scan their wristband to erase it.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Continue",
            onPress: () => {
              setEraseTarget({ camper, checkInId });
              setEraseVisible(true);
            },
          },
        ]
      );
    } else {
      // No wristband — direct checkout
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
    }
  };

  const handleEraseSuccess = async () => {
    setEraseVisible(false);
    if (!eraseTarget) return;
    const { camper, checkInId } = eraseTarget;
    try {
      await checkOutCamper(checkInId);
      await updateCamper(camper.id, {
        wristbandId: null as any,
        wristbandEncryptedData: null as any,
        wristbandLastProgrammed: null as any,
      });
      setEraseTarget(null);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Checked Out",
        `${camper.firstName} ${camper.lastName} has been checked out and their wristband has been erased. Their parent has been notified.`
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to complete check-out.");
    }
  };

  const handleNfcPayload = (payload: WristbandPayload) => {
    setNfcScanVisible(false);
    const camper = campers.find((c) => c.id === payload.camperId);
    if (!camper) {
      Alert.alert("Camper Not Found", "No camper found for this wristband. They may not be registered in the system.");
      return;
    }
    const activeCheckIn = getActiveCheckIn(camper.id);
    if (activeCheckIn) {
      handleCheckOut(camper, activeCheckIn.id);
    } else {
      handleCheckIn(camper);
    }
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
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => setEmergencyLookupVisible(true)}
              style={styles.emergencyButton}
            >
              <Ionicons name="medkit" size={18} color={Colors.danger} />
            </Pressable>
            <Pressable onPress={handleLogout} style={styles.logoutButton}>
              <Ionicons name="log-out-outline" size={20} color={Colors.light.textSecondary} />
            </Pressable>
          </View>
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

        {cabinGroups.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            <Pressable
              style={[styles.filterChip, { backgroundColor: !selectedCabin ? Colors.primary : Colors.light.surface, borderColor: !selectedCabin ? Colors.primary : Colors.light.border }]}
              onPress={() => setSelectedCabin(null)}
            >
              <Text style={[styles.filterChipText, { color: !selectedCabin ? "#fff" : Colors.light.textSecondary }]}>All</Text>
            </Pressable>
            {cabinGroups.map((cabin) => (
              <Pressable
                key={cabin}
                style={[styles.filterChip, { backgroundColor: selectedCabin === cabin ? Colors.primary : Colors.light.surface, borderColor: selectedCabin === cabin ? Colors.primary : Colors.light.border }]}
                onPress={() => setSelectedCabin(selectedCabin === cabin ? null : cabin)}
              >
                <Text style={[styles.filterChipText, { color: selectedCabin === cabin ? "#fff" : Colors.light.textSecondary }]}>{cabin}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
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

      {eraseVisible && eraseTarget && (
        <NFCScanner
          visible={eraseVisible}
          mode="erase"
          camperName={eraseTarget.camper.firstName}
          onEraseSuccess={handleEraseSuccess}
          onError={(msg) => {
            setEraseVisible(false);
            Alert.alert("Wristband Error", msg);
          }}
          onCancel={() => {
            setEraseVisible(false);
            setEraseTarget(null);
          }}
        />
      )}

      <EmergencyLookupModal
        visible={emergencyLookupVisible}
        onClose={() => setEmergencyLookupVisible(false)}
        campers={campers}
      />
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
  filterRow: {
    gap: 8,
    paddingRight: 4,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
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
    gap: 6,
    borderRadius: 10,
    height: 44,
  },
  checkinButton: {
    backgroundColor: Colors.primary,
  },
  checkoutButton: {
    backgroundColor: Colors.danger,
  },
  actionButtonText: {
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
    color: "#fff",
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  emergencyButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.danger + "15",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.danger + "30",
  },
  empty: {
    alignItems: "center",
    paddingTop: 60,
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
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.light.text,
  },
  modalBackBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    marginHorizontal: 20,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  modalSearchInput: {
    flex: 1,
    fontFamily: "Outfit_400Regular",
    fontSize: 15,
    color: Colors.light.text,
  },
  emCamperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  emAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  emAllergyBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.danger + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  medSection: {
    marginBottom: 20,
  },
  medSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  medSectionTitle: {
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.light.text,
  },
  medCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  medRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  medIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.primary + "12",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  medLabel: {
    fontSize: 11,
    fontFamily: "Outfit_500Medium",
    color: Colors.light.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  medValue: {
    fontSize: 15,
    fontFamily: "Outfit_500Medium",
    color: Colors.light.text,
    marginTop: 2,
  },
  medNoData: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textMuted,
    fontStyle: "italic",
  },
  medNotesText: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.text,
    lineHeight: 20,
  },
});
