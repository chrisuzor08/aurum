import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { albumSaves, albums, artists, downloads, follows, likes, songs } from "@/db/schema";
import { getCurrentUser, requireApiUser } from "@/lib/auth";
import { getEntitlements } from "@/lib/entitlements";
import { badRequest, forbidden, notFound, ok, readJson, withErrors } from "@/lib/http";
import { SONG_FROM, SONG_SELECT, toSong, type SongRow } from "@/lib/catalog";
import { str, uuid } from "@/lib/validate";

/** Library reads (GET) and toggles (POST). All writes use the verified session user, never a client-supplied user id. */
export const GET = withErrors(async (req) => {
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const user = await getCurrentUser();

  switch (kind) {
    case "status": {
      const id = uuid(url.searchParams.get("id"), "id");
      if (!user) return ok({ liked: false });
      const [row] = await db.select({ songId: likes.songId }).from(likes).where(and(eq(likes.userId, user.id), eq(likes.songId, id))).limit(1);
      return ok({ liked: Boolean(row) });
    }
    case "likes": {
      const u = await requireApiUser();
      const res = await db.execute<SongRow>(sql`
        SELECT ${SONG_SELECT} ${SONG_FROM}
        JOIN likes lk ON lk.song_id = s.id
        WHERE lk.user_id = ${u.id}::uuid
        ORDER BY lk.created_at DESC LIMIT 300`);
      return ok({ songs: res.rows.map(toSong) });
    }
    case "downloads": {
      const u = await requireApiUser();
      const res = await db.execute<SongRow>(sql`
        SELECT ${SONG_SELECT} ${SONG_FROM}
        JOIN downloads d ON d.song_id = s.id
        WHERE d.user_id = ${u.id}::uuid
        ORDER BY d.downloaded_at DESC LIMIT 300`);
      return ok({ songs: res.rows.map(toSong) });
    }
    case "history": {
      const u = await requireApiUser();
      const res = await db.execute<SongRow & { played_at: string; plays: number }>(sql`
        SELECT ${SONG_SELECT}, x.played_at, x.plays ${SONG_FROM}
        JOIN (
          SELECT song_id, MAX(played_at) AS played_at, COUNT(*)::int AS plays
          FROM play_events WHERE user_id = ${u.id}::uuid
          GROUP BY song_id ORDER BY MAX(played_at) DESC LIMIT 100
        ) x ON x.song_id = s.id
        ORDER BY x.played_at DESC`);
      return ok({
        songs: res.rows.map((r) => ({ ...toSong(r), playedAt: new Date(r.played_at).toISOString(), plays: r.plays })),
      });
    }
    case "follows": {
      const u = await requireApiUser();
      const res = await db.execute<{ id: string; name: string; image_url: string | null; verified: boolean; monthly_listeners: number; followed_at: string }>(sql`
        SELECT a.id, a.name, a.image_url, a.verified, a.monthly_listeners, f.created_at AS followed_at
        FROM follows f JOIN artists a ON a.id = f.artist_id
        WHERE f.user_id = ${u.id}::uuid ORDER BY f.created_at DESC`);
      return ok({
        artists: res.rows.map((r) => ({ id: r.id, name: r.name, imageUrl: r.image_url, verified: r.verified, monthlyListeners: r.monthly_listeners })),
      });
    }
    case "albums": {
      const u = await requireApiUser();
      const res = await db.execute<{ id: string; title: string; cover_url: string | null; release_date: string; artist_id: string; artist_name: string }>(sql`
        SELECT al.id, al.title, al.cover_url, al.release_date::text AS release_date, al.artist_id, a.name AS artist_name
        FROM album_saves sv JOIN albums al ON al.id = sv.album_id JOIN artists a ON a.id = al.artist_id
        WHERE sv.user_id = ${u.id}::uuid ORDER BY sv.created_at DESC`);
      return ok({
        albums: res.rows.map((r) => ({ id: r.id, title: r.title, coverUrl: r.cover_url, releaseDate: r.release_date, artistId: r.artist_id, artistName: r.artist_name })),
      });
    }
    default:
      throw badRequest("Unknown library query");
  }
});

export const POST = withErrors(async (req) => {
  const user = await requireApiUser();
  const body = await readJson(req);
  const kind = str(body.kind, "kind", { max: 20 });
  const id = uuid(body.id, "id");
  const on = body.on !== false;

  switch (kind) {
    case "like": {
      const [s] = await db.select({ id: songs.id }).from(songs).where(eq(songs.id, id)).limit(1);
      if (!s) throw notFound("Song not found");
      if (on) await db.insert(likes).values({ userId: user.id, songId: id }).onConflictDoNothing();
      else await db.delete(likes).where(and(eq(likes.userId, user.id), eq(likes.songId, id)));
      return ok({ liked: on });
    }
    case "follow": {
      const [a] = await db.select({ id: artists.id }).from(artists).where(eq(artists.id, id)).limit(1);
      if (!a) throw notFound("Artist not found");
      if (on) await db.insert(follows).values({ userId: user.id, artistId: id }).onConflictDoNothing();
      else await db.delete(follows).where(and(eq(follows.userId, user.id), eq(follows.artistId, id)));
      return ok({ following: on });
    }
    case "album": {
      const [al] = await db.select({ id: albums.id }).from(albums).where(eq(albums.id, id)).limit(1);
      if (!al) throw notFound("Album not found");
      if (on) await db.insert(albumSaves).values({ userId: user.id, albumId: id }).onConflictDoNothing();
      else await db.delete(albumSaves).where(and(eq(albumSaves.userId, user.id), eq(albumSaves.albumId, id)));
      return ok({ saved: on });
    }
    case "download": {
      // Premium entitlement is evaluated on the server from the database, never from the client.
      const ent = getEntitlements(user);
      if (on && !ent.canDownload) throw forbidden("Offline downloads are a Premium feature.");
      const [s] = await db.select({ id: songs.id, audioUrl: songs.audioUrl }).from(songs).where(eq(songs.id, id)).limit(1);
      if (!s) throw notFound("Song not found");
      if (on && !s.audioUrl) throw badRequest("This track has no licensed audio asset to download.");
      if (on) await db.insert(downloads).values({ userId: user.id, songId: id }).onConflictDoNothing();
      else await db.delete(downloads).where(and(eq(downloads.userId, user.id), eq(downloads.songId, id)));
      return ok({ downloaded: on });
    }
    default:
      throw badRequest("Unknown library action");
  }
});
