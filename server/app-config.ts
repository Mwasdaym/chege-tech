import fs from "fs";
import path from "path";

const CONFIG_FILE = path.join(process.cwd(), "app-config.json");

export interface AppConfig {
  siteName: string;
  whatsappNumber: string;
  whatsappChannel: string;
  supportEmail: string;
  customDomain: string;
  chatAssistantEnabled: boolean;
}

const DEFAULTS: AppConfig = {
  siteName: "Chege Tech",
  whatsappNumber: "+254114291301",
  whatsappChannel: "https://whatsapp.com/channel/0029VbBx7NeDp2QGF7qoZ02A",
  supportEmail: "",
  customDomain: "",
  chatAssistantEnabled: true,
};

export function getAppConfig(): AppConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, "utf8");
      return { ...DEFAULTS, ...JSON.parse(raw) };
    }
  } catch {}
  return { ...DEFAULTS };
}

export function saveAppConfig(config: Partial<AppConfig>): AppConfig {
  const current = getAppConfig();
  const updated = { ...current, ...config };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2));
  return updated;
}
