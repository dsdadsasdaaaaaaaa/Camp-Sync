import { useColorScheme } from "react-native";
import Colors from "@/constants/colors";

export function useColors() {
  const scheme = useColorScheme();
  return scheme === "dark" ? Colors.dark : Colors.light;
}

export function useIsDark() {
  return useColorScheme() === "dark";
}
