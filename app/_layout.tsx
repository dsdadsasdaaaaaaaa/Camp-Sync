import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState, createContext, useContext } from "react";
import { View, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import OfflineBanner from "@/components/OfflineBanner";
import { queryClient } from "@/lib/query-client";
import { AuthProvider } from "@/contexts/AuthContext";
import { DataProvider } from "@/contexts/DataContext";
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  useFonts,
} from "@expo-google-fonts/outfit";

SplashScreen.preventAutoHideAsync();

export const ThemeContext = createContext<{
  isDark: boolean;
  toggleTheme: (v: boolean) => void;
  useSystem: boolean;
  setUseSystem: (v: boolean) => void;
}>({
  isDark: false,
  toggleTheme: () => {},
  useSystem: true,
  setUseSystem: () => {},
});

export const useTheme = () => useContext(ThemeContext);

function RootLayoutNav() {
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState(systemScheme === "dark");
  const [useSystem, setUseSystem] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem("theme_settings").then((val) => {
      if (val) {
        const { isDark: savedDark, useSystem: savedSystem } = JSON.parse(val);
        setUseSystem(savedSystem);
        if (!savedSystem) setIsDark(savedDark);
      }
    });
  }, []);

  useEffect(() => {
    if (useSystem) {
      setIsDark(systemScheme === "dark");
    }
  }, [systemScheme, useSystem]);

  const handleToggleTheme = (dark: boolean) => {
    setIsDark(dark);
    setUseSystem(false);
    AsyncStorage.setItem("theme_settings", JSON.stringify({ isDark: dark, useSystem: false }));
  };

  const handleSetUseSystem = (system: boolean) => {
    setUseSystem(system);
    if (system) setIsDark(systemScheme === "dark");
    AsyncStorage.setItem("theme_settings", JSON.stringify({ isDark, useSystem: system }));
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme: handleToggleTheme, useSystem, setUseSystem: handleSetUseSystem }}>
      <View style={{ flex: 1 }}>
        <OfflineBanner />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(offline)" />
          <Stack.Screen name="(management)" />
          <Stack.Screen name="(staff)" />
          <Stack.Screen name="(parent)" />
        </Stack>
      </View>
    </ThemeContext.Provider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <AuthProvider>
              <DataProvider>
                <RootLayoutNav />
              </DataProvider>
            </AuthProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
