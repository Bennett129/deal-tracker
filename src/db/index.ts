import os from "node:os";
import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const globalForDb = globalThis as unknown as { __db?: Promise<Db> };

async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;

  if (url) {
    const { neon } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-http");
    return drizzle(neon(url), { schema }) as unknown as Db;
  }

  // No DATABASE_URL: run an in-process Postgres (PGlite) and migrate it on first use.
  // Kept outside the project folder so the dev server's file watcher ignores it.
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");

  const dataDir =
    process.env.PGLITE_DIR || path.join(os.tmpdir(), "deal-tracker-pglite");
  const db = drizzle(new PGlite(dataDir), { schema });
  await migrate(db, {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
  });
  return db as unknown as Db;
}

export function getDb(): Promise<Db> {
  return (globalForDb.__db ??= createDb());
}
