import { dbSettingsGet, dbSettingsSet } from "./storage";

const CONFIG_KEY = "supabase_backup";

export interface SupabaseConfig {
  url: string;
  key: string;
  enabled: boolean;
  lastSyncAt?: string;
  lastSyncCount?: number;
}

function getConfig(): SupabaseConfig {
  try {
    const raw = dbSettingsGet(CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { url: "", key: "", enabled: false };
}

function saveConfig(config: SupabaseConfig): void {
  dbSettingsSet(CONFIG_KEY, JSON.stringify(config));
}

export function getSupabaseConfig(): SupabaseConfig {
  return getConfig();
}

export function updateSupabaseConfig(data: Partial<SupabaseConfig>): SupabaseConfig {
  const current = getConfig();
  const updated = { ...current, ...data };
  saveConfig(updated);
  return updated;
}

export function isSupabaseConfigured(): boolean {
  const cfg = getConfig();
  return cfg.enabled && !!cfg.url && !!cfg.key;
}

async function supabaseRequest(path: string, method: string, body?: any): Promise<any> {
  const cfg = getConfig();
  if (!cfg.url || !cfg.key) throw new Error("Supabase not configured");
  const url = `${cfg.url.replace(/\/$/, "")}/rest/v1${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "apikey": cfg.key,
      "Authorization": `Bearer ${cfg.key}`,
      "Content-Type": "application/json",
      "Prefer": method === "POST" ? "resolution=merge-duplicates" : "return=minimal",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase error ${res.status}: ${text}`);
  }
  if (res.status === 204 || res.headers.get("content-length") === "0") return null;
  return res.json();
}

export async function testSupabaseConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const cfg = getConfig();
    if (!cfg.url || !cfg.key) return { success: false, error: "URL and key are required" };
    const url = `${cfg.url.replace(/\/$/, "")}/rest/v1/`;
    const res = await fetch(url, {
      headers: { "apikey": cfg.key, "Authorization": `Bearer ${cfg.key}` },
    });
    if (res.ok) return { success: true };
    return { success: false, error: `Connection failed: ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function syncCustomerToSupabase(customer: {
  id: number;
  email: string;
  name?: string | null;
  passwordHash: string;
  emailVerified?: boolean;
  suspended?: boolean;
  createdAt?: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    await supabaseRequest("/customer_backups", "POST", [{
      local_id: customer.id,
      email: customer.email,
      name: customer.name || null,
      password_hash: customer.passwordHash,
      email_verified: customer.emailVerified ?? false,
      suspended: customer.suspended ?? false,
      created_at: customer.createdAt || new Date().toISOString(),
      synced_at: new Date().toISOString(),
    }]);
  } catch (err: any) {
    console.error("[supabase-backup] sync error:", err.message);
  }
}

export async function syncAllCustomers(customers: Array<{
  id: number;
  email: string;
  name?: string | null;
  passwordHash: string;
  emailVerified?: boolean;
  suspended?: boolean;
  createdAt?: string;
}>): Promise<{ synced: number; errors: number }> {
  if (!isSupabaseConfigured()) throw new Error("Supabase backup is not configured");
  let synced = 0;
  let errors = 0;
  const batchSize = 50;

  for (let i = 0; i < customers.length; i += batchSize) {
    const batch = customers.slice(i, i + batchSize).map((c) => ({
      local_id: c.id,
      email: c.email,
      name: c.name || null,
      password_hash: c.passwordHash,
      email_verified: c.emailVerified ?? false,
      suspended: c.suspended ?? false,
      created_at: c.createdAt || new Date().toISOString(),
      synced_at: new Date().toISOString(),
    }));
    try {
      await supabaseRequest("/customer_backups", "POST", batch);
      synced += batch.length;
    } catch (err: any) {
      console.error("[supabase-backup] batch sync error:", err.message);
      errors += batch.length;
    }
  }

  const cfg = getConfig();
  cfg.lastSyncAt = new Date().toISOString();
  cfg.lastSyncCount = synced;
  saveConfig(cfg);

  return { synced, errors };
}
