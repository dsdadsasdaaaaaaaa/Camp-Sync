import { Alert, Platform } from "react-native";

if (Platform.OS === "web" && typeof window !== "undefined") {
  Alert.alert = ((
    title: string,
    message?: string,
    buttons?: Array<{ text?: string; onPress?: (value?: any) => void; style?: "default" | "cancel" | "destructive" }>,
    _options?: unknown
  ) => {
    const body = message ? `${title}\n\n${message}` : title;

    if (!buttons || buttons.length === 0) {
      window.alert(body);
      return;
    }

    if (buttons.length === 1) {
      window.alert(body);
      const btn = buttons[0];
      if (btn?.onPress) {
        try { btn.onPress(); } catch { /* swallow */ }
      }
      return;
    }

    const nonCancelButtons = buttons.filter((b) => b.style !== "cancel");
    const confirmBtn = nonCancelButtons[nonCancelButtons.length - 1] ?? buttons[buttons.length - 1];
    const cancelBtn = buttons.find((b) => b.style === "cancel");

    const ok = window.confirm(body);
    if (ok) {
      if (confirmBtn?.onPress) {
        try { confirmBtn.onPress(); } catch { /* swallow */ }
      }
    } else {
      if (cancelBtn?.onPress) {
        try { cancelBtn.onPress(); } catch { /* swallow */ }
      }
    }
  }) as typeof Alert.alert;
}
