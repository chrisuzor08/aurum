import { notFound } from "next/navigation";
import { sql, eq, and } from "drizzle-orm";
import { BadgeCheck, Headphones } from "lucide-react";
import { db } from "@/db";
import { artists, follows } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAlbumCards, getArtistCards, querySongs } from "@/lib/catalog";
import { Artwork, Badge, PageHeader, Section } from "@/components/common/ui";
import { CardRow } from "@/components/common/CardRow";
import { AlbumCard, ArtistCard, SongRow } from "@/components/music/MusicCards";
import { FollowButton, PlayQueueButtons } from "@/components/library/LibraryActions";
import { formatCount, formatTotalDuration } from "@/lib/format";
import { isUuid } from "@/lib/validate";

export default async function ArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [artist] = await db.select().from(artists).where(eq(artists.id, id)).limit(1);
  if (!artist) notFound();

  const user = await getCurrentUser();
  const [topSongs, discography, related, followRow] = await Promise.all([
    querySongs(sql`s.artist_id = ${id}::uuid`, sql`s.play_count DESC, s.title`, 10),
    db.execute<{ id: string; title: string; cover_url: string | null; release_date: string; artist_id: string; artist_name: string }>(sql`
      SELECT al.id, al.title, al.cover_url, al.release_date::text AS release_date, al.artist_id, a.name AS artist_name
      FROM albums al JOIN artists a ON a.id = al.artist_id WHERE al.artist_id = ${id}::uuid ORDER BY al.release_date DESC`),
    getArtistCards(9).then((list) => list.filter((a) => a.id !== id).slice(0, 8)),
    user ? db.select().from(follows).where(and(eq(follows.userId, user.id), eq(follows.artistId, id))).limit(1) : Promise.resolve([]),
  ]);
  const totalDuration = topSongs.reduce((acc, s) => acc + s.duration, 0);
  const isFollowing = followRow.length > 0;

  return (
    <>
      <section className="relative -mx-4 mb-8 overflow-hidden md:-mx-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(212,175,55,0.22),transparent_60%)]" aria-hidden />
        <div className="relative flex flex-col items-center gap-6 px-4 pb-8 pt-10 md:flex-row md:items-end md:gap-10 md:px-8">
          <div className="h-44 w-44 shrink-0 overflow-hidden rounded-full shadow-gold-lg md:h-56 md:w-56">
            <Artwork src={artist.imageUrl} seed={artist.name} alt={`${artist.name} portrait`} rounded="rounded-full" priority />
          </div>
          <div className="text-center md:text-left">
            <p className="text-xs uppercase tracking-[0.25em] text-gold">Artist</p>
            <h1 className="font-display mt-2 flex items-center justify-center gap-2 text-4xl md:justify-start md:text-6xl">
              {artist.name}
              {artist.verified && <BadgeCheck className="text-gold" size={28} aria-label="Verified artist" />}
            </h1>
            <p className="mt-3 flex items-center justify-center gap-2 text-sm text-secondary md:justify-start">
              <Headphones size={14} /> {formatCount(artist.monthlyListeners)} monthly listeners
              {topSongs.length > 0 && <span>· {topSongs.length} top tracks · {formatTotalDuration(totalDuration)}</span>}
            </p>
            <div className="mt-5 flex items-center justify-center gap-3 md:justify-start">
              <PlayQueueButtons songs={topSongs} label="Play top songs" />
              <FollowButton artistId={artist.id} initial={isFollowing} signedIn={Boolean(user)} />
            </div>
          </div>
        </div>
      </section>

      {artist.bio && (
        <Section title="About">
          <p className="max-w-3xl leading-relaxed text-white/75">{artist.bio}</p>
        </Section>
      )}

      <Section title="Top Songs">
        {topSongs.length === 0 ? (
          <p className="text-sm text-secondary">No releases yet.</p>
        ) : (
          <div className="space-y-1 rounded-2xl border border-white/5 bg-surface p-2">
            {topSongs.map((s, i) => (
              <SongRow key={s.id} song={s} index={i + 1} queue={topSongs} showAlbum />
            ))}
          </div>
        )}
      </Section>

      <Section title="Discography">
        {discography.rows.length === 0 ? (
          <p className="text-sm text-secondary">No albums published yet.</p>
        ) : (
          <CardRow label="Albums">
            {discography.rows.map((a) => (
              <AlbumCard key={a.id} id={a.id} title={a.title} coverUrl={a.cover_url} artistName={a.artist_name} subtitle={`${a.release_date.slice(0, 4)} · Album`} />
            ))}
          </CardRow>
        )}
      </Section>

      <Section title="Related Artists">
        <CardRow label="Related artists">
          {related.map((a) => (
            <ArtistCard key={a.id} {...a} />
          ))}
        </CardRow>
      </Section>
    </>
  );
}
