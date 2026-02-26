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
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRef, useEffect } from "react";
import * as Haptics from "expo-haptics";
import { useData } from "@/contexts/DataContext";
import { decryptWristbandData } from "@/lib/crypto";
import Colors from "@/constants/colors";
import type { Camper, WristbandPayload } from "@/types";

type Mode = "idle" | "read" | "write" | "scanning" | "success" | "error";

function ScanAnimation({ active }: { active: boolean }) {
  const pulse1 = useRef(new Animated.Value(1)).current;
  const pulse2 = useRef(new Animated.Value(1)).current;
  const pulse3 = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) {
      pulse1.setValue(1);
      pulse2.setValue(1);
      pulse3.setValue(1);
      return;
    }
    const createPulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1.6,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      );

    const a1 = createPulse(pulse1, 0);
    const a2 = createPulse(pulse2, 400);
    const a3 = createPulse(pulse3, 800);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [active]);

  const ring = (anim: Animated.Value, size: number, opacity: number) => (
    <Animated.View
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: Colors.accent,
        opacity: opacity,
        transform: [{ scale: anim }],
      }}
    />
  );

  return (
    <View style={styles.scanContainer}>
      {active && ring(pulse3, 160, 0.15)}
      {active && ring(pulse2, 120, 0.25)}
      {active && ring(pulse1, 80, 0.4)}
      <View style={styles.nfcCircle}>
        <Ionicons name="radio" size={44} color={active ? Colors.accent : Colors.light.textMuted} />
      </View>
    </View>
  );
}

export default function NFCScreen() {
  const { campers, programWristband, getActiveCheckIn } = useData();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>("idle");
  const [selectedCamper, setSelectedCamper] = useState<Camper | null>(null);
  const [wristbandId, setWristbandId] = useState("");
  const [readResult, setReadResult] = useState<WristbandPayload | null>(null);
  const [camperSearch, setCamperSearch] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const filteredCampers = campers.filter((c) =>
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(camperSearch.toLowerCase())
  );

  const handleStartRead = () => {
    if (!wristbandId.trim()) {
      Alert.alert("Enter Wristband ID", "Please enter the wristband ID to read.");
      return;
    }
    const camper = campers.find((c) => c.wristbandId === wristbandId.trim().toUpperCase());
    if (!camper || !camper.wristbandEncryptedData) {
      setMode("error");
      setErrorMsg("No programmed wristband found with that ID.");
      return;
    }
    setMode("scanning");
    setTimeout(() => {
      const data = decryptWristbandData(camper.wristbandEncryptedData!);
      if (!data) {
        setMode("error");
        setErrorMsg("Failed to decrypt wristband data. This wristband may not belong to CampSync.");
        return;
      }
      setReadResult(data as WristbandPayload);
      setMode("success");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 2000);
  };

  const handleStartWrite = async () => {
    if (!selectedCamper) {
      Alert.alert("Select Camper", "Please select a camper to program the wristband for.");
      return;
    }
    setMode("scanning");
    setTimeout(async () => {
      try {
        const id = await programWristband(selectedCamper.id);
        setMode("success");
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          "Wristband Programmed",
          `Successfully programmed wristband for ${selectedCamper.firstName} ${selectedCamper.lastName}.\n\nWristband ID: ${id}`,
          [{ text: "Done", onPress: resetAll }]
        );
      } catch (err: any) {
        setMode("error");
        setErrorMsg(err.message || "Failed to program wristband.");
      }
    }, 2500);
  };

  const resetAll = () => {
    setMode("idle");
    setSelectedCamper(null);
    setWristbandId("");
    setReadResult(null);
    setCamperSearch("");
    setErrorMsg("");
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
      <Text style={styles.headerTitle}>NFC Wristband</Text>
      <Text style={styles.headerSub}>Program or read encrypted wristband data</Text>

      {mode === "idle" && (
        <>
          <View style={styles.modeGrid}>
            <Pressable
              style={({ pressed }) => [
                styles.modeCard,
                { opacity: pressed ? 0.85 : 1, borderColor: Colors.primary + "40" },
              ]}
              onPress={() => setMode("write")}
            >
              <View style={[styles.modeIcon, { backgroundColor: Colors.primary + "20" }]}>
                <Ionicons name="create" size={28} color={Colors.primary} />
              </View>
              <Text style={styles.modeTitle}>Program Wristband</Text>
              <Text style={styles.modeSub}>Write encrypted camper data</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.modeCard,
                { opacity: pressed ? 0.85 : 1, borderColor: Colors.accent + "40" },
              ]}
              onPress={() => setMode("read")}
            >
              <View style={[styles.modeIcon, { backgroundColor: Colors.accent + "20" }]}>
                <Ionicons name="scan" size={28} color={Colors.accent} />
              </View>
              <Text style={styles.modeTitle}>Read Wristband</Text>
              <Text style={styles.modeSub}>Decrypt and view stored data</Text>
            </Pressable>
          </View>

          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={20} color={Colors.primary} />
            <Text style={styles.infoText}>
              NFC functionality requires a physical device with NFC capabilities. In the Expo Go preview, wristband simulation is shown for demonstration.
            </Text>
          </View>
        </>
      )}

      {mode === "read" && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Read Wristband</Text>
          <Text style={styles.cardSub}>Enter the wristband ID printed on the band</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. WB-001234"
            placeholderTextColor={Colors.light.textMuted}
            value={wristbandId}
            onChangeText={(v) => setWristbandId(v.toUpperCase())}
            autoCapitalize="characters"
          />
          <View style={styles.buttonRow}>
            <Pressable
              style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.8 : 1 }]}
              onPress={resetAll}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.85 : 1 }]}
              onPress={handleStartRead}
            >
              <Ionicons name="scan" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Read</Text>
            </Pressable>
          </View>
        </View>
      )}

      {mode === "write" && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Select Camper</Text>
          <TextInput
            style={styles.input}
            placeholder="Search camper..."
            placeholderTextColor={Colors.light.textMuted}
            value={camperSearch}
            onChangeText={setCamperSearch}
          />
          {campers.length === 0 && (
            <Text style={[styles.cardSub, { textAlign: "center", paddingVertical: 16 }]}>
              No campers registered yet. Add campers first.
            </Text>
          )}
          {filteredCampers.slice(0, 6).map((camper) => (
            <Pressable
              key={camper.id}
              style={[
                styles.camperOption,
                selectedCamper?.id === camper.id && styles.camperOptionSelected,
              ]}
              onPress={() => setSelectedCamper(camper)}
            >
              <View style={styles.camperOptionAvatar}>
                <Text style={styles.camperOptionInitial}>
                  {camper.firstName.charAt(0)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.camperOptionName}>
                  {camper.firstName} {camper.lastName}
                </Text>
                <Text style={styles.camperOptionSub}>{camper.cabinGroup || "No cabin"}</Text>
              </View>
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
              <Text style={styles.primaryBtnText}>Program</Text>
            </Pressable>
          </View>
        </View>
      )}

      {mode === "scanning" && (
        <View style={styles.scanCard}>
          <ScanAnimation active={true} />
          <Text style={styles.scanTitle}>Scanning...</Text>
          <Text style={styles.scanSub}>
            {readResult !== null ? "Reading wristband data" : "Hold wristband to device"}
          </Text>
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 8 }} />
        </View>
      )}

      {mode === "success" && readResult && (
        <View style={styles.card}>
          <View style={styles.successHeader}>
            <Ionicons name="checkmark-circle" size={32} color={Colors.success} />
            <Text style={styles.successTitle}>Wristband Read Successfully</Text>
          </View>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Name</Text>
            <Text style={styles.dataValue}>{readResult.firstName} {readResult.lastName}</Text>
          </View>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Date of Birth</Text>
            <Text style={styles.dataValue}>{readResult.dateOfBirth || "—"}</Text>
          </View>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Blood Type</Text>
            <Text style={[styles.dataValue, { color: Colors.danger, fontFamily: "Outfit_700Bold" }]}>
              {readResult.medical?.bloodType || "—"}
            </Text>
          </View>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Allergies</Text>
            <Text style={styles.dataValue}>{readResult.medical?.allergies || "None"}</Text>
          </View>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Emergency Contact</Text>
            <Text style={styles.dataValue}>{readResult.medical?.emergencyContact || "—"}</Text>
          </View>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Emergency Phone</Text>
            <Text style={styles.dataValue}>{readResult.medical?.emergencyPhone || "—"}</Text>
          </View>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Programmed</Text>
            <Text style={styles.dataValue}>
              {readResult.programmedAt
                ? new Date(readResult.programmedAt).toLocaleString()
                : "—"}
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.85 : 1, marginTop: 4 }]}
            onPress={resetAll}
          >
            <Text style={styles.primaryBtnText}>Done</Text>
          </Pressable>
        </View>
      )}

      {mode === "error" && (
        <View style={styles.card}>
          <View style={styles.errorHeader}>
            <Ionicons name="close-circle" size={32} color={Colors.danger} />
            <Text style={styles.errorTitle}>Read Failed</Text>
            <Text style={styles.errorMsg}>{errorMsg}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.85 : 1 }]}
            onPress={resetAll}
          >
            <Text style={styles.primaryBtnText}>Try Again</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    gap: 20,
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
    marginTop: -12,
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
    fontSize: 14,
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
  camperOptionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  camperOptionInitial: {
    fontSize: 16,
    fontFamily: "Outfit_700Bold",
    color: Colors.primary,
  },
  camperOptionName: {
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.light.text,
  },
  camperOptionSub: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textSecondary,
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
    flex: 1,
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
  scanCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    padding: 40,
    alignItems: "center",
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  scanContainer: {
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  nfcCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  scanTitle: {
    fontSize: 22,
    fontFamily: "Outfit_700Bold",
    color: Colors.light.text,
  },
  scanSub: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textSecondary,
  },
  successHeader: {
    alignItems: "center",
    gap: 8,
  },
  successTitle: {
    fontSize: 18,
    fontFamily: "Outfit_700Bold",
    color: Colors.success,
  },
  dataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  dataLabel: {
    fontSize: 13,
    fontFamily: "Outfit_500Medium",
    color: Colors.light.textSecondary,
  },
  dataValue: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.light.text,
    maxWidth: "60%",
    textAlign: "right",
  },
  errorHeader: {
    alignItems: "center",
    gap: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontFamily: "Outfit_700Bold",
    color: Colors.danger,
  },
  errorMsg: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
});
