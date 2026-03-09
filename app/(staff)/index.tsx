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
import { useColors } from "@/hooks/useColors";
import NFCScanner from "@/components/NFCScanner";
import { useSiren } from "@/lib/useSiren";
import type { Camper, WristbandPayload } from "@/types";

function medStr(value: any): string {
  if (!value) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

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
  const colors = useColors();
  const styles = getStyles(colors);
  return (
    <View style={[styles.camperCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
          <Text style={[styles.camperName, { color: colors.text }]}>{camper.firstName} {camper.lastName}</Text>
          <Text style={[styles.camperCabin, { color: colors.textSecondary }]}>{camper.cabinGroup || "No cabin"}</Text>
          {medStr(camper.medical.allergies) && medStr(camper.medical.allergies).toLowerCase() !== "none" && (
            <View style={[styles.allergyTag, { backgroundColor: Colors.danger + "10" }]}>
              <Ionicons name="warning" size={11} color={Colors.danger} />
              <Text style={styles.allergyText}>
                Allergy: {medStr(camper.medical.allergies).slice(0, 30)}
                {medStr(camper.medical.allergies).length > 30 ? "..." : ""}
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

function MedicalInfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: any }) {
  const colors = useColors();
  const styles = getStyles(colors);
  const strVal = medStr(value);
  if (!strVal || strVal.toLowerCase() === "none" || strVal.trim() === "") return null;
  return (
    <View style={styles.medRow}>
      <View style={[styles.medIconWrap, { backgroundColor: colors.surfaceSecondary }]}>
        <Ionicons name={icon} size={16} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.medLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.medValue, { color: colors.text }]}>{strVal}</Text>
      </View>
    </View>
  );
}

function EmergencyLookupModal({
  visible,
  onClose,
  campers,
  selectedCabin,
}: {
  visible: boolean;
  onClose: () => void;
  campers: Camper[];
  selectedCabin: string | null;
}) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = getStyles(colors);
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
      <View style={[styles.modalContainer, { paddingTop: Platform.OS === "web" ? 67 : insets.top + 10, backgroundColor: colors.background }]}>
        <View style={styles.modalHeader}>
          {selectedCamper ? (
            <Pressable onPress={handleBack} style={styles.modalBackBtn}>
              <Ionicons name="chevron-back" size={22} color={Colors.primary} />
            </Pressable>
          ) : (
            <View style={{ width: 36 }} />
          )}
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            {selectedCamper ? `${selectedCamper.firstName} ${selectedCamper.lastName}` : "Emergency Lookup"}
          </Text>
          <Pressable onPress={handleClose} style={styles.modalCloseBtn}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        {!selectedCamper ? (
          <>
            <View style={[styles.modalSearchContainer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <Ionicons name="search-outline" size={18} color={colors.textMuted} />
              <TextInput
                style={[styles.modalSearchInput, { color: colors.text }]}
                placeholder="Search by name or cabin..."
                placeholderTextColor={colors.textMuted}
                value={emSearch}
                onChangeText={setEmSearch}
                autoFocus
              />
              {emSearch.length > 0 && (
                <Pressable onPress={() => setEmSearch("")}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
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
                  style={({ pressed }) => [styles.emCamperRow, { opacity: pressed ? 0.7 : 1, borderBottomColor: colors.border }]}
                  onPress={() => setSelectedCamper(item)}
                >
                  <View style={[styles.emAvatar, { backgroundColor: Colors.accent + "20" }]}>
                    <Text style={[styles.avatarText, { color: Colors.accent }]}>
                      {item.firstName.charAt(0)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.camperName, { color: colors.text }]}>{item.firstName} {item.lastName}</Text>
                    <Text style={[styles.camperCabin, { color: colors.textSecondary }]}>{item.cabinGroup || "No cabin"}</Text>
                  </View>
                  {medStr(item.medical.allergies) && medStr(item.medical.allergies).toLowerCase() !== "none" && (
                    <View style={styles.emAllergyBadge}>
                      <Ionicons name="warning" size={12} color={Colors.danger} />
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              )}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons name="search" size={40} color={colors.textMuted} />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>No campers found</Text>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Try a different search term</Text>
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
                <Text style={[styles.medSectionTitle, { color: colors.text }]}>Allergies & Conditions</Text>
              </View>
              <View style={[styles.medCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <MedicalInfoRow icon="warning-outline" label="Allergies" value={selectedCamper.medical.allergies} />
                <MedicalInfoRow icon="medkit-outline" label="Medications" value={selectedCamper.medical.medications} />
                <MedicalInfoRow icon="fitness-outline" label="Conditions" value={selectedCamper.medical.conditions} />
                <MedicalInfoRow icon="water-outline" label="Blood Type" value={selectedCamper.medical.bloodType} />
                {!selectedCamper.medical.allergies && !selectedCamper.medical.medications && !selectedCamper.medical.conditions && !selectedCamper.medical.bloodType && (
                  <Text style={[styles.medNoData, { color: colors.textMuted }]}>No medical alerts on file</Text>
                )}
              </View>
            </View>

            <View style={styles.medSection}>
              <View style={styles.medSectionHeader}>
                <Ionicons name="call" size={18} color={Colors.primary} />
                <Text style={[styles.medSectionTitle, { color: colors.text }]}>Emergency Contact</Text>
              </View>
              <View style={[styles.medCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
                <Text style={[styles.medSectionTitle, { color: colors.text }]}>Doctor & Insurance</Text>
              </View>
              <View style={[styles.medCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <MedicalInfoRow icon="person-circle-outline" label="Doctor" value={selectedCamper.medical.doctorName} />
                <MedicalInfoRow icon="call-outline" label="Doctor Phone" value={selectedCamper.medical.doctorPhone} />
                <MedicalInfoRow icon="shield-checkmark-outline" label="Insurance" value={selectedCamper.medical.insuranceProvider} />
              </View>
            </View>

            {medStr(selectedCamper.medical.notes) && medStr(selectedCamper.medical.notes).toLowerCase() !== "none" && (
              <View style={styles.medSection}>
                <View style={styles.medSectionHeader}>
                  <Ionicons name="document-text" size={18} color={Colors.warning} />
                  <Text style={[styles.medSectionTitle, { color: colors.text }]}>Additional Notes</Text>
                </View>
                <View style={[styles.medCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.medNotesText, { color: colors.text }]}>{medStr(selectedCamper.medical.notes)}</Text>
                </View>
              </View>
            )}

            <View style={styles.medSection}>
              <View style={styles.medSectionHeader}>
                <Ionicons name="information-circle" size={18} color={colors.textMuted} />
                <Text style={[styles.medSectionTitle, { color: colors.text }]}>Camper Details</Text>
              </View>
              <View style={[styles.medCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <MedicalInfoRow icon="calendar-outline" label="Date of Birth" value={selectedCamper.dateOfBirth} />
                <MedicalInfoRow icon="home-outline" label="Cabin" value={selectedCabin || selectedCamper.cabinGroup} />
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
    broadcasts,
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
  const colors = useColors();
  const styles = getStyles(colors);
  const activeEmergency = broadcasts.find((b) => b.emergencyActive);
  useSiren(!!activeEmergency);
  const [search, setSearch] = useState("");
  const [selectedCabin, setSelectedCabin] = useState<string | null>(null);
  const [nfcScanVisible, setNfcScanVisible] = useState(false);
  const [emergencyLookupVisible, setEmergencyLookupVisible] = useState(false);

  // Wristband-erase checkout state
  const [eraseTarget, setEraseTarget] = useState<{ camper: Camper; checkInId: string; notes?: string } | null>(null);
  const [eraseVisible, setEraseVisible] = useState(false);

  // Notes confirm modal
  const [noteModal, setNoteModal] = useState<{
    visible: boolean;
    title: string;
    subtitle: string;
    actionLabel: string;
    noteText: string;
    onConfirm: (note: string) => void;
  }>({
    visible: false,
    title: "",
    subtitle: "",
    actionLabel: "Confirm",
    noteText: "",
    onConfirm: () => {},
  });

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
    setNoteModal({
      visible: true,
      title: "Check In",
      subtitle: `${camper.firstName} ${camper.lastName}`,
      actionLabel: "Check In",
      noteText: "",
      onConfirm: async (note) => {
        try {
          await checkInCamper(camper.id, activeSession.id, note || undefined);
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err: any) {
          Alert.alert("Error", err.message);
        }
      },
    });
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
      // Camper has a wristband — collect note first, then erase
      setNoteModal({
        visible: true,
        title: "Check Out",
        subtitle: `${camper.firstName} ${camper.lastName} — wristband will be erased`,
        actionLabel: "Proceed",
        noteText: "",
        onConfirm: (note) => {
          setEraseTarget({ camper, checkInId, notes: note || undefined });
          setEraseVisible(true);
        },
      });
    } else {
      // No wristband — direct checkout with note
      setNoteModal({
        visible: true,
        title: "Check Out",
        subtitle: `${camper.firstName} ${camper.lastName}`,
        actionLabel: "Check Out",
        noteText: "",
        onConfirm: async (note) => {
          try {
            await checkOutCamper(checkInId, note || undefined);
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (err: any) {
            Alert.alert("Error", err.message);
          }
        },
      });
    }
  };

  const handleEraseSuccess = async () => {
    setEraseVisible(false);
    if (!eraseTarget) return;
    const { camper, checkInId, notes } = eraseTarget;
    try {
      await checkOutCamper(checkInId, notes);
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
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={[
          styles.header,
          { paddingTop: Platform.OS === "web" ? 67 : insets.top + 20, backgroundColor: colors.background },
        ]}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>Welcome,</Text>
            <Text style={[styles.name, { color: colors.text }]}>{user?.name}</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => setEmergencyLookupVisible(true)}
              style={[styles.emergencyButton, { backgroundColor: Colors.danger + "10" }]}
            >
              <Ionicons name="medkit" size={18} color={Colors.danger} />
            </Pressable>
            <Pressable onPress={handleLogout} style={[styles.logoutButton, { backgroundColor: colors.surfaceSecondary }]}>
              <Ionicons name="log-out-outline" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        {activeEmergency && (
          <View style={[styles.lockBanner, { backgroundColor: Colors.danger, flexDirection: "row", gap: 8 }]}>
            <Ionicons name="warning" size={18} color="#fff" />
            <Text style={styles.lockText}>{activeEmergency.title}</Text>
          </View>
        )}

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

        <View style={[styles.searchContainer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
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

        {cabinGroups.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            <Pressable
              style={[styles.filterChip, { backgroundColor: !selectedCabin ? Colors.primary : colors.surface, borderColor: !selectedCabin ? Colors.primary : colors.border }]}
              onPress={() => setSelectedCabin(null)}
            >
              <Text style={[styles.filterChipText, { color: !selectedCabin ? "#fff" : colors.textSecondary }]}>All</Text>
            </Pressable>
            {cabinGroups.map((cabin) => (
              <Pressable
                key={cabin}
                style={[styles.filterChip, { backgroundColor: selectedCabin === cabin ? Colors.primary : colors.surface, borderColor: selectedCabin === cabin ? Colors.primary : colors.border }]}
                onPress={() => setSelectedCabin(selectedCabin === cabin ? null : cabin)}
              >
                <Text style={[styles.filterChipText, { color: selectedCabin === cabin ? "#fff" : colors.textSecondary }]}>{cabin}</Text>
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
            <Ionicons name="people-outline" size={52} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No campers found</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
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
        selectedCabin={selectedCabin}
      />

      <Modal
        visible={noteModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setNoteModal((m) => ({ ...m, visible: false }))}
      >
        <View style={styles.noteOverlay}>
          <View style={[styles.noteSheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.noteTitle, { color: colors.text }]}>{noteModal.title}</Text>
            <Text style={[styles.noteSubtitle, { color: colors.textSecondary }]}>{noteModal.subtitle}</Text>
            <TextInput
              style={[styles.noteInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="Add a note (optional)"
              placeholderTextColor={colors.textMuted}
              value={noteModal.noteText}
              onChangeText={(t) => setNoteModal((m) => ({ ...m, noteText: t }))}
              multiline
              numberOfLines={3}
              maxLength={200}
            />
            <Text style={[styles.noteCharCount, { color: colors.textMuted }]}>{noteModal.noteText.length}/200</Text>
            <View style={styles.noteActions}>
              <Pressable
                style={[styles.noteBtn, styles.noteBtnCancel, { borderColor: colors.border }]}
                onPress={() => setNoteModal((m) => ({ ...m, visible: false, noteText: "" }))}
              >
                <Text style={[styles.noteBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.noteBtn, styles.noteBtnConfirm, { backgroundColor: Colors.primary }]}
                onPress={() => {
                  const note = noteModal.noteText.trim();
                  const fn = noteModal.onConfirm;
                  setNoteModal((m) => ({ ...m, visible: false, noteText: "" }));
                  fn(note);
                }}
              >
                <Text style={[styles.noteBtnText, { color: "#fff" }]}>{noteModal.actionLabel}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
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
  },
  name: {
    fontSize: 26,
    fontFamily: "Outfit_700Bold",
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    borderRadius: 16,
    padding: 14,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 8,
    borderWidth: 1,
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
    color: colors.text,
  },
  camperCabin: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: colors.textSecondary,
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
    color: colors.text,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: colors.textSecondary,
    textAlign: "center",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: "Outfit_600SemiBold",
    color: colors.text,
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
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    marginHorizontal: 20,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalSearchInput: {
    flex: 1,
    fontFamily: "Outfit_400Regular",
    fontSize: 15,
    color: colors.text,
  },
  emCamperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    color: colors.text,
  },
  medCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  medValue: {
    fontSize: 15,
    fontFamily: "Outfit_500Medium",
    color: colors.text,
    marginTop: 2,
  },
  medNoData: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: colors.textMuted,
    fontStyle: "italic",
  },
  medNotesText: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: colors.text,
    lineHeight: 20,
  },
  noteOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  noteSheet: {
    width: "100%",
    borderRadius: 20,
    padding: 24,
    gap: 12,
  },
  noteTitle: {
    fontSize: 20,
    fontFamily: "Outfit_700Bold",
  },
  noteSubtitle: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    marginTop: -6,
  },
  noteInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    minHeight: 80,
    textAlignVertical: "top",
  },
  noteCharCount: {
    fontSize: 11,
    fontFamily: "Outfit_400Regular",
    textAlign: "right",
    marginTop: -6,
  },
  noteActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  noteBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  noteBtnCancel: {
    borderWidth: 1.5,
  },
  noteBtnConfirm: {},
  noteBtnText: {
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
  },
});
