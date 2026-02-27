import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetch } from "expo/fetch";
import { getApiUrl } from "@/lib/query-client";
import {
  loadTokenFromStorage,
  saveToken,
  clearToken,
  getToken,
} from "@/lib/auth-token";
import type { User } from "@/types";

const CACHED_USER_KEY = "campsync_cached_user";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  offlineMode: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    authCode: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (
    email: string,
    authCode: string,
    newPassword: string
  ) => Promise<void>;
  adminResetPassword: (email: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function apiPost(path: string, body: object, token?: string) {
  const url = new URL(path, getApiUrl()).toString();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
}

async function apiGet(path: string, token: string) {
  const url = new URL(path, getApiUrl()).toString();
  return fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function getCachedUser(): Promise<User | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHED_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function cacheUser(user: User | null) {
  try {
    if (user) {
      await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
    } else {
      await AsyncStorage.removeItem(CACHED_USER_KEY);
    }
  } catch {}
}

function mapApiUser(data: any): User {
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    passwordHash: "",
    role: data.role,
    linkedCamperIds: data.linkedCamperIds ?? [],
    authCode: data.authCode,
    createdAt: data.createdAt,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const token = await loadTokenFromStorage();

        if (!token) {
          setOfflineMode(true);
          setIsLoading(false);
          return;
        }

        let response: Response;
        try {
          response = await apiGet("/api/auth/me", token);
        } catch {
          const cached = await getCachedUser();
          if (cached) {
            setUser(cached);
          } else {
            setOfflineMode(true);
          }
          setIsLoading(false);
          return;
        }

        if (response.ok) {
          const data = await response.json();
          const u = mapApiUser(data);
          setUser(u);
          await cacheUser(u);
          setOfflineMode(false);
        } else {
          await clearToken();
          await cacheUser(null);
          setOfflineMode(true);
        }
      } catch {
        setOfflineMode(true);
      }

      setIsLoading(false);
    })();
  }, []);

  const login = async (email: string, password: string) => {
    let response: Response;
    try {
      response = await apiPost("/api/auth/login", {
        email: email.trim(),
        password: password.trim(),
      });
    } catch {
      throw new Error(
        "Cannot connect to server. Check your internet connection."
      );
    }

    if (!response.ok) {
      let msg = "Login failed";
      try {
        const body = await response.json();
        msg = body.message || msg;
      } catch {}
      throw new Error(msg);
    }

    const { token, user: userData } = await response.json();
    await saveToken(token);
    const u = mapApiUser(userData);
    await cacheUser(u);
    setUser(u);
    setOfflineMode(false);
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    authCode: string
  ) => {
    let response: Response;
    try {
      response = await apiPost("/api/auth/register", {
        name: name.trim(),
        email: email.trim(),
        password,
        authCode: authCode.trim(),
      });
    } catch {
      throw new Error(
        "Cannot connect to server. Check your internet connection."
      );
    }

    if (!response.ok) {
      let msg = "Registration failed";
      try {
        const body = await response.json();
        msg = body.message || msg;
      } catch {}
      throw new Error(msg);
    }

    const { token, user: userData } = await response.json();
    await saveToken(token);
    const u = mapApiUser(userData);
    await cacheUser(u);
    setUser(u);
    setOfflineMode(false);
  };

  const logout = async () => {
    const token = getToken();
    if (token) {
      try {
        await apiPost("/api/auth/logout", {}, token);
      } catch {}
    }
    await clearToken();
    await cacheUser(null);
    setUser(null);
    setOfflineMode(true);
  };

  const resetPassword = async (
    email: string,
    authCode: string,
    newPassword: string
  ) => {
    let response: Response;
    try {
      response = await apiPost("/api/auth/reset-password", {
        email: email.trim(),
        authCode: authCode.trim(),
        newPassword: newPassword.trim(),
      });
    } catch {
      throw new Error("Cannot connect to server. Check your internet connection.");
    }

    if (!response.ok) {
      let msg = "Password reset failed";
      try {
        const body = await response.json();
        msg = body.message || msg;
      } catch {}
      throw new Error(msg);
    }
  };

  const adminResetPassword = async (email: string, newPassword: string) => {
    const token = getToken();
    if (!token) throw new Error("Not authenticated");

    let response: Response;
    try {
      response = await apiPost(
        "/api/auth/admin-reset-password",
        { email: email.trim(), newPassword: newPassword.trim() },
        token
      );
    } catch {
      throw new Error("Cannot connect to server. Check your internet connection.");
    }

    if (!response.ok) {
      let msg = "Password reset failed";
      try {
        const body = await response.json();
        msg = body.message || msg;
      } catch {}
      throw new Error(msg);
    }
  };

  const value = useMemo(
    () => ({
      user,
      isLoading,
      offlineMode,
      login,
      register,
      logout,
      resetPassword,
      adminResetPassword,
    }),
    [user, isLoading, offlineMode]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
