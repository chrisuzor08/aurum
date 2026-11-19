"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { useState } from "react";
import { Artwork, Badge, Button, EmptyState, ErrorState, Skeleton } from "@/components/common/ui";
import { PlayButton } from "@/components/music/MusicCards";
import { useApi } from "@/hooks/useApi";
import { usePlayerStore } from "@/store/player";
import { formatCount } from "@/lib/format";
import type { ChartEntry, PeriodKey, SongSummary } from "@/types";
import { cn } from "@/utils/cn";

function Movement({ entry }: { entry: ChartEntry }) {
  if (entry.movement === "new") return <Badge>New</Badge>;
  if (entry.movement === "up")
    return (
      <span className="flex items-center gap-0.5 text-xs text-gold" aria-label={`Up ${(entry.previousRank ?? 0) - entry.rank} places`}>
        <ArrowUp size={12} /> {(entry.previousRank ?? 0) - entry.rank}
      </span>
    );
  if (entry.movement === "down")
    return (
      <span className="flex items-center gap-0.5 text-xs text-secondary" aria-label={`Down ${entry.rank - (entry.previousRank ?? 0)} places`}>
        <ArrowDown size={12} /> {entry.rank - (entry.previousRank ?? 0)}
      </span>
    );
  return <span className="text-secondary" aria-label="Unchanged"><Minus size={12} /></span>;
}

/** Ranked list. Quick play starts the chart from that entry with the full list as the queue. */
export function ChartList({ entries }: { entries: ChartEntry[] }) {
  const playSong = usePlayerStore((s) => s.playSong);
  const trackId = usePlayerStore((s) => s.trackId);
  const queue: SongSummary[] = entries.map((e) => e.song);
  return (
    <ol className="divide-y divide-white/5">
      {entries.map((e) => {
        const active = trackId === e.song.id;
        return (
          <li key={e.song.id} className={cn("group flex items-center gap-3 px-2 py-3 transition hover:bg-white/5", active && "bg-gold/5")}>
            <span className={cn("w-8 shrink-0 text-center font-display text-xl tabular-nums", e.rank <= 3 ? "text-gold-highlight" : "text-secondary")}>{e.rank}</span>
            <div className="h-12 w-12 shrink-0">
              <Artwork src={e.song.coverUrl} seed={e.song.title} alt="" rounded="rounded-lg" />
            </div>
            <div className="min-w-0 flex-1">
              <Link href={`/songs/${e.song.id}`} className={cn("block truncate text-sm font-medium hover:text-gold", active ? "text-gold" : "text-white")}>
                {e.song.title}
              </Link>
              <Link href={`/artists/${e.song.artistId}`} className="block truncate text-xs text-secondary hover:text-gold">
                {e.song.artistName}
              </Link>
            </div>
            <div className="hidden w-16 justify-center sm:flex"><Movement entry={e} /></div>
            <span className="w-20 text-right text-xs tabular-nums text-secondary sm:text-sm">{formatCount(e.plays)} <span className="hidden sm:inline">plays</span></span>
            <button
              type="button"
              aria-label={`Play ${e.song.title}`}
              onClick={() => playSong(e.song, queue)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold-gradient text-[#0A0A0A] shadow-gold transition hover:scale-105"
            >
              <span className="sr-only">Play</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "season", label: "This Season" },
];

/** Period-switchable chart with progressive reveal (10 → 50) to keep the first paint light. */
export function ChartsView() {
  const [period, setPeriod] = useState<PeriodKey>("week");
  const [visible, setVisible] = useState(10);
  const { data, error, loading, retry } = useApi<{ entries: ChartEntry[]; label: string }>(`/api/charts?period=${period}`);

  return (
    <div>
      <div role="tablist" aria-label="Chart period" className="mb-6 inline-flex rounded-full border border-white/10 bg-surface p-1">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            role="tab"
            aria-selected={period === p.key}
            onClick={() => {
              setPeriod(p.key);
              setVisible(10);
            }}
            className={cn(
              "rounded-full px-4 py-2 text-sm transition duration-200",
              period === p.key ? "bg-gold-gradient font-semibold text-[#0A0A0A] shadow-gold" : "text-secondary hover:text-white",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading && !data && (
        <div className="space-y-3" aria-busy="true" aria-label="Loading chart">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}
      {error && <ErrorState message={error} onRetry={retry} />}
      {data && data.entries.length === 0 && (
        <EmptyState title="No ranking yet for this period" text="Charts are built from real listening sessions. Play a few tracks and this list will fill in." />
      )}
      {data && data.entries.length > 0 && (
        <>
          <p className="mb-2 text-xs text-secondary">Top {data.entries.length} · {data.label}</p>
          <div className="rounded-2xl border border-white/5 bg-surface px-2 md:px-4">
            <ChartList entries={data.entries.slice(0, visible)} />
          </div>
          {visible < data.entries.length && (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" onClick={() => setVisible(data.entries.length)}>
                Show all {data.entries.length}
              </Button>
            </div>
          )}
        </>
      )}
      <p className="mt-6 text-xs text-secondary">
        Movement compares against the previous equivalent period. <Link href="/search" className="text-gold hover:underline">Find more music</Link>
      </p>
    </div>
  );
}
