import { Elysia, t } from "elysia";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "./db/client";
import { kv } from "./db/schema";

const kvBodySchema = t.Object({
  key: t.String({ minLength: 1, maxLength: 64 }),
  value: t.String({ minLength: 1, maxLength: 2000 }),
});

const kvPatchSchema = t.Object({
  key: t.String({ minLength: 1, maxLength: 64 }),
  value: t.String({ minLength: 1, maxLength: 2000 }),
});

const kvDeleteSchema = t.Object({
  key: t.String({ minLength: 1, maxLength: 64 }),
});

function serializeEntry(entry: { key: string; value: string; updatedAt: Date }) {
  return {
    key: entry.key,
    value: entry.value,
    updatedAt: entry.updatedAt.toISOString(),
  };
}

export const app = new Elysia({
  prefix: "/api",
  nativeStaticResponse: false,
})
  .get("/health", () => ({ ok: true }))
  .get("/kv", async () => {
    const entries = await db.select().from(kv).orderBy(desc(kv.updatedAt), asc(kv.key));

    return {
      items: entries.map(serializeEntry),
    };
  })
  .post(
    "/kv",
    async ({ body, set }) => {
      const [entry] = await db
        .insert(kv)
        .values({ key: body.key, value: body.value, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: kv.key,
          set: {
            value: body.value,
            updatedAt: new Date(),
          },
        })
        .returning();

      set.status = 201;

      return {
        item: serializeEntry(entry),
      };
    },
    { body: kvBodySchema },
  )
  .patch(
    "/kv",
    async ({ body }) => {
      const [entry] = await db
        .insert(kv)
        .values({ key: body.key, value: body.value, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: kv.key,
          set: {
            value: body.value,
            updatedAt: new Date(),
          },
        })
        .returning();

      return {
        item: serializeEntry(entry),
      };
    },
    {
      body: kvPatchSchema,
    },
  )
  .delete(
    "/kv",
    async ({ body }) => {
      await db.delete(kv).where(eq(kv.key, body.key));

      return {
        ok: true,
        key: body.key,
      };
    },
    {
      body: kvDeleteSchema,
    },
  );

export type ApiApp = typeof app;
