import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getCurrentUser, requireApiUser } from "@/lib/auth";
import { SONG_FROM, SONG_SELECT, toSong, type SongRow } from "@/lib/catalog";
import { badRequest, ok, readJson, withErrors } from "@/lib/http";
import { uuid } from "@/lib/validate";
import { pgTextArray } from "@/lib/sql";

interface ShortRow extends SongRow {
  short_id: string;
  caption: string | null;
  likes_count: number;
  video_url: string;
  short_created_at: string;
}

/** Cursor-paginated AURUM Shorts feed (newest first). Shorts are 15–60 s clips linked to a full song. */
export const GET = withErrors(async (req) => {
  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor");
  const limit = Math.min(12, Math.max(1, Number(url.searchParams.get("limit") ?? 6)));
  const user = await getCurrentUser();

  const res = await db.execute<ShortRow>(sql`
    SELECT sh.id AS short_id, sh.caption, sh.likes_count, sh.video_url, sh.created_at AS short_created_at,
           ${SONG_SELECT}
    ${SONG_FROM}
    JOIN shorts sh ON sh.song_id = s.id
    WHERE (${cursor}::timestamptz IS NULL OR sh.created_at < ${cursor}::timestamptz)
    ORDER BY sh.created_at DESC
    LIMIT ${limit}`);

  const shortIds = res.rows.map((r) => r.short_id);
  const artistIds = res.rows.map((r) => r.artist_id);
  let likedSet = new Set<string>();
  let followSet = new Set<string>();
  if (user && shortIds.length) {
    const liked = await db.execute<{ short_id: string }>(sql`
      SELECT short_id FROM short_likes WHERE user_id = ${user.id}::uuid AND short_id = ANY(${pgTextArray(shortIds)}::uuid[])`);
    likedSet = new Set(liked.rows.map((r) => r.short_id));
    const fol = await db.execute<{ artist_id: string }>(sql`
      SELECT artist_id FROM follows WHERE user_id = ${user.id}::uuid AND artist_id = ANY(${pgTextArray(artistIds)}::uuid[])`);
    followSet = new Set(fol.rows.map((r) => r.artist_id));
  }

  const items = res.rows.map((r) => ({
    id: r.short_id,
    caption: r.caption,
    likesCount: r.likes_count,
    videoUrl: r.video_url,
    liked: likedSet.has(r.short_id),
    following: followSet.has(r.artist_id),
    song: toSong(r),
  }));
  const last = res.rows[res.rows.length - 1];
  return ok({ items, nextCursor: items.length === limit && last ? last.short_created_at : null, signedIn: Boolean(user) });
});

/** Toggle a like on a short. The database function keeps likes_count consistent atomically. */
export const POST = withErrors(async (req) => {
  const user = await requireApiUser();
  const body = await readJson(req);
  const shortId = uuid(body.shortId, "shortId");
  const res = await db.execute<{ liked: boolean }>(sql`SELECT aurum_toggle_short_like(${user.id}::uuid, ${shortId}::uuid) AS liked`);
  const count = await db.execute<{ likes_count: number }>(sql`SELECT likes_count FROM shorts WHERE id = ${shortId}::uuid`);
  if (!count.rows[0]) throw badRequest("Short not found");
  return ok({ liked: res.rows[0]!.liked, likesCount: count.rows[0].likes_count });
});
