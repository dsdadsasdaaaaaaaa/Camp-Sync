import { useColorScheme } from "react-native";
import Colors from "@/constants/colors";
import { useTheme } from "@/app/_layout";

export function useColors() {
  const { isDark } = useTheme();
  return isDark ? Colors.dark : Colors.light;
}

export function useIsDark() {
  const { isDark } = useTheme();
  return isDark;
}
