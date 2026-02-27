import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "campsync_session_token";

let _token: string | null = null;

export function getToken(): string | null {
  return _token;
}

export function setTokenInMemory(token: string | null) {
  _token = token;
}

export async function loadTokenFromStorage(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      _token = localStorage.getItem(TOKEN_KEY);
    } else {
      _token = await SecureStore.getItemAsync(TOKEN_KEY);
    }
    return _token;
  } catch {
    return null;
  }
}

export async function saveToken(token: string): Promise<void> {
  _token = token;
  try {
    if (Platform.OS === "web") {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    }
  } catch {}
}

export async function clearToken(): Promise<void> {
  _token = null;
  try {
    if (Platform.OS === "web") {
      localStorage.removeItem(TOKEN_KEY);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  } catch {}
}
