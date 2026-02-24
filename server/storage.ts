import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, desc } from "drizzle-orm";
import {
  transactions, customers, customerSessions, apiKeys,
  type Transaction, type InsertTransaction,
  type Customer, type CustomerSession, type ApiKey,
} from "@shared/schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

export interface IStorage {
  createTransaction(data: InsertTransaction): Promise<Transaction>;
  getTransaction(reference: string): Promise<Transaction | undefined>;
  updateTransaction(reference: string, data: Partial<Transaction>): Promise<Transaction | undefined>;
  getAllTransactions(): Promise<Transaction[]>;
  getStats(): Promise<{ total: number; completed: number; pending: number; revenue: number; emailsSent: number }>;
  getTransactionsByEmail(email: string): Promise<Transaction[]>;

  createCustomer(data: { email: string; name?: string; passwordHash: string; verificationCode: string; verificationExpires: Date }): Promise<Customer>;
  getCustomerByEmail(email: string): Promise<Customer | undefined>;
  getCustomerById(id: number): Promise<Customer | undefined>;
  updateCustomer(id: number, data: Partial<Customer>): Promise<Customer | undefined>;

  createCustomerSession(customerId: number, token: string, expiresAt: Date): Promise<CustomerSession>;
  getCustomerSession(token: string): Promise<CustomerSession | undefined>;
  deleteCustomerSession(token: string): Promise<void>;
  deleteExpiredSessions(): Promise<void>;

  getAllCustomers(): Promise<Customer[]>;

  createApiKey(data: { customerId?: number; key: string; label: string }): Promise<ApiKey>;
  getApiKeysByCustomer(customerId: number): Promise<ApiKey[]>;
  getAllApiKeys(): Promise<ApiKey[]>;
  revokeApiKey(id: number): Promise<void>;
  deleteApiKey(id: number): Promise<void>;
}

export class DbStorage implements IStorage {
  async createTransaction(data: InsertTransaction): Promise<Transaction> {
    const [result] = await db.insert(transactions).values(data).returning();
    return result;
  }

  async getTransaction(reference: string): Promise<Transaction | undefined> {
    const [result] = await db.select().from(transactions).where(eq(transactions.reference, reference));
    return result;
  }

  async updateTransaction(reference: string, data: Partial<Transaction>): Promise<Transaction | undefined> {
    const [result] = await db
      .update(transactions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(transactions.reference, reference))
      .returning();
    return result;
  }

  async getAllTransactions(): Promise<Transaction[]> {
    return db.select().from(transactions).orderBy(desc(transactions.createdAt));
  }

  async getTransactionsByEmail(email: string): Promise<Transaction[]> {
    return db.select().from(transactions)
      .where(eq(transactions.customerEmail, email))
      .orderBy(desc(transactions.createdAt));
  }

  async getStats() {
    const all = await db.select().from(transactions);
    const completed = all.filter((t) => t.status === "success");
    return {
      total: all.length,
      completed: completed.length,
      pending: all.filter((t) => t.status === "pending").length,
      revenue: completed.reduce((sum, t) => sum + t.amount, 0),
      emailsSent: all.filter((t) => t.emailSent).length,
    };
  }

  async createCustomer(data: { email: string; name?: string; passwordHash: string; verificationCode: string; verificationExpires: Date }): Promise<Customer> {
    const [result] = await db.insert(customers).values({
      email: data.email,
      name: data.name,
      passwordHash: data.passwordHash,
      emailVerified: false,
      verificationCode: data.verificationCode,
      verificationExpires: data.verificationExpires,
    }).returning();
    return result;
  }

  async getCustomerByEmail(email: string): Promise<Customer | undefined> {
    const [result] = await db.select().from(customers).where(eq(customers.email, email));
    return result;
  }

  async getCustomerById(id: number): Promise<Customer | undefined> {
    const [result] = await db.select().from(customers).where(eq(customers.id, id));
    return result;
  }

  async updateCustomer(id: number, data: Partial<Customer>): Promise<Customer | undefined> {
    const [result] = await db.update(customers).set(data).where(eq(customers.id, id)).returning();
    return result;
  }

  async createCustomerSession(customerId: number, token: string, expiresAt: Date): Promise<CustomerSession> {
    const [result] = await db.insert(customerSessions).values({ customerId, token, expiresAt }).returning();
    return result;
  }

  async getCustomerSession(token: string): Promise<CustomerSession | undefined> {
    const [result] = await db.select().from(customerSessions).where(eq(customerSessions.token, token));
    return result;
  }

  async deleteCustomerSession(token: string): Promise<void> {
    await db.delete(customerSessions).where(eq(customerSessions.token, token));
  }

  async deleteExpiredSessions(): Promise<void> {
    await db.delete(customerSessions);
  }

  async getAllCustomers(): Promise<Customer[]> {
    return db.select().from(customers).orderBy(desc(customers.createdAt));
  }

  async createApiKey(data: { customerId?: number; key: string; label: string }): Promise<ApiKey> {
    const [result] = await db.insert(apiKeys).values({
      customerId: data.customerId ?? null,
      key: data.key,
      label: data.label,
      active: true,
    }).returning();
    return result;
  }

  async getApiKeysByCustomer(customerId: number): Promise<ApiKey[]> {
    return db.select().from(apiKeys).where(eq(apiKeys.customerId, customerId)).orderBy(desc(apiKeys.createdAt));
  }

  async getAllApiKeys(): Promise<ApiKey[]> {
    return db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
  }

  async revokeApiKey(id: number): Promise<void> {
    await db.update(apiKeys).set({ active: false }).where(eq(apiKeys.id, id));
  }

  async deleteApiKey(id: number): Promise<void> {
    await db.delete(apiKeys).where(eq(apiKeys.id, id));
  }
}

export const storage = new DbStorage();
