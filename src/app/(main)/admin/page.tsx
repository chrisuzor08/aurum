import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requirePageAdmin } from "@/lib/auth";
import { AdminConsole, type AdminStats } from "@/components/admin/AdminConsole";
import { PageHeader } from "@/components/common/ui";

export const metadata = { title: "Admin · AURUM" };

/** Administrator dashboard. Role is checked on the server (accounts.role), never from the client. */
export default async function AdminPage() {
  await requirePageAdmin("/admin");

  const [totals] = (
    await db.execute<{
      total_users: number; active_users: number; total_songs: number; total_streams: number; premium_subscribers: number; revenue_minor: number;
    }>(sql`
      SELECT
        (SELECT COUNT(*)::int FROM accounts) AS total_users,
        (SELECT COUNT(DISTINCT user_id)::int FROM play_events WHERE played_at > now() - interval '7 days') AS active_users,
        (SELECT COUNT(*)::int FROM songs) AS total_songs,
        (SELECT COUNT(*)::int FROM play_events) AS total_streams,
        (SELECT COUNT(*)::int FROM profiles WHERE is_premium AND (premium_expires_at IS NULL OR premium_expires_at > now())) AS premium_subscribers,
        (SELECT COALESCE(SUM(amount_minor), 0)::int FROM subscriptions WHERE status = 'active') AS revenue_minor`)
    ).rows;
  const topSongs = (await db.execute<{ id: string; title: string; artist_name: string; plays: number }>(sql`
    SELECT s.id, s.title, a.name AS artist_name, COUNT(p.id)::int AS plays
    FROM play_events p JOIN songs s ON s.id = p.song_id JOIN artists a ON a.id = s.artist_id
    GROUP BY s.id, a.name, s.title ORDER BY plays DESC LIMIT 5`)).rows;
  const topArtists = (await db.execute<{ id: string; name: string; plays: number }>(sql`
    SELECT a.id, a.name, COUNT(p.id)::int AS plays
    FROM play_events p JOIN songs s ON s.id = p.song_id JOIN artists a ON a.id = s.artist_id
    GROUP BY a.id, a.name ORDER BY plays DESC LIMIT 5`)).rows;
  const songs = (await db.execute<{ id: string; title: string; artist_name: string; play_count: number; audio_url: string | null; video_url: string | null }>(sql`
    SELECT s.id, s.title, a.name AS artist_name, s.play_count, s.audio_url, s.video_url
    FROM songs s JOIN artists a ON a.id = s.artist_id ORDER BY s.created_at DESC LIMIT 100`)).rows;
  const artists = (await db.execute<{ id: string; name: string; verified: boolean; monthly_listeners: number; bio: string | null }>(sql`
    SELECT id, name, verified, monthly_listeners, bio FROM artists ORDER BY name`)).rows;
  const albums = (await db.execute<{ id: string; title: string; artist_id: string; release_date: string }>(sql`
    SELECT id, title, artist_id, release_date::text AS release_date FROM albums ORDER BY release_date DESC LIMIT 100`)).rows;
  const shorts = (await db.execute<{ id: string; caption: string | null; title: string; likes_count: number }>(sql`
    SELECT sh.id, sh.caption, s.title, sh.likes_count FROM shorts sh JOIN songs s ON s.id = sh.song_id ORDER BY sh.created_at DESC LIMIT 50`)).rows;
  const comments = (await db.execute<{ id: string; body: string; username: string; song_title: string }>(sql`
    SELECT c.id, c.body, pr.username, s.title AS song_title FROM comments c
    JOIN profiles pr ON pr.id = c.user_id JOIN songs s ON s.id = c.song_id
    ORDER BY c.created_at DESC LIMIT 30`)).rows;

  const stats: AdminStats = {
    totalUsers: totals?.total_users ?? 0,
    activeUsers7d: totals?.active_users ?? 0,
    totalSongs: totals?.total_songs ?? 0,
    totalStreams: totals?.total_streams ?? 0,
    premiumSubscribers: totals?.premium_subscribers ?? 0,
    revenueMinor: totals?.revenue_minor ?? 0,
    topSongs: topSongs.map((r) => ({ id: r.id, title: r.title, artistName: r.artist_name, plays: r.plays })),
    topArtists: topArtists.map((r) => ({ id: r.id, name: r.name, plays: r.plays })),
  };

  return (
    <>
      <PageHeader eyebrow="Administration" title="Control Room" description="Publish music, manage the catalogue and moderate content. Every action is checked against your administrator role." />
      <AdminConsole
        stats={stats}
        artists={artists.map((a) => ({ id: a.id, name: a.name, verified: a.verified, monthlyListeners: a.monthly_listeners, bio: a.bio }))}
        albums={albums.map((a) => ({ id: a.id, title: a.title, artistId: a.artist_id, releaseDate: a.release_date }))}
        songs={songs.map((s) => ({ id: s.id, title: s.title, artistName: s.artist_name, playCount: s.play_count, hasAudio: Boolean(s.audio_url), hasVideo: Boolean(s.video_url) }))}
        shorts={shorts.map((s) => ({ id: s.id, caption: s.caption, songTitle: s.title, likesCount: s.likes_count }))}
        comments={comments.map((c) => ({ id: c.id, body: c.body, username: c.username, songTitle: c.song_title }))}
      />
    </>
  );
}
