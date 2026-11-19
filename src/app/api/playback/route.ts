import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { skipEvents, songs } from "@/db/schema";
import { getCurrentUser, requireApiUser } from "@/lib/auth";
import { getEntitlements } from "@/lib/entitlements";
import { badRequest, HttpError, notFound, ok, readJson, unauthorized, withErrors } from "@/lib/http";
import { isUuid } from "@/lib/validate";

/**
 * Playback events. Play events feed charts and history (server-authoritative; the client only reports).
 * Skips are counted server-side against the centralised free-tier limit.
 */
export const POST = withErrors(async (req) => {
  const body = await readJson(req);
  if (body.type === "play") return recordPlay(body);
  if (body.type === "skip") return recordSkip();
  throw badRequest("Unknown playback event");
});

async function recordPlay(body: Record<string, unknown>) {
  const user = await requireApiUser();
  if (!isUuid(body.songId)) throw badRequest("songId must be a valid id");
  const songId = body.songId;
  const seconds = Math.min(3600, Math.max(0, Math.round(Number(body.seconds) || 0)));
  const [song] = await db.select({ id: songs.id }).from(songs).where(eq(songs.id, songId)).limit(1);
  if (!song) throw notFound("Song not found");
  await db.execute(sql`SELECT aurum_record_play(${user.id}::uuid, ${songId}::uuid, ${seconds}::int)`);
  return ok({ ok: true });
}

async function recordSkip() {
  const user = await getCurrentUser();
  if (!user) throw unauthorized("Sign in to skip tracks");
  const ent = getEntitlements(user);
  if (ent.skipLimitPerHour === null) return ok({ remaining: null });
  const limit = ent.skipLimitPerHour;

  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(skipEvents)
    .where(and(eq(skipEvents.userId, user.id), gt(skipEvents.createdAt, sql`now() - interval '1 hour'`)));

  if (count >= limit) {
    throw new HttpError(403, `You’ve used all ${limit} skips for this hour. Upgrade to Premium for unlimited skips.`, "skip_limit");
  }
  await db.insert(skipEvents).values({ userId: user.id });
  return ok({ remaining: limit - count - 1 });
}
