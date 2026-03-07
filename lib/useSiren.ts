import { useEffect, useRef, useCallback } from "react";
import { Platform } from "react-native";
import { Audio } from "expo-av";

export function useSiren(isEmergencyActive: boolean) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopSiren = useCallback(async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch {}
      soundRef.current = null;
    }
  }, []);

  const playSiren = useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
      });

      const { sound } = await Audio.Sound.createAsync(
        require("../assets/sounds/alarm.mp3"),
        { shouldPlay: true, isLooping: false, volume: 1.0 }
      );
      soundRef.current = sound;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          if (isEmergencyActive) {
            sound.replayAsync().catch(() => {});
          }
        }
      });
    } catch (e) {
      console.error("Siren play error:", e);
    }
  }, [isEmergencyActive]);

  useEffect(() => {
    if (Platform.OS === "web") return;

    if (isEmergencyActive) {
      playSiren();
    } else {
      stopSiren();
    }

    return () => {
      stopSiren();
    };
  }, [isEmergencyActive]);

  return { stopSiren };
}
