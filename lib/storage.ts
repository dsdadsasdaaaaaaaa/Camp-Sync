import AsyncStorage from "@react-native-async-storage/async-storage";

export async function getItem<T>(key: string): Promise<T | null> {
  try {
    const value = await AsyncStorage.getItem(key);
    if (value === null) return null;
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export async function setItem<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function removeItem(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}

export async function mergeItem<T extends object>(key: string, updates: Partial<T>): Promise<T | null> {
  const existing = await getItem<T>(key);
  if (!existing) return null;
  const merged = { ...existing, ...updates };
  await setItem(key, merged);
  return merged;
}

export const KEYS = {
  USERS: "campsync_users",
  CAMPERS: "campsync_campers",
  SESSIONS: "campsync_sessions",
  CHECK_INS: "campsync_checkins",
  AUTH_CODES: "campsync_auth_codes",
  PENDING_UPDATES: "campsync_pending_updates",
  CURRENT_USER_ID: "campsync_current_user_id",
} as const;
