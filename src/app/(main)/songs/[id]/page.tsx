import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { Clock3, Sparkles } from "lucide-react";
import { db } from "@/db";
import { querySongs, SONG_FROM, SONG_SELECT, toSong, type SongRow } from "@/lib/catalog";
import { Artwork, Badge, Section } from "@/components/common/ui";
import { CardRow } from "@/components/common/CardRow";
import { SongCard } from "@/components/music/MusicCards";
import { CommentsPanel } from "@/components/social/CommentsPanel";
import { SongActions } from "@/components/library/LibraryActions";
import { Lyrics } from "@/components/player/Lyrics";
import { formatDate, formatDuration } from "@/lib/format";
import { isUuid } from "@/lib/validate";
import { getCurrentUser } from "@/lib/auth";

export default async function SongPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const res = await db.execute<SongRow>(sql`SELECT ${SONG_SELECT} ${SONG_FROM} WHERE s.id = ${id}::uuid LIMIT 1`);
  const row = res.rows[0];
  if (!row) notFound();
  const song = toSong(row);
  const [related, user] = await Promise.all([
    querySongs(sql`s.genre = ${song.genre} AND s.id <> ${id}::uuid`, sql`s.play_count DESC`, 12),
    getCurrentUser(),
  ]);
  const hasLyrics = Boolean(song.lyricsLrc || song.lyricsPlain);

  return (
    <>
      <section className="relative -mx-4 mb-8 overflow-hidden md:-mx-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.2),transparent_65%)]" aria-hidden />
        <div className="relative flex flex-col items-center gap-6 px-4 pb-6 pt-8 md:flex-row md:items-end md:gap-10 md:px-8">
          <div className="w-60 shrink-0 overflow-hidden rounded-2xl shadow-gold-lg md:w-72">
            <Artwork src={song.coverUrl} seed={song.title} alt={`${song.title} cover`} rounded="rounded-2xl" priority />
          </div>
          <div className="min-w-0 text-center md:text-left">
            <p className="text-xs uppercase tracking-[0.25em] text-gold">Song</p>
            <h1 className="font-display mt-2 text-4xl md:text-6xl">{song.title}</h1>
            <p className="mt-3 text-sm text-white/80">
              <Link href={`/artists/${song.artistId}`} className="font-medium hover:text-gold">{song.artistName}</Link>
              {song.albumId && song.albumTitle && (
                <>
                  <span className="text-secondary"> · </span>
                  <Link href={`/albums/${song.albumId}`} className="hover:text-gold">{song.albumTitle}</Link>
                </>
              )}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 md:justify-start">
              <Badge tone="muted">{song.genre}</Badge>
              <Badge tone="muted">{song.mood}</Badge>
              {song.explicit && <Badge tone="muted">Explicit</Badge>}
              <span className="flex items-center gap-1 text-xs text-secondary"><Clock3 size={12} /> {formatDuration(song.duration)}</span>
              <span className="text-xs text-secondary">· Released {formatDate(song.releaseDate)} · {song.playCount.toLocaleString()} plays</span>
            </div>
            <div className="mt-5">
              <SongActions song={song} signedIn={Boolean(user)} hasVideo={song.hasVideo} hasAudio={song.hasAudio} />
            </div>
          </div>
        </div>
      </section>

      {hasLyrics && (
        <Section title="Lyrics">
          <div className="rounded-2xl border border-white/5 bg-surface p-4">
            <p className="mb-2 flex items-center gap-2 text-xs text-secondary"><Sparkles size={12} className="text-gold" /> Tap a line to jump to it when this song is playing.</p>
            <div className="max-h-[50vh] overflow-y-auto">
              <Lyrics song={song} />
            </div>
          </div>
        </Section>
      )}

      <Section title="Comments" id="comments">
        <CommentsPanel songId={song.id} signedIn={Boolean(user)} />
      </Section>

      {related.length > 0 && (
        <Section title={`More ${song.genre}`}>
          <CardRow label="Related songs">
            {related.map((s) => (
              <SongCard key={s.id} song={s} queue={related} />
            ))}
          </CardRow>
        </Section>
      )}
    </>
  );
}
