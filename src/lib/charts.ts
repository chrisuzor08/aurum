import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { ChartEntry, PeriodKey, SongSummary } from "@/types";

export const CHART_SIZE = 50;

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  week: "This Week",
  month: "This Month",
  season: "This Season",
};

/**
 * Period windows (all computed in the database clock):
 *  - week:   previous 7 days                       vs. the 7 days before that
 *  - month:  current calendar month (to now)       vs. the previous calendar month
 *  - season: previous three calendar months        vs. the three months before that
 */
export function periodWindows(period: PeriodKey) {
  switch (period) {
    case "week":
      return {
        cur: sql`now() - interval '7 days'`,
        curEnd: sql`now()`,
        prev: sql`now() - interval '14 days'`,
        prevEnd: sql`now() - interval '7 days'`,
      };
    case "month":
      return {
        cur: sql`date_trunc('month', now())`,
        curEnd: sql`now()`,
        prev: sql`date_trunc('month', now()) - interval '1 month'`,
        prevEnd: sql`date_trunc('month', now())`,
      };
    case "season":
      return {
        cur: sql`date_trunc('month', now()) - interval '3 months'`,
        curEnd: sql`date_trunc('month', now())`,
        prev: sql`date_trunc('month', now()) - interval '6 months'`,
        prevEnd: sql`date_trunc('month', now()) - interval '3 months'`,
      };
  }
}

interface ChartRow extends Record<string, unknown> {
  id: string;
  title: string;
  artist_id: string;
  artist_name: string;
  album_id: string | null;
  genre: string;
  mood: string;
  duration: number;
  cover_url: string | null;
  audio_url: string | null;
  video_url: string | null;
  explicit: boolean;
  play_count: number;
  lyrics_lrc: string | null;
  lyrics_plain: string | null;
  plays: number;
  rank: number;
  prev_rank: number | null;
}

/**
 * Top-50 chart computed from real play_events rows.
 * Current and previous ranks are computed in one query using window functions,
 * so movement indicators and "new entry" detection are exact.
 */
export async function getChart(period: PeriodKey): Promise<ChartEntry[]> {
  const w = periodWindows(period);
  const result = await db.execute<ChartRow>(sql`
    WITH cur AS (
      SELECT song_id, COUNT(*)::int AS plays
      FROM play_events
      WHERE played_at >= ${w.cur} AND played_at < ${w.curEnd}
      GROUP BY song_id
    ),
    cur_ranked AS (
      SELECT song_id, plays, ROW_NUMBER() OVER (ORDER BY plays DESC, song_id) AS rank
      FROM cur
    ),
    prev AS (
      SELECT song_id, COUNT(*)::int AS plays
      FROM play_events
      WHERE played_at >= ${w.prev} AND played_at < ${w.prevEnd}
      GROUP BY song_id
    ),
    prev_ranked AS (
      SELECT song_id, ROW_NUMBER() OVER (ORDER BY plays DESC, song_id) AS rank
      FROM prev
    )
    SELECT s.id, s.title, s.artist_id, a.name AS artist_name, s.album_id, s.genre, s.mood,
           s.duration, s.cover_url, s.audio_url, s.video_url, s.explicit, s.play_count,
           s.lyrics_lrc, s.lyrics_plain,
           c.plays, c.rank::int AS rank, pr.rank::int AS prev_rank
    FROM cur_ranked c
    JOIN songs s ON s.id = c.song_id
    JOIN artists a ON a.id = s.artist_id
    LEFT JOIN prev_ranked pr ON pr.song_id = c.song_id
    ORDER BY c.rank
    LIMIT ${CHART_SIZE}
  `);

  return result.rows.map((r) => {
    const movement: ChartEntry["movement"] =
      r.prev_rank === null ? "new" : r.prev_rank > r.rank ? "up" : r.prev_rank < r.rank ? "down" : "same";
    const song: SongSummary = {
      id: r.id,
      title: r.title,
      artistId: r.artist_id,
      artistName: r.artist_name,
      albumId: r.album_id,
      genre: r.genre,
      mood: r.mood,
      duration: r.duration,
      coverUrl: r.cover_url,
      hasAudio: Boolean(r.audio_url),
      hasVideo: Boolean(r.video_url),
      explicit: r.explicit,
      playCount: r.play_count,
      lyricsLrc: r.lyrics_lrc,
      lyricsPlain: r.lyrics_plain,
    };
    return { rank: r.rank, previousRank: r.prev_rank, movement, plays: r.plays, song };
  });
}

/** Persists the current ranking to chart_snapshots (called by the admin "snapshot" action or a scheduled job). */
export async function snapshotChart(period: PeriodKey): Promise<number> {
  const entries = await getChart(period);
  if (entries.length === 0) return 0;
  const periodStart = await db.execute<{ start: string }>(sql`
    SELECT (${periodWindows(period).cur})::date::text AS start
  `);
  const start = periodStart.rows[0]!.start;
  for (const e of entries) {
    await db.execute(sql`
      INSERT INTO chart_snapshots (period, period_start, song_id, rank, plays)
      VALUES (${period}, ${start}, ${e.song.id}, ${e.rank}, ${e.plays})
      ON CONFLICT (period, period_start, song_id)
      DO UPDATE SET rank = EXCLUDED.rank, plays = EXCLUDED.plays, created_at = now()
    `);
  }
  return entries.length;
}
