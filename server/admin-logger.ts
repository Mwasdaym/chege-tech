import fs from "fs";
import path from "path";

const LOG_FILE = path.join(process.cwd(), "admin-logs.json");
const MAX_ENTRIES = 500;

export interface AdminLogEntry {
  id: string;
  timestamp: string;
  action: string;
  category: "auth" | "plans" | "accounts" | "promos" | "settings" | "customers" | "apikeys" | "transactions";
  details: string;
  ip?: string;
  status: "success" | "warning" | "error";
}

function loadLogs(): AdminLogEntry[] {
  try {
    if (fs.existsSync(LOG_FILE)) {
      return JSON.parse(fs.readFileSync(LOG_FILE, "utf8"));
    }
  } catch {}
  return [];
}

function saveLogs(entries: AdminLogEntry[]): void {
  fs.writeFileSync(LOG_FILE, JSON.stringify(entries, null, 2));
}

export function logAdminAction(params: Omit<AdminLogEntry, "id" | "timestamp">): void {
  try {
    const entries = loadLogs();
    const entry: AdminLogEntry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...params,
    };
    entries.unshift(entry);
    saveLogs(entries.slice(0, MAX_ENTRIES));
  } catch {}
}

export function getAdminLogs(limit = 100, category?: string): AdminLogEntry[] {
  const entries = loadLogs();
  const filtered = category ? entries.filter((e) => e.category === category) : entries;
  return filtered.slice(0, limit);
}
