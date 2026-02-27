import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const csUsers = pgTable("cs_users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: text("name").notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: varchar("role", { length: 50 }).notNull(),
  linkedCamperIds: text("linked_camper_ids").notNull().default("[]"),
  authCode: varchar("auth_code", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const csAuthCodes = pgTable("cs_auth_codes", {
  code: varchar("code", { length: 100 }).primaryKey(),
  role: varchar("role", { length: 50 }).notNull(),
  linkedCamperId: varchar("linked_camper_id", { length: 36 }),
  maxUses: integer("max_uses").notNull().default(0),
  usedCount: integer("used_count").notNull().default(0),
  usedBy: text("used_by").notNull().default("[]"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: varchar("created_by", { length: 100 }).notNull(),
});

export const csUserSessions = pgTable("cs_user_sessions", {
  token: varchar("token", { length: 255 }).primaryKey(),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => csUsers.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const insertUserSchema = createInsertSchema(csUsers).pick({
  name: true,
  email: true,
  passwordHash: true,
  role: true,
  authCode: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof csUsers.$inferSelect;
export type AuthCode = typeof csAuthCodes.$inferSelect;
export type UserSession = typeof csUserSessions.$inferSelect;
