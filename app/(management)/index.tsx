import { Redirect } from "expo-router";
import React from "react";

export default function ManagementIndex() {
  return <Redirect href="/(management)/(tabs)" />;
}
