"use client";

import { ChevronUp, Pause, Play, SkipForward } from "lucide-react";
import { usePlayerStore, selectCurrentSong } from "@/store/player";
import { Artwork, IconButton } from "@/components/common/ui";

/** Persistent mini-player. Sits above the bottom nav on mobile and at the bottom of the viewport on desktop. */
export function MiniPlayer() {
  const song = usePlayerStore(selectCurrentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const error = usePlayerStore((s) => s.error);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const next = usePlayerStore((s) => s.next);
  const setFullscreen = usePlayerStore((s) => s.setFullscreen);
  const retry = usePlayerStore((s) => s.retry);

  if (!song) return null;
  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 px-2 md:bottom-0 md:left-64 md:px-4 md:pb-3">
      <div className="relative mx-auto flex max-w-5xl items-center gap-3 overflow-hidden rounded-2xl border border-gold/15 bg-elevated/95 p-2 pr-3 shadow-gold backdrop-blur-xl md:rounded-none md:rounded-t-2xl md:border-x-0 md:border-b-0 md:shadow-none">
        <button
          type="button"
          onClick={() => setFullscreen(true)}
          aria-label={`Open full player for ${song.title}`}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <div className="h-12 w-12 shrink-0">
            <Artwork src={song.coverUrl} seed={song.title} alt="" rounded="rounded-lg" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{song.title}</p>
            <p className="truncate text-xs text-secondary">{error ? <span className="text-red-300">{error}</span> : song.artistName}</p>
          </div>
        </button>
        <IconButton label={error ? "Retry playback" : isPlaying ? "Pause" : "Play"} onClick={error ? retry : togglePlay} className="bg-gold-gradient text-[#0A0A0A] shadow-gold hover:bg-gold-gradient hover:text-[#0A0A0A]">
          {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
        </IconButton>
        <IconButton label="Next track" onClick={() => void next()} className="hidden sm:grid">
          <SkipForward size={18} />
        </IconButton>
        <IconButton label="Expand player" onClick={() => setFullscreen(true)}>
          <ChevronUp size={18} />
        </IconButton>
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/10" aria-hidden>
          <div className="h-full bg-gold-gradient transition-[width] duration-200" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
