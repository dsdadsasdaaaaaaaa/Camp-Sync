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
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useColors } from "@/hooks/useColors";
import NFCScanner from "@/components/NFCScanner";
import type { WristbandPayload } from "@/types";

export default function OfflineScannerScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = getStyles(colors);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [result, setResult] = useState<WristbandPayload | null>(null);

  const handleStartScan = () => {
    setResult(null);
    setScannerVisible(true);
  };

  const handlePayloadRead = (payload: WristbandPayload) => {
    setScannerVisible(false);
    setResult(payload);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20),
          paddingBottom: insets.bottom + 40,
        },
      ]}
    >
      <View style={styles.offlineBanner}>
        <Ionicons name="cloud-offline" size={16} color="#fff" />
        <Text style={styles.offlineText}>Offline — Sign in for full access</Text>
        <Pressable onPress={() => router.push("/(auth)/login")} style={styles.signInBtn}>
          <Text style={styles.signInText}>Sign In</Text>
        </Pressable>
      </View>

      <Text style={styles.title}>Wristband Scanner</Text>
      <Text style={styles.subtitle}>
        Scan a CampSync wristband to view the camper's medical information
      </Text>

      <View style={styles.infoCard}>
        <Ionicons name="lock-closed-outline" size={18} color={Colors.primary} />
        <Text style={styles.infoText}>
          Data is encrypted on the wristband. Scanning works without internet or an account.
        </Text>
      </View>

      {!result ? (
        <View style={styles.scanArea}>
          <Pressable
            style={({ pressed }) => [
              styles.scanButton,
              { transform: [{ scale: pressed ? 0.95 : 1 }] },
            ]}
            onPress={handleStartScan}
          >
            <View style={styles.scanButtonInner}>
              <Ionicons name="radio" size={52} color={Colors.accent} />
            </View>
          </Pressable>
          <Text style={styles.scanTitle}>Tap to Scan Wristband</Text>
          <Text style={styles.scanSub}>
            Hold a camper's NFC wristband near your device
          </Text>
        </View>
      ) : (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <View style={styles.resultAvatar}>
              <Text style={styles.resultAvatarText}>
                {result.firstName[0]}{result.lastName[0]}
              </Text>
            </View>
            <View>
              <Text style={styles.resultName}>
                {result.firstName} {result.lastName}
              </Text>
              <Text style={styles.resultDob}>DOB: {result.dateOfBirth}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {result.medical.bloodType ? (
            <View style={styles.medRow}>
              <Ionicons name="water" size={16} color={Colors.danger} />
              <Text style={styles.medLabel}>Blood Type</Text>
              <Text style={styles.medValue}>{result.medical.bloodType}</Text>
            </View>
          ) : null}

          {result.medical.allergies ? (
            <View style={styles.medRow}>
              <Ionicons name="warning" size={16} color="#F59E0B" />
              <Text style={styles.medLabel}>Allergies</Text>
              <Text style={[styles.medValue, { color: "#B45309" }]}>
                {result.medical.allergies}
              </Text>
            </View>
          ) : null}

          {result.medical.medications ? (
            <View style={styles.medRow}>
              <Ionicons name="medkit" size={16} color={Colors.primary} />
              <Text style={styles.medLabel}>Medications</Text>
              <Text style={styles.medValue}>{result.medical.medications}</Text>
            </View>
          ) : null}

          {result.medical.conditions ? (
            <View style={styles.medRow}>
              <Ionicons name="heart" size={16} color={Colors.danger} />
              <Text style={styles.medLabel}>Conditions</Text>
              <Text style={styles.medValue}>{result.medical.conditions}</Text>
            </View>
          ) : null}

          {result.medical.emergencyContacts?.length > 0 ? (
            <>
              <View style={styles.divider} />
              <View style={styles.medRow}>
                <Ionicons name="call" size={16} color={Colors.accent} />
                <Text style={styles.medLabel}>Emergency</Text>
                <Text style={styles.medValue}>
                  {result.medical.emergencyContacts[0].name}
                  {result.medical.emergencyContacts[0].phone ? ` — ${result.medical.emergencyContacts[0].phone}` : ""}
                </Text>
              </View>
            </>
          ) : null}

          <Pressable style={styles.scanAgainBtn} onPress={handleStartScan}>
            <Ionicons name="radio-outline" size={18} color={Colors.primary} />
            <Text style={styles.scanAgainText}>Scan Another</Text>
          </Pressable>
        </View>
      )}

      {scannerVisible && (
        <NFCScanner
          visible={scannerVisible}
          mode="read"
          onPayloadRead={handlePayloadRead}
          onError={(msg) => {
            setScannerVisible(false);
            Alert.alert("NFC Error", msg);
          }}
          onCancel={() => setScannerVisible(false)}
        />
      )}
    </ScrollView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    gap: 16,
  },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.textMuted,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  offlineText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: "#fff",
  },
  signInBtn: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  signInText: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: "#fff",
  },
  title: {
    fontSize: 26,
    fontFamily: "Outfit_700Bold",
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: -8,
  },
  infoCard: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: Colors.primary + "12",
    borderRadius: 12,
    padding: 14,
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: Colors.primary + "30",
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: colors.textSecondary,
    lineHeight: 18,
  },
  scanArea: {
    alignItems: "center",
    gap: 16,
    marginTop: 20,
  },
  scanButton: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.accent + "15",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.accent + "40",
  },
  scanButtonInner: {
    alignItems: "center",
    justifyContent: "center",
  },
  scanTitle: {
    fontSize: 18,
    fontFamily: "Outfit_700Bold",
    color: colors.text,
  },
  scanSub: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  resultCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  resultAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  resultAvatarText: {
    fontSize: 18,
    fontFamily: "Outfit_700Bold",
    color: Colors.primary,
  },
  resultName: {
    fontSize: 18,
    fontFamily: "Outfit_700Bold",
    color: colors.text,
  },
  resultDob: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  medRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  medLabel: {
    width: 80,
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: colors.textSecondary,
  },
  medValue: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: colors.text,
  },
  scanAgainBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary + "40",
    backgroundColor: Colors.primary + "10",
  },
  scanAgainText: {
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.primary,
  },
});
