import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { preferences, profiles } from "@/db/schema";
import { requireApiUser } from "@/lib/auth";
import { HttpError, ok, readJson, withErrors, badRequest } from "@/lib/http";
import { saveUpload } from "@/lib/storage";
import { str } from "@/lib/validate";

export const GET = withErrors(async () => {
  const user = await requireApiUser();
  const [[counts], prefs] = await Promise.all([
    db.execute<{ likes: number; follows: number; playlists: number }>(sql`
      SELECT (SELECT COUNT(*)::int FROM likes WHERE user_id = ${user.id}::uuid) AS likes,
             (SELECT COUNT(*)::int FROM follows WHERE user_id = ${user.id}::uuid) AS follows,
             (SELECT COUNT(*)::int FROM playlists WHERE user_id = ${user.id}::uuid) AS playlists`).then((r) => [r.rows]),
    db.select().from(preferences).where(eq(preferences.userId, user.id)),
  ]);
  return ok({
    user,
    counts: counts ?? { likes: 0, follows: 0, playlists: 0 },
    preferences: {
      genres: prefs.filter((p) => p.kind === "genre").map((p) => p.value),
      moods: prefs.filter((p) => p.kind === "mood").map((p) => p.value),
      artists: prefs.filter((p) => p.kind === "artist").map((p) => p.value),
    },
  });
});

/** PATCH: username / display name. PUT: onboarding preferences. POST (multipart): avatar upload. */
export const PATCH = withErrors(async (req) => {
  const user = await requireApiUser();
  const body = await readJson(req);
  const patch: Partial<typeof profiles.$inferInsert> = { updatedAt: new Date() };
  if (body.username !== undefined) {
    const username = str(body.username, "Username", { min: 3, max: 24 }).toLowerCase();
    if (!/^[a-z0-9_]+$/.test(username)) throw badRequest("Usernames may only use letters, numbers and underscores");
    const [taken] = await db.select({ id: profiles.id }).from(profiles).where(and(eq(profiles.username, username), ne(profiles.id, user.id))).limit(1);
    if (taken) throw new HttpError(409, "That username is taken", "conflict");
    patch.username = username;
  }
  if (body.displayName !== undefined) patch.displayName = str(body.displayName, "Display name", { max: 60, optional: true }) || null;
  await db.update(profiles).set(patch).where(eq(profiles.id, user.id));
  return ok({ ok: true });
});

export const PUT = withErrors(async (req) => {
  const user = await requireApiUser();
  const body = await readJson(req);
  const list = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, max) : []);
  const genres = list(body.genres, 12).map((g) => g.slice(0, 40));
  const moods = list(body.moods, 12).map((m) => m.slice(0, 40));
  const artists = list(body.artists, 25).filter((a) => /^[0-9a-f-]{36}$/i.test(a));
  await db.transaction(async (tx) => {
    await tx.delete(preferences).where(eq(preferences.userId, user.id));
    const rows = [
      ...genres.map((value) => ({ userId: user.id, kind: "genre", value })),
      ...moods.map((value) => ({ userId: user.id, kind: "mood", value })),
      ...artists.map((value) => ({ userId: user.id, kind: "artist", value })),
    ];
    if (rows.length) await tx.insert(preferences).values(rows);
    // Follow the artists chosen during onboarding (idempotent).
    for (const artistId of artists) {
      await tx.execute(sql`INSERT INTO follows (user_id, artist_id) VALUES (${user.id}::uuid, ${artistId}::uuid) ON CONFLICT DO NOTHING`);
    }
    await tx.update(profiles).set({ onboardingDone: true, updatedAt: new Date() }).where(eq(profiles.id, user.id));
  });
  return ok({ ok: true });
});

export const POST = withErrors(async (req) => {
  const user = await requireApiUser();
  const form = await req.formData();
  const file = form.get("avatar");
  if (!(file instanceof File)) throw badRequest("Choose an image to upload");
  const avatarUrl = await saveUpload("avatars", file);
  await db.update(profiles).set({ avatarUrl, updatedAt: new Date() }).where(eq(profiles.id, user.id));
  return ok({ avatarUrl });
});

