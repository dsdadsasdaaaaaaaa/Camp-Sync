import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import NFCScanner from "@/components/NFCScanner";
import { useData } from "@/contexts/DataContext";
import type { WristbandPayload } from "@/types";

type Screen = "home" | "readResult" | "checkoutResult";

export default function StaffNFCScreen() {
  const insets = useSafeAreaInsets();
  const { campers, checkIns, checkOutCamper, updateCamper } = useData();
  const [screen, setScreen] = useState<Screen>("home");
  const [scannerVisible, setScannerVisible] = useState(false);
  const [checkoutScanVisible, setCheckoutScanVisible] = useState(false);
  const [eraseScanVisible, setEraseScanVisible] = useState(false);
  const [result, setResult] = useState<WristbandPayload | null>(null);

  const checkedInCount = campers.filter((c) => {
    return checkIns.some(ci => ci.camperId === c.id && !ci.checkedOutAt);
  }).length;

  const handleStartScan = () => {
    setResult(null);
    setScannerVisible(true);
  };

  const handleStartCheckoutScan = () => {
    setResult(null);
    setCheckoutScanVisible(true);
  };

  const handlePayloadRead = (payload: WristbandPayload) => {
    setScannerVisible(false);
    setResult(payload);
    setScreen("readResult");
  };

  const handleCheckoutPayloadRead = (payload: WristbandPayload) => {
    setCheckoutScanVisible(false);
    setResult(payload);
    setScreen("checkoutResult");
  };

  const handleCheckOutFromRead = async () => {
    if (!result) return;
    const camper = campers.find(c => c.id === result.camperId);
    if (!camper) {
      Alert.alert("Error", "Camper not found in system.");
      return;
    }

    const activeCheckIn = checkIns.find(ci => ci.camperId === camper.id && !ci.checkedOutAt);
    if (!activeCheckIn) {
      Alert.alert("Error", "Camper is not currently checked in.");
      return;
    }

    setEraseScanVisible(true);
  };

  const handleEraseSuccess = async () => {
    setEraseScanVisible(false);
    if (!result) return;
    const camper = campers.find(c => c.id === result.camperId);
    if (!camper) return;

    const activeCheckIn = checkIns.find(ci => ci.camperId === camper.id && !ci.checkedOutAt);
    if (!activeCheckIn) return;

    try {
      await checkOutCamper(activeCheckIn.id);
      await updateCamper(camper.id, {
        wristbandId: null as any,
        wristbandEncryptedData: null as any,
        wristbandLastProgrammed: null as any,
      });
      Alert.alert("Checked Out", `${camper.firstName} has been checked out and their wristband has been erased.`);
      resetAll();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to complete check-out.");
    }
  };

  const resetAll = () => {
    setScreen("home");
    setResult(null);
    setScannerVisible(false);
    setCheckoutScanVisible(false);
    setEraseScanVisible(false);
  };

  const getCamperCheckInStatus = (camperId: string) => {
    return checkIns.some(ci => ci.camperId === camperId && !ci.checkedOutAt);
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
    >
      <Text style={styles.title}>Wristband Management</Text>
      <Text style={styles.subtitle}>
        Scan wristbands to view medical info or check out campers
      </Text>

      {screen === "home" && (
        <>
          <View style={styles.modeGrid}>
            <Pressable
              style={({ pressed }) => [
                styles.modeCard,
                { opacity: pressed ? 0.85 : 1, borderColor: Colors.accent + "40" },
              ]}
              onPress={handleStartScan}
            >
              <View style={[styles.modeIcon, { backgroundColor: Colors.accent + "15" }]}>
                <Ionicons name="radio" size={28} color={Colors.accent} />
              </View>
              <Text style={styles.modeTitle}>Scan</Text>
              <Text style={styles.modeSub}>Read wristband data offline</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.modeCard,
                { opacity: pressed ? 0.85 : 1, borderColor: Colors.danger + "40" },
              ]}
              onPress={handleStartCheckoutScan}
            >
              <View style={[styles.modeIcon, { backgroundColor: Colors.danger + "15" }]}>
                <Ionicons name="log-out" size={28} color={Colors.danger} />
              </View>
              <Text style={styles.modeTitle}>Check Out</Text>
              <Text style={styles.modeSub}>Scan to check out & erase</Text>
            </Pressable>
          </View>

          <View style={styles.infoCard}>
            <Ionicons name="cloud-offline" size={18} color={Colors.primary} />
            <Text style={styles.infoText}>
              All camper data is encrypted on the tag. {checkedInCount} campers currently checked in.
            </Text>
          </View>

          <View style={styles.instructionCard}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.light.textSecondary} />
            <Text style={styles.instructionText}>
              Staff can read and check out wristbands during designated times. Contact management to program new wristbands.
            </Text>
          </View>
        </>
      )}

      {screen === "readResult" && result && (
        <View style={styles.card}>
          <View style={styles.successHeader}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={32} color={Colors.success} />
            </View>
            <Text style={styles.successTitle}>Wristband Data</Text>
            <Text style={styles.offlineLabel}>Read from NFC tag · Offline</Text>
          </View>

          <View style={styles.camperBanner}>
            <Text style={styles.camperBannerName}>
              {result.firstName} {result.lastName}
            </Text>
            <Text style={styles.camperBannerDob}>
              DOB: {result.dateOfBirth || "—"}
            </Text>
          </View>

          <View style={styles.bloodHighlight}>
            <Ionicons name="water" size={22} color={Colors.danger} />
            <View>
              <Text style={styles.bloodLabel}>Blood Type</Text>
              <Text style={styles.bloodValue}>
                {result.medical?.bloodType || "Unknown"}
              </Text>
            </View>
          </View>

          <View style={styles.dataSection}>
            <Text style={styles.dataSectionTitle}>Emergency Contact</Text>
            {result.medical?.emergencyContacts?.length > 0 ? (
              result.medical.emergencyContacts.map((ec: any, i: number) => (
                <View key={i} style={i > 0 ? { marginTop: 8 } : undefined}>
                  <Text style={styles.dataValue}>{ec.name || "—"}</Text>
                  {ec.relationship ? (
                    <Text style={styles.dataValueSec}>{ec.relationship}</Text>
                  ) : null}
                  <Text style={styles.dataValueSec}>{ec.phone || "—"}</Text>
                  {ec.email ? (
                    <Text style={styles.dataValueSec}>{ec.email}</Text>
                  ) : null}
                </View>
              ))
            ) : (
              <Text style={styles.dataValue}>—</Text>
            )}
          </View>

          <View style={styles.dataSection}>
            <Text style={styles.dataSectionTitle}>Allergies</Text>
            <Text
              style={[
                styles.dataValue,
                result.medical?.allergies &&
                result.medical.allergies.toLowerCase() !== "none"
                  ? { color: Colors.danger, fontFamily: "Outfit_700Bold" }
                  : {},
              ]}
            >
              {result.medical?.allergies || "None reported"}
            </Text>
          </View>

          <View style={styles.dataSection}>
            <Text style={styles.dataSectionTitle}>Medications</Text>
            <Text style={styles.dataValue}>
              {result.medical?.medications || "None reported"}
            </Text>
          </View>

          <View style={styles.dataSection}>
            <Text style={styles.dataSectionTitle}>Medical Conditions</Text>
            <Text style={styles.dataValue}>
              {result.medical?.conditions || "None reported"}
            </Text>
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
            Tag programmed:{" "}
            {result.programmedAt
              ? new Date(result.programmedAt).toLocaleString()
              : "—"}
          </Text>

          <View style={{ gap: 10 }}>
            <Pressable
              style={({ pressed }) => [
                styles.checkOutBtn,
                { opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={handleCheckOutFromRead}
            >
              <Ionicons name="log-out" size={18} color="#fff" />
              <Text style={styles.checkOutText}>Check Out Camper</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.scanAgainBtn,
                { opacity: pressed ? 0.85 : 1, backgroundColor: Colors.light.surfaceSecondary, borderWidth: 1, borderColor: Colors.light.border },
              ]}
              onPress={handleStartScan}
            >
              <Ionicons name="radio" size={18} color={Colors.light.textSecondary} />
              <Text style={[styles.scanAgainText, { color: Colors.light.textSecondary }]}>Scan Another Wristband</Text>
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

      {screen === "checkoutResult" && result && (
        <View style={styles.card}>
          <View style={styles.successHeader}>
            <View style={[styles.successIcon, { backgroundColor: Colors.danger + "15" }]}>
              <Ionicons name="log-out" size={32} color={Colors.danger} />
            </View>
            <Text style={[styles.successTitle, { color: Colors.danger }]}>Check Out</Text>
            <Text style={styles.offlineLabel}>Confirm checkout and erase wristband</Text>
          </View>

          <View style={styles.camperBanner}>
            <Text style={styles.camperBannerName}>
              {result.firstName} {result.lastName}
            </Text>
            <Text style={styles.camperBannerDob}>DOB: {result.dateOfBirth || "—"}</Text>
          </View>

          <View style={styles.instructionCard}>
            <Ionicons name="information-circle" size={18} color={Colors.light.textSecondary} />
            <Text style={styles.instructionText}>
              This will check out the camper and erase their wristband data.
            </Text>
          </View>

          <View style={{ gap: 10 }}>
            <Pressable
              style={({ pressed }) => [
                styles.checkOutBtn,
                !getCamperCheckInStatus(result.camperId) && styles.disabledBtn,
                { opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={handleCheckOutFromRead}
              disabled={!getCamperCheckInStatus(result.camperId)}
            >
              <Ionicons name="log-out" size={18} color="#fff" />
              <Text style={styles.checkOutText}>
                {getCamperCheckInStatus(result.camperId) ? "Erase & Check Out" : "Not Checked In"}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.8 : 1 }]}
              onPress={resetAll}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}

      {scannerVisible && (
        <NFCScanner
          visible={scannerVisible}
          mode="read"
          onPayloadRead={handlePayloadRead}
          onError={(msg) => {
            setScannerVisible(false);
            Alert.alert("Scan Error", msg);
          }}
          onCancel={() => setScannerVisible(false)}
        />
      )}

      {checkoutScanVisible && (
        <NFCScanner
          visible={checkoutScanVisible}
          mode="read"
          onPayloadRead={handleCheckoutPayloadRead}
          onError={(msg) => {
            setCheckoutScanVisible(false);
            Alert.alert("Scan Error", msg);
          }}
          onCancel={() => setCheckoutScanVisible(false)}
        />
      )}

      {eraseScanVisible && result && (
        <NFCScanner
          visible={eraseScanVisible}
          mode="erase"
          camperName={result.firstName}
          onEraseSuccess={handleEraseSuccess}
          onError={(msg) => {
            setEraseScanVisible(false);
            Alert.alert("Erase Error", msg);
          }}
          onCancel={() => setEraseScanVisible(false)}
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
  title: {
    fontSize: 28,
    fontFamily: "Outfit_700Bold",
    color: Colors.light.text,
  },
  subtitle: {
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
  infoCard: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: Colors.primary + "10",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.primary + "20",
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textSecondary,
    lineHeight: 18,
  },
  instructionCard: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12,
    padding: 12,
    alignSelf: "stretch",
  },
  instructionText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textSecondary,
    lineHeight: 17,
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
  successHeader: {
    alignItems: "center",
    gap: 6,
  },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.success + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    fontSize: 20,
    fontFamily: "Outfit_700Bold",
    color: Colors.success,
  },
  offlineLabel: {
    fontSize: 12,
    fontFamily: "Outfit_500Medium",
    color: Colors.light.textMuted,
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
  serverNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  serverNoteText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textMuted,
    fontStyle: "italic" as const,
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
  checkOutText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Outfit_600SemiBold",
  },
  scanAgainBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 52,
    marginTop: 4,
  },
  scanAgainText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Outfit_600SemiBold",
  },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 14,
    height: 52,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  cancelBtnText: {
    fontSize: 16,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.light.textSecondary,
  },
  disabledBtn: {
    backgroundColor: Colors.light.textMuted,
  },
});
