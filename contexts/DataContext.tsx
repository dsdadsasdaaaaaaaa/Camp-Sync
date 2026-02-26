import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  ReactNode,
} from "react";
import { getItem, setItem, KEYS } from "@/lib/storage";
import { generateId, generateWristbandId, encryptWristbandData } from "@/lib/crypto";
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
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [campers, setCampers] = useState<Camper[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [authCodes, setAuthCodes] = useState<AuthCode[]>([]);
  const [pendingUpdates, setPendingUpdates] = useState<PendingWristbandUpdate[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [c, s, ci, ac, pu, u] = await Promise.all([
      getItem<Camper[]>(KEYS.CAMPERS),
      getItem<Session[]>(KEYS.SESSIONS),
      getItem<CheckIn[]>(KEYS.CHECK_INS),
      getItem<AuthCode[]>(KEYS.AUTH_CODES),
      getItem<PendingWristbandUpdate[]>(KEYS.PENDING_UPDATES),
      getItem<User[]>(KEYS.USERS),
    ]);
    setCampers(c || []);
    setSessions(s || []);
    setCheckIns(ci || []);
    setAuthCodes(ac || []);
    setPendingUpdates(pu || []);
    setUsers(u || []);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    (async () => {
      setIsLoading(true);
      await refresh();
      setIsLoading(false);
    })();
  }, [refresh, authLoading, user]);

  const addCamper = useCallback(
    async (data: Omit<Camper, "id" | "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString();
      const newCamper: Camper = {
        ...data,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      };
      const updated = [...campers, newCamper];
      await setItem(KEYS.CAMPERS, updated);
      setCampers(updated);
      return newCamper;
    },
    [campers]
  );

  const updateCamper = useCallback(
    async (id: string, data: Partial<Camper>) => {
      const updated = campers.map((c) =>
        c.id === id ? { ...c, ...data, updatedAt: new Date().toISOString() } : c
      );
      await setItem(KEYS.CAMPERS, updated);
      setCampers(updated);

      const activeCheckIn = checkIns.find(
        (ci) => ci.camperId === id && !ci.checkedOutAt
      );
      if (activeCheckIn && user) {
        const pending = pendingUpdates.filter((p) => !p.resolved);
        const alreadyExists = pending.find((p) => p.camperId === id);
        if (!alreadyExists) {
          const camper = campers.find((c) => c.id === id);
          const newPending: PendingWristbandUpdate = {
            id: generateId(),
            camperId: id,
            camperName: camper
              ? `${camper.firstName} ${camper.lastName}`
              : "Unknown",
            requestedAt: new Date().toISOString(),
            requestedBy: user.id,
            requestedByName: user.name,
            resolved: false,
          };
          const updatedPending = [...pendingUpdates, newPending];
          await setItem(KEYS.PENDING_UPDATES, updatedPending);
          setPendingUpdates(updatedPending);
        }
      }
    },
    [campers, checkIns, pendingUpdates, user]
  );

  const deleteCamper = useCallback(
    async (id: string) => {
      const updated = campers.filter((c) => c.id !== id);
      await setItem(KEYS.CAMPERS, updated);
      setCampers(updated);
    },
    [campers]
  );

  const programWristband = useCallback(
    async (camperId: string) => {
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

      const updated = campers.map((c) =>
        c.id === camperId
          ? {
              ...c,
              wristbandId,
              wristbandLastProgrammed: now,
              wristbandEncryptedData: encrypted,
              updatedAt: now,
            }
          : c
      );
      await setItem(KEYS.CAMPERS, updated);
      setCampers(updated);

      const updatedPending = pendingUpdates.map((p) =>
        p.camperId === camperId && !p.resolved
          ? {
              ...p,
              resolved: true,
              resolvedAt: now,
              resolvedBy: user?.id,
              resolvedByName: user?.name,
            }
          : p
      );
      await setItem(KEYS.PENDING_UPDATES, updatedPending);
      setPendingUpdates(updatedPending);

      return wristbandId;
    },
    [campers, pendingUpdates, user]
  );

  const addSession = useCallback(
    async (data: Omit<Session, "id" | "createdAt">) => {
      const newSession: Session = {
        ...data,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };
      const updated = [...sessions, newSession];
      await setItem(KEYS.SESSIONS, updated);
      setSessions(updated);
    },
    [sessions]
  );

  const updateSession = useCallback(
    async (id: string, data: Partial<Session>) => {
      const updated = sessions.map((s) =>
        s.id === id ? { ...s, ...data } : s
      );
      await setItem(KEYS.SESSIONS, updated);
      setSessions(updated);
    },
    [sessions]
  );

  const deleteSession = useCallback(
    async (id: string) => {
      const updated = sessions.filter((s) => s.id !== id);
      await setItem(KEYS.SESSIONS, updated);
      setSessions(updated);
    },
    [sessions]
  );

  const checkInCamper = useCallback(
    async (camperId: string, sessionId: string) => {
      if (!user) throw new Error("Not authenticated");
      const existing = checkIns.find(
        (ci) => ci.camperId === camperId && !ci.checkedOutAt
      );
      if (existing) throw new Error("Camper is already checked in");

      const newCheckIn: CheckIn = {
        id: generateId(),
        camperId,
        sessionId,
        checkedInAt: new Date().toISOString(),
        checkedInBy: user.id,
        checkedInByName: user.name,
      };
      const updated = [...checkIns, newCheckIn];
      await setItem(KEYS.CHECK_INS, updated);
      setCheckIns(updated);
    },
    [checkIns, user]
  );

  const checkOutCamper = useCallback(
    async (checkInId: string) => {
      if (!user) throw new Error("Not authenticated");
      const updated = checkIns.map((ci) =>
        ci.id === checkInId
          ? {
              ...ci,
              checkedOutAt: new Date().toISOString(),
              checkedOutBy: user.id,
              checkedOutByName: user.name,
            }
          : ci
      );
      await setItem(KEYS.CHECK_INS, updated);
      setCheckIns(updated);
    },
    [checkIns, user]
  );

  const getActiveCheckIn = useCallback(
    (camperId: string) => {
      return checkIns.find((ci) => ci.camperId === camperId && !ci.checkedOutAt);
    },
    [checkIns]
  );

  const createAuthCode = useCallback(
    async (role: UserRole, maxUses: number, linkedCamperId?: string) => {
      if (!user) throw new Error("Not authenticated");
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      const randomPart = Array.from({ length: 8 }, () =>
        chars[Math.floor(Math.random() * chars.length)]
      ).join("");

      const prefix =
        role === "management"
          ? "MGMT"
          : role === "staff"
          ? "STAFF"
          : "PARENT";
      const code = `${prefix}-${randomPart}`;

      const newCode: AuthCode = {
        code,
        role,
        linkedCamperId,
        maxUses,
        usedCount: 0,
        usedBy: [],
        createdAt: new Date().toISOString(),
        createdBy: user.id,
      };

      const updated = [...authCodes, newCode];
      await setItem(KEYS.AUTH_CODES, updated);
      setAuthCodes(updated);
      return code;
    },
    [authCodes, user]
  );

  const updateAuthCode = useCallback(
    async (code: string, data: Partial<AuthCode>) => {
      const updated = authCodes.map((c) =>
        c.code === code ? { ...c, ...data } : c
      );
      await setItem(KEYS.AUTH_CODES, updated);
      setAuthCodes(updated);
    },
    [authCodes]
  );

  const deleteAuthCode = useCallback(
    async (code: string) => {
      const updated = authCodes.filter((c) => c.code !== code);
      await setItem(KEYS.AUTH_CODES, updated);
      setAuthCodes(updated);
    },
    [authCodes]
  );

  const resolvePendingUpdate = useCallback(
    async (updateId: string) => {
      const update = pendingUpdates.find((p) => p.id === updateId);
      if (!update) return;
      await programWristband(update.camperId);
    },
    [pendingUpdates, programWristband]
  );

  const getTodaySessions = useCallback(() => {
    const today = new Date().toISOString().split("T")[0];
    return sessions.filter(
      (s) => s.isActive && s.authorizedDates.includes(today)
    );
  }, [sessions]);

  const canStaffCheckIn = useCallback(() => {
    return getTodaySessions().length > 0;
  }, [getTodaySessions]);

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
    }),
    [
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
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
