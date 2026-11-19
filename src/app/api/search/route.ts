import { desc, eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { searchHistory } from "@/db/schema";
import { getCurrentUser, requireApiUser } from "@/lib/auth";
import { getFacets, SONG_FROM, SONG_SELECT, toSong, type SongRow } from "@/lib/catalog";
import { ok, readJson, withErrors } from "@/lib/http";
import { getLyrics } from "@/lib/lrc";
import { str } from "@/lib/validate";

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * Multi-category search using trigram (pg_trgm) GIN indexes from the migration.
 * Categories: songs, artists, albums, playlists (public only), lyrics (snippets), plus suggestions.
 */
export const GET = withErrors(async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.has("facets")) {
    const [genres, moods] = await Promise.all([getFacets("genre"), getFacets("mood")]);
    return ok({ genres, moods });
  }
  if (url.searchParams.has("history")) {
    const user = await requireApiUser();
    const rows = await db
      .select({ query: searchHistory.query, last: sql<string>`max(${searchHistory.createdAt})` })
      .from(searchHistory)
      .where(eq(searchHistory.userId, user.id))
      .groupBy(searchHistory.query)
      .orderBy(desc(sql`max(${searchHistory.createdAt})`))
      .limit(8);
    return ok({ history: rows.map((r) => r.query) });
  }

  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const genre = url.searchParams.get("genre")?.slice(0, 40) || null;
  const mood = url.searchParams.get("mood")?.slice(0, 40) || null;
  const empty = { query: q, songs: [], artists: [], albums: [], playlists: [], lyrics: [], suggestions: [] };
  if (q.length < 1) return ok(empty);

  const like = `%${escapeLike(q)}%`;
  const prefix = `${escapeLike(q)}%`;
  const genreF = genre ? sql`AND s.genre = ${genre}` : sql``;
  const moodF = mood ? sql`AND s.mood = ${mood}` : sql``;

  const [songRes, artistRows, albumRes, playlistRows, lyricRes, suggestRes] = await Promise.all([
    db.execute<SongRow>(sql`
      SELECT ${SONG_SELECT} ${SONG_FROM}
      WHERE (s.title ILIKE ${like} OR a.name ILIKE ${like}) ${genreF} ${moodF}
      ORDER BY (s.title ILIKE ${prefix}) DESC, s.play_count DESC
      LIMIT 12`),
    db.execute<{ id: string; name: string; image_url: string | null; verified: boolean; monthly_listeners: number }>(sql`
      SELECT id, name, image_url, verified, monthly_listeners FROM artists
      WHERE name ILIKE ${like} ORDER BY monthly_listeners DESC LIMIT 8`),
    db.execute<{ id: string; title: string; cover_url: string | null; release_date: string; artist_id: string; artist_name: string }>(sql`
      SELECT al.id, al.title, al.cover_url, al.release_date::text AS release_date, al.artist_id, a.name AS artist_name
      FROM albums al JOIN artists a ON a.id = al.artist_id
      WHERE al.title ILIKE ${like} OR a.name ILIKE ${like}
      ORDER BY al.release_date DESC LIMIT 8`),
    db.execute<{ id: string; name: string; song_count: number; user_name: string }>(sql`
      SELECT p.id, p.name, p.user_id, pr.username AS user_name,
             (SELECT COUNT(*)::int FROM playlist_songs ps WHERE ps.playlist_id = p.id) AS song_count
      FROM playlists p JOIN profiles pr ON pr.id = p.user_id
      WHERE p.is_public AND p.name ILIKE ${like}
      ORDER BY p.updated_at DESC LIMIT 8`),
    db.execute<SongRow>(sql`
      SELECT ${SONG_SELECT} ${SONG_FROM}
      WHERE s.lyrics_plain ILIKE ${like} OR s.lyrics_lrc ILIKE ${like} ${genreF} ${moodF}
      LIMIT 8`),
    db.execute<{ value: string }>(sql`
      (SELECT title AS value FROM songs WHERE title ILIKE ${`%${escapeLike(q)}%`} ORDER BY play_count DESC LIMIT 5)
      UNION
      (SELECT name AS value FROM artists WHERE name ILIKE ${`%${escapeLike(q)}%`} LIMIT 3)
      LIMIT 8`),
  ]);

  const lowerQ = q.toLowerCase();
  const lyrics = lyricRes.rows.map((r) => {
    const song = toSong(r);
    const plain = getLyrics(r.lyrics_lrc, r.lyrics_plain).lines.map((l) => l.text).join("\n");
    const idx = plain.toLowerCase().indexOf(lowerQ);
    const snippet = idx >= 0 ? plain.slice(Math.max(0, idx - 50), idx + 90).replace(/\n/g, " ") : plain.slice(0, 120).replace(/\n/g, " ");
    return { song, snippet };
  });

  return ok({
    query: q,
    songs: songRes.rows.map(toSong),
    artists: artistRows.rows.map((r) => ({ id: r.id, name: r.name, imageUrl: r.image_url, verified: r.verified, monthlyListeners: r.monthly_listeners })),
    albums: albumRes.rows.map((r) => ({ id: r.id, title: r.title, coverUrl: r.cover_url, releaseDate: r.release_date, artistId: r.artist_id, artistName: r.artist_name })),
    playlists: playlistRows.rows.map((r) => ({ id: r.id, name: r.name, songCount: r.song_count, ownerName: r.user_name })),
    lyrics,
    suggestions: suggestRes.rows.map((r) => r.value),
  });
});

/** Save a query to the signed-in user's history (de-duplicated). */
export const POST = withErrors(async (req) => {
  const user = await requireApiUser();
  const body = await readJson(req);
  const query = str(body.query, "query", { min: 2, max: 80 }).toLowerCase();
  await db.delete(searchHistory).where(and(eq(searchHistory.userId, user.id), eq(searchHistory.query, query)));
  await db.insert(searchHistory).values({ userId: user.id, query });
  return ok({ ok: true });
});

export const DELETE = withErrors(async () => {
  const user = await getCurrentUser();
  if (!user) return ok({ ok: true });
  await db.delete(searchHistory).where(eq(searchHistory.userId, user.id));
  return ok({ ok: true });
});
