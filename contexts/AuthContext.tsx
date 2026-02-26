import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { getItem, setItem, KEYS } from "@/lib/storage";
import { hashPassword, generateId } from "@/lib/crypto";
import type { User, UserRole, AuthCode } from "@/types";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    authCode: string
  ) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const SECURE_KEY = "campsync_user_id";

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
    return;
  }
  return SecureStore.setItemAsync(key, value);
}

async function secureDelete(key: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(key);
    return;
  }
  return SecureStore.deleteItemAsync(key);
}

async function seedInitialData() {
  const users = await getItem<User[]>(KEYS.USERS);
  if (users && users.length > 0) return;

  const codes = await getItem<AuthCode[]>(KEYS.AUTH_CODES);
  if (!codes) {
    const mgmtId = generateId();
    const initialCodes: AuthCode[] = [
      {
        code: "MGMT-MASTER-2024",
        role: "management",
        used: false,
        createdAt: new Date().toISOString(),
        createdBy: "system",
      },
      {
        code: "STAFF-001",
        role: "staff",
        used: false,
        createdAt: new Date().toISOString(),
        createdBy: "system",
      },
      {
        code: "STAFF-002",
        role: "staff",
        used: false,
        createdAt: new Date().toISOString(),
        createdBy: "system",
      },
    ];
    await setItem(KEYS.AUTH_CODES, initialCodes);
  }

  if (!users || users.length === 0) {
    await setItem<User[]>(KEYS.USERS, []);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      await seedInitialData();
      try {
        const userId = await secureGet(SECURE_KEY);
        if (userId) {
          const users = await getItem<User[]>(KEYS.USERS);
          const found = users?.find((u) => u.id === userId);
          if (found) setUser(found);
        }
      } catch {}
      setIsLoading(false);
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const users = await getItem<User[]>(KEYS.USERS);
    if (!users) throw new Error("No accounts found");
    const hash = await hashPassword(password);
    const found = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === hash
    );
    if (!found) throw new Error("Invalid email or password");
    await secureSet(SECURE_KEY, found.id);
    setUser(found);
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    authCode: string
  ) => {
    const codes = await getItem<AuthCode[]>(KEYS.AUTH_CODES);
    if (!codes) throw new Error("Invalid auth code");

    const code = codes.find(
      (c) => c.code.toUpperCase() === authCode.toUpperCase() && !c.used
    );
    if (!code) throw new Error("Invalid or already-used auth code");

    const users = (await getItem<User[]>(KEYS.USERS)) || [];
    if (users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error("An account with this email already exists");
    }

    const hash = await hashPassword(password);
    const newUser: User = {
      id: generateId(),
      name,
      email,
      passwordHash: hash,
      role: code.role,
      linkedCamperIds: code.linkedCamperId ? [code.linkedCamperId] : [],
      authCode: code.code,
      createdAt: new Date().toISOString(),
    };

    const updatedCodes = codes.map((c) =>
      c.code === code.code
        ? { ...c, used: true, usedBy: newUser.id }
        : c
    );

    await setItem(KEYS.USERS, [...users, newUser]);
    await setItem(KEYS.AUTH_CODES, updatedCodes);

    if (code.role === "parent" && code.linkedCamperId) {
      const campers = (await getItem<any[]>(KEYS.CAMPERS)) || [];
      const updated = campers.map((c) =>
        c.id === code.linkedCamperId
          ? { ...c, parentAuthCode: code.code }
          : c
      );
      await setItem(KEYS.CAMPERS, updated);
    }

    await secureSet(SECURE_KEY, newUser.id);
    setUser(newUser);
  };

  const logout = async () => {
    await secureDelete(SECURE_KEY);
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, isLoading, login, register, logout }),
    [user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
