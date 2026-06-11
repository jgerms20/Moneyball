import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

export type DB = BetterSQLite3Database<typeof schema>;

let cached: { db: DB; sqlite: Database.Database; file: string } | null = null;

export function dbFilePath(): string {
  return process.env.TRADER_MIRROR_DB || path.join(process.cwd(), "data", "trader-mirror.db");
}

/** Create a standalone connection (used by tests with ":memory:"). */
export function createDb(file: string): { db: DB; sqlite: Database.Database } {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  if (file !== ":memory:") sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return { db, sqlite };
}

export function getDb(): DB {
  const file = dbFilePath();
  if (cached && cached.file === file) return cached.db;
  const { db, sqlite } = createDb(file);
  cached = { db, sqlite, file };
  return db;
}

export function closeDb(): void {
  if (cached) {
    cached.sqlite.close();
    cached = null;
  }
}

export { schema };
