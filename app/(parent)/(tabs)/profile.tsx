import React from "react";
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
import { useAuth } from "@/contexts/AuthContext";
import Colors from "@/constants/colors";

export default function ParentProfileScreen() {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();

  const handleLogout = async () => {
    if (Platform.OS === "web") {
      await logout();
      router.replace("/(auth)/login");
      return;
    }
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: async () => {
        await logout();
        router.replace("/(auth)/login");
      }},
    ]);
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
      <Text style={styles.title}>Account</Text>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.name?.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.roleBadge}>
          <Ionicons name="person" size={12} color="#8B5CF6" />
          <Text style={styles.roleText}>Parent Account</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <Ionicons name="shield-checkmark-outline" size={18} color={Colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.infoTitle}>Linked via Auth Code</Text>
          <Text style={styles.infoText}>
            Your account was created using code:{"\n"}
            <Text style={styles.codeText}>{user?.authCode}</Text>
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Your Role</Text>
        <View style={styles.roleRow}>
          <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
          <Text style={styles.roleCapability}>View linked children's info</Text>
        </View>
        <View style={styles.roleRow}>
          <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
          <Text style={styles.roleCapability}>Edit medical & emergency info</Text>
        </View>
        <View style={styles.roleRow}>
          <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
          <Text style={styles.roleCapability}>See check-in/out status in real time</Text>
        </View>
        <View style={styles.roleRow}>
          <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
          <Text style={styles.roleCapability}>View full check-in history</Text>
        </View>
        <View style={[styles.roleRow, { opacity: 0.5 }]}>
          <Ionicons name="close-circle" size={18} color={Colors.danger} />
          <Text style={styles.roleCapability}>Check-in/out campers (staff only)</Text>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.logoutButton,
          { opacity: pressed ? 0.85 : 1 },
        ]}
        onPress={handleLogout}
      >
        <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
        <Text style={styles.logoutText}>Sign Out</Text>
      </Pressable>
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
  profileCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#8B5CF620",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatarText: {
    fontSize: 32,
    fontFamily: "Outfit_700Bold",
    color: "#8B5CF6",
  },
  name: {
    fontSize: 22,
    fontFamily: "Outfit_700Bold",
    color: Colors.light.text,
  },
  email: {
    fontSize: 15,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textSecondary,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#8B5CF615",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginTop: 4,
  },
  roleText: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: "#8B5CF6",
  },
  infoCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: Colors.primary + "10",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.primary + "20",
  },
  infoTitle: {
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.light.text,
  },
  infoText: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  codeText: {
    fontFamily: "Outfit_700Bold",
    color: Colors.primary,
  },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    padding: 20,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Outfit_700Bold",
    color: Colors.light.text,
  },
  roleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  roleCapability: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.text,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.danger + "15",
    borderRadius: 16,
    height: 54,
    borderWidth: 1,
    borderColor: Colors.danger + "30",
  },
  logoutText: {
    fontSize: 16,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.danger,
  },
});
