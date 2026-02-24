import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  reference: varchar("reference", { length: 255 }).unique().notNull(),
  planId: varchar("plan_id", { length: 255 }).notNull(),
  planName: varchar("plan_name", { length: 255 }).notNull(),
  customerEmail: varchar("customer_email", { length: 255 }).notNull(),
  customerName: varchar("customer_name", { length: 255 }),
  amount: integer("amount").notNull(),
  status: varchar("status", { length: 50 }).default("pending"),
  emailSent: boolean("email_sent").default(false),
  accountAssigned: boolean("account_assigned").default(false),
  paystackReference: varchar("paystack_reference", { length: 255 }),
  createdAt: timestamp("created_at").default(sql`NOW()`),
  updatedAt: timestamp("updated_at").default(sql`NOW()`),
});

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  name: varchar("name", { length: 255 }),
  passwordHash: text("password_hash"),
  emailVerified: boolean("email_verified").default(false),
  verificationCode: varchar("verification_code", { length: 10 }),
  verificationExpires: timestamp("verification_expires"),
  suspended: boolean("suspended").default(false),
  totpSecret: text("totp_secret"),
  totpEnabled: boolean("totp_enabled").default(false),
  passwordResetCode: varchar("password_reset_code", { length: 10 }),
  passwordResetExpires: timestamp("password_reset_expires"),
  createdAt: timestamp("created_at").default(sql`NOW()`),
});

export const customerSessions = pgTable("customer_sessions", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  token: varchar("token", { length: 512 }).unique().notNull(),
  createdAt: timestamp("created_at").default(sql`NOW()`),
  expiresAt: timestamp("expires_at").notNull(),
});

export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id"),
  key: varchar("key", { length: 255 }).unique().notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").default(sql`NOW()`),
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Customer = typeof customers.$inferSelect;
export type CustomerSession = typeof customerSessions.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;

export interface SubscriptionPlan {
  name: string;
  price: number;
  duration: string;
  features: string[];
  shared: boolean;
  maxUsers: number;
  popular?: boolean;
  category?: string;
  categoryIcon?: string;
  categoryColor?: string;
}

export interface PlanCategory {
  category: string;
  icon: string;
  color: string;
  plans: Record<string, SubscriptionPlan>;
}

export interface AccountEntry {
  id: string;
  email?: string;
  username?: string;
  password?: string;
  activationCode?: string;
  redeemLink?: string;
  instructions?: string;
  currentUsers: number;
  maxUsers: number;
  fullyUsed: boolean;
  disabled?: boolean;
  usedBy: Array<{
    customerEmail: string;
    customerName: string;
    assignedAt: string;
  }>;
  addedAt: string;
}

export interface AccountsData {
  [planId: string]: AccountEntry[];
}
