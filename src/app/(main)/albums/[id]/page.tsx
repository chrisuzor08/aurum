import Link from "next/link";
import { notFound } from "next/navigation";
import { sql, eq, and } from "drizzle-orm";
import { db } from "@/db";
import { albumSaves, albums } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { querySongs } from "@/lib/catalog";
import { Artwork, Badge } from "@/components/common/ui";
import { SongRow } from "@/components/music/MusicCards";
import { AlbumSaveButton, PlayQueueButtons } from "@/components/library/LibraryActions";
import { formatDate, formatTotalDuration } from "@/lib/format";
import { isUuid } from "@/lib/validate";

export default async function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [album] = await db
    .select({ id: albums.id, title: albums.title, coverUrl: albums.coverUrl, releaseDate: albums.releaseDate, artistId: albums.artistId })
    .from(albums)
    .where(eq(albums.id, id))
    .limit(1);
  if (!album) notFound();
  const artist = await db.execute<{ name: string }>(sql`SELECT name FROM artists WHERE id = ${album.artistId}::uuid`);
  const user = await getCurrentUser();
  const tracks = await querySongs(sql`s.album_id = ${id}::uuid`, sql`s.created_at, s.title`, 100);
  const saved = user ? (await db.select().from(albumSaves).where(and(eq(albumSaves.userId, user.id), eq(albumSaves.albumId, id))).limit(1)).length > 0 : false;
  const total = tracks.reduce((a, t) => a + t.duration, 0);
  const artistName = artist.rows[0]?.name ?? "Unknown artist";

  return (
    <>
      <section className="relative -mx-4 mb-8 overflow-hidden md:-mx-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(212,175,55,0.2),transparent_60%)]" aria-hidden />
        <div className="relative flex flex-col items-center gap-6 px-4 pb-8 pt-8 md:flex-row md:items-end md:gap-8 md:px-8">
          <div className="w-56 shrink-0 overflow-hidden rounded-2xl shadow-gold-lg md:w-64">
            <Artwork src={album.coverUrl} seed={album.title} alt={`${album.title} cover`} rounded="rounded-2xl" priority />
          </div>
          <div className="text-center md:text-left">
            <p className="text-xs uppercase tracking-[0.25em] text-gold">Album</p>
            <h1 className="font-display mt-2 text-4xl md:text-6xl">{album.title}</h1>
            <p className="mt-3 text-sm text-white/80">
              <Link href={`/artists/${album.artistId}`} className="font-medium hover:text-gold">{artistName}</Link>
              <span className="text-secondary"> · {formatDate(album.releaseDate)} · {tracks.length} songs · {formatTotalDuration(total)}</span>
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3 md:justify-start">
              <PlayQueueButtons songs={tracks} label="Play album" />
              <PlayQueueButtons songs={tracks} shuffle label="Shuffle album" />
              <AlbumSaveButton albumId={album.id} initial={saved} signedIn={Boolean(user)} />
            </div>
          </div>
        </div>
      </section>

      {tracks.length === 0 ? (
        <p className="text-sm text-secondary">This album has no tracks yet.</p>
      ) : (
        <div className="space-y-1 rounded-2xl border border-white/5 bg-surface p-2">
          {tracks.map((s, i) => (
            <SongRow key={s.id} song={s} index={i + 1} queue={tracks} />
          ))}
        </div>
      )}
      <div className="mt-6">
        <Badge tone="muted">Released {formatDate(album.releaseDate)}</Badge>
      </div>
    </>
  );
}
