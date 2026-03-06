import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { db } from "./db";
import {
  csUsers,
  csAuthCodes,
  csUserSessions,
  csCampers,
  csCampSessions,
  csCheckIns,
  csPendingUpdates,
  csResetCodes,
} from "@shared/schema";
import { eq, and, gt, lt, isNull } from "drizzle-orm";
import OpenAI from "openai";
import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  createCipheriv,
  createDecipheriv,
  createHash,
} from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ─── Encryption ───────────────────────────────────────────────────────────────

function getEncKey(): Buffer {
  const secret = process.env.SESSION_SECRET ?? "campsync-dev-secret-32bytes!!!!!";
  return createHash("sha256").update(secret).digest();
}

function encryptMedical(data: object): { encrypted: string; iv: string; authTag: string } {
  const key = getEncKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
  return {
    encrypted: enc.toString("base64"),
    iv: iv.toString("hex"),
    authTag: cipher.getAuthTag().toString("hex"),
  };
}

function decryptMedical(encrypted: string, iv: string, authTag: string): object {
  try {
    const key = getEncKey();
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "hex"));
    decipher.setAuthTag(Buffer.from(authTag, "hex"));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64")),
      decipher.final(),
    ]);
    return JSON.parse(dec.toString("utf8"));
  } catch {
    return {
      allergies: "",
      medications: "",
      conditions: "",
      emergencyContacts: [],
      doctorName: "",
      doctorPhone: "",
      insuranceProvider: "",
      bloodType: "Unknown",
      notes: "",
    };
  }
}

// ─── Password Helpers ──────────────────────────────────────────────────────────

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [hashed, salt] = hash.split(".");
  if (!hashed || !salt) return false;
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  const hashedBuf = Buffer.from(hashed, "hex");
  if (buf.length !== hashedBuf.length) return false;
  return timingSafeEqual(buf, hashedBuf);
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function generateId(): string {
  return randomBytes(9).toString("hex") + Date.now().toString(36);
}

// ─── Expo Push Notifications ──────────────────────────────────────────────────

async function sendExpoPush(tokens: string[], title: string, body: string, data?: object) {
  const messages = tokens
    .filter((t) => t && t.startsWith("ExponentPushToken["))
    .map((to) => ({ to, title, body, sound: "default", data: data || {} }));
  if (messages.length === 0) return;
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(messages),
    });
  } catch (e) {
    console.error("Push notification error:", e);
  }
}

async function notifyParentsOfCamper(camperId: string, title: string, body: string, data?: object) {
  try {
    const allUsers = await db.select().from(csUsers);
    const parentTokens = allUsers
      .filter((u) => {
        const linked: string[] = JSON.parse(u.linkedCamperIds || "[]");
        return linked.includes(camperId) && u.pushToken;
      })
      .map((u) => u.pushToken!)
      .filter(Boolean);
    if (parentTokens.length > 0) await sendExpoPush(parentTokens, title, body, data);
  } catch (e) {
    console.error("Notify parents error:", e);
  }
}

// ─── Auth Middleware ───────────────────────────────────────────────────────────

function authMiddleware(req: Request, res: Response, next: Function) {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  (req as any).sessionToken = authHeader.slice(7);
  next();
}

async function resolveUser(req: Request): Promise<{ userId: string; role: string } | null> {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const [session] = await db
    .select()
    .from(csUserSessions)
    .where(and(eq(csUserSessions.token, token), gt(csUserSessions.expiresAt, new Date())));
  if (!session) return null;
  const [user] = await db.select().from(csUsers).where(eq(csUsers.id, session.userId));
  if (!user) return null;
  return { userId: user.id, role: user.role };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCamper(row: any, medical: object) {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    dateOfBirth: row.dateOfBirth,
    cabinGroup: row.cabinGroup,
    medical,
    wristbandId: row.wristbandId ?? undefined,
    wristbandLastProgrammed: row.wristbandLastProgrammed ?? undefined,
    wristbandEncryptedData: row.wristbandEncryptedData ?? undefined,
    parentAuthCode: row.parentAuthCode ?? undefined,
    photoData: row.photoData ?? undefined,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  };
}

function formatCheckIn(row: any) {
  return {
    id: row.id,
    camperId: row.camperId,
    sessionId: row.sessionId,
    checkedInAt: row.checkedInAt instanceof Date ? row.checkedInAt.toISOString() : row.checkedInAt,
    checkedInBy: row.checkedInBy,
    checkedInByName: row.checkedInByName,
    checkedOutAt: row.checkedOutAt
      ? row.checkedOutAt instanceof Date
        ? row.checkedOutAt.toISOString()
        : row.checkedOutAt
      : undefined,
    checkedOutBy: row.checkedOutBy ?? undefined,
    checkedOutByName: row.checkedOutByName ?? undefined,
  };
}

function formatSession(row: any) {
  return {
    id: row.id,
    name: row.name,
    startDate: row.startDate,
    endDate: row.endDate,
    authorizedDates: JSON.parse(row.authorizedDates || "[]"),
    isActive: row.isActive,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}

function formatPendingUpdate(row: any) {
  return {
    id: row.id,
    camperId: row.camperId,
    camperName: row.camperName,
    requestedAt: row.requestedAt instanceof Date ? row.requestedAt.toISOString() : row.requestedAt,
    requestedBy: row.requestedBy,
    requestedByName: row.requestedByName,
    resolved: row.resolved,
    resolvedAt: row.resolvedAt
      ? row.resolvedAt instanceof Date
        ? row.resolvedAt.toISOString()
        : row.resolvedAt
      : undefined,
    resolvedBy: row.resolvedBy ?? undefined,
    resolvedByName: row.resolvedByName ?? undefined,
  };
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function seedAuthCodes() {
  const existing = await db.select().from(csAuthCodes).limit(1);
  if (existing.length > 0) return;

  const codes = [
    { code: "DEMO-ADMIN", role: "management", maxUses: 0, linkedCamperId: null },
    { code: "DEMO-STAFF", role: "staff", maxUses: 0, linkedCamperId: null },
    { code: "DEMO-PARENT", role: "parent", maxUses: 0, linkedCamperId: null },
    { code: "MGMT-MASTER-2024", role: "management", maxUses: 1, linkedCamperId: null },
    { code: "STAFF-001", role: "staff", maxUses: 1, linkedCamperId: null },
    { code: "STAFF-002", role: "staff", maxUses: 1, linkedCamperId: null },
  ];

  for (const c of codes) {
    await db.insert(csAuthCodes).values({
      code: c.code,
      role: c.role,
      linkedCamperId: c.linkedCamperId,
      maxUses: c.maxUses,
      usedCount: 0,
      usedBy: "[]",
      createdBy: "system",
    }).onConflictDoNothing();
  }
}

const DEMO_CAMPER_ID = "demo-camper-jamie-001";

async function seedDemoUsers() {
  const demoAccounts = [
    { email: "admin@demo.com", name: "Demo Manager", password: "demo1234", authCode: "DEMO-ADMIN", role: "management" },
    { email: "staff@demo.com", name: "Demo Staff", password: "demo1234", authCode: "DEMO-STAFF", role: "staff" },
    { email: "parent@demo.com", name: "Demo Parent", password: "demo1234", authCode: "DEMO-PARENT", role: "parent" },
  ];

  for (const account of demoAccounts) {
    const [existing] = await db.select().from(csUsers).where(eq(csUsers.email, account.email));
    if (existing) continue;

    const passwordHash = await hashPassword(account.password);
    const userId = generateId();
    const linkedCamperIds = account.role === "parent" ? JSON.stringify([DEMO_CAMPER_ID]) : "[]";
    await db.insert(csUsers).values({
      id: userId,
      name: account.name,
      email: account.email,
      passwordHash,
      role: account.role,
      linkedCamperIds,
      authCode: account.authCode,
    });
  }

  // Ensure parent@demo.com always has the demo camper linked (even if already created without it)
  const [parentUser] = await db.select().from(csUsers).where(eq(csUsers.email, "parent@demo.com"));
  if (parentUser) {
    const linked = JSON.parse(parentUser.linkedCamperIds || "[]") as string[];
    if (!linked.includes(DEMO_CAMPER_ID)) {
      await db.update(csUsers)
        .set({ linkedCamperIds: JSON.stringify([...linked, DEMO_CAMPER_ID]) })
        .where(eq(csUsers.email, "parent@demo.com"));
    }
  }

  // Seed demo camper Jamie
  const [existingCamper] = await db.select().from(csCampers).where(eq(csCampers.id, DEMO_CAMPER_ID));
  if (!existingCamper) {
    const demoMedical = {
      allergies: "Peanuts",
      medications: "EpiPen (carry at all times)",
      conditions: "None",
      emergencyContacts: [
        { name: "Demo Parent", relationship: "Parent", phone: "555-0100", email: "parent@demo.com" },
      ],
      doctorName: "Dr. Smith",
      doctorPhone: "555-0199",
      insuranceProvider: "Blue Shield Demo",
      bloodType: "O+",
      notes: "Demo camper — for testing purposes",
    };
    const { encrypted, iv, authTag } = encryptMedical(demoMedical);
    await db.insert(csCampers).values({
      id: DEMO_CAMPER_ID,
      firstName: "Jamie",
      lastName: "Demo",
      dateOfBirth: "2015-06-15",
      cabinGroup: "Cabin 4 - Sunrise",
      medicalEncrypted: encrypted,
      medicalIv: iv,
      medicalAuthTag: authTag,
    });
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function registerRoutes(app: Express): Promise<Server> {
  await seedAuthCodes();
  await seedDemoUsers();

  // ── Auth: Register ──────────────────────────────────────────────────────────

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { name, email, password, authCode } = req.body;
      if (!name || !email || !password || !authCode) {
        return res.status(400).json({ message: "All fields are required" });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const normalizedCode = authCode.trim().toUpperCase();

      const [code] = await db.select().from(csAuthCodes).where(eq(csAuthCodes.code, normalizedCode));
      if (!code || (code.maxUses > 0 && code.usedCount >= code.maxUses)) {
        return res.status(400).json({ message: "Invalid or expired auth code" });
      }

      const [existingUser] = await db.select().from(csUsers).where(eq(csUsers.email, normalizedEmail));
      if (existingUser) {
        return res.status(400).json({ message: "An account with this email already exists" });
      }

      const passwordHash = await hashPassword(password.trim());
      const userId = generateId();
      const linkedCamperIds = code.linkedCamperId ? [code.linkedCamperId] : [];

      await db.insert(csUsers).values({
        id: userId,
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: code.role,
        linkedCamperIds: JSON.stringify(linkedCamperIds),
        authCode: code.code,
      });

      const usedBy = JSON.parse(code.usedBy || "[]");
      await db.update(csAuthCodes)
        .set({ usedCount: code.usedCount + 1, usedBy: JSON.stringify([...usedBy, userId]) })
        .where(eq(csAuthCodes.code, code.code));

      const token = generateToken();
      await db.insert(csUserSessions).values({
        token,
        userId,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      });

      return res.status(201).json({
        token,
        user: {
          id: userId,
          name: name.trim(),
          email: normalizedEmail,
          role: code.role,
          linkedCamperIds,
          authCode: code.code,
          createdAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error("Register error:", err);
      return res.status(500).json({ message: "Registration failed" });
    }
  });

  // ── Auth: Login ─────────────────────────────────────────────────────────────

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ message: "Email and password are required" });

      const [user] = await db.select().from(csUsers).where(eq(csUsers.email, email.trim().toLowerCase()));
      if (!user) return res.status(401).json({ message: "No account found with that email address." });

      const valid = await verifyPassword(password.trim(), user.passwordHash);
      if (!valid) return res.status(401).json({ message: "Incorrect password. Please try again." });

      const token = generateToken();
      await db.insert(csUserSessions).values({
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      });

      return res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          linkedCamperIds: JSON.parse(user.linkedCamperIds || "[]"),
          authCode: user.authCode,
          createdAt: user.createdAt.toISOString(),
        },
      });
    } catch (err) {
      console.error("Login error:", err);
      return res.status(500).json({ message: "Login failed" });
    }
  });

  // ── Auth: Logout ────────────────────────────────────────────────────────────

  app.post("/api/auth/logout", authMiddleware, async (req: Request, res: Response) => {
    try {
      await db.delete(csUserSessions).where(eq(csUserSessions.token, (req as any).sessionToken));
      return res.json({ success: true });
    } catch {
      return res.json({ success: true });
    }
  });

  // ── Auth: Me ────────────────────────────────────────────────────────────────

  app.get("/api/auth/me", authMiddleware, async (req: Request, res: Response) => {
    try {
      const token = (req as any).sessionToken;
      const [session] = await db
        .select()
        .from(csUserSessions)
        .where(and(eq(csUserSessions.token, token), gt(csUserSessions.expiresAt, new Date())));

      if (!session) return res.status(401).json({ message: "Session expired or invalid" });

      const [user] = await db.select().from(csUsers).where(eq(csUsers.id, session.userId));
      if (!user) {
        await db.delete(csUserSessions).where(eq(csUserSessions.token, token));
        return res.status(401).json({ message: "User not found" });
      }

      return res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        linkedCamperIds: JSON.parse(user.linkedCamperIds || "[]"),
        authCode: user.authCode,
        createdAt: user.createdAt.toISOString(),
      });
    } catch (err) {
      console.error("Auth/me error:", err);
      return res.status(500).json({ message: "Server error" });
    }
  });

  // ── Auth: Reset Password ────────────────────────────────────────────────────

  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const { email, authCode, newPassword } = req.body;
      if (!email || !authCode || !newPassword) return res.status(400).json({ message: "All fields are required" });

      const [user] = await db.select().from(csUsers).where(eq(csUsers.email, email.trim().toLowerCase()));
      if (!user) return res.status(404).json({ message: "No account found with that email address." });

      if (user.authCode.toUpperCase() !== authCode.trim().toUpperCase()) {
        return res.status(400).json({ message: "Invalid auth code. Use the code you registered with." });
      }

      await db.update(csUsers).set({ passwordHash: await hashPassword(newPassword.trim()) }).where(eq(csUsers.id, user.id));
      await db.delete(csUserSessions).where(eq(csUserSessions.userId, user.id));
      return res.json({ success: true });
    } catch (err) {
      console.error("Reset password error:", err);
      return res.status(500).json({ message: "Password reset failed" });
    }
  });

  // ── Auth: Admin Reset Password ──────────────────────────────────────────────

  app.post("/api/auth/admin-reset-password", authMiddleware, async (req: Request, res: Response) => {
    try {
      const auth = await resolveUser(req);
      if (!auth || auth.role !== "management") return res.status(403).json({ message: "Only management can reset passwords" });

      const { email, newPassword } = req.body;
      if (!email || !newPassword) return res.status(400).json({ message: "Email and new password required" });

      const [target] = await db.select().from(csUsers).where(eq(csUsers.email, email.trim().toLowerCase()));
      if (!target) return res.status(404).json({ message: "No account with that email" });

      await db.update(csUsers).set({ passwordHash: await hashPassword(newPassword.trim()) }).where(eq(csUsers.id, target.id));
      await db.delete(csUserSessions).where(eq(csUserSessions.userId, target.id));
      return res.json({ success: true });
    } catch (err) {
      console.error("Admin reset error:", err);
      return res.status(500).json({ message: "Reset failed" });
    }
  });

  // ── Auth Codes ──────────────────────────────────────────────────────────────

  app.get("/api/auth/codes", async (req: Request, res: Response) => {
    try {
      const auth = await resolveUser(req);
      if (!auth) return res.status(401).json({ message: "Unauthorized" });

      const codes = await db.select().from(csAuthCodes);
      return res.json(codes.map((c) => ({
        code: c.code,
        role: c.role,
        linkedCamperId: c.linkedCamperId,
        maxUses: c.maxUses,
        usedCount: c.usedCount,
        usedBy: JSON.parse(c.usedBy || "[]"),
        createdAt: c.createdAt.toISOString(),
        createdBy: c.createdBy,
      })));
    } catch (err) {
      console.error("Get codes error:", err);
      return res.status(500).json({ message: "Failed to fetch codes" });
    }
  });

  app.post("/api/auth/codes", async (req: Request, res: Response) => {
    try {
      const auth = await resolveUser(req);
      if (!auth || auth.role !== "management") return res.status(403).json({ message: "Only management can create codes" });

      const { role, maxUses, linkedCamperId } = req.body;
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      const randomPart = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
      const prefix = role === "management" ? "MGMT" : role === "staff" ? "STAFF" : "PARENT";
      const code = `${prefix}-${randomPart}`;

      await db.insert(csAuthCodes).values({
        code,
        role,
        linkedCamperId: linkedCamperId ?? null,
        maxUses: maxUses ?? 1,
        usedCount: 0,
        usedBy: "[]",
        createdBy: auth.userId,
      });

      return res.status(201).json({
        code,
        role,
        maxUses: maxUses ?? 1,
        usedCount: 0,
        usedBy: [],
        linkedCamperId: linkedCamperId ?? null,
        createdBy: auth.userId,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Create code error:", err);
      return res.status(500).json({ message: "Failed to create code" });
    }
  });

  app.delete("/api/auth/codes/:code", async (req: Request, res: Response) => {
    try {
      const auth = await resolveUser(req);
      if (!auth || auth.role !== "management") return res.status(403).json({ message: "Only management can delete codes" });
      await db.delete(csAuthCodes).where(eq(csAuthCodes.code, String(req.params.code)));
      return res.json({ success: true });
    } catch (err) {
      console.error("Delete code error:", err);
      return res.status(500).json({ message: "Failed to delete code" });
    }
  });

  app.patch("/api/auth/codes/:code", async (req: Request, res: Response) => {
    try {
      const auth = await resolveUser(req);
      if (!auth) return res.status(401).json({ message: "Unauthorized" });
      const { maxUses } = req.body;
      const updates: any = {};
      if (maxUses !== undefined) updates.maxUses = maxUses;
      await db.update(csAuthCodes).set(updates).where(eq(csAuthCodes.code, String(req.params.code)));
      return res.json({ success: true });
    } catch (err) {
      console.error("Update code error:", err);
      return res.status(500).json({ message: "Failed to update code" });
    }
  });

  // ── Users ───────────────────────────────────────────────────────────────────

  app.get("/api/users", async (req: Request, res: Response) => {
    try {
      const auth = await resolveUser(req);
      if (!auth || auth.role !== "management") return res.status(403).json({ message: "Forbidden" });
      const users = await db.select().from(csUsers);
      return res.json(users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        linkedCamperIds: JSON.parse(u.linkedCamperIds || "[]"),
        authCode: u.authCode,
        createdAt: u.createdAt.toISOString(),
      })));
    } catch (err) {
      console.error("Get users error:", err);
      return res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.patch("/api/users/:id", async (req: Request, res: Response) => {
    try {
      const auth = await resolveUser(req);
      if (!auth || auth.role !== "management") return res.status(403).json({ message: "Forbidden" });
      const { id } = req.params;
      const { name, email, role, linkedCamperIds } = req.body;
      const updates: Record<string, any> = {};
      if (name !== undefined) updates.name = name.trim();
      if (email !== undefined) {
        const normalizedEmail = email.trim().toLowerCase();
        const [existing] = await db.select().from(csUsers).where(eq(csUsers.email, normalizedEmail));
        if (existing && existing.id !== id) return res.status(400).json({ message: "Email already in use by another account" });
        updates.email = normalizedEmail;
      }
      if (role !== undefined) updates.role = role;
      if (linkedCamperIds !== undefined) updates.linkedCamperIds = JSON.stringify(linkedCamperIds);
      await db.update(csUsers).set(updates).where(eq(csUsers.id, id));
      const [updated] = await db.select().from(csUsers).where(eq(csUsers.id, id));
      if (!updated) return res.status(404).json({ message: "User not found" });
      return res.json({
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        linkedCamperIds: JSON.parse(updated.linkedCamperIds || "[]"),
        authCode: updated.authCode,
        createdAt: updated.createdAt.toISOString(),
      });
    } catch (err) {
      console.error("Update user error:", err);
      return res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", async (req: Request, res: Response) => {
    try {
      const auth = await resolveUser(req);
      if (!auth || auth.role !== "management") return res.status(403).json({ message: "Forbidden" });
      if (auth.userId === req.params.id) return res.status(400).json({ message: "You cannot delete your own account" });
      await db.delete(csUserSessions).where(eq(csUserSessions.userId, req.params.id));
      await db.delete(csUsers).where(eq(csUsers.id, req.params.id));
      return res.json({ success: true });
    } catch (err) {
      console.error("Delete user error:", err);
      return res.status(500).json({ message: "Failed to delete user" });
    }
  });

  app.post("/api/users/:id/reset-code", async (req: Request, res: Response) => {
    try {
      const auth = await resolveUser(req);
      if (!auth || auth.role !== "management") return res.status(403).json({ message: "Forbidden" });
      const [target] = await db.select().from(csUsers).where(eq(csUsers.id, req.params.id));
      if (!target) return res.status(404).json({ message: "User not found" });
      const code = randomBytes(5).toString("hex").toUpperCase().slice(0, 8);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await db.delete(csResetCodes).where(eq(csResetCodes.userId, target.id));
      await db.insert(csResetCodes).values({ code, userId: target.id, expiresAt, used: false });
      return res.json({ code, expiresInMinutes: 60 });
    } catch (err) {
      console.error("Reset code error:", err);
      return res.status(500).json({ message: "Failed to generate reset code" });
    }
  });

  app.post("/api/auth/use-reset-code", async (req: Request, res: Response) => {
    try {
      const { code, newPassword } = req.body;
      if (!code || !newPassword) return res.status(400).json({ message: "Code and new password are required" });
      if (newPassword.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
      const normalizedCode = code.toUpperCase().trim();
      const [entry] = await db.select().from(csResetCodes).where(eq(csResetCodes.code, normalizedCode));
      if (!entry || entry.used) return res.status(400).json({ message: "Invalid or expired reset code" });
      if (new Date() > entry.expiresAt) {
        await db.delete(csResetCodes).where(eq(csResetCodes.code, normalizedCode));
        return res.status(400).json({ message: "Reset code has expired" });
      }
      const newHash = await hashPassword(newPassword.trim());
      await db.update(csUsers).set({ passwordHash: newHash }).where(eq(csUsers.id, entry.userId));
      await db.delete(csUserSessions).where(eq(csUserSessions.userId, entry.userId));
      await db.delete(csResetCodes).where(eq(csResetCodes.code, normalizedCode));
      return res.json({ success: true });
    } catch (err) {
      console.error("Use reset code error:", err);
      return res.status(500).json({ message: "Failed to use reset code" });
    }
  });

  app.post("/api/users/push-token", async (req: Request, res: Response) => {
    try {
      const auth = await resolveUser(req);
      if (!auth) return res.status(401).json({ message: "Unauthorized" });
      const { token } = req.body;
      if (!token) return res.status(400).json({ message: "token is required" });
      await db.update(csUsers).set({ pushToken: token }).where(eq(csUsers.id, auth.userId));
      return res.json({ success: true });
    } catch (err) {
      console.error("Push token error:", err);
      return res.status(500).json({ message: "Failed to register push token" });
    }
  });

  // ── Campers ─────────────────────────────────────────────────────────────────

  app.get("/api/campers", async (req: Request, res: Response) => {
    try {
      const auth = await resolveUser(req);
      if (!auth) return res.status(401).json({ message: "Unauthorized" });

      let rows = await db.select().from(csCampers);

      // Parents only see their linked campers
      if (auth.role === "parent") {
        const [user] = await db.select().from(csUsers).where(eq(csUsers.id, auth.userId));
        const linkedIds: string[] = JSON.parse(user?.linkedCamperIds || "[]");
        rows = rows.filter((r) => linkedIds.includes(r.id));
      }

      const result = rows.map((row) => {
        const medical =
          row.medicalEncrypted && row.medicalIv && row.medicalAuthTag
            ? decryptMedical(row.medicalEncrypted, row.medicalIv, row.medicalAuthTag)
            : {
                allergies: "",
                medications: "",
                conditions: "",
                emergencyContacts: [],
                doctorName: "",
                doctorPhone: "",
                insuranceProvider: "",
                bloodType: "Unknown",
                notes: "",
              };
        return formatCamper(row, medical);
      });

      return res.json(result);
    } catch (err) {
      console.error("Get campers error:", err);
      return res.status(500).json({ message: "Failed to fetch campers" });
    }
  });

  app.get("/api/campers/:id", async (req: Request, res: Response) => {
    try {
      const auth = await resolveUser(req);
      if (!auth) return res.status(401).json({ message: "Unauthorized" });

      const [row] = await db.select().from(csCampers).where(eq(csCampers.id, String(req.params.id)));
      if (!row) return res.status(404).json({ message: "Camper not found" });

      if (auth.role === "parent") {
        const [user] = await db.select().from(csUsers).where(eq(csUsers.id, auth.userId));
        const linkedIds: string[] = JSON.parse(user?.linkedCamperIds || "[]");
        if (!linkedIds.includes(row.id)) return res.status(403).json({ message: "Access denied" });
      }

      const medical =
        row.medicalEncrypted && row.medicalIv && row.medicalAuthTag
          ? decryptMedical(row.medicalEncrypted, row.medicalIv, row.medicalAuthTag)
          : {
              allergies: "", medications: "", conditions: "", emergencyContacts: [],
              doctorName: "", doctorPhone: "", insuranceProvider: "",
              bloodType: "Unknown", notes: "",
            };

      return res.json(formatCamper(row, medical));
    } catch (err) {
      console.error("Get camper error:", err);
      return res.status(500).json({ message: "Failed to fetch camper" });
    }
  });

  app.post("/api/campers", async (req: Request, res: Response) => {
    try {
      const auth = await resolveUser(req);
      if (!auth || auth.role !== "management") return res.status(403).json({ message: "Only management can add campers" });

      const { firstName, lastName, dateOfBirth, cabinGroup, medical } = req.body;
      if (!firstName || !lastName || !dateOfBirth) {
        return res.status(400).json({ message: "firstName, lastName, and dateOfBirth are required" });
      }

      const id = generateId();
      const medData = medical || {
        allergies: "", medications: "", conditions: "", emergencyContacts: [],
        doctorName: "", doctorPhone: "", insuranceProvider: "",
        bloodType: "Unknown", notes: "",
      };
      const { encrypted, iv, authTag } = encryptMedical(medData);

      await db.insert(csCampers).values({
        id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dateOfBirth,
        cabinGroup: cabinGroup?.trim() || "",
        medicalEncrypted: encrypted,
        medicalIv: iv,
        medicalAuthTag: authTag,
      });

      const [row] = await db.select().from(csCampers).where(eq(csCampers.id, id));
      return res.status(201).json(formatCamper(row!, medData));
    } catch (err) {
      console.error("Create camper error:", err);
      return res.status(500).json({ message: "Failed to create camper" });
    }
  });

  app.patch("/api/campers/:id", async (req: Request, res: Response) => {
    try {
      const auth = await resolveUser(req);
      if (!auth) return res.status(401).json({ message: "Unauthorized" });

      const [existing] = await db.select().from(csCampers).where(eq(csCampers.id, String(req.params.id)));
      if (!existing) return res.status(404).json({ message: "Camper not found" });

      if (auth.role === "parent") {
        const [user] = await db.select().from(csUsers).where(eq(csUsers.id, auth.userId));
        const linkedIds: string[] = JSON.parse(user?.linkedCamperIds || "[]");
        if (!linkedIds.includes(existing.id)) return res.status(403).json({ message: "Access denied" });
      }

      const updates: any = { updatedAt: new Date() };
      const { firstName, lastName, dateOfBirth, cabinGroup, medical, wristbandId, wristbandLastProgrammed, wristbandEncryptedData, parentAuthCode } = req.body;

      if (firstName !== undefined) updates.firstName = firstName.trim();
      if (lastName !== undefined) updates.lastName = lastName.trim();
      if (dateOfBirth !== undefined) updates.dateOfBirth = dateOfBirth;
      if (cabinGroup !== undefined) updates.cabinGroup = cabinGroup.trim();
      if (wristbandId !== undefined) updates.wristbandId = wristbandId;
      if (wristbandLastProgrammed !== undefined) updates.wristbandLastProgrammed = wristbandLastProgrammed;
      if (wristbandEncryptedData !== undefined) updates.wristbandEncryptedData = wristbandEncryptedData;
      if (parentAuthCode !== undefined) updates.parentAuthCode = parentAuthCode;

      if (medical !== undefined) {
        const { encrypted, iv, authTag } = encryptMedical(medical);
        updates.medicalEncrypted = encrypted;
        updates.medicalIv = iv;
        updates.medicalAuthTag = authTag;
      }

      await db.update(csCampers).set(updates).where(eq(csCampers.id, String(req.params.id)));

      const [row] = await db.select().from(csCampers).where(eq(csCampers.id, String(req.params.id)));
      const medData =
        row!.medicalEncrypted && row!.medicalIv && row!.medicalAuthTag
          ? decryptMedical(row!.medicalEncrypted, row!.medicalIv, row!.medicalAuthTag)
          : medical || {};

      return res.json(formatCamper(row!, medData));
    } catch (err) {
      console.error("Update camper error:", err);
      return res.status(500).json({ message: "Failed to update camper" });
    }
  });

  app.delete("/api/campers/:id", async (req: Request, res: Response) => {
    try {
      const auth = await resolveUser(req);
      if (!auth || auth.role !== "management") return res.status(403).json({ message: "Only management can delete campers" });
      await db.delete(csCampers).where(eq(csCampers.id, String(req.params.id)));
      return res.json({ success: true });
    } catch (err) {
      console.error("Delete camper error:", err);
      return res.status(500).json({ message: "Failed to delete camper" });
    }
  });

  app.put("/api/campers/:id/photo", async (req: Request, res: Response) => {
    try {
      const auth = await resolveUser(req);
      if (!auth || auth.role !== "management") return res.status(403).json({ message: "Only management can update photos" });
      const { photoData } = req.body;
      await db.update(csCampers)
        .set({ photoData: photoData ?? null, updatedAt: new Date() })
        .where(eq(csCampers.id, String(req.params.id)));
      return res.json({ success: true });
    } catch (err) {
      console.error("Photo update error:", err);
      return res.status(500).json({ message: "Failed to update photo" });
    }
  });

  // ── Sessions ────────────────────────────────────────────────────────────────

  app.get("/api/sessions", async (req: Request, res: Response) => {
    try {
      const auth = await resolveUser(req);
      if (!auth) return res.status(401).json({ message: "Unauthorized" });
      const rows = await db.select().from(csCampSessions);
      return res.json(rows.map(formatSession));
    } catch (err) {
      console.error("Get sessions error:", err);
      return res.status(500).json({ message: "Failed to fetch sessions" });
    }
  });

  app.post("/api/sessions", async (req: Request, res: Response) => {
    try {
      const auth = await resolveUser(req);
      if (!auth || auth.role !== "management") return res.status(403).json({ message: "Only management can create sessions" });

      const { name, startDate, endDate, authorizedDates, isActive } = req.body;
      if (!name || !startDate || !endDate) return res.status(400).json({ message: "name, startDate, and endDate are required" });

      const id = generateId();
      await db.insert(csCampSessions).values({
        id,
        name: name.trim(),
        startDate,
        endDate,
        authorizedDates: JSON.stringify(authorizedDates || []),
        isActive: isActive !== false,
        createdBy: auth.userId,
      });

      const [row] = await db.select().from(csCampSessions).where(eq(csCampSessions.id, id));
      return res.status(201).json(formatSession(row!));
    } catch (err) {
      console.error("Create session error:", err);
      return res.status(500).json({ message: "Failed to create session" });
    }
  });

  app.patch("/api/sessions/:id", async (req: Request, res: Response) => {
    try {
      const auth = await resolveUser(req);
      if (!auth || auth.role !== "management") return res.status(403).json({ message: "Only management can update sessions" });

      const updates: any = {};
      const { name, startDate, endDate, authorizedDates, isActive } = req.body;
      if (name !== undefined) updates.name = name.trim();
      if (startDate !== undefined) updates.startDate = startDate;
      if (endDate !== undefined) updates.endDate = endDate;
      if (authorizedDates !== undefined) updates.authorizedDates = JSON.stringify(authorizedDates);
      if (isActive !== undefined) updates.isActive = isActive;

      await db.update(csCampSessions).set(updates).where(eq(csCampSessions.id, String(req.params.id)));
      const [row] = await db.select().from(csCampSessions).where(eq(csCampSessions.id, String(req.params.id)));
      return res.json(formatSession(row!));
    } catch (err) {
      console.error("Update session error:", err);
      return res.status(500).json({ message: "Failed to update session" });
    }
  });

  app.delete("/api/sessions/:id", async (req: Request, res: Response) => {
    try {
      const auth = await resolveUser(req);
      if (!auth || auth.role !== "management") return res.status(403).json({ message: "Only management can delete sessions" });
      await db.delete(csCampSessions).where(eq(csCampSessions.id, String(req.params.id)));
      return res.json({ success: true });
    } catch (err) {
      console.error("Delete session error:", err);
      return res.status(500).json({ message: "Failed to delete session" });
    }
  });

  // ── Check-ins ───────────────────────────────────────────────────────────────

  app.get("/api/check-ins", async (req: Request, res: Response) => {
    try {
      const auth = await resolveUser(req);
      if (!auth) return res.status(401).json({ message: "Unauthorized" });

      let rows = await db.select().from(csCheckIns);

      if (auth.role === "parent") {
        const [user] = await db.select().from(csUsers).where(eq(csUsers.id, auth.userId));
        const linkedIds: string[] = JSON.parse(user?.linkedCamperIds || "[]");
        rows = rows.filter((r) => linkedIds.includes(r.camperId));
      }

      return res.json(rows.map(formatCheckIn));
    } catch (err) {
      console.error("Get check-ins error:", err);
      return res.status(500).json({ message: "Failed to fetch check-ins" });
    }
  });

  app.post("/api/check-ins", async (req: Request, res: Response) => {
    try {
      const auth = await resolveUser(req);
      if (!auth || auth.role === "parent") return res.status(403).json({ message: "Staff or management required" });

      const [user] = await db.select().from(csUsers).where(eq(csUsers.id, auth.userId));
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const { camperId, sessionId } = req.body;
      if (!camperId || !sessionId) return res.status(400).json({ message: "camperId and sessionId are required" });

      // Check if already checked in
      const existing = await db
        .select()
        .from(csCheckIns)
        .where(and(eq(csCheckIns.camperId, camperId), isNull(csCheckIns.checkedOutAt)));

      if (existing.length > 0) return res.status(400).json({ message: "Camper is already checked in" });

      const id = generateId();
      await db.insert(csCheckIns).values({
        id,
        camperId,
        sessionId,
        checkedInBy: auth.userId,
        checkedInByName: user.name,
      });

      const [row] = await db.select().from(csCheckIns).where(eq(csCheckIns.id, id));
      // Send push notification to parents
      const [camper] = await db.select().from(csCampers).where(eq(csCampers.id, camperId));
      if (camper) {
        notifyParentsOfCamper(
          camperId,
          `${camper.firstName} checked in`,
          `${camper.firstName} ${camper.lastName} has been checked in by ${user.name}.`,
          { type: "check_in", camperId }
        ).catch(() => {});
      }
      return res.status(201).json(formatCheckIn(row!));
    } catch (err) {
      console.error("Check-in error:", err);
      return res.status(500).json({ message: "Check-in failed" });
    }
  });

  app.patch("/api/check-ins/:id/checkout", async (req: Request, res: Response) => {
    try {
      const auth = await resolveUser(req);
      if (!auth || auth.role === "parent") return res.status(403).json({ message: "Staff or management required" });

      const [user] = await db.select().from(csUsers).where(eq(csUsers.id, auth.userId));
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const [existingCheckIn] = await db.select().from(csCheckIns).where(eq(csCheckIns.id, String(req.params.id)));

      await db.update(csCheckIns)
        .set({
          checkedOutAt: new Date(),
          checkedOutBy: auth.userId,
          checkedOutByName: user.name,
        })
        .where(eq(csCheckIns.id, String(req.params.id)));

      const [row] = await db.select().from(csCheckIns).where(eq(csCheckIns.id, String(req.params.id)));

      // Send push notification to parents
      if (existingCheckIn) {
        const [camper] = await db.select().from(csCampers).where(eq(csCampers.id, existingCheckIn.camperId));
        if (camper) {
          notifyParentsOfCamper(
            existingCheckIn.camperId,
            `${camper.firstName} checked out`,
            `${camper.firstName} ${camper.lastName} has been checked out by ${user.name}.`,
            { type: "check_out", camperId: existingCheckIn.camperId }
          ).catch(() => {});
        }
      }

      return res.json(formatCheckIn(row!));
    } catch (err) {
      console.error("Check-out error:", err);
      return res.status(500).json({ message: "Check-out failed" });
    }
  });

  // ── Pending Wristband Updates ────────────────────────────────────────────────

  app.get("/api/pending-updates", async (req: Request, res: Response) => {
    try {
      const auth = await resolveUser(req);
      if (!auth) return res.status(401).json({ message: "Unauthorized" });
      const rows = await db.select().from(csPendingUpdates);
      return res.json(rows.map(formatPendingUpdate));
    } catch (err) {
      console.error("Get pending updates error:", err);
      return res.status(500).json({ message: "Failed to fetch pending updates" });
    }
  });

  app.post("/api/pending-updates", async (req: Request, res: Response) => {
    try {
      const auth = await resolveUser(req);
      if (!auth) return res.status(401).json({ message: "Unauthorized" });

      const [user] = await db.select().from(csUsers).where(eq(csUsers.id, auth.userId));
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const { camperId, camperName } = req.body;
      if (!camperId || !camperName) return res.status(400).json({ message: "camperId and camperName are required" });

      const id = generateId();
      await db.insert(csPendingUpdates).values({
        id,
        camperId,
        camperName,
        requestedBy: auth.userId,
        requestedByName: user.name,
        resolved: false,
      });

      const [row] = await db.select().from(csPendingUpdates).where(eq(csPendingUpdates.id, id));
      return res.status(201).json(formatPendingUpdate(row!));
    } catch (err) {
      console.error("Create pending update error:", err);
      return res.status(500).json({ message: "Failed to create pending update" });
    }
  });

  app.patch("/api/pending-updates/:id/resolve", async (req: Request, res: Response) => {
    try {
      const auth = await resolveUser(req);
      if (!auth || auth.role !== "management") return res.status(403).json({ message: "Only management can resolve updates" });

      const [user] = await db.select().from(csUsers).where(eq(csUsers.id, auth.userId));

      await db.update(csPendingUpdates)
        .set({
          resolved: true,
          resolvedAt: new Date(),
          resolvedBy: auth.userId,
          resolvedByName: user?.name ?? "Unknown",
        })
        .where(eq(csPendingUpdates.id, String(req.params.id)));

      const [row] = await db.select().from(csPendingUpdates).where(eq(csPendingUpdates.id, String(req.params.id)));
      return res.json(formatPendingUpdate(row!));
    } catch (err) {
      console.error("Resolve pending update error:", err);
      return res.status(500).json({ message: "Failed to resolve update" });
    }
  });

  // ─── AI Assistant (management only) ──────────────────────────────────────────

  const openai = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });

  app.post("/api/ai/query", async (req: Request, res: Response) => {
    try {
      const auth = await resolveUser(req);
      if (!auth || auth.role !== "management") {
        return res.status(403).json({ message: "AI assistant is only available to management" });
      }

      const { question } = req.body;
      if (!question || typeof question !== "string" || question.trim().length === 0) {
        return res.status(400).json({ message: "question is required" });
      }

      // Fetch full data server-side — AI gets everything; client never sends medical data
      const [camperRows, checkInRows, sessionRows] = await Promise.all([
        db.select().from(csCampers),
        db.select().from(csCheckIns),
        db.select().from(csCampSessions),
      ]);

      // Decrypt all camper medical records for AI context
      const campersForAI = camperRows.map((row) => {
        const medical =
          row.medicalEncrypted && row.medicalIv && row.medicalAuthTag
            ? decryptMedical(row.medicalEncrypted, row.medicalIv, row.medicalAuthTag)
            : {};
        return {
          id: row.id,
          firstName: row.firstName,
          lastName: row.lastName,
          dateOfBirth: row.dateOfBirth,
          cabinGroup: row.cabinGroup,
          wristbandId: row.wristbandId ?? null,
          medical,
        };
      });

      const today = new Date().toISOString().split("T")[0];

      const checkedInNow = checkInRows
        .filter((ci) => !ci.checkedOutAt)
        .map((ci) => {
          const camper = campersForAI.find((c) => c.id === ci.camperId);
          return camper ? `${camper.firstName} ${camper.lastName} (cabin: ${camper.cabinGroup || "unassigned"})` : ci.camperId;
        });

      const todaySessions = sessionRows
        .filter((s) => {
          const dates: string[] = JSON.parse(s.authorizedDates || "[]");
          return s.isActive && dates.includes(today);
        })
        .map((s) => s.name);

      const systemPrompt = `You are CampSync AI, a secure assistant for camp management staff. You have full access to all camper data.

TODAY: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}

ACTIVE SESSIONS TODAY: ${todaySessions.length > 0 ? todaySessions.join(", ") : "None scheduled"}

CURRENTLY CHECKED IN (${checkedInNow.length} campers):
${checkedInNow.length > 0 ? checkedInNow.join("\n") : "No campers currently checked in"}

ALL CAMPERS (${campersForAI.length} total):
${campersForAI.map((c) => {
  const med = c.medical as any;
  const parts = [
    `Name: ${c.firstName} ${c.lastName}`,
    `DOB: ${c.dateOfBirth}`,
    `Cabin: ${c.cabinGroup || "unassigned"}`,
    `Wristband: ${c.wristbandId ? "programmed" : "none"}`,
  ];
  const toMedStr = (v: any): string => Array.isArray(v) ? v.join(", ") : (typeof v === "string" ? v : "");
  const allergyStr = toMedStr(med.allergies); if (allergyStr && allergyStr.toLowerCase() !== "none") parts.push(`Allergies: ${allergyStr}`);
  const medStr = toMedStr(med.medications); if (medStr && medStr.toLowerCase() !== "none") parts.push(`Medications: ${medStr}`);
  const condStr = toMedStr(med.conditions); if (condStr && condStr.toLowerCase() !== "none") parts.push(`Conditions: ${condStr}`);
  if (med.bloodType && med.bloodType !== "Unknown") parts.push(`Blood type: ${med.bloodType}`);
  if (med.emergencyContacts && med.emergencyContacts.length > 0) {
    const ec = med.emergencyContacts[0];
    if (ec.name) parts.push(`Emergency contact: ${ec.name} (${ec.phone || "no phone"})`);
  }
  if (med.doctorName) parts.push(`Doctor: ${med.doctorName} ${med.doctorPhone ? `(${med.doctorPhone})` : ""}`);
  if (med.insuranceProvider) parts.push(`Insurance: ${med.insuranceProvider}`);
  if (med.notes && med.notes.toLowerCase() !== "none") parts.push(`Notes: ${med.notes}`);
  return parts.join(" | ");
}).join("\n")}

CHECK-IN HISTORY (last 30 days):
${checkInRows
  .filter((ci) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return new Date(ci.checkedInAt) >= thirtyDaysAgo;
  })
  .map((ci) => {
    const camper = campersForAI.find((c) => c.id === ci.camperId);
    const name = camper ? `${camper.firstName} ${camper.lastName}` : "Unknown";
    const checkIn = new Date(ci.checkedInAt).toLocaleString();
    const checkOut = ci.checkedOutAt ? new Date(ci.checkedOutAt).toLocaleString() : "still checked in";
    return `${name}: in ${checkIn}, out ${checkOut}`;
  })
  .join("\n") || "No check-in history in the last 30 days"}

RULES:
- You have access to real sensitive medical and personal data. Handle all responses with care.
- Never suggest sharing this data with unauthorized parties.
- Be concise, helpful, and accurate. Use bullet points for lists.
- If asked about something outside camp management, politely redirect to camp-related topics.`;

      // Stream the response
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question.trim() },
        ],
        stream: true,
        max_completion_tokens: 1024,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (err) {
      console.error("AI query error:", err);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "AI query failed" })}\n\n`);
        res.end();
      } else {
        return res.status(500).json({ message: "AI query failed" });
      }
    }
  });

  // ─── Change Password ──────────────────────────────────────────────────────────

  app.post("/api/auth/change-password", async (req: Request, res: Response) => {
    try {
      const auth = await resolveUser(req);
      if (!auth) return res.status(401).json({ message: "Unauthorized" });

      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "currentPassword and newPassword are required" });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ message: "New password must be at least 8 characters" });
      }

      const [user] = await db.select().from(csUsers).where(eq(csUsers.id, auth.userId));
      if (!user) return res.status(404).json({ message: "User not found" });

      const valid = await verifyPassword(currentPassword, user.passwordHash);
      if (!valid) return res.status(400).json({ message: "Current password is incorrect" });

      const newHash = await hashPassword(newPassword);
      await db.update(csUsers).set({ passwordHash: newHash }).where(eq(csUsers.id, auth.userId));

      return res.json({ message: "Password changed successfully" });
    } catch (err) {
      console.error("Change password error:", err);
      return res.status(500).json({ message: "Failed to change password" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
