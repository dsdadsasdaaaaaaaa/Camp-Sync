import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { getApiUrl } from "@/lib/query-client";
import { getToken } from "@/lib/auth-token";

export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync("default", {
      name: "General Notifications",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
      enableVibrate: true,
    });
    await Notifications.setNotificationChannelAsync("emergency", {
      name: "Emergency Alerts",
      importance: Notifications.AndroidImportance.MAX,
      sound: "default",
      vibrationPattern: [0, 500, 250, 500, 250, 500],
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      showBadge: true,
    });
  } catch (e) {
    console.log("Notification channel setup failed (non-fatal):", e);
  }
}

if (Platform.OS !== "web") {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (_) {}
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function registerPushToken(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const granted = await requestNotificationPermissions();
    if (!granted) return;
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenData.data;
    const authToken = getToken();
    if (!authToken || !token) return;
    const url = new URL("/api/users/push-token", getApiUrl()).toString();
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ token }),
    });
  } catch (e) {
    console.log("Push token registration failed (non-fatal):", e);
  }
}

export async function scheduleCheckInNotification(
  camperName: string,
  action: "in" | "out",
  staffName?: string
): Promise<void> {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return;

    const title =
      action === "in"
        ? `${camperName} checked in`
        : `${camperName} checked out`;
    const body =
      action === "in"
        ? `${camperName} has been checked in to camp${staffName ? ` by ${staffName}` : ""}.`
        : `${camperName} has been checked out of camp${staffName ? ` by ${staffName}` : ""}.`;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        data: { type: "check_" + action, camperName },
      },
      trigger: null,
    });
  } catch {}
}

export async function scheduleWristbandUpdateNotification(
  camperName: string
): Promise<void> {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Wristband Update Needed",
        body: `${camperName}'s information has been updated. Their wristband needs reprogramming.`,
        sound: true,
        data: { type: "wristband_update", camperName },
      },
      trigger: null,
    });
  } catch {}
}

export async function clearAllNotifications(): Promise<void> {
  try {
    await Notifications.dismissAllNotificationsAsync();
    await Notifications.setBadgeCountAsync(0);
  } catch {}
}
