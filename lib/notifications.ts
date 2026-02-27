import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

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
