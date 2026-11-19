import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { playlistSongs, playlists, profiles, songs } from "@/db/schema";
import { getCurrentUser, requireApiUser } from "@/lib/auth";
import { badRequest, forbidden, HttpError, notFound, ok, readJson, withErrors } from "@/lib/http";
import { SONG_FROM, SONG_SELECT, toSong, type SongRow } from "@/lib/catalog";
import { str, uuid } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

async function loadPlaylist(id: string) {
  const [p] = await db
    .select({ id: playlists.id, userId: playlists.userId, name: playlists.name, description: playlists.description, isPublic: playlists.isPublic, coverUrl: playlists.coverUrl, createdAt: playlists.createdAt, ownerName: profiles.username })
    .from(playlists)
    .innerJoin(profiles, eq(profiles.id, playlists.userId))
    .where(eq(playlists.id, id))
    .limit(1);
  if (!p) throw notFound("Playlist not found");
  return p;
}

/** Owner-only mutation guard. Ownership is checked against the verified session. */
async function requireOwner(id: string) {
  const user = await requireApiUser();
  const p = await loadPlaylist(id);
  if (p.userId !== user.id && user.role !== "admin") throw forbidden("Only the playlist owner can change this playlist");
  return { user, playlist: p };
}

export const GET = withErrors<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  uuid(id, "playlist id");
  const viewer = await getCurrentUser();
  const p = await loadPlaylist(id);
  const isOwner = viewer?.id === p.userId;
  if (!p.isPublic && !isOwner && viewer?.role !== "admin") throw notFound("Playlist not found");

  const res = await db.execute<SongRow & { position: number }>(sql`
    SELECT ${SONG_SELECT}, ps.position ${SONG_FROM}
    JOIN playlist_songs ps ON ps.song_id = s.id
    WHERE ps.playlist_id = ${id}::uuid
    ORDER BY ps.position ASC`);
  const list = res.rows.map((r) => toSong(r));
  const totalDuration = list.reduce((acc, s) => acc + s.duration, 0);
  return ok({
    playlist: {
      id: p.id,
      name: p.name,
      description: p.description,
      isPublic: p.isPublic,
      coverUrl: p.coverUrl,
      ownerId: p.userId,
      ownerName: p.ownerName,
      isOwner,
      songCount: list.length,
      totalDuration,
      createdAt: p.createdAt.toISOString(),
    },
    songs: list,
  });
});

export const PATCH = withErrors<Ctx>(async (req, { params }) => {
  const { id } = await params;
  await requireOwner(id);
  const body = await readJson(req);
  const patch: Partial<typeof playlists.$inferInsert> = { updatedAt: new Date() };
  if (body.name !== undefined) patch.name = str(body.name, "Playlist name", { min: 1, max: 80 });
  if (body.description !== undefined) patch.description = typeof body.description === "string" ? body.description.trim().slice(0, 300) || null : null;
  if (body.isPublic !== undefined) patch.isPublic = body.isPublic === true;
  await db.update(playlists).set(patch).where(eq(playlists.id, id));
  return ok({ ok: true });
});

export const DELETE = withErrors<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  await requireOwner(id);
  await db.delete(playlists).where(eq(playlists.id, id));
  return ok({ ok: true });
});

/** Playlist item actions: add | remove | move (up/down). */
export const POST = withErrors<Ctx>(async (req, { params }) => {
  const { id } = await params;
  await requireOwner(id);
  const body = await readJson(req);
  const action = str(body.action, "action", { max: 10 });
  const songId = uuid(body.songId, "songId");

  if (action === "add") {
    const [s] = await db.select({ id: songs.id }).from(songs).where(eq(songs.id, songId)).limit(1);
    if (!s) throw notFound("Song not found");
    const [existing] = await db.select({ songId: playlistSongs.songId }).from(playlistSongs).where(and(eq(playlistSongs.playlistId, id), eq(playlistSongs.songId, songId))).limit(1);
    if (existing) throw new HttpError(409, "That song is already in this playlist", "conflict");
    await db.transaction(async (tx) => {
      const [{ max } = { max: 0 }] = await tx
        .select({ max: sql<number>`coalesce(max(${playlistSongs.position}), 0)::int` })
        .from(playlistSongs)
        .where(eq(playlistSongs.playlistId, id));
      await tx.insert(playlistSongs).values({ playlistId: id, songId, position: max + 1 });
      await tx.update(playlists).set({ updatedAt: new Date() }).where(eq(playlists.id, id));
    });
    return ok({ added: true });
  }

  if (action === "remove") {
    await db.delete(playlistSongs).where(and(eq(playlistSongs.playlistId, id), eq(playlistSongs.songId, songId)));
    return ok({ removed: true });
  }

  if (action === "move") {
    const direction = body.direction === "up" ? -1 : body.direction === "down" ? 1 : 0;
    if (!direction) throw badRequest("direction must be 'up' or 'down'");
    await db.transaction(async (tx) => {
      const rows = await tx.select().from(playlistSongs).where(eq(playlistSongs.playlistId, id)).orderBy(asc(playlistSongs.position));
      const i = rows.findIndex((r) => r.songId === songId);
      const j = i + direction;
      if (i < 0 || j < 0 || j >= rows.length) return;
      const a = rows[i]!;
      const b = rows[j]!;
      // Swap positions atomically inside the transaction.
      await tx.update(playlistSongs).set({ position: b.position }).where(and(eq(playlistSongs.playlistId, id), eq(playlistSongs.songId, a.songId)));
      await tx.update(playlistSongs).set({ position: a.position }).where(and(eq(playlistSongs.playlistId, id), eq(playlistSongs.songId, b.songId)));
      await tx.update(playlists).set({ updatedAt: new Date() }).where(eq(playlists.id, id));
    });
    return ok({ moved: true });
  }

  throw badRequest("Unknown playlist action");
});
