import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { env } from "../env";

declare global {
  var __cards_sql_client__: ReturnType<typeof postgres> | undefined;
  var __cards_drizzle_db__: ReturnType<typeof drizzle<typeof schema>> | undefined;
}

const sql =
  globalThis.__cards_sql_client__ ??
  postgres(env.DATABASE_URL, {
    max: 10,
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__cards_sql_client__ = sql;
}

export const db = globalThis.__cards_drizzle_db__ ?? drizzle({ client: sql, schema });

if (process.env.NODE_ENV !== "production") {
  globalThis.__cards_drizzle_db__ = db;
}
