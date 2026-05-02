import { Alert, Platform } from "react-native";

export function alertMessage(title: string, message?: string): void {
  if (Platform.OS === "web") {
    if (typeof window === "undefined" || typeof window.alert !== "function") return;
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

export function confirmAction(
  title: string,
  message: string,
  onConfirm: () => void | Promise<void>,
  options?: { confirmLabel?: string; destructive?: boolean }
): void {
  const confirmLabel = options?.confirmLabel ?? "Confirm";

  if (Platform.OS === "web") {
    if (typeof window === "undefined" || typeof window.confirm !== "function") {
      return;
    }
    const ok = window.confirm(`${title}\n\n${message}`);
    if (ok) {
      void onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    {
      text: confirmLabel,
      style: options?.destructive ? "destructive" : "default",
      onPress: () => {
        void onConfirm();
      },
    },
  ]);
}
