"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePlayerStore } from "@/store/player";
import { activeLineIndex, getLyrics } from "@/lib/lrc";
import type { SongSummary } from "@/types";
import { Lock } from "lucide-react";
import Link from "next/link";

/**
 * Synchronized lyrics. Highlight is driven by the store's currentTime, which is shared by audio and video,
 * so lyrics stay in sync across mode switches. Tap a line to seek.
 */
export function Lyrics({ song }: { song: SongSummary }) {
  const isPremium = usePlayerStore((s) => s.isPremium);
  // Only the track that is actually loaded drives the highlight; other songs show static lyrics.
  const currentTime = usePlayerStore((s) => (s.trackId === song.id ? s.currentTime : -1));
  const seek = usePlayerStore((s) => s.seek);
  const playing = usePlayerStore((s) => s.isPlaying);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const { lines, synced } = useMemo(() => getLyrics(song.lyricsLrc, song.lyricsPlain), [song.lyricsLrc, song.lyricsPlain]);
  // Synced timing is a Premium feature; free users see the plain-text version.
  const canSync = synced && isPremium;
  const active = canSync ? activeLineIndex(lines, currentTime) : -1;

  useEffect(() => {
    if (active < 0) return;
    lineRefs.current[active]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [active]);

  if (lines.length === 0) {
    return <p className="py-16 text-center text-sm text-secondary">Lyrics are not available for this track yet.</p>;
  }

  return (
    <div ref={containerRef} className="flex h-full flex-col">
      {synced && !isPremium && (
        <Link href="/premium" className="mx-auto mb-4 flex items-center gap-2 rounded-full border border-gold/30 px-4 py-1.5 text-xs text-gold-highlight">
          <Lock size={12} /> Synced lyrics are a Premium feature — upgrade
        </Link>
      )}
      <div className="no-scrollbar flex-1 overflow-y-auto py-[30vh]" aria-live="off">
        {lines.map((line, i) => {
          const isActive = i === active;
          return (
            <button
              key={`${i}-${line.time ?? "p"}`}
              ref={(el) => {
                lineRefs.current[i] = el;
              }}
              type="button"
              disabled={!canSync || line.time === null}
              onClick={() => {
                if (line.time === null) return;
                seek(line.time);
                if (!playing) togglePlay();
              }}
              aria-current={isActive ? "true" : undefined}
              className={`block w-full px-4 py-2 text-center font-display text-2xl leading-snug transition duration-300 md:text-3xl ${
                isActive ? "scale-105 text-gold drop-shadow-[0_0_12px_rgba(212,175,55,0.45)]" : canSync ? "text-white/35 hover:text-white/60" : "text-white/70"
              }`}
            >
              {line.text || "♪"}
            </button>
          );
        })}
      </div>
    </div>
  );
}
