import speakeasy from "speakeasy";
import QRCode from "qrcode";
import crypto from "crypto";
import { getAdminEmail, getAdminPassword } from "./secrets";
import { dbSettingsGet, dbSettingsSet } from "./storage";
import { getAllAdminUsers as getAdminUsersList } from "./admin-users";

const SETTINGS_KEY = "admin_config";

interface AdminConfig {
  totpSecret: string | null;
  totpSetupComplete: boolean;
  passwordResetCodeHash?: string | null;
  passwordResetExpires?: string | null;
  passwordResetAttempts?: number;
  totpResetCodeHash?: string | null;
  totpResetExpires?: string | null;
  totpResetAttempts?: number;
}

function readConfig(): AdminConfig {
  try {
    const raw = dbSettingsGet(SETTINGS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch { }
  return { totpSecret: null, totpSetupComplete: false };
}

function writeConfig(config: AdminConfig): void {
  dbSettingsSet(SETTINGS_KEY, JSON.stringify(config));
}

export function getAdminCredentials() {
  return {
    email: getAdminEmail(),
    password: getAdminPassword(),
  };
}

export function isSetupComplete(): boolean {
  const config = readConfig();
  return config.totpSetupComplete && !!config.totpSecret;
}

export function getTotpSecret(): string | null {
  return readConfig().totpSecret;
}

export async function generateSetup(): Promise<{ secret: string; qrCodeDataUrl: string; otpauthUrl: string }> {
  const adminEmail = getAdminEmail();
  const generated = speakeasy.generateSecret({
    name: `Premium Subscriptions (${adminEmail})`,
    length: 20,
  });
  const secret = generated.base32;
  const otpauthUrl = generated.otpauth_url || speakeasy.otpauthURL({
    secret,
    label: encodeURIComponent(adminEmail),
    issuer: "Premium Subscriptions Admin",
    encoding: "base32",
  });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
  return { secret, qrCodeDataUrl, otpauthUrl };
}

export function saveSecret(secret: string): void {
  const config = readConfig();
  config.totpSecret = secret;
  config.totpSetupComplete = true;
  writeConfig(config);
}

export function verifyTotp(token: string): boolean {
  const config = readConfig();
  if (!config.totpSecret) return false;
  return speakeasy.totp.verify({
    secret: config.totpSecret,
    encoding: "base32",
    token,
    window: 2,
  });
}

export function verifyTotpWithSecret(token: string, secret: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token,
    window: 2,
  });
}

function getTokenSecret(): string {
  const { password } = getAdminCredentials();
  return password + (process.env.SESSION_SECRET || "ct-admin-secret");
}

export function createAdminToken(adminId?: string): string {
  const id = adminId || "primary";
  const timestamp = Date.now();
  const payload = `${id}:${timestamp}`;
  const signature = crypto.createHmac("sha256", getTokenSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}:${signature}`).toString("base64");
}

export function validateAdminToken(token: string): { valid: boolean; adminId?: string } {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length < 3) return { valid: false };
    const adminId = parts[0];
    const timestamp = parseInt(parts[1]);
    const signature = parts[2];
    const expectedPayload = `${adminId}:${timestamp}`;
    const expectedSig = crypto.createHmac("sha256", getTokenSecret()).update(expectedPayload).digest("hex");
    if (signature !== expectedSig) return { valid: false };
    const sessionAge = Date.now() - timestamp;
    const maxAge = 24 * 60 * 60 * 1000;
    if (sessionAge >= maxAge) return { valid: false };
    if (adminId !== "primary") {
      const users = getAdminUsersList();
      if (!users.find((u) => u.id === adminId)) return { valid: false };
    }
    return { valid: true, adminId };
  } catch {
    return { valid: false };
  }
}

export function getAdminRole(adminId: string): "superadmin" | "admin" {
  if (adminId === "primary") return "superadmin";
  const users = getAdminUsersList();
  const user = users.find((u) => u.id === adminId);
  return user?.role || "admin";
}

const MAX_RESET_ATTEMPTS = 5;

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export function generateAdminResetCode(): string {
  const code = crypto.randomInt(100000, 999999).toString();
  const config = readConfig();
  config.passwordResetCodeHash = hashCode(code);
  config.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  config.passwordResetAttempts = 0;
  writeConfig(config);
  return code;
}

export function verifyAdminResetCode(code: string): { valid: boolean; error?: string } {
  const config = readConfig();
  if (!config.passwordResetCodeHash || !config.passwordResetExpires) {
    return { valid: false, error: "No reset code was requested" };
  }
  if (new Date(config.passwordResetExpires) < new Date()) {
    clearAdminResetCode();
    return { valid: false, error: "Reset code has expired" };
  }
  const attempts = (config.passwordResetAttempts || 0) + 1;
  if (attempts > MAX_RESET_ATTEMPTS) {
    clearAdminResetCode();
    return { valid: false, error: "Too many failed attempts. Request a new code." };
  }
  config.passwordResetAttempts = attempts;
  writeConfig(config);
  if (hashCode(code) !== config.passwordResetCodeHash) {
    return { valid: false, error: `Invalid code. ${MAX_RESET_ATTEMPTS - attempts} attempts remaining.` };
  }
  return { valid: true };
}

export function clearAdminResetCode(): void {
  const config = readConfig();
  config.passwordResetCodeHash = null;
  config.passwordResetExpires = null;
  config.passwordResetAttempts = 0;
  writeConfig(config);
}

export function generateTotpResetCode(): string {
  const code = crypto.randomInt(100000, 999999).toString();
  const config = readConfig();
  config.totpResetCodeHash = hashCode(code);
  config.totpResetExpires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  config.totpResetAttempts = 0;
  writeConfig(config);
  return code;
}

export function verifyTotpResetCode(code: string): { valid: boolean; error?: string } {
  const config = readConfig();
  if (!config.totpResetCodeHash || !config.totpResetExpires) {
    return { valid: false, error: "No reset code was requested" };
  }
  if (new Date(config.totpResetExpires) < new Date()) {
    clearTotpResetCode();
    return { valid: false, error: "Reset code has expired" };
  }
  const attempts = (config.totpResetAttempts || 0) + 1;
  if (attempts > MAX_RESET_ATTEMPTS) {
    clearTotpResetCode();
    return { valid: false, error: "Too many failed attempts. Request a new code." };
  }
  config.totpResetAttempts = attempts;
  writeConfig(config);
  if (hashCode(code) !== config.totpResetCodeHash) {
    return { valid: false, error: `Invalid code. ${MAX_RESET_ATTEMPTS - attempts} attempts remaining.` };
  }
  return { valid: true };
}

export function clearTotpResetCode(): void {
  const config = readConfig();
  config.totpResetCodeHash = null;
  config.totpResetExpires = null;
  config.totpResetAttempts = 0;
  writeConfig(config);
}

export function disableAdminTotp(): void {
  const config = readConfig();
  config.totpSecret = null;
  config.totpSetupComplete = false;
  writeConfig(config);
}

export function adminAuthMiddleware(req: any, res: any, next: any) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "Unauthorized" });
  const token = auth.replace("Bearer ", "");
  const result = validateAdminToken(token);
  if (result.valid) {
    req.adminId = result.adminId;
    req.adminRole = getAdminRole(result.adminId || "primary");
    return next();
  }
  res.status(401).json({ error: "Unauthorized" });
}
