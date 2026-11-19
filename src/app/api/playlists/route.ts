import { sql } from "drizzle-orm";
import { db } from "@/db";
import { playlists } from "@/db/schema";
import { requireApiUser } from "@/lib/auth";
import { ok, readJson, withErrors } from "@/lib/http";
import { str } from "@/lib/validate";

export const GET = withErrors(async () => {
  const user = await requireApiUser();
  const res = await db.execute<{ id: string; name: string; description: string | null; is_public: boolean; cover_url: string | null; song_count: number; updated_at: string }>(sql`
    SELECT p.id, p.name, p.description, p.is_public, p.cover_url, p.updated_at, COUNT(ps.song_id)::int AS song_count
    FROM playlists p
    LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
    WHERE p.user_id = ${user.id}::uuid
    GROUP BY p.id
    ORDER BY p.updated_at DESC`);
  return ok({
    playlists: res.rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isPublic: r.is_public,
      coverUrl: r.cover_url,
      songCount: r.song_count,
      updatedAt: r.updated_at,
    })),
  });
});

export const POST = withErrors(async (req) => {
  const user = await requireApiUser();
  const body = await readJson(req);
  const name = str(body.name, "Playlist name", { min: 1, max: 80 });
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 300) || null : null;
  const isPublic = body.isPublic === true;
  const [row] = await db
    .insert(playlists)
    .values({ userId: user.id, name, description, isPublic })
    .returning();
  return ok({
    playlist: { id: row!.id, name: row!.name, description: row!.description, isPublic: row!.isPublic, coverUrl: row!.coverUrl, songCount: 0, updatedAt: row!.updatedAt.toISOString() },
  });
});
