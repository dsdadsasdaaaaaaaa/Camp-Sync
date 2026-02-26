import { Stack } from "expo-router";
import React from "react";

export default function CamperLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[id]" />
      <Stack.Screen name="new" options={{ presentation: "modal" }} />
    </Stack>
  );
}
