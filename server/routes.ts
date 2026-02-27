import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { db } from "./db";
import { csUsers, csAuthCodes, csUserSessions } from "@shared/schema";
import { eq, and, gt } from "drizzle-orm";
import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

const DEMO_CAMPER_ID = "demo-camper-001";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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

function authMiddleware(req: Request, res: Response, next: Function) {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  (req as any).sessionToken = authHeader.slice(7);
  next();
}

async function seedAuthCodes() {
  const existing = await db.select().from(csAuthCodes).limit(1);
  if (existing.length > 0) return;

  const codes = [
    { code: "DEMO-ADMIN", role: "management", maxUses: 0, createdBy: "system" },
    { code: "DEMO-STAFF", role: "staff", maxUses: 0, createdBy: "system" },
    { code: "DEMO-PARENT", role: "parent", linkedCamperId: DEMO_CAMPER_ID, maxUses: 0, createdBy: "system" },
    { code: "MGMT-MASTER-2024", role: "management", maxUses: 1, createdBy: "system" },
    { code: "STAFF-001", role: "staff", maxUses: 1, createdBy: "system" },
    { code: "STAFF-002", role: "staff", maxUses: 1, createdBy: "system" },
  ];

  for (const c of codes) {
    await db.insert(csAuthCodes).values({
      code: c.code,
      role: c.role,
      linkedCamperId: c.linkedCamperId ?? null,
      maxUses: c.maxUses,
      usedCount: 0,
      usedBy: "[]",
      createdBy: c.createdBy,
    }).onConflictDoNothing();
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  await seedAuthCodes();

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { name, email, password, authCode } = req.body;
      if (!name || !email || !password || !authCode) {
        return res.status(400).json({ message: "All fields are required" });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const normalizedCode = authCode.trim().toUpperCase();

      const [code] = await db
        .select()
        .from(csAuthCodes)
        .where(eq(csAuthCodes.code, normalizedCode));

      if (!code || (code.maxUses > 0 && code.usedCount >= code.maxUses)) {
        return res.status(400).json({ message: "Invalid or expired auth code" });
      }

      const [existingUser] = await db
        .select()
        .from(csUsers)
        .where(eq(csUsers.email, normalizedEmail));

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
      await db
        .update(csAuthCodes)
        .set({ usedCount: code.usedCount + 1, usedBy: JSON.stringify([...usedBy, userId]) })
        .where(eq(csAuthCodes.code, code.code));

      const token = generateToken();
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

      await db.insert(csUserSessions).values({ token, userId, expiresAt });

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
    } catch (err: any) {
      console.error("Register error:", err);
      return res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const normalizedEmail = email.trim().toLowerCase();

      const [user] = await db
        .select()
        .from(csUsers)
        .where(eq(csUsers.email, normalizedEmail));

      if (!user) {
        return res.status(401).json({ message: "No account found with that email address." });
      }

      const valid = await verifyPassword(password.trim(), user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Incorrect password. Please try again." });
      }

      const token = generateToken();
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
      await db.insert(csUserSessions).values({ token, userId: user.id, expiresAt });

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
    } catch (err: any) {
      console.error("Login error:", err);
      return res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", authMiddleware, async (req: Request, res: Response) => {
    try {
      const token = (req as any).sessionToken;
      await db.delete(csUserSessions).where(eq(csUserSessions.token, token));
      return res.json({ success: true });
    } catch {
      return res.json({ success: true });
    }
  });

  app.get("/api/auth/me", authMiddleware, async (req: Request, res: Response) => {
    try {
      const token = (req as any).sessionToken;
      const now = new Date();

      const [session] = await db
        .select()
        .from(csUserSessions)
        .where(and(eq(csUserSessions.token, token), gt(csUserSessions.expiresAt, now)));

      if (!session) {
        return res.status(401).json({ message: "Session expired or invalid" });
      }

      const [user] = await db
        .select()
        .from(csUsers)
        .where(eq(csUsers.id, session.userId));

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

  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const { email, authCode, newPassword } = req.body;
      if (!email || !authCode || !newPassword) {
        return res.status(400).json({ message: "All fields are required" });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const [user] = await db.select().from(csUsers).where(eq(csUsers.email, normalizedEmail));

      if (!user) {
        return res.status(404).json({ message: "No account found with that email address." });
      }

      if (user.authCode.toUpperCase() !== authCode.trim().toUpperCase()) {
        return res.status(400).json({ message: "Invalid auth code. Use the code you registered with." });
      }

      const newHash = await hashPassword(newPassword.trim());
      await db.update(csUsers).set({ passwordHash: newHash }).where(eq(csUsers.id, user.id));
      await db.delete(csUserSessions).where(eq(csUserSessions.userId, user.id));

      return res.json({ success: true });
    } catch (err) {
      console.error("Reset password error:", err);
      return res.status(500).json({ message: "Password reset failed" });
    }
  });

  app.post("/api/auth/admin-reset-password", authMiddleware, async (req: Request, res: Response) => {
    try {
      const token = (req as any).sessionToken;
      const [session] = await db
        .select()
        .from(csUserSessions)
        .where(and(eq(csUserSessions.token, token), gt(csUserSessions.expiresAt, new Date())));

      if (!session) return res.status(401).json({ message: "Unauthorized" });

      const [admin] = await db.select().from(csUsers).where(eq(csUsers.id, session.userId));
      if (!admin || admin.role !== "management") {
        return res.status(403).json({ message: "Only management can reset passwords" });
      }

      const { email, newPassword } = req.body;
      if (!email || !newPassword) {
        return res.status(400).json({ message: "Email and new password required" });
      }

      const [target] = await db.select().from(csUsers).where(eq(csUsers.email, email.trim().toLowerCase()));
      if (!target) return res.status(404).json({ message: "No account with that email" });

      const newHash = await hashPassword(newPassword.trim());
      await db.update(csUsers).set({ passwordHash: newHash }).where(eq(csUsers.id, target.id));
      await db.delete(csUserSessions).where(eq(csUserSessions.userId, target.id));

      return res.json({ success: true });
    } catch (err) {
      console.error("Admin reset error:", err);
      return res.status(500).json({ message: "Reset failed" });
    }
  });

  async function requireAuth(req: Request, res: Response): Promise<string | null> {
    const authHeader = req.headers["authorization"];
    if (!authHeader?.startsWith("Bearer ")) return null;
    const token = authHeader.slice(7);
    const now = new Date();
    const [session] = await db
      .select()
      .from(csUserSessions)
      .where(and(eq(csUserSessions.token, token), gt(csUserSessions.expiresAt, now)));
    if (!session) return null;
    return session.userId;
  }

  app.get("/api/auth/codes", async (req: Request, res: Response) => {
    try {
      const userId = await requireAuth(req, res);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const codes = await db.select().from(csAuthCodes);
      return res.json(
        codes.map((c) => ({
          code: c.code,
          role: c.role,
          linkedCamperId: c.linkedCamperId,
          maxUses: c.maxUses,
          usedCount: c.usedCount,
          usedBy: JSON.parse(c.usedBy || "[]"),
          createdAt: c.createdAt.toISOString(),
          createdBy: c.createdBy,
        }))
      );
    } catch (err) {
      console.error("Get codes error:", err);
      return res.status(500).json({ message: "Failed to fetch codes" });
    }
  });

  app.post("/api/auth/codes", async (req: Request, res: Response) => {
    try {
      const userId = await requireAuth(req, res);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const [creator] = await db.select().from(csUsers).where(eq(csUsers.id, userId));
      if (!creator || creator.role !== "management") {
        return res.status(403).json({ message: "Only management can create codes" });
      }

      const { role, maxUses, linkedCamperId } = req.body;
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      const randomPart = Array.from({ length: 8 }, () =>
        chars[Math.floor(Math.random() * chars.length)]
      ).join("");
      const prefix = role === "management" ? "MGMT" : role === "staff" ? "STAFF" : "PARENT";
      const code = `${prefix}-${randomPart}`;

      await db.insert(csAuthCodes).values({
        code,
        role,
        linkedCamperId: linkedCamperId ?? null,
        maxUses: maxUses ?? 0,
        usedCount: 0,
        usedBy: "[]",
        createdBy: userId,
      });

      return res.status(201).json({ code, role, maxUses, usedCount: 0, usedBy: [], linkedCamperId, createdBy: userId, createdAt: new Date().toISOString() });
    } catch (err) {
      console.error("Create code error:", err);
      return res.status(500).json({ message: "Failed to create code" });
    }
  });

  app.delete("/api/auth/codes/:code", async (req: Request, res: Response) => {
    try {
      const userId = await requireAuth(req, res);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const [creator] = await db.select().from(csUsers).where(eq(csUsers.id, userId));
      if (!creator || creator.role !== "management") {
        return res.status(403).json({ message: "Only management can delete codes" });
      }

      await db.delete(csAuthCodes).where(eq(csAuthCodes.code, req.params.code));
      return res.json({ success: true });
    } catch (err) {
      console.error("Delete code error:", err);
      return res.status(500).json({ message: "Failed to delete code" });
    }
  });

  app.patch("/api/auth/codes/:code", async (req: Request, res: Response) => {
    try {
      const userId = await requireAuth(req, res);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const { maxUses } = req.body;
      const updates: any = {};
      if (maxUses !== undefined) updates.maxUses = maxUses;

      await db.update(csAuthCodes).set(updates).where(eq(csAuthCodes.code, req.params.code));
      return res.json({ success: true });
    } catch (err) {
      console.error("Update code error:", err);
      return res.status(500).json({ message: "Failed to update code" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
