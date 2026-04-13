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
import { useColors } from "@/hooks/useColors";
import { readNFCTag, writeNFCTag, eraseNFCTag, lockNFCTag, unlockNFCTag, isNFCSupported } from "@/lib/nfc";
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

interface NFCScannerLockProps {
  visible: boolean;
  mode: "lock";
  camperName: string;
  onLockSuccess: () => void;
  onError: (message: string) => void;
  onCancel: () => void;
}

interface NFCScannerUnlockProps {
  visible: boolean;
  mode: "unlock";
  camperName: string;
  onUnlockSuccess: () => void;
  onError: (message: string) => void;
  onCancel: () => void;
}

interface NFCScannerEraseProps {
  visible: boolean;
  mode: "erase";
  camperName: string;
  onEraseSuccess: () => void;
  onError: (message: string) => void;
  onCancel: () => void;
}

type NFCScannerProps =
  | NFCScannerReadProps
  | NFCScannerWriteProps
  | NFCScannerLockProps
  | NFCScannerUnlockProps
  | NFCScannerEraseProps;

function PulseRings({ active, color }: { active: boolean; color?: string }) {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(1)).current;
  const ringColor = color || Colors.accent;

  useEffect(() => {
    if (!active) {
      ring1.setValue(0); ring2.setValue(0); ring3.setValue(0); iconScale.setValue(1);
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
          width: 90, height: 90, borderRadius: 45,
          backgroundColor: ringColor + "50",
          transform: [{ scale }],
          opacity,
        }}
      />
    );
  };

  return (
    <View style={pulseStyles.pulseWrap}>
      {active && ringView(ring3)}
      {active && ringView(ring2)}
      {active && ringView(ring1)}
      <Animated.View style={[pulseStyles.iconCircle, { transform: [{ scale: iconScale }], backgroundColor: ringColor + "12", borderColor: ringColor + "35" }]}>
        <Ionicons name="radio" size={52} color={ringColor} />
      </Animated.View>
    </View>
  );
}

const pulseStyles = StyleSheet.create({
  pulseWrap: {
    width: 180, height: 180,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  iconCircle: {
    width: 100, height: 100,
    borderRadius: 50,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});

function getStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.65)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 28,
      paddingBottom: Platform.OS === "web" ? 34 : 48,
    },
    handle: {
      width: 40, height: 5,
      backgroundColor: colors.border,
      borderRadius: 2.5,
      alignSelf: "center",
      marginTop: 12, marginBottom: 4,
    },
    content: {
      alignItems: "center",
      paddingVertical: 24,
      gap: 14,
    },
    stepBadge: {
      paddingHorizontal: 14,
      paddingVertical: 5,
      borderRadius: 20,
      borderWidth: 1,
      marginBottom: 4,
    },
    stepBadgeText: {
      fontSize: 12,
      fontFamily: "Outfit_700Bold",
      letterSpacing: 0.5,
    },
    iconCircle: {
      width: 100, height: 100,
      borderRadius: 50,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      fontSize: 22,
      fontFamily: "Outfit_700Bold",
      color: colors.text,
      textAlign: "center",
    },
    subtitle: {
      fontSize: 14,
      fontFamily: "Outfit_400Regular",
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 20,
      paddingHorizontal: 8,
    },
    hint: {
      fontSize: 12,
      fontFamily: "Outfit_500Medium",
      textAlign: "center",
    },
    cancelBtn: {
      width: "100%",
      height: 52,
      borderRadius: 14,
      backgroundColor: colors.surfaceSecondary,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelBtnText: {
      fontSize: 16,
      fontFamily: "Outfit_600SemiBold",
      color: colors.textSecondary,
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
}

export default function NFCScanner(props: NFCScannerProps) {
  const { visible, mode, onCancel } = props;
  const colors = useColors();
  const styles = getStyles(colors);

  const [status, setStatus] = useState<"scanning" | "success" | "error" | "unsupported">("scanning");
  const [errorMsg, setErrorMsg] = useState("");
  const [scanAttempt, setScanAttempt] = useState(0);

  const retry = () => {
    setStatus("scanning");
    setErrorMsg("");
    setScanAttempt((n) => n + 1);
  };

  const extractError = (err: any): string => {
    if (!err) return "NFC operation failed.";
    if (typeof err === "string") return err || "NFC operation failed.";
    if (err.message) return err.message;
    try {
      const str = JSON.stringify(err);
      if (str && str !== "{}") return str;
    } catch {}
    return String(err) || "NFC operation failed.";
  };

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
        if (cancelled) return;
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
          setTimeout(() => { if (!cancelled) (props as NFCScannerReadProps).onPayloadRead(payload); }, 500);

        } else if (mode === "write") {
          const writeProps = props as NFCScannerWriteProps;
          await writeNFCTag(writeProps.writePayload);
          if (cancelled) return;
          setStatus("success");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTimeout(() => { if (!cancelled) writeProps.onWriteSuccess(); }, 800);

        } else if (mode === "lock") {
          await lockNFCTag();
          if (cancelled) return;
          setStatus("success");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTimeout(() => { if (!cancelled) (props as NFCScannerLockProps).onLockSuccess(); }, 800);

        } else if (mode === "unlock") {
          await unlockNFCTag();
          if (cancelled) return;
          setStatus("success");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTimeout(() => { if (!cancelled) (props as NFCScannerUnlockProps).onUnlockSuccess(); }, 800);

        } else if (mode === "erase") {
          await eraseNFCTag();
          if (cancelled) return;
          setStatus("success");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTimeout(() => { if (!cancelled) (props as NFCScannerEraseProps).onEraseSuccess(); }, 800);
        }
      } catch (err: any) {
        if (cancelled) return;
        const msg = extractError(err);
        if (
          msg.includes("UserCancel") ||
          msg.includes("cancelled") ||
          msg.includes("cancel") ||
          msg.includes("invalidated") ||
          (msg.includes("session") && msg.includes("ended"))
        ) {
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
  }, [visible, scanAttempt]);

  const stepLabel = () => {
    if (mode === "write") return "Step 1 of 2";
    if (mode === "lock") return "Step 2 of 2";
    if (mode === "unlock") return "Step 1 of 2";
    if (mode === "erase") return "Step 2 of 2";
    return null;
  };

  const getTitle = () => {
    if (mode === "write") return "Program Wristband";
    if (mode === "lock") return "Lock Wristband";
    if (mode === "unlock") return "Unlock Wristband";
    if (mode === "erase") return "Erase Wristband";
    return "Ready to Scan";
  };

  const getSubtitle = () => {
    if (mode === "write") return `Hold iPhone near ${(props as NFCScannerWriteProps).writeCamper?.firstName}'s wristband to program it`;
    if (mode === "lock") return `Scan ${(props as NFCScannerLockProps).camperName}'s wristband again to lock it`;
    if (mode === "unlock") return `Scan ${(props as NFCScannerUnlockProps).camperName}'s wristband to unlock it`;
    if (mode === "erase") return `Scan ${(props as NFCScannerEraseProps).camperName}'s wristband again to erase it`;
    return "Hold iPhone near a CampSync wristband";
  };

  const getHint = () => {
    if (mode === "write") return "Data will be encrypted and written to the tag";
    if (mode === "lock") return "This prevents tampering with the wristband data";
    if (mode === "unlock") return "Authenticates with the wristband's security key";
    if (mode === "erase") return "Wristband will be cleared for future use";
    return "The iOS NFC reader will activate automatically";
  };

  const getSuccessTitle = () => {
    if (mode === "write") return "Data Written!";
    if (mode === "lock") return "Wristband Locked!";
    if (mode === "unlock") return "Wristband Unlocked!";
    if (mode === "erase") return "Wristband Erased!";
    return "Tag Read Successfully!";
  };

  const getSuccessSubtitle = () => {
    if (mode === "write") return "Scan again to lock the wristband";
    if (mode === "lock") return "Wristband is now tamper-protected";
    if (mode === "unlock") return "Security removed — ready to erase";
    if (mode === "erase") return "Wristband data has been cleared";
    return "Decrypting camper data...";
  };

  const ringColor = mode === "lock" || mode === "unlock"
    ? Colors.warning
    : mode === "erase"
    ? Colors.danger
    : Colors.accent;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {status === "unsupported" && (
            <View style={styles.content}>
              <View style={[styles.iconCircle, { backgroundColor: Colors.warning + "20", borderColor: Colors.warning + "40" }]}>
                <Ionicons name="warning" size={48} color={Colors.warning} />
              </View>
              <Text style={styles.title}>NFC Not Available</Text>
              <Text style={styles.subtitle}>
                This device does not support NFC, or NFC is disabled. Please enable NFC in Settings.
              </Text>
              <Pressable style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.8 : 1 }]} onPress={onCancel}>
                <Text style={styles.cancelBtnText}>Close</Text>
              </Pressable>
            </View>
          )}

          {status === "scanning" && (
            <View style={styles.content}>
              {stepLabel() && (
                <View style={[styles.stepBadge, { backgroundColor: ringColor + "15", borderColor: ringColor + "30" }]}>
                  <Text style={[styles.stepBadgeText, { color: ringColor }]}>{stepLabel()}</Text>
                </View>
              )}
              <PulseRings active={true} color={ringColor} />
              <Text style={styles.title}>{getTitle()}</Text>
              <Text style={styles.subtitle}>{getSubtitle()}</Text>
              <Text style={[styles.hint, { color: ringColor }]}>{getHint()}</Text>
              <Pressable
                style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.8 : 1, marginTop: 8 }]}
                onPress={onCancel}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
            </View>
          )}

          {status === "success" && (
            <View style={styles.content}>
              <View style={[styles.iconCircle, { backgroundColor: Colors.success + "15", borderColor: Colors.success + "40" }]}>
                <Ionicons name="checkmark-circle" size={52} color={Colors.success} />
              </View>
              <Text style={[styles.title, { color: Colors.success }]}>{getSuccessTitle()}</Text>
              <Text style={styles.subtitle}>{getSuccessSubtitle()}</Text>
              <ActivityIndicator color={Colors.primary} style={{ marginTop: 8 }} />
            </View>
          )}

          {status === "error" && (
            <View style={styles.content}>
              <View style={[styles.iconCircle, { backgroundColor: Colors.danger + "15", borderColor: Colors.danger + "40" }]}>
                <Ionicons name="close-circle" size={52} color={Colors.danger} />
              </View>
              <Text style={[styles.title, { color: Colors.danger }]}>Scan Failed</Text>
              <Text style={styles.subtitle}>{errorMsg}</Text>
              <Pressable
                style={({ pressed }) => [styles.retryBtn, { opacity: pressed ? 0.85 : 1 }]}
                onPress={retry}
              >
                <Ionicons name="refresh" size={18} color="#fff" />
                <Text style={styles.retryBtnText}>Try Again</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.8 : 1 }]}
                onPress={onCancel}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
