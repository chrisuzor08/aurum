"use client";

import { Heart, Trash2, Download, Clock } from "lucide-react";
import { EmptyState, ErrorState, Skeleton } from "@/components/common/ui";
import { SongRow } from "@/components/music/MusicCards";
import { useApi } from "@/hooks/useApi";
import { api } from "@/services/api";
import { relativeTime } from "@/lib/format";
import { usePlayerStore } from "@/store/player";
import { useState } from "react";
import type { SongSummary } from "@/types";
import { IconButton } from "@/components/common/ui";

type Kind = "likes" | "downloads" | "history";
type Item = SongSummary & { playedAt?: string; plays?: number };

/** Shared track list for Liked Songs, Downloads and Listening History. Each row has its own inline action. */
export function TrackListView({ kind, emptyTitle, emptyText, showPlayed = false }: { kind: Kind; emptyTitle: string; emptyText: string; showPlayed?: boolean }) {
  const { data, error, loading, retry, setData } = useApi<{ songs: Item[] }>(`/api/library?kind=${kind}`);
  const flash = usePlayerStore((s) => s.flash);
  const [busy, setBusy] = useState<string | null>(null);

  const removeItem = async (song: Item) => {
    setBusy(song.id);
    try {
      if (kind === "likes") await api("/api/library", { method: "POST", json: { kind: "like", id: song.id, on: false } });
      if (kind === "downloads") await api("/api/library", { method: "POST", json: { kind: "download", id: song.id, on: false } });
      setData({ songs: (data?.songs ?? []).filter((s) => s.id !== song.id) });
      flash(kind === "likes" ? "Removed from Liked Songs" : "Removed from downloads");
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (loading && !data)
    return (
      <div className="space-y-2" aria-busy="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (!data || data.songs.length === 0) return <EmptyState icon={kind === "likes" ? <Heart size={28} /> : kind === "history" ? <Clock size={28} /> : <Download size={28} />} title={emptyTitle} text={emptyText} />;

  return (
    <div className="space-y-1 rounded-2xl border border-white/5 bg-surface p-2">
      {data.songs.map((s, i) => (
        <SongRow
          key={`${s.id}-${i}`}
          song={s}
          index={i + 1}
          queue={data.songs}
          showAlbum
          actions={
            <div className="flex items-center gap-2">
              {showPlayed && s.playedAt && <span className="hidden text-xs text-secondary md:block">{relativeTime(s.playedAt)}</span>}
              {(kind === "likes" || kind === "downloads") && (
                <IconButton label={kind === "likes" ? `Unlike ${s.title}` : `Remove ${s.title} download`} className="h-8 w-8" disabled={busy === s.id} onClick={() => removeItem(s)}>
                  {kind === "likes" ? <Heart size={15} className="text-gold" fill="currentColor" /> : <Trash2 size={15} />}
                </IconButton>
              )}
            </div>
          }
        />
      ))}
    </div>
  );
}
