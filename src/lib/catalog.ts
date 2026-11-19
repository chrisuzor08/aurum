import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { SongSummary } from "@/types";
import { pgTextArray } from "@/lib/sql";

/** Row shape returned by the shared song projection. */
export interface SongRow extends Record<string, unknown> {
  id: string;
  title: string;
  artist_id: string;
  artist_name: string;
  album_id: string | null;
  album_title: string | null;
  genre: string;
  mood: string;
  duration: number;
  cover_url: string | null;
  audio_url: string | null;
  video_url: string | null;
  explicit: boolean;
  release_date: string;
  play_count: number;
  lyrics_lrc: string | null;
  lyrics_plain: string | null;
}

/** Shared SELECT for songs so every surface returns the same client-safe shape. */
export const SONG_SELECT = sql`
  s.id, s.title, s.artist_id, a.name AS artist_name, s.album_id, al.title AS album_title,
  s.genre, s.mood, s.duration, s.cover_url, s.audio_url, s.video_url, s.explicit,
  s.release_date::text AS release_date, s.play_count, s.lyrics_lrc, s.lyrics_plain
`;

export const SONG_FROM = sql`
  FROM songs s
  JOIN artists a ON a.id = s.artist_id
  LEFT JOIN albums al ON al.id = s.album_id
`;

export function toSong(r: SongRow): SongSummary {
  return {
    id: r.id,
    title: r.title,
    artistId: r.artist_id,
    artistName: r.artist_name,
    albumId: r.album_id,
    albumTitle: r.album_title,
    genre: r.genre,
    mood: r.mood,
    duration: r.duration,
    coverUrl: r.cover_url,
    hasAudio: Boolean(r.audio_url),
    hasVideo: Boolean(r.video_url),
    explicit: r.explicit,
    releaseDate: r.release_date,
    playCount: r.play_count,
    lyricsLrc: r.lyrics_lrc,
    lyricsPlain: r.lyrics_plain,
  };
}

export async function querySongs(where: ReturnType<typeof sql>, order: ReturnType<typeof sql>, limit: number, offset = 0): Promise<SongSummary[]> {
  const res = await db.execute<SongRow>(sql`
    SELECT ${SONG_SELECT} ${SONG_FROM}
    WHERE ${where}
    ORDER BY ${order}
    LIMIT ${limit} OFFSET ${offset}
  `);
  return res.rows.map(toSong);
}

/** Returns songs in the exact order of the given ids (used for queues and recent history). */
export async function getSongsByIds(ids: string[]): Promise<SongSummary[]> {
  if (ids.length === 0) return [];
  const res = await db.execute<SongRow>(sql`
    SELECT ${SONG_SELECT} ${SONG_FROM}
    WHERE s.id = ANY(${pgTextArray(ids)}::uuid[])
  `);
  const byId = new Map(res.rows.map((r) => [r.id, toSong(r)]));
  return ids.map((id) => byId.get(id)).filter((s): s is SongSummary => Boolean(s));
}

export interface ArtistCard {
  id: string;
  name: string;
  imageUrl: string | null;
  verified: boolean;
  monthlyListeners: number;
}

export interface AlbumCard {
  id: string;
  title: string;
  coverUrl: string | null;
  releaseDate: string;
  artistId: string;
  artistName: string;
}

export async function getArtistCards(limit: number): Promise<ArtistCard[]> {
  const res = await db.execute<{ id: string; name: string; image_url: string | null; verified: boolean; monthly_listeners: number }>(sql`
    SELECT id, name, image_url, verified, monthly_listeners FROM artists
    ORDER BY monthly_listeners DESC, name LIMIT ${limit}
  `);
  return res.rows.map((r) => ({ id: r.id, name: r.name, imageUrl: r.image_url, verified: r.verified, monthlyListeners: r.monthly_listeners }));
}

export async function getAlbumCards(limit: number, offset = 0, order: "new" | "popular" = "new"): Promise<AlbumCard[]> {
  const orderSql = order === "new" ? sql`al.release_date DESC` : sql`al.release_date ASC`;
  const res = await db.execute<{ id: string; title: string; cover_url: string | null; release_date: string; artist_id: string; artist_name: string }>(sql`
    SELECT al.id, al.title, al.cover_url, al.release_date::text AS release_date, al.artist_id, a.name AS artist_name
    FROM albums al JOIN artists a ON a.id = al.artist_id
    ORDER BY ${orderSql} LIMIT ${limit} OFFSET ${offset}
  `);
  return res.rows.map((r) => ({ id: r.id, title: r.title, coverUrl: r.cover_url, releaseDate: r.release_date, artistId: r.artist_id, artistName: r.artist_name }));
}

/** Distinct genre/mood facets, with a count, for browse tiles and filters. */
export async function getFacets(column: "genre" | "mood"): Promise<{ value: string; count: number }[]> {
  const col = column === "genre" ? sql`genre` : sql`mood`;
  const res = await db.execute<{ value: string; count: number }>(sql`
    SELECT ${col} AS value, COUNT(*)::int AS count FROM songs GROUP BY ${col} ORDER BY count DESC, value
  `);
  return res.rows;
}
