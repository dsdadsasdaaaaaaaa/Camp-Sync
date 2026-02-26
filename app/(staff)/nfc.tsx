import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useData } from "@/contexts/DataContext";
import { decryptWristbandData } from "@/lib/crypto";
import Colors from "@/constants/colors";
import type { WristbandPayload } from "@/types";

type State = "idle" | "scanning" | "success" | "error";

export default function StaffNFCScreen() {
  const { campers } = useData();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<State>("idle");
  const [wristbandId, setWristbandId] = useState("");
  const [result, setResult] = useState<WristbandPayload | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleRead = () => {
    if (!wristbandId.trim()) return;
    setState("scanning");
    setTimeout(async () => {
      const camper = campers.find(
        (c) => c.wristbandId === wristbandId.trim().toUpperCase()
      );
      if (!camper || !camper.wristbandEncryptedData) {
        setState("error");
        setErrorMsg("No wristband found with that ID. This wristband may not be registered in CampSync.");
        return;
      }
      const data = decryptWristbandData(camper.wristbandEncryptedData);
      if (!data) {
        setState("error");
        setErrorMsg("Failed to decrypt data. This wristband does not belong to CampSync.");
        return;
      }
      setResult(data as WristbandPayload);
      setState("success");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 2000);
  };

  const reset = () => {
    setState("idle");
    setWristbandId("");
    setResult(null);
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
      <Text style={styles.title}>Read Wristband</Text>
      <Text style={styles.subtitle}>Scan camper wristbands to view their medical info</Text>

      <View style={styles.infoCard}>
        <Ionicons name="shield-checkmark" size={18} color={Colors.primary} />
        <Text style={styles.infoText}>
          Staff can only read wristband data. Programming wristbands requires management access.
        </Text>
      </View>

      {state === "idle" && (
        <View style={styles.card}>
          <View style={styles.scanIcon}>
            <Ionicons name="radio" size={40} color={Colors.primary} />
          </View>
          <Text style={styles.cardTitle}>Enter Wristband ID</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. WB-001234"
            placeholderTextColor={Colors.light.textMuted}
            value={wristbandId}
            onChangeText={(v) => setWristbandId(v.toUpperCase())}
            autoCapitalize="characters"
          />
          <Pressable
            style={({ pressed }) => [
              styles.readBtn,
              !wristbandId.trim() && styles.readBtnDisabled,
              { opacity: pressed && wristbandId.trim() ? 0.85 : 1 },
            ]}
            onPress={handleRead}
            disabled={!wristbandId.trim()}
          >
            <Ionicons name="scan" size={18} color="#fff" />
            <Text style={styles.readBtnText}>Read Wristband</Text>
          </Pressable>
        </View>
      )}

      {state === "scanning" && (
        <View style={styles.scanCard}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.scanTitle}>Reading Wristband...</Text>
          <Text style={styles.scanSub}>Decrypting data</Text>
        </View>
      )}

      {state === "success" && result && (
        <View style={styles.card}>
          <View style={styles.successHeader}>
            <Ionicons name="checkmark-circle" size={32} color={Colors.success} />
            <Text style={styles.successTitle}>Wristband Data</Text>
          </View>

          <View style={styles.camperBanner}>
            <Text style={styles.camperBannerName}>
              {result.firstName} {result.lastName}
            </Text>
            <Text style={styles.camperBannerDob}>DOB: {result.dateOfBirth || "—"}</Text>
          </View>

          <View style={styles.bloodTypeHighlight}>
            <Ionicons name="water" size={20} color={Colors.danger} />
            <View>
              <Text style={styles.bloodTypeLabel}>Blood Type</Text>
              <Text style={styles.bloodTypeValue}>{result.medical?.bloodType || "Unknown"}</Text>
            </View>
          </View>

          <View style={styles.dataSection}>
            <Text style={styles.dataSectionTitle}>Emergency Contact</Text>
            <Text style={styles.dataValue}>{result.medical?.emergencyContact || "—"}</Text>
            <Text style={styles.dataValue}>{result.medical?.emergencyPhone || "—"}</Text>
          </View>

          <View style={styles.dataSection}>
            <Text style={styles.dataSectionTitle}>Allergies</Text>
            <Text style={[styles.dataValue, { color: result.medical?.allergies && result.medical.allergies.toLowerCase() !== "none" ? Colors.danger : Colors.light.text }]}>
              {result.medical?.allergies || "None reported"}
            </Text>
          </View>

          <View style={styles.dataSection}>
            <Text style={styles.dataSectionTitle}>Medications</Text>
            <Text style={styles.dataValue}>{result.medical?.medications || "None reported"}</Text>
          </View>

          <View style={styles.dataSection}>
            <Text style={styles.dataSectionTitle}>Medical Conditions</Text>
            <Text style={styles.dataValue}>{result.medical?.conditions || "None reported"}</Text>
          </View>

          <Text style={styles.programmedAt}>
            Programmed: {result.programmedAt ? new Date(result.programmedAt).toLocaleString() : "—"}
          </Text>

          <Pressable
            style={({ pressed }) => [styles.readBtn, { opacity: pressed ? 0.85 : 1 }]}
            onPress={reset}
          >
            <Text style={styles.readBtnText}>Read Another</Text>
          </Pressable>
        </View>
      )}

      {state === "error" && (
        <View style={styles.card}>
          <View style={styles.errorHeader}>
            <Ionicons name="close-circle" size={32} color={Colors.danger} />
            <Text style={styles.errorTitle}>Read Failed</Text>
            <Text style={styles.errorMsg}>{errorMsg}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.readBtn, { opacity: pressed ? 0.85 : 1 }]}
            onPress={reset}
          >
            <Text style={styles.readBtnText}>Try Again</Text>
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
  title: {
    fontSize: 28,
    fontFamily: "Outfit_700Bold",
    color: Colors.light.text,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textSecondary,
    marginTop: -12,
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
  scanIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: Colors.primary + "15",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: "Outfit_700Bold",
    color: Colors.light.text,
    textAlign: "center",
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
    textAlign: "center",
    letterSpacing: 1,
  },
  readBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 50,
  },
  readBtnDisabled: {
    backgroundColor: Colors.light.textMuted,
  },
  readBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Outfit_600SemiBold",
  },
  scanCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    padding: 48,
    alignItems: "center",
    gap: 16,
  },
  scanTitle: {
    fontSize: 20,
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
    fontSize: 20,
    fontFamily: "Outfit_700Bold",
    color: Colors.success,
  },
  camperBanner: {
    backgroundColor: Colors.primary + "10",
    borderRadius: 12,
    padding: 14,
  },
  camperBannerName: {
    fontSize: 20,
    fontFamily: "Outfit_700Bold",
    color: Colors.primary,
  },
  camperBannerDob: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 4,
  },
  bloodTypeHighlight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.danger + "10",
    borderRadius: 12,
    padding: 14,
  },
  bloodTypeLabel: {
    fontSize: 12,
    fontFamily: "Outfit_500Medium",
    color: Colors.light.textSecondary,
  },
  bloodTypeValue: {
    fontSize: 24,
    fontFamily: "Outfit_700Bold",
    color: Colors.danger,
  },
  dataSection: {
    gap: 4,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  dataSectionTitle: {
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.light.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dataValue: {
    fontSize: 15,
    fontFamily: "Outfit_500Medium",
    color: Colors.light.text,
  },
  programmedAt: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textMuted,
    textAlign: "center",
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
