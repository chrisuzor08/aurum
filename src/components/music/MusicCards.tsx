"use client";

import Link from "next/link";
import { Play, MoreHorizontal, BadgeCheck, Plus, ListEnd, Heart } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Artwork, IconButton } from "@/components/common/ui";
import { usePlayerStore } from "@/store/player";
import { formatDuration, formatCount } from "@/lib/format";
import type { SongSummary } from "@/types";
import { AddToPlaylistDialog } from "@/components/player/AddToPlaylistDialog";
import { cn } from "@/utils/cn";

/** Plays a song within a queue context. */
export function PlayButton({ onPlay, label, className, size = 44 }: { onPlay: () => void; label: string; className?: string; size?: number }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onPlay();
      }}
      style={{ width: size, height: size }}
      className={cn(
        "grid place-items-center rounded-full bg-gold-gradient text-[#0A0A0A] opacity-100 shadow-gold transition duration-200 hover:scale-105 focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:translate-y-2 md:group-hover:translate-y-0",
        className,
      )}
    >
      <Play size={Math.round(size * 0.42)} fill="currentColor" className="ml-0.5" />
    </button>
  );
}

function MenuItem({ icon, onClick, children }: { icon: ReactNode; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-white/85 transition hover:bg-white/5 hover:text-gold">
      <span className="text-gold">{icon}</span>
      {children}
    </button>
  );
}

export function SongCard({ song, queue, rank }: { song: SongSummary; queue?: SongSummary[]; rank?: number }) {
  const playSong = usePlayerStore((s) => s.playSong);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState(false);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const playNext = usePlayerStore((s) => s.playNext);
  return (
    <article className="group relative w-40 shrink-0 md:w-48">
      <div className="relative">
        <Link href={`/songs/${song.id}`} aria-label={`Open ${song.title}`} className="block overflow-hidden rounded-xl shadow-card transition duration-300 group-hover:-translate-y-1 group-hover:shadow-gold">
          <Artwork src={song.coverUrl} seed={song.title} alt={`${song.title} cover`} className="transition duration-500 group-hover:scale-105" />
        </Link>
        <PlayButton className="absolute bottom-3 right-3" label={`Play ${song.title}`} onPlay={() => playSong(song, queue ?? [song])} />
      </div>
      <div className="mt-3 flex items-start justify-between gap-1">
        <div className="min-w-0">
          <Link href={`/songs/${song.id}`} className="block truncate text-sm font-medium text-white hover:text-gold">
            {rank ? `${rank}. ` : ""}
            {song.title}
          </Link>
          <Link href={`/artists/${song.artistId}`} className="block truncate text-xs text-secondary hover:text-gold">
            {song.artistName}
          </Link>
        </div>
        <div className="relative">
          <IconButton label={`More options for ${song.title}`} className="h-8 w-8" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
            <MoreHorizontal size={16} />
          </IconButton>
          {menuOpen && (
            <div role="menu" className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-xl border border-white/10 bg-elevated py-1 shadow-card" onMouseLeave={() => setMenuOpen(false)}>
              <MenuItem icon={<ListEnd size={15} />} onClick={() => { playNext(song); setMenuOpen(false); }}>Play next</MenuItem>
              <MenuItem icon={<Plus size={15} />} onClick={() => { addToQueue(song); setMenuOpen(false); }}>Add to queue</MenuItem>
              <MenuItem icon={<Heart size={15} />} onClick={() => { setDialog(true); setMenuOpen(false); }}>Add to playlist</MenuItem>
            </div>
          )}
        </div>
      </div>
      <AddToPlaylistDialog songId={song.id} open={dialog} onClose={() => setDialog(false)} />
    </article>
  );
}

export function AlbumCard({ id, title, coverUrl, artistName, subtitle }: { id: string; title: string; coverUrl: string | null; artistName: string; subtitle?: string }) {
  return (
    <Link href={`/albums/${id}`} className="group block w-40 shrink-0 md:w-48">
      <div className="overflow-hidden rounded-xl shadow-card transition duration-300 group-hover:-translate-y-1 group-hover:shadow-gold">
        <Artwork src={coverUrl} seed={title} alt={`${title} album cover`} className="transition duration-500 group-hover:scale-105" />
      </div>
      <p className="mt-3 truncate text-sm font-medium text-white group-hover:text-gold">{title}</p>
      <p className="truncate text-xs text-secondary">{subtitle ?? artistName}</p>
    </Link>
  );
}

export function ArtistCard({ id, name, imageUrl, verified, monthlyListeners }: { id: string; name: string; imageUrl: string | null; verified: boolean; monthlyListeners: number }) {
  return (
    <Link href={`/artists/${id}`} className="group flex w-36 shrink-0 flex-col items-center text-center md:w-44">
      <div className="w-full overflow-hidden rounded-full shadow-card transition duration-300 group-hover:-translate-y-1 group-hover:shadow-gold">
        <Artwork src={imageUrl} seed={name} alt={`${name} portrait`} rounded="rounded-full" />
      </div>
      <p className="mt-3 flex items-center gap-1 truncate text-sm font-medium text-white group-hover:text-gold">
        {name}
        {verified && <BadgeCheck size={14} className="shrink-0 text-gold" aria-label="Verified artist" />}
      </p>
      <p className="text-xs text-secondary">{formatCount(monthlyListeners)} monthly listeners</p>
    </Link>
  );
}

export function GenreTile({ label, count, href }: { label: string; count: number; href: string }) {
  return (
    <Link
      href={href}
      className="group relative flex h-24 items-end overflow-hidden rounded-2xl border border-white/5 bg-surface p-4 transition duration-300 hover:border-gold/40 hover:shadow-gold md:h-28"
    >
      <span className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gold/10 blur-xl transition group-hover:bg-gold/20" aria-hidden />
      <div>
        <p className="font-display text-lg capitalize text-white group-hover:text-gold">{label}</p>
        <p className="text-xs text-secondary">{count} tracks</p>
      </div>
    </Link>
  );
}

/** Row used for every track list (albums, playlists, liked songs, history, search). */
export function SongRow({
  song,
  index,
  queue,
  actions,
  showAlbum = false,
  onPlay,
}: {
  song: SongSummary;
  index?: number;
  queue: SongSummary[];
  actions?: ReactNode;
  showAlbum?: boolean;
  onPlay?: () => void;
}) {
  const playSong = usePlayerStore((s) => s.playSong);
  const currentId = usePlayerStore((s) => s.trackId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const active = currentId === song.id;
  return (
    <div className={cn("group flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-white/5", active && "bg-gold/5")}>
      {index !== undefined && (
        <span className={cn("w-6 shrink-0 text-center text-sm tabular-nums", active ? "text-gold" : "text-secondary")}>{index}</span>
      )}
      <button
        type="button"
        onClick={onPlay ?? (() => playSong(song, queue))}
        aria-label={`Play ${song.title}`}
        className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg"
      >
        <Artwork src={song.coverUrl} seed={song.title} alt="" rounded="rounded-lg" />
        <span className={cn("absolute inset-0 grid place-items-center bg-black/50 transition", active ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
          <Play size={16} className="text-gold" fill="currentColor" />
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm", active ? "text-gold" : "text-white")}>
          {song.title}
          {song.explicit && <span className="ml-2 rounded bg-white/10 px-1 text-[10px] text-secondary">E</span>}
          {active && isPlaying && <span className="ml-2 text-[10px] uppercase tracking-widest text-gold">Playing</span>}
        </p>
        <p className="truncate text-xs text-secondary">
          <Link href={`/artists/${song.artistId}`} className="hover:text-gold">{song.artistName}</Link>
          {showAlbum && song.albumTitle ? ` · ${song.albumTitle}` : ""}
        </p>
      </div>
      <span className="hidden text-xs tabular-nums text-secondary sm:block">{formatDuration(song.duration)}</span>
      <div className="flex items-center">{actions}</div>
    </div>
  );
}
