import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireApiUser } from "@/lib/auth";
import { badRequest, ok, readJson, withErrors } from "@/lib/http";

export const GET = withErrors(async (req) => {
  const user = await requireApiUser();
  const url = new URL(req.url);
  if (url.searchParams.get("countOnly")) {
    const [{ unread } = { unread: 0 }] = await db
      .select({ unread: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
    return ok({ unread });
  }
  const rows = await db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(50);
  return ok({
    notifications: rows.map((r) => ({ id: r.id, type: r.type, title: r.title, body: r.body, link: r.link, read: r.readAt !== null, createdAt: r.createdAt.toISOString() })),
  });
});

export const POST = withErrors(async (req) => {
  const user = await requireApiUser();
  const body = await readJson(req);
  if (body.action !== "readAll") throw badRequest("Unknown notification action");
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
  return ok({ ok: true });
});
