import { useEffect } from "react";
import { router } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import Colors from "@/constants/colors";

export default function IndexScreen() {
  const { user, isLoading, offlineMode } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (offlineMode && !user) {
      router.replace("/(offline)");
    } else if (!user) {
      router.replace("/(auth)/login");
    } else if (user.role === "management") {
      router.replace("/(management)");
    } else if (user.role === "staff") {
      router.replace("/(staff)");
    } else if (user.role === "parent") {
      router.replace("/(parent)");
    }
  }, [user, isLoading, offlineMode]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: Colors.light.background,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}
