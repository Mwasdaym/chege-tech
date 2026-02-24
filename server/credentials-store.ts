import fs from "fs";
import path from "path";

const CREDS_FILE = path.join(process.cwd(), "credentials-override.json");

export interface CredentialsOverride {
  paystackPublicKey?: string;
  paystackSecretKey?: string;
  emailUser?: string;
  emailPass?: string;
  adminEmail?: string;
  adminPassword?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  whatsappAccessToken?: string;
  whatsappPhoneId?: string;
  whatsappVerifyToken?: string;
  whatsappAdminPhone?: string;
}

export function getCredentialsOverride(): CredentialsOverride {
  try {
    if (fs.existsSync(CREDS_FILE)) {
      const raw = fs.readFileSync(CREDS_FILE, "utf8");
      return JSON.parse(raw);
    }
  } catch {}
  return {};
}

export function saveCredentialsOverride(data: CredentialsOverride): CredentialsOverride {
  let current: CredentialsOverride = {};
  try {
    if (fs.existsSync(CREDS_FILE)) {
      current = JSON.parse(fs.readFileSync(CREDS_FILE, "utf8"));
    }
  } catch {}
  const updated = { ...current };
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined && val !== null) {
      (updated as any)[key] = val === "" ? undefined : val;
    }
  }
  // Remove undefined values
  for (const key of Object.keys(updated)) {
    if ((updated as any)[key] === undefined) delete (updated as any)[key];
  }
  fs.writeFileSync(CREDS_FILE, JSON.stringify(updated, null, 2));
  return updated;
}
