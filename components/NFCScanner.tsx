import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { readNFCTag, writeNFCTag, isNFCSimulated, isNFCSupported } from "@/lib/nfc";
import type { WristbandPayload, Camper } from "@/types";

interface NFCScannerReadProps {
  visible: boolean;
  mode: "read";
  onPayloadRead: (payload: WristbandPayload) => void;
  onError: (message: string) => void;
  onCancel: () => void;
}

interface NFCScannerWriteProps {
  visible: boolean;
  mode: "write";
  writePayload: WristbandPayload;
  writeCamper: Camper;
  onWriteSuccess: () => void;
  onError: (message: string) => void;
  onCancel: () => void;
}

type NFCScannerProps = NFCScannerReadProps | NFCScannerWriteProps;

function PulseRings({ active }: { active: boolean }) {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) {
      ring1.setValue(0);
      ring2.setValue(0);
      ring3.setValue(0);
      iconScale.setValue(1);
      return;
    }

    const makeRing = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 1800, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );

    const iconAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(iconScale, { toValue: 1.12, duration: 900, useNativeDriver: true }),
        Animated.timing(iconScale, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );

    const a1 = makeRing(ring1, 0);
    const a2 = makeRing(ring2, 600);
    const a3 = makeRing(ring3, 1200);

    a1.start(); a2.start(); a3.start(); iconAnim.start();

    return () => { a1.stop(); a2.stop(); a3.stop(); iconAnim.stop(); };
  }, [active]);

  const ringView = (anim: Animated.Value) => {
    const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] });
    const opacity = anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.5, 0.2, 0] });
    return (
      <Animated.View
        style={{
          position: "absolute",
          width: 90,
          height: 90,
          borderRadius: 45,
          backgroundColor: Colors.accent + "50",
          transform: [{ scale }],
          opacity,
        }}
      />
    );
  };

  return (
    <View style={scanStyles.pulseWrap}>
      {active && ringView(ring3)}
      {active && ringView(ring2)}
      {active && ringView(ring1)}
      <Animated.View style={[scanStyles.iconCircle, { transform: [{ scale: iconScale }] }]}>
        <Ionicons name="radio" size={52} color={Colors.accent} />
      </Animated.View>
    </View>
  );
}

export default function NFCScanner(props: NFCScannerProps) {
  const { visible, mode, onCancel } = props;
  const [status, setStatus] = useState<"scanning" | "success" | "error" | "unsupported">("scanning");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!visible) {
      setStatus("scanning");
      setErrorMsg("");
      return;
    }

    if (Platform.OS === "web") {
      setStatus("unsupported");
      return;
    }

    let cancelled = false;

    const doScan = async () => {
      setStatus("scanning");
      try {
        const supported = await isNFCSupported();
        if (!supported) {
          setStatus("unsupported");
          return;
        }

        if (mode === "read") {
          const payload = await readNFCTag();
          if (cancelled) return;
          if (!payload) {
            setStatus("error");
            setErrorMsg("This wristband doesn't contain CampSync data. Hold a programmed CampSync wristband near your phone.");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
          }
          setStatus("success");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTimeout(() => {
            if (!cancelled) {
              (props as NFCScannerReadProps).onPayloadRead(payload);
            }
          }, 500);
        } else {
          const writeProps = props as NFCScannerWriteProps;
          await writeNFCTag(writeProps.writePayload);
          if (cancelled) return;
          setStatus("success");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTimeout(() => {
            if (!cancelled) writeProps.onWriteSuccess();
          }, 800);
        }
      } catch (err: any) {
        if (cancelled) return;
        const msg = err?.message || "NFC operation failed.";
        if (msg.includes("cancelled") || msg.includes("cancel") || msg.includes("UserCancel")) {
          onCancel();
          return;
        }
        setStatus("error");
        setErrorMsg(msg);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        props.onError(msg);
      }
    };

    doScan();

    return () => { cancelled = true; };
  }, [visible]);

  const subtitle =
    mode === "write"
      ? `Hold iPhone near ${(props as NFCScannerWriteProps).writeCamper?.firstName}'s wristband to program`
      : "Hold iPhone near a CampSync wristband";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onCancel}
    >
      <View style={scanStyles.overlay}>
        <View style={scanStyles.sheet}>
          <View style={scanStyles.handle} />

          {status === "unsupported" && (
            <View style={scanStyles.content}>
              <View style={[scanStyles.iconCircle, { backgroundColor: Colors.warning + "20", borderColor: Colors.warning + "40" }]}>
                <Ionicons name="warning" size={48} color={Colors.warning} />
              </View>
              <Text style={scanStyles.title}>NFC Not Available</Text>
              <Text style={scanStyles.subtitle}>
                This device does not support NFC, or NFC is disabled. Please enable NFC in Settings.
              </Text>
              <Pressable
                style={({ pressed }) => [scanStyles.cancelBtn, { opacity: pressed ? 0.8 : 1 }]}
                onPress={onCancel}
              >
                <Text style={scanStyles.cancelBtnText}>Close</Text>
              </Pressable>
            </View>
          )}

          {status === "scanning" && (
            <View style={scanStyles.content}>
              <PulseRings active={true} />
              <Text style={scanStyles.title}>
                {mode === "write" ? "Program Wristband" : "Ready to Scan"}
              </Text>
              <Text style={scanStyles.subtitle}>{subtitle}</Text>
              <Text style={scanStyles.hint}>
                {mode === "write"
                  ? "Hold near a blank NFC wristband tag"
                  : "The iOS NFC reader will activate automatically"}
              </Text>
              <Pressable
                style={({ pressed }) => [scanStyles.cancelBtn, { opacity: pressed ? 0.8 : 1, marginTop: 8 }]}
                onPress={onCancel}
              >
                <Text style={scanStyles.cancelBtnText}>Cancel</Text>
              </Pressable>
            </View>
          )}

          {status === "success" && (
            <View style={scanStyles.content}>
              <View style={[scanStyles.iconCircle, { backgroundColor: Colors.success + "15", borderColor: Colors.success + "40" }]}>
                <Ionicons name="checkmark-circle" size={52} color={Colors.success} />
              </View>
              <Text style={[scanStyles.title, { color: Colors.success }]}>
                {mode === "write" ? "Wristband Programmed!" : "Tag Read Successfully!"}
              </Text>
              <Text style={scanStyles.subtitle}>
                {mode === "write"
                  ? "Encrypted camper data written to wristband"
                  : "Decrypting camper data..."}
              </Text>
              <ActivityIndicator color={Colors.primary} style={{ marginTop: 8 }} />
            </View>
          )}

          {status === "error" && (
            <View style={scanStyles.content}>
              <View style={[scanStyles.iconCircle, { backgroundColor: Colors.danger + "15", borderColor: Colors.danger + "40" }]}>
                <Ionicons name="close-circle" size={52} color={Colors.danger} />
              </View>
              <Text style={[scanStyles.title, { color: Colors.danger }]}>Scan Failed</Text>
              <Text style={scanStyles.subtitle}>{errorMsg}</Text>
              <Pressable
                style={({ pressed }) => [scanStyles.retryBtn, { opacity: pressed ? 0.85 : 1 }]}
                onPress={() => {
                  setStatus("scanning");
                  setErrorMsg("");
                }}
              >
                <Ionicons name="refresh" size={18} color="#fff" />
                <Text style={scanStyles.retryBtnText}>Try Again</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [scanStyles.cancelBtn, { opacity: pressed ? 0.8 : 1 }]}
                onPress={onCancel}
              >
                <Text style={scanStyles.cancelBtnText}>Cancel</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const scanStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === "web" ? 34 : 48,
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: Colors.light.border,
    borderRadius: 2.5,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  content: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 14,
  },
  pulseWrap: {
    width: 180,
    height: 180,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.accent + "12",
    borderWidth: 2,
    borderColor: Colors.accent + "35",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontFamily: "Outfit_700Bold",
    color: Colors.light.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  hint: {
    fontSize: 12,
    fontFamily: "Outfit_500Medium",
    color: Colors.accent,
    textAlign: "center",
  },
  cancelBtn: {
    width: "100%",
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  cancelBtnText: {
    fontSize: 16,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.light.textSecondary,
  },
  retryBtn: {
    width: "100%",
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  retryBtnText: {
    fontSize: 16,
    fontFamily: "Outfit_600SemiBold",
    color: "#fff",
  },
});
