import crypto from "crypto";
import bcrypt from "bcryptjs";
import { dbSettingsGet, dbSettingsSet } from "./storage";

const SETTINGS_KEY = "admin_users";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: "superadmin" | "admin";
  createdAt: string;
}

function readAdminUsers(): AdminUser[] {
  try {
    const raw = dbSettingsGet(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function writeAdminUsers(users: AdminUser[]): void {
  dbSettingsSet(SETTINGS_KEY, JSON.stringify(users));
}

export function getAllAdminUsers(): AdminUser[] {
  return readAdminUsers();
}

export function getAdminUserByEmail(email: string): AdminUser | undefined {
  return readAdminUsers().find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export async function createAdminUser(data: {
  email: string;
  name: string;
  password: string;
  role?: "admin" | "superadmin";
}): Promise<AdminUser> {
  const users = readAdminUsers();
  if (users.find((u) => u.email.toLowerCase() === data.email.toLowerCase())) {
    throw new Error("An admin with this email already exists");
  }
  const passwordHash = await bcrypt.hash(data.password, 10);
  const user: AdminUser = {
    id: crypto.randomUUID(),
    email: data.email,
    name: data.name,
    passwordHash,
    role: data.role || "admin",
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  writeAdminUsers(users);
  return user;
}

export async function validateAdminUserPassword(email: string, password: string): Promise<AdminUser | null> {
  const user = getAdminUserByEmail(email);
  if (!user) return null;
  const valid = await bcrypt.compare(password, user.passwordHash);
  return valid ? user : null;
}

export function removeAdminUser(id: string): boolean {
  const users = readAdminUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return false;
  if (users[idx].role === "superadmin") throw new Error("Cannot remove the super admin");
  users.splice(idx, 1);
  writeAdminUsers(users);
  return true;
}

export async function updateAdminUserPassword(id: string, newPassword: string): Promise<boolean> {
  const users = readAdminUsers();
  const user = users.find((u) => u.id === id);
  if (!user) return false;
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  writeAdminUsers(users);
  return true;
}

export function sanitizeAdminUser(user: AdminUser) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
  };
}
