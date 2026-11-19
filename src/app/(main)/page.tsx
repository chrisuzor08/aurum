import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { getEntitlements } from "@/lib/entitlements";
import { getAlbumCards, getArtistCards, getFacets, querySongs, SONG_FROM, SONG_SELECT, toSong, type SongRow } from "@/lib/catalog";
import { getChart } from "@/lib/charts";
import { preferences } from "@/db/schema";
import { pgTextArray } from "@/lib/sql";
import { eq } from "drizzle-orm";
import { Section, Badge } from "@/components/common/ui";
import { CardRow } from "@/components/common/CardRow";
import { AdSlot } from "@/components/common/AdSlot";
import { SongCard, AlbumCard, ArtistCard, GenreTile } from "@/components/music/MusicCards";
import { ChartList } from "@/components/charts/ChartList";
import type { SongSummary } from "@/types";

export const metadata = { title: "Home" };

async function recentlyPlayed(userId: string, offset: number, limit: number): Promise<SongSummary[]> {
  const res = await db.execute<SongRow>(sql`
    SELECT ${SONG_SELECT} ${SONG_FROM}
    JOIN (
      SELECT song_id, MAX(played_at) AS last_played FROM play_events
      WHERE user_id = ${userId}::uuid GROUP BY song_id
      ORDER BY last_played DESC LIMIT ${limit} OFFSET ${offset}
    ) x ON x.song_id = s.id
    ORDER BY x.last_played DESC`);
  return res.rows.map(toSong);
}

async function genrePreferences(userId: string): Promise<string[]> {
  const rows = await db.select({ value: preferences.value }).from(preferences).where(eq(preferences.userId, userId));
  return rows.filter((r) => r.value).map((r) => r.value);
}

export default async function HomePage() {
  const user = await getCurrentUser();
  const ent = getEntitlements(user);
  const hour = new Date().getHours();
  const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const name = user ? user.displayName || user.username : null;

  const [recent, continueList, prefGenres, newReleases, popular, artists, genres, moods, albums, chart] = await Promise.all([
    user ? recentlyPlayed(user.id, 6, 12) : Promise.resolve([] as SongSummary[]),
    user ? recentlyPlayed(user.id, 0, 6) : Promise.resolve([] as SongSummary[]),
    user ? genrePreferences(user.id) : Promise.resolve([] as string[]),
    querySongs(sql`TRUE`, sql`s.release_date DESC, s.created_at DESC`, 12),
    querySongs(sql`TRUE`, sql`s.play_count DESC, s.title`, 12),
    getArtistCards(12),
    getFacets("genre"),
    getFacets("mood"),
    getAlbumCards(10, 0, "new"),
    getChart("week"),
  ]);

  const forYou = prefGenres.length
    ? await querySongs(sql`s.genre = ANY(${pgTextArray(prefGenres)}::text[])`, sql`s.play_count DESC`, 12)
    : popular.slice(0, 12);
  const continueItems = continueList.length ? continueList : popular.slice(0, 6);
  const recentItems = recent.length ? recent : popular.slice(6, 18);

  const sections: React.ReactNode[] = [
    <Section key="continue" title={user ? "Continue Listening" : "Trending Now"} action={<Link href="/search" className="text-sm text-secondary hover:text-gold">Explore</Link>}>
      <CardRow label="Continue listening">
        {continueItems.map((s) => (
          <SongCard key={s.id} song={s} queue={continueItems} />
        ))}
      </CardRow>
    </Section>,
    <Section key="recent" title="Recently Played">
      <CardRow label="Recently played">
        {recentItems.map((s) => (
          <SongCard key={s.id} song={s} queue={recentItems} />
        ))}
      </CardRow>
    </Section>,
    <Section key="foryou" title="Made For You" action={prefGenres.length ? <Badge tone="muted">Based on your taste</Badge> : undefined}>
      <CardRow label="Made for you">
        {forYou.map((s) => (
          <SongCard key={s.id} song={s} queue={forYou} />
        ))}
      </CardRow>
    </Section>,
    <Section key="new" title="New Releases">
      <CardRow label="New releases">
        {newReleases.map((s) => (
          <SongCard key={s.id} song={s} queue={newReleases} />
        ))}
      </CardRow>
    </Section>,
    <Section key="charts" title="Top Charts" action={<Link href="/charts" className="text-sm text-gold hover:underline">View all 50</Link>}>
      <div className="rounded-2xl border border-white/5 bg-surface p-2 md:p-4">
        <ChartList entries={chart.slice(0, 5)} />
      </div>
    </Section>,
    <Section key="artists" title="Popular Artists">
      <CardRow label="Popular artists">
        {artists.map((a) => (
          <ArtistCard key={a.id} {...a} />
        ))}
      </CardRow>
    </Section>,
    <Section key="genres" title="Browse Genres">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {genres.slice(0, 8).map((g) => (
          <GenreTile key={g.value} label={g.value} count={g.count} href={`/search?genre=${encodeURIComponent(g.value)}`} />
        ))}
      </div>
    </Section>,
    <Section key="moods" title="Browse Moods">
      <div className="flex flex-wrap gap-2">
        {moods.slice(0, 12).map((m) => (
          <Link
            key={m.value}
            href={`/search?mood=${encodeURIComponent(m.value)}`}
            className="rounded-full border border-white/10 px-4 py-2 text-sm capitalize text-white/80 transition duration-200 hover:border-gold/50 hover:text-gold"
          >
            {m.value} <span className="text-secondary">· {m.count}</span>
          </Link>
        ))}
      </div>
    </Section>,
    <Section key="albums" title="Recommended Albums">
      <CardRow label="Recommended albums">
        {albums.map((a) => (
          <AlbumCard key={a.id} id={a.id} title={a.title} coverUrl={a.coverUrl} artistName={a.artistName} />
        ))}
      </CardRow>
    </Section>,
  ];

  // Occasional free-tier ad placements (house promotion for Premium); none for Premium members.
  if (ent.showAds) sections.splice(4, 0, <AdSlot key="ad-1" />);

  return (
    <div className="pt-2">
      <header className="mb-10">
        <p className="text-xs uppercase tracking-[0.25em] text-gold">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
        <h1 className="font-display mt-2 text-3xl md:text-5xl">
          {name ? (
            <>
              {part}, <span className="text-gold-gradient">{name}</span>
            </>
          ) : (
            <>
              Welcome to <span className="text-gold-gradient">AURUM</span>
            </>
          )}
        </h1>
        {!user && (
          <p className="mt-3 text-sm text-secondary">
            <Link href="/login" className="text-gold hover:underline">Sign in</Link> to save likes, build playlists and get personalised picks.
          </p>
        )}
      </header>
      {sections}
    </div>
  );
}
