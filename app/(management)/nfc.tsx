import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useData } from "@/contexts/DataContext";
import Colors from "@/constants/colors";
import NFCScanner from "@/components/NFCScanner";
import type { Camper, WristbandPayload } from "@/types";

type Screen = "home" | "selectCamper" | "readResult";

export default function NFCScreen() {
  const { campers, checkIns, programWristband, checkOutCamper, updateCamper } = useData();
  const insets = useSafeAreaInsets();
  const [screen, setScreen] = useState<Screen>("home");
  const [readScanVisible, setReadScanVisible] = useState(false);
  const [writeScanVisible, setWriteScanVisible] = useState(false);
  const [selectedCamper, setSelectedCamper] = useState<Camper | null>(null);
  const [writePayload, setWritePayload] = useState<WristbandPayload | null>(null);
  const [readResult, setReadResult] = useState<WristbandPayload | null>(null);
  const [camperSearch, setCamperSearch] = useState("");

  const programmedWristbands = campers.filter(
    (c) => c.wristbandId && c.wristbandEncryptedData
  );

  const filteredCampers = campers.filter((c) =>
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(camperSearch.toLowerCase())
  );

  const handleStartRead = () => {
    setReadScanVisible(true);
  };

  const handleStartWrite = () => {
    if (!selectedCamper) {
      Alert.alert("Select Camper", "Please select a camper first.");
      return;
    }
    const payload: WristbandPayload = {
      camperId: selectedCamper.id,
      firstName: selectedCamper.firstName,
      lastName: selectedCamper.lastName,
      dateOfBirth: selectedCamper.dateOfBirth,
      medical: selectedCamper.medical,
      programmedAt: new Date().toISOString(),
      appVersion: "1.0",
    };
    setWritePayload(payload);
    setWriteScanVisible(true);
  };

  const handleWriteSuccess = async () => {
    setWriteScanVisible(false);
    if (!selectedCamper) return;
    try {
      await programWristband(selectedCamper.id);
      Alert.alert(
        "Wristband Programmed",
        `${selectedCamper.firstName} ${selectedCamper.lastName}'s wristband now contains their encrypted profile and medical data. It can be read offline anywhere. They have also been checked into camp automatically.`,
        [{ text: "Done", onPress: resetAll }]
      );
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const handlePayloadRead = (payload: WristbandPayload) => {
    setReadScanVisible(false);
    setReadResult(payload);
    setScreen("readResult");
  };

  const handleCheckOut = async () => {
    if (!readResult) return;
    const camper = campers.find(c => c.id === readResult.camperId);
    if (!camper) {
      Alert.alert("Error", "Camper not found in system.");
      return;
    }

    const activeCheckIn = checkIns.find(ci => ci.camperId === camper.id && !ci.checkedOutAt);
    if (!activeCheckIn) {
      Alert.alert("Error", "Camper is not currently checked in.");
      return;
    }

    setReadScanVisible(false);
    setWriteScanVisible(true);
  };

  const handleEraseSuccess = async () => {
    setWriteScanVisible(false);
    if (!readResult) return;
    const camper = campers.find(c => c.id === readResult.camperId);
    if (!camper) return;

    const activeCheckIn = checkIns.find(ci => ci.camperId === camper.id && !ci.checkedOutAt);
    if (!activeCheckIn) return;

    try {
      await checkOutCamper(activeCheckIn.id);
      // Clear wristband data in DB too
      await updateCamper(camper.id, {
        wristbandId: null as any,
        wristbandEncryptedData: null as any,
        wristbandLastProgrammed: null as any
      });
      
      Alert.alert("Checked Out", `${camper.firstName} has been checked out and their wristband has been erased.`);
      resetAll();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to complete check-out.");
    }
  };

  const resetAll = () => {
    setScreen("home");
    setSelectedCamper(null);
    setWritePayload(null);
    setReadResult(null);
    setCamperSearch("");
    setReadScanVisible(false);
    setWriteScanVisible(false);
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
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.headerTitle}>NFC Wristband</Text>
      <Text style={styles.headerSub}>Program or scan encrypted wristbands</Text>

      {screen === "home" && (
        <>
          <View style={styles.modeGrid}>
            <Pressable
              style={({ pressed }) => [
                styles.modeCard,
                { opacity: pressed ? 0.85 : 1, borderColor: Colors.primary + "40" },
              ]}
              onPress={() => setScreen("selectCamper")}
            >
              <View style={[styles.modeIcon, { backgroundColor: Colors.primary + "15" }]}>
                <Ionicons name="create" size={28} color={Colors.primary} />
              </View>
              <Text style={styles.modeTitle}>Program</Text>
              <Text style={styles.modeSub}>Write camper data to wristband</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.modeCard,
                { opacity: pressed ? 0.85 : 1, borderColor: Colors.accent + "40" },
              ]}
              onPress={handleStartRead}
            >
              <View style={[styles.modeIcon, { backgroundColor: Colors.accent + "15" }]}>
                <Ionicons name="radio" size={28} color={Colors.accent} />
              </View>
              <Text style={styles.modeTitle}>Scan</Text>
              <Text style={styles.modeSub}>Read wristband data offline</Text>
            </Pressable>
          </View>

          <View style={styles.statsCard}>
            <View style={styles.statRow}>
              <View style={[styles.statIcon, { backgroundColor: Colors.success + "15" }]}>
                <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.statLabel}>Programmed Wristbands</Text>
                <Text style={styles.statValue}>{programmedWristbands.length} of {campers.length}</Text>
              </View>
            </View>
            <View style={styles.statRow}>
              <View style={[styles.statIcon, { backgroundColor: Colors.warning + "15" }]}>
                <Ionicons name="alert-circle" size={20} color={Colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.statLabel}>Not Yet Programmed</Text>
                <Text style={styles.statValue}>{campers.length - programmedWristbands.length}</Text>
              </View>
            </View>
          </View>

          <View style={styles.offlineCard}>
            <Ionicons name="cloud-offline" size={20} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.offlineTitle}>Offline-First NFC</Text>
              <Text style={styles.offlineText}>
                All camper data is encrypted and written directly to the NFC wristband tag. Scanning works anywhere — no internet required. Medical info and emergency contacts are always accessible.
              </Text>
            </View>
          </View>
        </>
      )}

      {screen === "selectCamper" && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Select Camper</Text>
          <Text style={styles.cardSub}>
            Their encrypted data will be written directly onto the NFC wristband
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Search campers..."
            placeholderTextColor={Colors.light.textMuted}
            value={camperSearch}
            onChangeText={setCamperSearch}
          />
          {campers.length === 0 && (
            <Text style={[styles.cardSub, { textAlign: "center", paddingVertical: 16 }]}>
              No campers registered yet.
            </Text>
          )}
          {filteredCampers.slice(0, 8).map((camper) => (
            <Pressable
              key={camper.id}
              style={[
                styles.camperOption,
                selectedCamper?.id === camper.id && styles.camperOptionSelected,
              ]}
              onPress={() => setSelectedCamper(camper)}
            >
              <View style={styles.camperAvatar}>
                <Text style={styles.camperInitial}>
                  {camper.firstName.charAt(0)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.camperName}>
                  {camper.firstName} {camper.lastName}
                </Text>
                <Text style={styles.camperSub}>
                  {camper.cabinGroup || "No cabin"}
                  {camper.wristbandId ? " · Wristband active" : " · No wristband"}
                </Text>
              </View>
              {camper.wristbandId && (
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>Active</Text>
                </View>
              )}
              {selectedCamper?.id === camper.id && (
                <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
              )}
            </Pressable>
          ))}
          <View style={styles.buttonRow}>
            <Pressable
              style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.8 : 1 }]}
              onPress={resetAll}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.primaryBtn,
                !selectedCamper && styles.disabledBtn,
                { opacity: pressed && selectedCamper ? 0.85 : 1 },
              ]}
              onPress={handleStartWrite}
              disabled={!selectedCamper}
            >
              <Ionicons name="radio" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Program Wristband</Text>
            </Pressable>
          </View>
        </View>
      )}

      {screen === "readResult" && readResult && (
        <View style={styles.card}>
          <View style={styles.successHeader}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={36} color={Colors.success} />
            </View>
            <Text style={styles.successTitle}>Wristband Scanned</Text>
            <Text style={styles.successSub}>Read from NFC tag · Offline</Text>
          </View>

          <View style={styles.camperBanner}>
            <Text style={styles.camperBannerName}>
              {readResult.firstName} {readResult.lastName}
            </Text>
            <Text style={styles.camperBannerDob}>DOB: {readResult.dateOfBirth || "—"}</Text>
          </View>

          <View style={styles.bloodHighlight}>
            <Ionicons name="water" size={22} color={Colors.danger} />
            <View>
              <Text style={styles.bloodLabel}>Blood Type</Text>
              <Text style={styles.bloodValue}>{readResult.medical?.bloodType || "Unknown"}</Text>
            </View>
          </View>

          <View style={styles.dataSection}>
            <Text style={styles.dataSectionTitle}>Emergency Contact</Text>
            {readResult.medical?.emergencyContacts?.length > 0 ? (
              readResult.medical.emergencyContacts.map((ec, i) => (
                <View key={i} style={i > 0 ? { marginTop: 8 } : undefined}>
                  <Text style={styles.dataValue}>{ec.name || "—"}</Text>
                  {ec.relationship ? <Text style={styles.dataValueSec}>{ec.relationship}</Text> : null}
                  <Text style={styles.dataValueSec}>{ec.phone || "—"}</Text>
                  {ec.email ? <Text style={styles.dataValueSec}>{ec.email}</Text> : null}
                </View>
              ))
            ) : (
              <Text style={styles.dataValue}>—</Text>
            )}
          </View>

          <View style={styles.dataSection}>
            <Text style={styles.dataSectionTitle}>Allergies</Text>
            <Text style={[
              styles.dataValue,
              readResult.medical?.allergies && readResult.medical.allergies.toLowerCase() !== "none"
                ? { color: Colors.danger }
                : {},
            ]}>
              {readResult.medical?.allergies || "None reported"}
            </Text>
          </View>

          <View style={styles.dataSection}>
            <Text style={styles.dataSectionTitle}>Medications</Text>
            <Text style={styles.dataValue}>{readResult.medical?.medications || "None reported"}</Text>
          </View>

          <View style={styles.dataSection}>
            <Text style={styles.dataSectionTitle}>Medical Conditions</Text>
            <Text style={styles.dataValue}>{readResult.medical?.conditions || "None reported"}</Text>
          </View>

          <View style={[styles.dataSection, { borderBottomWidth: 0 }]}>
            <View style={styles.serverNote}>
              <Ionicons name="cloud-outline" size={13} color={Colors.light.textMuted} />
              <Text style={styles.serverNoteText}>
                Doctor, insurance &amp; notes are stored in server records only
              </Text>
            </View>
          </View>

          <Text style={styles.programmedAt}>
            Encrypted: {readResult.programmedAt ? new Date(readResult.programmedAt).toLocaleString() : "—"}
          </Text>

          <View style={{ gap: 10 }}>
            <Pressable
              style={({ pressed }) => [styles.checkOutBtn, { opacity: pressed ? 0.85 : 1 }]}
              onPress={handleCheckOut}
            >
              <Ionicons name="log-out" size={18} color="#fff" />
              <Text style={styles.checkOutBtnText}>Check Out Camper</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.85 : 1, backgroundColor: Colors.light.surfaceSecondary, borderWidth: 1, borderColor: Colors.light.border }]}
              onPress={handleStartRead}
            >
              <Ionicons name="radio" size={18} color={Colors.light.textSecondary} />
              <Text style={[styles.primaryBtnText, { color: Colors.light.textSecondary }]}>Scan Another</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.8 : 1 }]}
              onPress={resetAll}
            >
              <Text style={styles.cancelBtnText}>Done</Text>
            </Pressable>
          </View>
        </View>
      )}

      {readScanVisible && (
        <NFCScanner
          visible={readScanVisible}
          mode="read"
          onPayloadRead={handlePayloadRead}
          onError={(msg) => {
            setReadScanVisible(false);
            Alert.alert("Scan Error", msg);
          }}
          onCancel={() => setReadScanVisible(false)}
        />
      )}

      {writeScanVisible && readResult && (
        <NFCScanner
          visible={writeScanVisible}
          mode="write"
          writePayload={{} as any} // Erase by writing empty
          writeCamper={campers.find(c => c.id === readResult.camperId) as any}
          onWriteSuccess={handleEraseSuccess}
          onError={(msg) => {
            setWriteScanVisible(false);
            Alert.alert("Erase Error", msg);
          }}
          onCancel={() => setWriteScanVisible(false)}
        />
      )}

      {writeScanVisible && selectedCamper && writePayload && !readResult && (
        <NFCScanner
          visible={writeScanVisible}
          mode="write"
          writePayload={writePayload}
          writeCamper={selectedCamper}
          onWriteSuccess={handleWriteSuccess}
          onError={(msg) => {
            setWriteScanVisible(false);
            Alert.alert("Write Error", msg);
          }}
          onCancel={() => setWriteScanVisible(false)}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    gap: 16,
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
    marginTop: -8,
  },
  modeGrid: {
    flexDirection: "row",
    gap: 12,
  },
  modeCard: {
    flex: 1,
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    gap: 10,
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  modeIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  modeTitle: {
    fontSize: 16,
    fontFamily: "Outfit_700Bold",
    color: Colors.light.text,
    textAlign: "center",
  },
  modeSub: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textSecondary,
    textAlign: "center",
  },
  statsCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statLabel: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textSecondary,
  },
  statValue: {
    fontSize: 16,
    fontFamily: "Outfit_700Bold",
    color: Colors.light.text,
  },
  offlineCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: Colors.primary + "08",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.primary + "20",
  },
  offlineTitle: {
    fontSize: 14,
    fontFamily: "Outfit_700Bold",
    color: Colors.primary,
    marginBottom: 4,
  },
  offlineText: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textSecondary,
    lineHeight: 18,
  },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    padding: 20,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 20,
    fontFamily: "Outfit_700Bold",
    color: Colors.light.text,
  },
  cardSub: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textSecondary,
    marginTop: -6,
  },
  input: {
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 14,
    height: 50,
    fontFamily: "Outfit_400Regular",
    fontSize: 15,
    color: Colors.light.text,
  },
  camperOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  camperOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + "08",
  },
  camperAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  camperInitial: {
    fontSize: 16,
    fontFamily: "Outfit_700Bold",
    color: Colors.primary,
  },
  camperName: {
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.light.text,
  },
  camperSub: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textSecondary,
  },
  activeBadge: {
    backgroundColor: Colors.success + "15",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeBadgeText: {
    fontSize: 11,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.success,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  cancelBtnText: {
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.light.textSecondary,
  },
  primaryBtn: {
    flex: 2,
    height: 50,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  primaryBtnText: {
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
    color: "#fff",
  },
  disabledBtn: {
    backgroundColor: Colors.light.textMuted,
  },
  successHeader: {
    alignItems: "center",
    gap: 8,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.success + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    fontSize: 20,
    fontFamily: "Outfit_700Bold",
    color: Colors.success,
  },
  successSub: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textSecondary,
  },
  camperBanner: {
    backgroundColor: Colors.primary + "10",
    borderRadius: 14,
    padding: 16,
  },
  camperBannerName: {
    fontSize: 22,
    fontFamily: "Outfit_700Bold",
    color: Colors.primary,
  },
  camperBannerDob: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 4,
  },
  bloodHighlight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.danger + "10",
    borderRadius: 14,
    padding: 14,
  },
  bloodLabel: {
    fontSize: 12,
    fontFamily: "Outfit_500Medium",
    color: Colors.light.textSecondary,
  },
  bloodValue: {
    fontSize: 26,
    fontFamily: "Outfit_700Bold",
    color: Colors.danger,
  },
  dataSection: {
    gap: 4,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  dataSectionTitle: {
    fontSize: 11,
    fontFamily: "Outfit_700Bold",
    color: Colors.light.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  dataValue: {
    fontSize: 15,
    fontFamily: "Outfit_500Medium",
    color: Colors.light.text,
  },
  dataValueSec: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textSecondary,
  },
  programmedAt: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textMuted,
    textAlign: "center",
  },
  checkOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.danger,
    borderRadius: 14,
    height: 52,
  },
  checkOutBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Outfit_600SemiBold",
  },
  serverNote: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
  },
  serverNoteText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textMuted,
    fontStyle: "italic" as const,
  },
});
