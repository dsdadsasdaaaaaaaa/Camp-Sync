import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs, useFocusEffect } from "expo-router";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import React, { useState, useEffect, useCallback } from "react";
import Colors from "@/constants/colors";
import { useTheme } from "@/app/_layout";
import { subscribeActivityBadge, getActivityBadge } from "@/lib/activityBadge";

function BadgeDot({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={{
      position: "absolute",
      top: -4,
      right: -8,
      backgroundColor: Colors.danger,
      borderRadius: 9,
      minWidth: 18,
      height: 18,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 4,
    }}>
      <Text style={{ color: "#fff", fontSize: 11, fontFamily: "Outfit_700Bold" }}>
        {count > 99 ? "99+" : count}
      </Text>
    </View>
  );
}

function useActivityBadge() {
  const [badge, setBadge] = useState(getActivityBadge());
  useEffect(() => {
    return subscribeActivityBadge(setBadge);
  }, []);
  return badge;
}

function NativeTabLayout() {
  const badge = useActivityBadge();
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "person.2", selected: "person.2.fill" }} />
        <Label>My Children</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="notifications">
        <Icon sf={{ default: "bell", selected: "bell.fill" }} />
        <Label>Activity</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: "person.circle", selected: "person.circle.fill" }} />
        <Label>Account</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const { isDark } = useTheme();
  const badge = useActivityBadge();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const theme = isDark ? Colors.dark : Colors.light;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.tint,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : theme.surface,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: theme.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={100} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.surface }]} />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "My Children",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "people" : "people-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Activity",
          tabBarIcon: ({ color, focused }) => (
            <View>
              <Ionicons name={focused ? "notifications" : "notifications-outline"} size={24} color={color} />
              <BadgeDot count={badge} />
            </View>
          ),
          tabBarBadge: badge > 0 ? badge : undefined,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Account",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

export default function ParentTabsLayout() {
  if (isLiquidGlassAvailable()) return <NativeTabLayout />;
  return <ClassicTabLayout />;
}
