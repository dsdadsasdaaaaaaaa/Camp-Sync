import { pgTable, text, varchar, integer, timestamp, boolean } from "drizzle-orm/pg-core";
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
  pushToken: text("push_token"),
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

export const csCampers = pgTable("cs_campers", {
  id: varchar("id", { length: 36 }).primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  cabinGroup: text("cabin_group").notNull(),
  medicalEncrypted: text("medical_encrypted"),
  medicalIv: text("medical_iv"),
  medicalAuthTag: text("medical_auth_tag"),
  wristbandId: text("wristband_id"),
  wristbandLastProgrammed: text("wristband_last_programmed"),
  wristbandEncryptedData: text("wristband_encrypted_data"),
  parentAuthCode: text("parent_auth_code"),
  photoData: text("photo_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const csResetCodes = pgTable("cs_reset_codes", {
  code: varchar("code", { length: 20 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => csUsers.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const csCampSessions = pgTable("cs_camp_sessions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: text("name").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  authorizedDates: text("authorized_dates").notNull().default("[]"),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by", { length: 36 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const csCheckIns = pgTable("cs_check_ins", {
  id: varchar("id", { length: 36 }).primaryKey(),
  camperId: varchar("camper_id", { length: 36 }).notNull(),
  sessionId: varchar("session_id", { length: 36 }).notNull(),
  checkedInAt: timestamp("checked_in_at").defaultNow().notNull(),
  checkedInBy: varchar("checked_in_by", { length: 36 }).notNull(),
  checkedInByName: text("checked_in_by_name").notNull(),
  checkedOutAt: timestamp("checked_out_at"),
  checkedOutBy: varchar("checked_out_by", { length: 36 }),
  checkedOutByName: text("checked_out_by_name"),
  notes: text("notes"),
});

export const csPendingUpdates = pgTable("cs_pending_updates", {
  id: varchar("id", { length: 36 }).primaryKey(),
  camperId: varchar("camper_id", { length: 36 }).notNull(),
  camperName: text("camper_name").notNull(),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  requestedBy: varchar("requested_by", { length: 36 }).notNull(),
  requestedByName: text("requested_by_name").notNull(),
  resolved: boolean("resolved").notNull().default(false),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by", { length: 36 }),
  resolvedByName: text("resolved_by_name"),
});

export const csBroadcasts = pgTable("cs_broadcasts", {
  id: varchar("id", { length: 36 }).primaryKey(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  audience: varchar("audience", { length: 20 }).notNull().default("all"),
  isEmergency: boolean("is_emergency").notNull().default(false),
  emergencyActive: boolean("emergency_active").notNull().default(false),
  sentBy: varchar("sent_by", { length: 36 }).notNull(),
  sentByName: text("sent_by_name").notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
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
