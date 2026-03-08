import { useEffect, useRef, useCallback } from "react";
import { Platform } from "react-native";
import { Audio } from "expo-av";

export function useSiren(isEmergencyActive: boolean) {
  const soundRef = useRef<Audio.Sound | null>(null);

  const stopSiren = useCallback(async () => {
    const s = soundRef.current;
    soundRef.current = null;
    if (s) {
      try {
        await s.stopAsync();
        await s.unloadAsync();
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return;

    if (isEmergencyActive) {
      (async () => {
        try {
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
            shouldDuckAndroid: false,
          });
          const { sound } = await Audio.Sound.createAsync(
            require("../assets/sounds/alarm.mp3"),
            { shouldPlay: true, isLooping: true, volume: 1.0 }
          );
          soundRef.current = sound;
        } catch (e) {
          console.error("Siren play error:", e);
        }
      })();
    } else {
      stopSiren();
    }

    return () => {
      stopSiren();
    };
  }, [isEmergencyActive]);

  return { stopSiren };
}
