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
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useData } from "@/contexts/DataContext";
import Colors from "@/constants/colors";
import { useColors } from "@/hooks/useColors";
import NFCScanner from "@/components/NFCScanner";
import type { Camper, WristbandPayload } from "@/types";

type Screen = "home" | "selectCamper" | "selectCheckout" | "readResult" | "confirmCheckout" | "step2Checkin" | "step2Checkout";

export default function NFCScreen() {
  const { campers, checkIns, programWristband, checkOutCamper, updateCamper, checkInCamper, getTodaySessions } = useData();
  const [manualCheckInLoading, setManualCheckInLoading] = useState(false);
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = getStyles(colors);
  const [screen, setScreen] = useState<Screen>("home");
  const [readScanVisible, setReadScanVisible] = useState(false);
  const [writeScanVisible, setWriteScanVisible] = useState(false);
  const [lockScanVisible, setLockScanVisible] = useState(false);
  const [unlockScanVisible, setUnlockScanVisible] = useState(false);
  const [eraseScanVisible, setEraseScanVisible] = useState(false);
  const [selectedCamper, setSelectedCamper] = useState<Camper | null>(null);
  const [writePayload, setWritePayload] = useState<WristbandPayload | null>(null);
  const [readResult, setReadResult] = useState<WristbandPayload | null>(null);
  const [camperSearch, setCamperSearch] = useState("");

  // Checkout-specific state
  const [checkoutCamper, setCheckoutCamper] = useState<Camper | null>(null);
  const [checkoutSearch, setCheckoutSearch] = useState("");
  const [manualOverrideLoading, setManualOverrideLoading] = useState(false);

  const programmedWristbands = campers.filter((c) => c.wristbandId && c.wristbandEncryptedData);

  const filteredCampers = campers.filter((c) =>
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(camperSearch.toLowerCase())
  );

  // Only checked-in campers can be checked out
  const checkedInCampers = campers.filter((c) =>
    checkIns.some((ci) => ci.camperId === c.id && !ci.checkedOutAt)
  );

  const filteredCheckoutCampers = checkedInCampers.filter((c) =>
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(checkoutSearch.toLowerCase()) ||
    c.cabinGroup?.toLowerCase().includes(checkoutSearch.toLowerCase())
  );

  const getCamperCheckInStatus = (camperId: string) =>
    checkIns.some((ci) => ci.camperId === camperId && !ci.checkedOutAt);

  // ── Manual Check-In (no NFC) ──────────────────────────────────────────────
  const handleManualCheckIn = async () => {
    if (!selectedCamper) { Alert.alert("Select Camper", "Please select a camper first."); return; }
    const isAlreadyCheckedIn = checkIns.some((ci) => ci.camperId === selectedCamper.id && !ci.checkedOutAt);
    if (isAlreadyCheckedIn) { Alert.alert("Already Checked In", `${selectedCamper.firstName} is already checked in.`); return; }
    const todaySessions = getTodaySessions();
    const sessionId = todaySessions.length > 0 ? todaySessions[0].id : "MANAGEMENT_OVERRIDE";
    Alert.alert(
      "Manual Check-In",
      `Check in ${selectedCamper.firstName} ${selectedCamper.lastName} without an NFC wristband?${!todaySessions.length ? "\n\nNo session is scheduled today — management override will be used." : ""}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Check In",
          onPress: async () => {
            setManualCheckInLoading(true);
            try {
              await checkInCamper(selectedCamper.id, sessionId);
              Alert.alert("Checked In", `${selectedCamper.firstName} ${selectedCamper.lastName} has been manually checked in.`);
              resetAll();
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to check in.");
            } finally {
              setManualCheckInLoading(false);
            }
          },
        },
      ]
    );
  };

  // ── Check In ───────────────────────────────────────────────────────────────
  const handleStartWrite = () => {
    if (!selectedCamper) { Alert.alert("Select Camper", "Please select a camper first."); return; }
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

  const handleWriteSuccess = () => {
    setWriteScanVisible(false);
    setScreen("step2Checkin");
  };

  const handleStartLock = () => {
    setLockScanVisible(true);
  };

  const handleLockSuccess = async () => {
    setLockScanVisible(false);
    if (!selectedCamper) return;
    try {
      await programWristband(selectedCamper.id);
      Alert.alert(
        "Wristband Programmed & Locked",
        `${selectedCamper.firstName} ${selectedCamper.lastName}'s wristband is programmed, locked, and they've been checked in automatically.`,
        [{ text: "Done", onPress: resetAll }]
      );
    } catch (err: any) { Alert.alert("Error", err.message); }
  };

  // ── Scan Only ──────────────────────────────────────────────────────────────
  const handlePayloadRead = (payload: WristbandPayload) => {
    setReadScanVisible(false);
    setReadResult(payload);
    setScreen("readResult");
  };

  // ── Checkout — select camper first ────────────────────────────────────────
  const handleOpenCheckoutPicker = () => {
    setCheckoutSearch("");
    setScreen("selectCheckout");
  };

  const handleSelectCheckoutCamper = (camper: Camper) => {
    setCheckoutCamper(camper);
    setScreen("confirmCheckout");
  };

  const handleStartErase = () => {
    if (!checkoutCamper) return;
    const activeCheckIn = checkIns.find((ci) => ci.camperId === checkoutCamper.id && !ci.checkedOutAt);
    if (!activeCheckIn) { Alert.alert("Error", "Camper is not currently checked in."); return; }
    // Step 1: unlock the wristband first
    setUnlockScanVisible(true);
  };

  const handleUnlockSuccess = () => {
    setUnlockScanVisible(false);
    setScreen("step2Checkout");
  };

  const handleStartErase2 = () => {
    setEraseScanVisible(true);
  };

  const handleEraseSuccess = async () => {
    setEraseScanVisible(false);
    if (!checkoutCamper) return;
    const activeCheckIn = checkIns.find((ci) => ci.camperId === checkoutCamper.id && !ci.checkedOutAt);
    if (!activeCheckIn) return;
    try {
      await checkOutCamper(activeCheckIn.id);
      await updateCamper(checkoutCamper.id, {
        wristbandId: null as any,
        wristbandEncryptedData: null as any,
        wristbandLastProgrammed: null as any,
      });
      Alert.alert("Checked Out", `${checkoutCamper.firstName} has been checked out and their wristband erased.`);
      resetAll();
    } catch (err: any) { Alert.alert("Error", err.message || "Failed to complete check-out."); }
  };

  // Management-only: checkout without scanning wristband
  const handleManualOverride = async () => {
    if (!checkoutCamper) return;
    const activeCheckIn = checkIns.find((ci) => ci.camperId === checkoutCamper.id && !ci.checkedOutAt);
    if (!activeCheckIn) { Alert.alert("Error", "Camper is not currently checked in."); return; }

    Alert.alert(
      "Manual Override",
      `Check out ${checkoutCamper.firstName} ${checkoutCamper.lastName} without scanning a wristband?\n\nTheir wristband record (if any) will also be cleared.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Override & Check Out",
          style: "destructive",
          onPress: async () => {
            setManualOverrideLoading(true);
            try {
              await checkOutCamper(activeCheckIn.id);
              if (checkoutCamper.wristbandId) {
                await updateCamper(checkoutCamper.id, {
                  wristbandId: null as any,
                  wristbandEncryptedData: null as any,
                  wristbandLastProgrammed: null as any,
                });
              }
              Alert.alert("Checked Out", `${checkoutCamper.firstName} has been manually checked out.`);
              resetAll();
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to complete check-out.");
            } finally {
              setManualOverrideLoading(false);
            }
          },
        },
      ]
    );
  };

  // ── Scan-and-read checkout (from "Scan Only" readResult screen) ────────────
  const handleCheckOutFromRead = () => {
    if (!readResult) return;
    const camper = campers.find((c) => c.id === readResult.camperId);
    if (!camper) { Alert.alert("Error", "Camper not found."); return; }
    const activeCheckIn = checkIns.find((ci) => ci.camperId === camper.id && !ci.checkedOutAt);
    if (!activeCheckIn) { Alert.alert("Error", "Camper is not currently checked in."); return; }
    setCheckoutCamper(camper);
    setScreen("confirmCheckout");
  };

  const resetAll = () => {
    setScreen("home");
    setSelectedCamper(null);
    setWritePayload(null);
    setReadResult(null);
    setCamperSearch("");
    setCheckoutCamper(null);
    setCheckoutSearch("");
    setReadScanVisible(false);
    setWriteScanVisible(false);
    setLockScanVisible(false);
    setUnlockScanVisible(false);
    setEraseScanVisible(false);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20), paddingBottom: insets.bottom + 100 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.headerTitle}>Check In / Out</Text>
      <Text style={styles.headerSub}>Manage camper wristbands and attendance</Text>

      {/* ── HOME ── */}
      {screen === "home" && (
        <>
          <View style={styles.modeGrid}>
            <Pressable
              style={({ pressed }) => [styles.modeCard, { opacity: pressed ? 0.85 : 1, borderColor: Colors.primary + "40" }]}
              onPress={() => setScreen("selectCamper")}
            >
              <View style={[styles.modeIcon, { backgroundColor: Colors.primary + "15" }]}>
                <Ionicons name="create" size={28} color={Colors.primary} />
              </View>
              <Text style={styles.modeTitle}>Check In</Text>
              <Text style={styles.modeSub}>Program & check in camper</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.modeCard, { opacity: pressed ? 0.85 : 1, borderColor: Colors.danger + "40" }]}
              onPress={handleOpenCheckoutPicker}
            >
              <View style={[styles.modeIcon, { backgroundColor: Colors.danger + "15" }]}>
                <Ionicons name="log-out" size={28} color={Colors.danger} />
              </View>
              <Text style={styles.modeTitle}>Check Out</Text>
              <Text style={styles.modeSub}>Select camper to check out</Text>
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [styles.scanOnlyCard, { opacity: pressed ? 0.85 : 1 }]}
            onPress={() => setReadScanVisible(true)}
          >
            <View style={styles.checkoutCardLeft}>
              <View style={[styles.modeIcon, { backgroundColor: Colors.accent + "15" }]}>
                <Ionicons name="radio" size={28} color={Colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.checkoutCardTitle}>Scan Only</Text>
                <Text style={styles.checkoutCardSub}>Read wristband data offline without changes</Text>
              </View>
            </View>
          </Pressable>

          <View style={styles.statsCard}>
            <View style={styles.statRow}>
              <View style={[styles.statIcon, { backgroundColor: Colors.success + "15" }]}>
                <Ionicons name="radio" size={20} color={Colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.statLabel}>NFC Wristbands</Text>
                <Text style={[styles.statValue, { color: colors.textSecondary }]}>
                  {programmedWristbands.length} of {campers.length} programmed
                </Text>
              </View>
            </View>
            <View style={styles.statRow}>
              <View style={[styles.statIcon, { backgroundColor: Colors.primary + "15" }]}>
                <Ionicons name="people" size={20} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.statLabel}>Currently at Camp</Text>
                <Text style={[styles.statValue, { color: colors.textSecondary }]}>
                  {checkedInCampers.length} checked in
                  {checkedInCampers.filter((c) => c.wristbandId).length > 0
                    ? ` · ${checkedInCampers.filter((c) => c.wristbandId).length} with NFC`
                    : ""}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.offlineCard}>
            <Ionicons name="cloud-offline" size={20} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.offlineTitle}>Offline-First NFC</Text>
              <Text style={styles.offlineText}>
                All camper data is encrypted and written directly to the NFC wristband. Medical info and emergency contacts are always accessible — no internet required.
              </Text>
            </View>
          </View>
        </>
      )}

      {/* ── SELECT CAMPER (CHECK IN) ── */}
      {screen === "selectCamper" && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Check In Camper</Text>
          <Text style={styles.cardSub}>Their encrypted data will be written to the NFC wristband</Text>
          <TextInput
            style={styles.input}
            placeholder="Search campers..."
            placeholderTextColor={colors.textMuted}
            value={camperSearch}
            onChangeText={setCamperSearch}
          />
          {campers.length === 0 && (
            <Text style={[styles.cardSub, { textAlign: "center", paddingVertical: 16 }]}>No campers registered yet.</Text>
          )}
          {filteredCampers.slice(0, 8).map((camper) => (
            <Pressable
              key={camper.id}
              style={[styles.camperOption, selectedCamper?.id === camper.id && styles.camperOptionSelected]}
              onPress={() => setSelectedCamper(camper)}
            >
              <View style={styles.camperAvatar}>
                <Text style={styles.camperInitial}>{camper.firstName.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.camperName}>{camper.firstName} {camper.lastName}</Text>
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
            <Pressable style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.8 : 1 }]} onPress={resetAll}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, !selectedCamper && styles.disabledBtn, { opacity: pressed && selectedCamper ? 0.85 : 1 }]}
              onPress={handleStartWrite}
              disabled={!selectedCamper}
            >
              <Ionicons name="radio" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>NFC Check In</Text>
            </Pressable>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.cancelBtn,
              { opacity: pressed ? 0.8 : 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
              !selectedCamper && styles.disabledBtn,
            ]}
            onPress={handleManualCheckIn}
            disabled={!selectedCamper || manualCheckInLoading}
          >
            {manualCheckInLoading ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Ionicons name="hand-left-outline" size={16} color={Colors.primary} />
            )}
            <Text style={[styles.cancelBtnText, { color: Colors.primary }]}>Manual Override (No NFC)</Text>
          </Pressable>
        </View>
      )}

      {/* ── SELECT CAMPER (CHECK OUT) ── */}
      {screen === "selectCheckout" && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Check Out Camper</Text>
          <Text style={styles.cardSub}>Select a checked-in camper to begin the check-out process</Text>
          <TextInput
            style={styles.input}
            placeholder="Search by name or cabin..."
            placeholderTextColor={colors.textMuted}
            value={checkoutSearch}
            onChangeText={setCheckoutSearch}
          />
          {checkedInCampers.length === 0 && (
            <Text style={[styles.cardSub, { textAlign: "center", paddingVertical: 16 }]}>No campers are currently checked in.</Text>
          )}
          {filteredCheckoutCampers.slice(0, 8).map((camper) => (
            <Pressable
              key={camper.id}
              style={({ pressed }) => [styles.camperOption, { opacity: pressed ? 0.85 : 1 }]}
              onPress={() => handleSelectCheckoutCamper(camper)}
            >
              <View style={[styles.camperAvatar, { backgroundColor: Colors.danger + "20" }]}>
                <Text style={[styles.camperInitial, { color: Colors.danger }]}>{camper.firstName.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.camperName}>{camper.firstName} {camper.lastName}</Text>
                <Text style={styles.camperSub}>
                  {camper.cabinGroup || "No cabin"}
                  {camper.wristbandId ? " · Wristband active" : " · No wristband"}
                </Text>
              </View>
              {camper.wristbandId ? (
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>NFC</Text>
                </View>
              ) : (
                <View style={[styles.activeBadge, { backgroundColor: Colors.warning + "20" }]}>
                  <Text style={[styles.activeBadgeText, { color: Colors.warning }]}>Manual</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          ))}
          {filteredCheckoutCampers.length === 0 && checkoutSearch.length > 0 && (
            <Text style={[styles.cardSub, { textAlign: "center", paddingVertical: 12 }]}>No results for "{checkoutSearch}"</Text>
          )}
          <View style={styles.buttonRow}>
            <Pressable style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.8 : 1 }]} onPress={resetAll}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── CONFIRM CHECKOUT ── */}
      {screen === "confirmCheckout" && checkoutCamper && (
        <View style={styles.card}>
          <View style={styles.successHeader}>
            <View style={[styles.successIcon, { backgroundColor: Colors.danger + "15" }]}>
              <Ionicons name="log-out" size={36} color={Colors.danger} />
            </View>
            <Text style={[styles.successTitle, { color: Colors.danger }]}>Check Out</Text>
            <Text style={styles.successSub}>
              {checkoutCamper.wristbandId ? "Erase wristband to confirm" : "No wristband — use manual override"}
            </Text>
          </View>

          <View style={styles.camperBanner}>
            <Text style={styles.camperBannerName}>{checkoutCamper.firstName} {checkoutCamper.lastName}</Text>
            {checkoutCamper.cabinGroup ? (
              <Text style={styles.camperBannerDob}>{checkoutCamper.cabinGroup}</Text>
            ) : null}
            <View style={[styles.statusPill, { backgroundColor: Colors.success + "15", marginTop: 8 }]}>
              <View style={[styles.statusDot, { backgroundColor: Colors.success }]} />
              <Text style={[styles.statusPillText, { color: Colors.success }]}>Currently Checked In</Text>
            </View>
          </View>

          <View style={styles.checkoutInfo}>
            <Ionicons name="information-circle" size={18} color={colors.textSecondary} />
            <Text style={styles.checkoutInfoText}>
              {checkoutCamper.wristbandId
                ? "Scan and erase the wristband to check this camper out. Their parent will be notified automatically."
                : "This camper has no active wristband. Use Manual Override to check them out without a scan."}
            </Text>
          </View>

          <View style={{ gap: 10 }}>
            {checkoutCamper.wristbandId ? (
              <Pressable
                style={({ pressed }) => [styles.checkOutBtn, { opacity: pressed ? 0.85 : 1 }]}
                onPress={handleStartErase}
              >
                <Ionicons name="radio" size={18} color="#fff" />
                <Text style={styles.checkOutBtnText}>Scan &amp; Erase Wristband</Text>
              </Pressable>
            ) : null}

            <Pressable
              style={({ pressed }) => [styles.overrideBtn, { opacity: pressed ? 0.85 : 1 || manualOverrideLoading ? 0.7 : 1 }]}
              onPress={handleManualOverride}
              disabled={manualOverrideLoading}
            >
              {manualOverrideLoading ? (
                <ActivityIndicator size="small" color={Colors.warning} />
              ) : (
                <>
                  <Ionicons name="shield-checkmark-outline" size={18} color={Colors.warning} />
                  <Text style={styles.overrideBtnText}>Manual Override</Text>
                </>
              )}
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

      {/* ── STEP 2: LOCK (Check-In) ── */}
      {screen === "step2Checkin" && selectedCamper && (
        <View style={[styles.card, { alignItems: "center" }]}>
          <Text style={[styles.cardTitle, { textAlign: "center", marginBottom: -6 }]}>Almost Done!</Text>

          <View style={styles.stepRow}>
            <View style={[styles.stepCircle, { backgroundColor: Colors.success + "15", borderColor: Colors.success }]}>
              <Ionicons name="checkmark" size={22} color={Colors.success} />
            </View>
            <View style={[styles.stepLine, { backgroundColor: Colors.warning }]} />
            <View style={[styles.stepCircle, { backgroundColor: Colors.warning + "15", borderColor: Colors.warning }]}>
              <Text style={[styles.stepNumber, { color: Colors.warning }]}>2</Text>
            </View>
          </View>

          <View style={styles.stepLabels}>
            <Text style={[styles.stepLabelText, { color: Colors.success }]}>Data Written</Text>
            <Text style={[styles.stepLabelText, { color: Colors.warning }]}>Lock Wristband</Text>
          </View>

          <View style={[styles.stepInfoBox, { borderColor: Colors.warning + "40", backgroundColor: Colors.warning + "08" }]}>
            <Ionicons name="lock-closed-outline" size={20} color={Colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.stepInfoTitle, { color: Colors.warning }]}>Scan Again to Lock</Text>
              <Text style={[styles.stepInfoText, { color: colors.textSecondary }]}>
                Hold {selectedCamper.firstName}'s wristband near your iPhone to lock it and complete check-in.
              </Text>
            </View>
          </View>

          <View style={[styles.camperBanner, { alignSelf: "stretch" }]}>
            <Text style={styles.camperBannerName}>{selectedCamper.firstName} {selectedCamper.lastName}</Text>
            {selectedCamper.cabinGroup ? (
              <Text style={styles.camperBannerDob}>{selectedCamper.cabinGroup}</Text>
            ) : null}
          </View>

          <Pressable
            style={({ pressed }) => [styles.lockBtn, { opacity: pressed ? 0.85 : 1 }]}
            onPress={handleStartLock}
          >
            <Ionicons name="lock-closed" size={20} color="#fff" />
            <Text style={styles.lockBtnText}>Lock Wristband — Step 2 of 2</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.8 : 1, alignSelf: "stretch" }]}
            onPress={resetAll}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
        </View>
      )}

      {/* ── STEP 2: ERASE (Check-Out) ── */}
      {screen === "step2Checkout" && checkoutCamper && (
        <View style={[styles.card, { alignItems: "center" }]}>
          <Text style={[styles.cardTitle, { textAlign: "center", marginBottom: -6 }]}>Almost Done!</Text>

          <View style={styles.stepRow}>
            <View style={[styles.stepCircle, { backgroundColor: Colors.success + "15", borderColor: Colors.success }]}>
              <Ionicons name="checkmark" size={22} color={Colors.success} />
            </View>
            <View style={[styles.stepLine, { backgroundColor: Colors.danger }]} />
            <View style={[styles.stepCircle, { backgroundColor: Colors.danger + "15", borderColor: Colors.danger }]}>
              <Text style={[styles.stepNumber, { color: Colors.danger }]}>2</Text>
            </View>
          </View>

          <View style={styles.stepLabels}>
            <Text style={[styles.stepLabelText, { color: Colors.success }]}>Unlocked</Text>
            <Text style={[styles.stepLabelText, { color: Colors.danger }]}>Erase Wristband</Text>
          </View>

          <View style={[styles.stepInfoBox, { borderColor: Colors.danger + "40", backgroundColor: Colors.danger + "08" }]}>
            <Ionicons name="trash-outline" size={20} color={Colors.danger} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.stepInfoTitle, { color: Colors.danger }]}>Scan Again to Erase</Text>
              <Text style={[styles.stepInfoText, { color: colors.textSecondary }]}>
                Hold {checkoutCamper.firstName}'s wristband near your iPhone to erase it and complete check-out.
              </Text>
            </View>
          </View>

          <View style={[styles.camperBanner, { alignSelf: "stretch" }]}>
            <Text style={[styles.camperBannerName, { color: Colors.danger }]}>{checkoutCamper.firstName} {checkoutCamper.lastName}</Text>
            {checkoutCamper.cabinGroup ? (
              <Text style={styles.camperBannerDob}>{checkoutCamper.cabinGroup}</Text>
            ) : null}
          </View>

          <Pressable
            style={({ pressed }) => [styles.checkOutBtn, { opacity: pressed ? 0.85 : 1, alignSelf: "stretch" }]}
            onPress={handleStartErase2}
          >
            <Ionicons name="trash" size={20} color="#fff" />
            <Text style={styles.checkOutBtnText}>Erase Wristband — Step 2 of 2</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.8 : 1, alignSelf: "stretch" }]}
            onPress={resetAll}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
        </View>
      )}

      {/* ── SCAN ONLY RESULT ── */}
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
            <Text style={styles.camperBannerName}>{readResult.firstName} {readResult.lastName}</Text>
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
              readResult.medical.emergencyContacts.map((ec: any, i: number) => (
                <View key={i} style={i > 0 ? { marginTop: 8 } : undefined}>
                  <Text style={styles.dataValue}>{ec.name || "—"}</Text>
                  {ec.relationship ? <Text style={styles.dataValueSec}>{ec.relationship}</Text> : null}
                  <Text style={styles.dataValueSec}>{ec.phone || "—"}</Text>
                  {ec.email ? <Text style={styles.dataValueSec}>{ec.email}</Text> : null}
                </View>
              ))
            ) : <Text style={styles.dataValue}>—</Text>}
          </View>

          <View style={styles.dataSection}>
            <Text style={styles.dataSectionTitle}>Allergies</Text>
            {Array.isArray(readResult.medical?.allergies) && readResult.medical.allergies.length > 0 ? (
              <View style={styles.chipRow}>
                {readResult.medical.allergies.map((a, i) => (
                  <View key={i} style={[styles.chip, { backgroundColor: Colors.danger + "20" }]}>
                    <Text style={[styles.chipText, { color: Colors.danger }]}>{a}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.dataValue}>None reported</Text>
            )}
          </View>

          <View style={styles.dataSection}>
            <Text style={styles.dataSectionTitle}>Medications</Text>
            {Array.isArray(readResult.medical?.medications) && readResult.medical.medications.length > 0 ? (
              <View style={styles.chipRow}>
                {readResult.medical.medications.map((m, i) => (
                  <View key={i} style={styles.chip}>
                    <Text style={styles.chipText}>{m}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.dataValue}>None reported</Text>
            )}
          </View>

          <View style={styles.dataSection}>
            <Text style={styles.dataSectionTitle}>Medical Conditions</Text>
            {Array.isArray(readResult.medical?.conditions) && readResult.medical.conditions.length > 0 ? (
              <View style={styles.chipRow}>
                {readResult.medical.conditions.map((c, i) => (
                  <View key={i} style={styles.chip}>
                    <Text style={styles.chipText}>{c}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.dataValue}>None reported</Text>
            )}
          </View>

          <View style={[styles.dataSection, { borderBottomWidth: 0 }]}>
            <View style={styles.serverNote}>
              <Ionicons name="cloud-outline" size={13} color={colors.textMuted} />
              <Text style={styles.serverNoteText}>Doctor, insurance &amp; notes are stored in server records only</Text>
            </View>
          </View>

          <Text style={styles.programmedAt}>
            Encrypted: {readResult.programmedAt ? new Date(readResult.programmedAt).toLocaleString() : "—"}
          </Text>

          <View style={{ gap: 10 }}>
            {getCamperCheckInStatus(readResult.camperId) && (
              <Pressable
                style={({ pressed }) => [styles.checkOutBtn, { opacity: pressed ? 0.85 : 1 }]}
                onPress={handleCheckOutFromRead}
              >
                <Ionicons name="log-out" size={18} color="#fff" />
                <Text style={styles.checkOutBtnText}>Check Out This Camper</Text>
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.85 : 1, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }]}
              onPress={() => setReadScanVisible(true)}
            >
              <Ionicons name="radio" size={18} color={colors.textSecondary} />
              <Text style={[styles.primaryBtnText, { color: colors.textSecondary }]}>Scan Another</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.8 : 1 }]} onPress={resetAll}>
              <Text style={styles.cancelBtnText}>Done</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── NFC Scanners ── */}
      {readScanVisible && (
        <NFCScanner
          visible={readScanVisible}
          mode="read"
          onPayloadRead={handlePayloadRead}
          onError={(msg) => { setReadScanVisible(false); Alert.alert("Scan Error", msg); }}
          onCancel={() => setReadScanVisible(false)}
        />
      )}

      {writeScanVisible && selectedCamper && writePayload && (
        <NFCScanner
          visible={writeScanVisible}
          mode="write"
          writePayload={writePayload}
          writeCamper={selectedCamper}
          onWriteSuccess={handleWriteSuccess}
          onError={(msg) => { setWriteScanVisible(false); Alert.alert("Write Error", msg); }}
          onCancel={() => setWriteScanVisible(false)}
        />
      )}

      {lockScanVisible && selectedCamper && (
        <NFCScanner
          visible={lockScanVisible}
          mode="lock"
          camperName={selectedCamper.firstName}
          onLockSuccess={handleLockSuccess}
          onError={(msg) => { setLockScanVisible(false); Alert.alert("Lock Error", msg); }}
          onCancel={() => setLockScanVisible(false)}
        />
      )}

      {unlockScanVisible && checkoutCamper && (
        <NFCScanner
          visible={unlockScanVisible}
          mode="unlock"
          camperName={checkoutCamper.firstName}
          onUnlockSuccess={handleUnlockSuccess}
          onError={(msg) => { setUnlockScanVisible(false); Alert.alert("Unlock Error", msg); }}
          onCancel={() => setUnlockScanVisible(false)}
        />
      )}

      {eraseScanVisible && checkoutCamper && (
        <NFCScanner
          visible={eraseScanVisible}
          mode="erase"
          camperName={checkoutCamper.firstName}
          onEraseSuccess={handleEraseSuccess}
          onError={(msg) => { setEraseScanVisible(false); Alert.alert("Erase Error", msg); }}
          onCancel={() => setEraseScanVisible(false)}
        />
      )}

    </ScrollView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { paddingHorizontal: 20, gap: 16 },
  headerTitle: { fontSize: 28, fontFamily: "Outfit_700Bold", color: colors.text },
  headerSub: { fontSize: 14, fontFamily: "Outfit_400Regular", color: colors.textSecondary, marginTop: -8 },
  modeGrid: { flexDirection: "row", gap: 12 },
  modeCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 20, padding: 20, alignItems: "center", gap: 10, borderWidth: 1.5, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  modeIcon: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  modeTitle: { fontSize: 16, fontFamily: "Outfit_700Bold", color: colors.text, textAlign: "center" },
  modeSub: { fontSize: 12, fontFamily: "Outfit_400Regular", color: colors.textSecondary, textAlign: "center" },
  scanOnlyCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 16, borderWidth: 1.5, borderColor: Colors.accent + "30", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, gap: 10 },
  checkoutCardLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  checkoutCardTitle: { fontSize: 16, fontFamily: "Outfit_700Bold", color: colors.text },
  checkoutCardSub: { fontSize: 12, fontFamily: "Outfit_400Regular", color: colors.textSecondary, marginTop: 2 },
  statsCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  statRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  statLabel: { fontSize: 13, fontFamily: "Outfit_400Regular", color: colors.textSecondary },
  statValue: { fontSize: 16, fontFamily: "Outfit_700Bold", color: colors.text },
  offlineCard: { flexDirection: "row", gap: 12, backgroundColor: Colors.primary + "08", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.primary + "20" },
  offlineTitle: { fontSize: 14, fontFamily: "Outfit_700Bold", color: Colors.primary, marginBottom: 4 },
  offlineText: { fontSize: 13, fontFamily: "Outfit_400Regular", color: colors.textSecondary, lineHeight: 18 },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 20, gap: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardTitle: { fontSize: 20, fontFamily: "Outfit_700Bold", color: colors.text },
  cardSub: { fontSize: 14, fontFamily: "Outfit_400Regular", color: colors.textSecondary, marginTop: -6 },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, height: 50, fontFamily: "Outfit_400Regular", fontSize: 15, color: colors.text },
  camperOption: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  camperOptionSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + "08" },
  camperAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary + "20", alignItems: "center", justifyContent: "center" },
  camperInitial: { fontSize: 16, fontFamily: "Outfit_700Bold", color: Colors.primary },
  camperName: { fontSize: 15, fontFamily: "Outfit_600SemiBold", color: colors.text },
  camperSub: { fontSize: 12, fontFamily: "Outfit_400Regular", color: colors.textSecondary },
  activeBadge: { backgroundColor: Colors.success + "15", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  activeBadgeText: { fontSize: 11, fontFamily: "Outfit_600SemiBold", color: Colors.success },
  buttonRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, height: 50, borderRadius: 12, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  cancelBtnText: { fontSize: 15, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary },
  primaryBtn: { flex: 2, height: 50, borderRadius: 12, backgroundColor: Colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  primaryBtnText: { fontSize: 15, fontFamily: "Outfit_600SemiBold", color: "#fff" },
  disabledBtn: { backgroundColor: colors.textMuted },
  successHeader: { alignItems: "center", gap: 8 },
  successIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.success + "15", alignItems: "center", justifyContent: "center" },
  successTitle: { fontSize: 20, fontFamily: "Outfit_700Bold", color: Colors.success },
  successSub: { fontSize: 13, fontFamily: "Outfit_400Regular", color: colors.textSecondary, textAlign: "center" },
  camperBanner: { backgroundColor: Colors.primary + "10", borderRadius: 14, padding: 16 },
  camperBannerName: { fontSize: 22, fontFamily: "Outfit_700Bold", color: Colors.primary },
  camperBannerDob: { fontSize: 14, fontFamily: "Outfit_400Regular", color: colors.textSecondary, marginTop: 4 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusPillText: { fontSize: 12, fontFamily: "Outfit_600SemiBold" },
  checkoutInfo: { flexDirection: "row", gap: 10, backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border },
  checkoutInfoText: { flex: 1, fontSize: 13, fontFamily: "Outfit_400Regular", color: colors.textSecondary, lineHeight: 18 },
  checkOutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.danger, borderRadius: 14, height: 52 },
  checkOutBtnText: { color: "#fff", fontSize: 16, fontFamily: "Outfit_600SemiBold" },
  overrideBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, height: 52, borderWidth: 1.5, borderColor: Colors.warning + "60", backgroundColor: Colors.warning + "10" },
  overrideBtnText: { fontSize: 16, fontFamily: "Outfit_600SemiBold", color: Colors.warning },
  bloodHighlight: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.danger + "10", borderRadius: 14, padding: 14 },
  bloodLabel: { fontSize: 12, fontFamily: "Outfit_500Medium", color: colors.textSecondary },
  bloodValue: { fontSize: 26, fontFamily: "Outfit_700Bold", color: Colors.danger },
  dataSection: { gap: 4, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  dataSectionTitle: { fontSize: 11, fontFamily: "Outfit_700Bold", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8 },
  dataValue: { fontSize: 15, fontFamily: "Outfit_500Medium", color: colors.text },
  dataValueSec: { fontSize: 14, fontFamily: "Outfit_400Regular", color: colors.textSecondary },
  chipRow: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 6 },
  chip: { backgroundColor: Colors.primary + "20", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  chipText: { fontSize: 13, fontFamily: "Outfit_500Medium", color: Colors.primary },
  programmedAt: { fontSize: 12, fontFamily: "Outfit_400Regular", color: colors.textMuted, textAlign: "center" },
  serverNote: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6 },
  serverNoteText: { flex: 1, fontSize: 12, fontFamily: "Outfit_400Regular", color: colors.textMuted, fontStyle: "italic" as const },
  // Step 2 screens
  stepRow: { flexDirection: "row", alignItems: "center", gap: 0, marginVertical: 8 },
  stepCircle: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  stepNumber: { fontSize: 20, fontFamily: "Outfit_700Bold" },
  stepLine: { flex: 1, height: 3, borderRadius: 2, marginHorizontal: 8 },
  stepLabels: { flexDirection: "row", justifyContent: "space-between", alignSelf: "stretch", paddingHorizontal: 0 },
  stepLabelText: { fontSize: 12, fontFamily: "Outfit_600SemiBold", textAlign: "center", flex: 1 },
  stepInfoBox: { flexDirection: "row", gap: 12, borderWidth: 1, borderRadius: 14, padding: 14, alignSelf: "stretch", alignItems: "flex-start" },
  stepInfoTitle: { fontSize: 15, fontFamily: "Outfit_700Bold", marginBottom: 4 },
  stepInfoText: { fontSize: 13, fontFamily: "Outfit_400Regular", lineHeight: 18 },
  lockBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.warning, borderRadius: 14, height: 52, alignSelf: "stretch" },
  lockBtnText: { color: "#fff", fontSize: 16, fontFamily: "Outfit_600SemiBold" },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingTop: 12, maxHeight: "85%" },
  modalHandle: { width: 40, height: 5, backgroundColor: colors.border, borderRadius: 2.5, alignSelf: "center", marginBottom: 16 },
  modalTitle: { fontSize: 20, fontFamily: "Outfit_700Bold", color: colors.text, marginBottom: 4 },
  modalSub: { fontSize: 14, fontFamily: "Outfit_400Regular", color: colors.textSecondary, marginBottom: 16 },
  pickerRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  emptyPicker: { alignItems: "center", paddingVertical: 32, gap: 12 },
  emptyPickerText: { fontSize: 14, fontFamily: "Outfit_400Regular", color: colors.textMuted },
});
