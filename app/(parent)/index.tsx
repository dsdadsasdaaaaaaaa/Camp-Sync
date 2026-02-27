import { Redirect } from "expo-router";

export default function ParentIndex() {
  return <Redirect href="/(parent)/(tabs)" />;
}
