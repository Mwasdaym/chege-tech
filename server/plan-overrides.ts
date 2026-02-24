import fs from "fs";
import path from "path";

const OVERRIDES_FILE = path.join(process.cwd(), "plan-overrides.json");
const CUSTOM_PLANS_FILE = path.join(process.cwd(), "custom-plans.json");

export interface PlanOverride {
  priceOverride?: number;
  disabled?: boolean;
  offerLabel?: string;
  originalPrice?: number;
}

export interface CustomPlan {
  id: string;
  name: string;
  price: number;
  duration: string;
  features: string[];
  categoryKey: string;
  categoryName: string;
  maxUsers: number;
  createdAt: string;
}

export class PlanOverridesManager {
  private overrides: Record<string, PlanOverride>;
  private customPlans: CustomPlan[];

  constructor() {
    this.overrides = {};
    this.customPlans = [];
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(OVERRIDES_FILE)) {
        this.overrides = JSON.parse(fs.readFileSync(OVERRIDES_FILE, "utf8"));
      }
    } catch { this.overrides = {}; }
    try {
      if (fs.existsSync(CUSTOM_PLANS_FILE)) {
        this.customPlans = JSON.parse(fs.readFileSync(CUSTOM_PLANS_FILE, "utf8"));
      }
    } catch { this.customPlans = []; }
  }

  private saveOverrides(): void {
    fs.writeFileSync(OVERRIDES_FILE, JSON.stringify(this.overrides, null, 2));
  }

  private saveCustomPlans(): void {
    fs.writeFileSync(CUSTOM_PLANS_FILE, JSON.stringify(this.customPlans, null, 2));
  }

  getOverrides(): Record<string, PlanOverride> {
    this.load();
    return this.overrides;
  }

  getOverride(planId: string): PlanOverride | undefined {
    this.load();
    return this.overrides[planId];
  }

  setOverride(planId: string, data: PlanOverride): void {
    this.load();
    this.overrides[planId] = { ...this.overrides[planId], ...data };
    this.saveOverrides();
  }

  deleteOverride(planId: string): void {
    this.load();
    delete this.overrides[planId];
    this.saveOverrides();
  }

  getCustomPlans(): CustomPlan[] {
    this.load();
    return this.customPlans;
  }

  addCustomPlan(data: Omit<CustomPlan, "id" | "createdAt">): CustomPlan {
    this.load();
    const plan: CustomPlan = {
      ...data,
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    this.customPlans.push(plan);
    this.saveCustomPlans();
    return plan;
  }

  updateCustomPlan(id: string, data: Partial<CustomPlan>): CustomPlan | null {
    this.load();
    const idx = this.customPlans.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    this.customPlans[idx] = { ...this.customPlans[idx], ...data };
    this.saveCustomPlans();
    return this.customPlans[idx];
  }

  deleteCustomPlan(id: string): boolean {
    this.load();
    const idx = this.customPlans.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    this.customPlans.splice(idx, 1);
    this.saveCustomPlans();
    return true;
  }
}

export const planOverridesManager = new PlanOverridesManager();
