import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  ReactNode,
} from "react";
import { apiRequest } from "@/lib/query-client";
import { generateId, generateWristbandId, encryptWristbandData } from "@/lib/crypto";
import { scheduleCheckInNotification, scheduleWristbandUpdateNotification } from "@/lib/notifications";
import type {
  Camper,
  Session,
  CheckIn,
  AuthCode,
  PendingWristbandUpdate,
  MedicalInfo,
  User,
  UserRole,
} from "@/types";
import { useAuth } from "./AuthContext";

interface DataContextValue {
  campers: Camper[];
  sessions: Session[];
  checkIns: CheckIn[];
  authCodes: AuthCode[];
  pendingUpdates: PendingWristbandUpdate[];
  users: User[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  addCamper: (data: Omit<Camper, "id" | "createdAt" | "updatedAt">) => Promise<Camper>;
  updateCamper: (id: string, data: Partial<Camper>) => Promise<void>;
  deleteCamper: (id: string) => Promise<void>;
  programWristband: (camperId: string) => Promise<string>;
  addSession: (data: Omit<Session, "id" | "createdAt">) => Promise<void>;
  updateSession: (id: string, data: Partial<Session>) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  checkInCamper: (camperId: string, sessionId: string) => Promise<void>;
  checkOutCamper: (checkInId: string) => Promise<void>;
  getActiveCheckIn: (camperId: string) => CheckIn | undefined;
  createAuthCode: (role: UserRole, maxUses: number, linkedCamperId?: string) => Promise<string>;
  updateAuthCode: (code: string, data: Partial<AuthCode>) => Promise<void>;
  deleteAuthCode: (code: string) => Promise<void>;
  resolvePendingUpdate: (updateId: string) => Promise<void>;
  getTodaySessions: () => Session[];
  canStaffCheckIn: () => boolean;
  updateUser: (id: string, data: Partial<Pick<User, "name" | "email" | "role" | "linkedCamperIds">>) => Promise<User>;
  deleteUser: (id: string) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

async function safeGet<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await apiRequest("GET", path);
    return await res.json();
  } catch {
    return fallback;
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading, offlineMode } = useAuth();
  const [campers, setCampers] = useState<Camper[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [authCodes, setAuthCodes] = useState<AuthCode[]>([]);
  const [pendingUpdates, setPendingUpdates] = useState<PendingWristbandUpdate[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user || offlineMode) return;
    
    // Only set loading if we don't have data yet
    const hasData = campers.length > 0;
    if (!hasData) {
      setIsLoading(true);
    }
    
    try {
      const [c, s, ci, pu, ac] = await Promise.all([
        safeGet<Camper[]>("/api/campers", []),
        safeGet<Session[]>("/api/sessions", []),
        safeGet<CheckIn[]>("/api/check-ins", []),
        safeGet<PendingWristbandUpdate[]>("/api/pending-updates", []),
        safeGet<AuthCode[]>("/api/auth/codes", []),
      ]);
      setCampers(c);
      setSessions(s);
      setCheckIns(ci);
      setPendingUpdates(pu);
      setAuthCodes(ac);

      // Fetch users only for management
      if (user.role === "management") {
        const u = await safeGet<User[]>("/api/users", []);
        setUsers(u);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, offlineMode]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || offlineMode) {
      setCampers([]);
      setSessions([]);
      setCheckIns([]);
      setAuthCodes([]);
      setPendingUpdates([]);
      setUsers([]);
      return;
    }
    refresh();

    const poll = setInterval(async () => {
      if (!user || offlineMode) return;
      try {
        const [c, s, ci, pu, ac] = await Promise.all([
          safeGet<Camper[]>("/api/campers", []),
          safeGet<Session[]>("/api/sessions", []),
          safeGet<CheckIn[]>("/api/check-ins", []),
          safeGet<PendingWristbandUpdate[]>("/api/pending-updates", []),
          safeGet<AuthCode[]>("/api/auth/codes", []),
        ]);
        setCampers(c);
        setSessions(s);
        setCheckIns(ci);
        setPendingUpdates(pu);
        setAuthCodes(ac);
        if (user.role === "management") {
          const u = await safeGet<User[]>("/api/users", []);
          setUsers(u);
        }
      } catch {
      }
    }, 30000);

    return () => clearInterval(poll);
  }, [authLoading, user, offlineMode]);

  // ── Campers ─────────────────────────────────────────────────────────────────

  const addCamper = useCallback(
    async (data: Omit<Camper, "id" | "createdAt" | "updatedAt">) => {
      const res = await apiRequest("POST", "/api/campers", data);
      const newCamper: Camper = await res.json();
      setCampers((prev) => [...prev, newCamper]);
      return newCamper;
    },
    []
  );

  const updateCamper = useCallback(
    async (id: string, data: Partial<Camper>) => {
      const res = await apiRequest("PATCH", `/api/campers/${id}`, data);
      const updated: Camper = await res.json();
      setCampers((prev) => prev.map((c) => (c.id === id ? updated : c)));

      // If camper is currently checked in and data on wristband changed, create a pending update
      const wristbandDataChanged = data.medical || data.firstName || data.lastName || data.dateOfBirth;
      if (wristbandDataChanged && user) {
        const activeCheckIn = checkIns.find((ci) => ci.camperId === id && !ci.checkedOutAt);
        if (activeCheckIn) {
          const existing = pendingUpdates.find((p) => p.camperId === id && !p.resolved);
          if (!existing) {
            const camper = updated;
            const camperName = `${camper.firstName} ${camper.lastName}`;
            try {
              const puRes = await apiRequest("POST", "/api/pending-updates", { camperId: id, camperName });
              const pu: PendingWristbandUpdate = await puRes.json();
              setPendingUpdates((prev) => [...prev, pu]);
              scheduleWristbandUpdateNotification(camperName);
            } catch (e) {
              console.error("Failed to create pending update:", e);
            }
          }
        }
      }
    },
    [checkIns, pendingUpdates, campers, user]
  );

  const deleteCamper = useCallback(async (id: string) => {
    await apiRequest("DELETE", `/api/campers/${id}`);
    setCampers((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const programWristband = useCallback(
    async (camperId: string): Promise<string> => {
      const camper = campers.find((c) => c.id === camperId);
      if (!camper) throw new Error("Camper not found");

      const wristbandId = camper.wristbandId || generateWristbandId();
      const payload = {
        camperId: camper.id,
        firstName: camper.firstName,
        lastName: camper.lastName,
        dateOfBirth: camper.dateOfBirth,
        medical: camper.medical,
        programmedAt: new Date().toISOString(),
        appVersion: "1.0",
      };

      const encrypted = encryptWristbandData(payload);
      const now = new Date().toISOString();

      const res = await apiRequest("PATCH", `/api/campers/${camperId}`, {
        wristbandId,
        wristbandLastProgrammed: now,
        wristbandEncryptedData: encrypted,
      });
      const updated: Camper = await res.json();
      setCampers((prev) => prev.map((c) => (c.id === camperId ? updated : c)));

      // Auto check-in if not already checked in
      const activeCheckIn = checkIns.find((ci) => ci.camperId === camperId && !ci.checkedOutAt);
      if (!activeCheckIn) {
        const todaySessions = getTodaySessions();
        const sessionId = todaySessions[0]?.id || "MANAGEMENT_OVERRIDE";
        try {
          await checkInCamper(camperId, sessionId);
        } catch (e) {
          console.error("Auto check-in failed:", e);
        }
      }

      // Resolve pending updates for this camper
      const unresolved = pendingUpdates.filter((p) => p.camperId === camperId && !p.resolved);
      for (const pu of unresolved) {
        try {
          await apiRequest("PATCH", `/api/pending-updates/${pu.id}/resolve`);
          // Update local state for each resolved update
          setPendingUpdates((prev) =>
            prev.map((p) =>
              p.id === pu.id
                ? { ...p, resolved: true, resolvedAt: now, resolvedBy: user?.id, resolvedByName: user?.name }
                : p
            )
          );
        } catch (e) {
          console.error("Failed to resolve update on server:", e);
        }
      }

      return wristbandId;
    },
    [campers, pendingUpdates, user]
  );

  // ── Sessions ─────────────────────────────────────────────────────────────────

  const addSession = useCallback(async (data: Omit<Session, "id" | "createdAt">) => {
    const res = await apiRequest("POST", "/api/sessions", data);
    const newSession: Session = await res.json();
    setSessions((prev) => [...prev, newSession]);
  }, []);

  const updateSession = useCallback(async (id: string, data: Partial<Session>) => {
    const res = await apiRequest("PATCH", `/api/sessions/${id}`, data);
    const updated: Session = await res.json();
    setSessions((prev) => prev.map((s) => (s.id === id ? updated : s)));
  }, []);

  const deleteSession = useCallback(async (id: string) => {
    await apiRequest("DELETE", `/api/sessions/${id}`);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // ── Check-ins ─────────────────────────────────────────────────────────────────

  const checkInCamper = useCallback(
    async (camperId: string, sessionId: string) => {
      if (!user) throw new Error("Not authenticated");
      const res = await apiRequest("POST", "/api/check-ins", { camperId, sessionId });
      const newCheckIn: CheckIn = await res.json();
      setCheckIns((prev) => [...prev, newCheckIn]);

      const camper = campers.find((c) => c.id === camperId);
      if (camper) {
        scheduleCheckInNotification(`${camper.firstName} ${camper.lastName}`, "in", user.name);
      }
    },
    [user, campers]
  );

  const checkOutCamper = useCallback(
    async (checkInId: string) => {
      if (!user) throw new Error("Not authenticated");
      const res = await apiRequest("PATCH", `/api/check-ins/${checkInId}/checkout`);
      const updated: CheckIn = await res.json();
      setCheckIns((prev) => prev.map((ci) => (ci.id === checkInId ? updated : ci)));

      const camper = campers.find((c) => c.id === updated.camperId);
      if (camper) {
        scheduleCheckInNotification(`${camper.firstName} ${camper.lastName}`, "out", user.name);
      }
    },
    [user, campers]
  );

  const getActiveCheckIn = useCallback(
    (camperId: string) => checkIns.find((ci) => ci.camperId === camperId && !ci.checkedOutAt),
    [checkIns]
  );

  // ── Auth Codes ────────────────────────────────────────────────────────────────

  const createAuthCode = useCallback(
    async (role: UserRole, maxUses: number, linkedCamperId?: string) => {
      const res = await apiRequest("POST", "/api/auth/codes", { role, maxUses, linkedCamperId });
      const newCode: AuthCode = await res.json();
      setAuthCodes((prev) => [...prev, newCode]);
      return newCode.code;
    },
    []
  );

  const updateAuthCode = useCallback(async (code: string, data: Partial<AuthCode>) => {
    await apiRequest("PATCH", `/api/auth/codes/${encodeURIComponent(code)}`, data);
    setAuthCodes((prev) => prev.map((c) => (c.code === code ? { ...c, ...data } : c)));
  }, []);

  const deleteAuthCode = useCallback(async (code: string) => {
    await apiRequest("DELETE", `/api/auth/codes/${encodeURIComponent(code)}`);
    setAuthCodes((prev) => prev.filter((c) => c.code !== code));
  }, []);

  // ── Users ────────────────────────────────────────────────────────────────────

  const updateUser = useCallback(
    async (id: string, data: Partial<Pick<User, "name" | "email" | "role" | "linkedCamperIds">>) => {
      const res = await apiRequest("PATCH", `/api/users/${id}`, data);
      const updated: User = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
      return updated;
    },
    []
  );

  const deleteUser = useCallback(async (id: string) => {
    await apiRequest("DELETE", `/api/users/${id}`);
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }, []);

  // ── Pending Updates ────────────────────────────────────────────────────────────

  const resolvePendingUpdate = useCallback(
    async (updateId: string) => {
      const update = pendingUpdates.find((p) => p.id === updateId);
      if (!update) return;
      await programWristband(update.camperId);
    },
    [pendingUpdates, programWristband]
  );

  // ── Session helpers ────────────────────────────────────────────────────────────

  const getTodaySessions = useCallback(() => {
    const today = new Date().toISOString().split("T")[0];
    return sessions.filter((s) => s.isActive && s.authorizedDates.includes(today));
  }, [sessions]);

  const canStaffCheckIn = useCallback(() => getTodaySessions().length > 0, [getTodaySessions]);

  const value = useMemo(
    () => ({
      campers,
      sessions,
      checkIns,
      authCodes,
      pendingUpdates,
      users,
      isLoading,
      refresh,
      addCamper,
      updateCamper,
      deleteCamper,
      programWristband,
      addSession,
      updateSession,
      deleteSession,
      checkInCamper,
      checkOutCamper,
      getActiveCheckIn,
      createAuthCode,
      updateAuthCode,
      deleteAuthCode,
      resolvePendingUpdate,
      getTodaySessions,
      canStaffCheckIn,
      updateUser,
      deleteUser,
    }),
    [
      campers, sessions, checkIns, authCodes, pendingUpdates, users, isLoading,
      refresh, addCamper, updateCamper, deleteCamper, programWristband,
      addSession, updateSession, deleteSession, checkInCamper, checkOutCamper,
      getActiveCheckIn, createAuthCode, updateAuthCode, deleteAuthCode,
      resolvePendingUpdate, getTodaySessions, canStaffCheckIn, updateUser, deleteUser,
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
