import { Stack } from "expo-router";
import React from "react";

export default function ManagementLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="account" />
      <Stack.Screen name="camper" />
      <Stack.Screen name="index" />
      <Stack.Screen name="campers" />
      <Stack.Screen name="nfc" />
      <Stack.Screen name="pending" />
      <Stack.Screen name="more" />
    </Stack>
  );
}
