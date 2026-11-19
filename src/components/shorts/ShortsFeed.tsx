"use client";

import { Bookmark, Check, Heart, MessageCircle, Pause, Play, Share2, UserPlus, UserCheck, Music } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, EmptyState, ErrorState, IconButton, Skeleton } from "@/components/common/ui";
import { CommentsPanel } from "@/components/social/CommentsPanel";
import { api } from "@/services/api";
import { usePlayerStore } from "@/store/player";
import { formatCount } from "@/lib/format";
import type { SongSummary } from "@/types";
import { cn } from "@/utils/cn";

interface ShortItem {
  id: string;
  caption: string | null;
  likesCount: number;
  videoUrl: string;
  liked: boolean;
  following: boolean;
  song: SongSummary;
}
interface FeedResponse {
  items: ShortItem[];
  nextCursor: string | null;
}

const MAX_SHORT_SECONDS = 60;

/**
 * AURUM Shorts: full-viewport vertical feed.
 *  - IntersectionObserver (threshold 0.6) decides which short is active; only that one plays.
 *  - Leaving the viewport pauses a short; the global music player is paused when a short starts.
 *  - Each short is clamped to 60 seconds and loops.
 */
export function ShortsFeed() {
  const router = useRouter();
  const playSong = usePlayerStore((s) => s.playSong);
  const flash = usePlayerStore((s) => s.flash);

  const [items, setItems] = useState<ShortItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [commentsFor, setCommentsFor] = useState<SongSummary | null>(null);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [paused, setPaused] = useState<Record<string, boolean>>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const videos = useRef(new Map<string, HTMLVideoElement>());
  const ioRef = useRef<IntersectionObserver | null>(null);

  const loadMore = useCallback(async (cur: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<FeedResponse>(`/api/shorts?limit=6${cur ? `&cursor=${encodeURIComponent(cur)}` : ""}`);
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...res.items.filter((i) => !seen.has(i.id))];
      });
      setCursor(res.nextCursor);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, []);

  useEffect(() => {
    void loadMore(null);
  }, [loadMore]);

  // Visibility-based activation.
  useEffect(() => {
    ioRef.current = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.6) setActiveId(e.target.getAttribute("data-id"));
        }
      },
      { root: containerRef.current, threshold: [0.6] },
    );
    return () => ioRef.current?.disconnect();
  }, []);

  const attach = (id: string) => (el: HTMLElement | null) => {
    if (el) ioRef.current?.observe(el);
  };

  // Only the active short plays; the global player pauses so audio never overlaps.
  useEffect(() => {
    if (!activeId) return;
    const st = usePlayerStore.getState();
    if (st.isPlaying) st.togglePlay();
    videos.current.forEach((v, id) => {
      if (id === activeId) {
        v.muted = muted;
        v.play().catch(() => {
          v.muted = true;
          setMuted(true);
          void v.play().catch(() => undefined);
        });
      } else {
        v.pause();
      }
    });
    setPaused((p) => ({ ...p, [activeId]: false }));
    // Load the saved state for the active short's song (best-effort, guests get false).
    const item = items.find((i) => i.id === activeId);
    if (item && saved[item.song.id] === undefined) {
      api<{ liked: boolean }>(`/api/library?kind=status&id=${item.song.id}`)
        .then((r) => setSaved((s) => ({ ...s, [item.song.id]: r.liked })))
        .catch(() => undefined);
    }
    // Prefetch when nearing the end of the loaded list.
    const idx = items.findIndex((i) => i.id === activeId);
    if (cursor && !loading && idx >= items.length - 2) void loadMore(cursor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    videos.current.forEach((v) => (v.muted = muted));
  }, [muted]);

  // Pause everything when the feed unmounts.
  useEffect(() => {
    const map = videos.current;
    return () => map.forEach((v) => v.pause());
  }, []);

  const requireSignIn = (msg: string) => {
    flash(msg);
    router.push(`/login?next=${encodeURIComponent("/trending")}`);
  };

  const toggleLike = async (item: ShortItem) => {
    try {
      const res = await api<{ liked: boolean; likesCount: number }>("/api/shorts", { method: "POST", json: { shortId: item.id } });
      setItems((list) => list.map((i) => (i.id === item.id ? { ...i, liked: res.liked, likesCount: res.likesCount } : i)));
    } catch (e) {
      if (/sign in/i.test((e as Error).message)) requireSignIn("Sign in to like shorts");
      else flash((e as Error).message);
    }
  };

  const toggleSave = async (item: ShortItem) => {
    const next = !saved[item.song.id];
    try {
      await api("/api/library", { method: "POST", json: { kind: "like", id: item.song.id, on: next } });
      setSaved((s) => ({ ...s, [item.song.id]: next }));
      flash(next ? "Saved to Liked Songs" : "Removed from Liked Songs");
    } catch (e) {
      if (/sign in/i.test((e as Error).message)) requireSignIn("Sign in to save songs");
      else flash((e as Error).message);
    }
  };

  const toggleFollow = async (item: ShortItem) => {
    try {
      await api("/api/library", { method: "POST", json: { kind: "follow", id: item.song.artistId, on: !item.following } });
      setItems((list) => list.map((i) => (i.song.artistId === item.song.artistId ? { ...i, following: !item.following } : i)));
    } catch (e) {
      if (/sign in/i.test((e as Error).message)) requireSignIn("Sign in to follow artists");
      else flash((e as Error).message);
    }
  };

  const share = async (item: ShortItem) => {
    const url = `${window.location.origin}/songs/${item.song.id}`;
    try {
      if (navigator.share) await navigator.share({ title: item.song.title, text: `${item.song.title} · ${item.song.artistName}`, url });
      else {
        await navigator.clipboard.writeText(url);
        flash("Song link copied");
      }
    } catch {
      /* cancelled */
    }
  };

  const playFull = (item: ShortItem) => {
    videos.current.get(item.id)?.pause();
    playSong(item.song, [item.song]);
    flash(`Playing “${item.song.title}” in full`);
  };

  const togglePaused = (id: string) => {
    const v = videos.current.get(id);
    if (!v) return;
    if (v.paused) {
      // Starting a short always stops the global player first.
      const st = usePlayerStore.getState();
      if (st.isPlaying) st.togglePlay();
      void v.play();
    } else v.pause();
    setPaused((p) => ({ ...p, [id]: !v.paused }));
  };

  if (initialized && items.length === 0 && !error) {
    return (
      <div className="px-2 py-10">
        <EmptyState icon={<Music size={28} />} title="No shorts yet" text="Shorts from artists on AURUM will appear here. Check back soon." />
      </div>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        aria-label="AURUM Shorts feed"
        className="no-scrollbar fixed inset-x-0 top-16 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-[35] snap-y snap-mandatory overflow-y-auto overscroll-y-contain bg-black md:left-64 md:top-16 md:bottom-0 md:flex md:flex-col"
      >
        {items.map((item, idx) => {
          const active = activeId === item.id || (activeId === null && idx === 0);
          const isSaved = Boolean(saved[item.song.id]);
          return (
            <section
              key={item.id}
              data-id={item.id}
              ref={attach(item.id)}
              aria-label={`${item.song.title} by ${item.song.artistName}`}
              className="relative flex h-full w-full shrink-0 snap-start items-center justify-center md:h-full"
            >
              <div className="relative h-full w-full overflow-hidden bg-elevated md:mx-auto md:h-[calc(100%-2rem)] md:w-auto md:aspect-[9/16] md:rounded-3xl md:border md:border-gold/15 md:shadow-gold-lg">
                <video
                  ref={(el) => {
                    if (el) videos.current.set(item.id, el);
                    else videos.current.delete(item.id);
                  }}
                  src={item.videoUrl}
                  className="h-full w-full bg-black object-cover"
                  loop
                  playsInline
                  preload={idx < 2 ? "auto" : "metadata"}
                  onClick={() => togglePaused(item.id)}
                  onTimeUpdate={(e) => {
                    const v = e.currentTarget;
                    if (v.currentTime >= Math.min(MAX_SHORT_SECONDS, v.duration || MAX_SHORT_SECONDS)) v.currentTime = 0;
                  }}
                  onError={() => setError("This short couldn’t be loaded. Sign in to watch AURUM Shorts or try again.")}
                  aria-label={`Short: ${item.song.title}`}
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/60 to-transparent" aria-hidden />

                {active && paused[item.id] && (
                  <span className="pointer-events-none absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-gold">
                    <Play size={28} fill="currentColor" className="ml-1" />
                  </span>
                )}

                {/* Info */}
                <div className="absolute inset-x-0 bottom-0 z-10 p-5 pr-20 pb-6">
                  <div className="flex items-center gap-3">
                    <Link href={`/artists/${item.song.artistId}`} className="grid h-10 w-10 place-items-center rounded-full border border-gold/50 bg-surface font-display text-sm text-gold">
                      {item.song.artistName.slice(0, 1)}
                    </Link>
                    <Link href={`/artists/${item.song.artistId}`} className="min-w-0 truncate text-sm font-semibold text-white hover:text-gold">
                      {item.song.artistName}
                    </Link>
                    <button
                      type="button"
                      onClick={() => toggleFollow(item)}
                      aria-pressed={item.following}
                      className={cn(
                        "ml-1 inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-semibold transition",
                        item.following ? "border border-gold/50 text-gold" : "bg-gold-gradient text-[#0A0A0A] shadow-gold",
                      )}
                    >
                      {item.following ? <UserCheck size={14} /> : <UserPlus size={14} />}
                      {item.following ? "Following" : "Follow"}
                    </button>
                  </div>
                  <p className="mt-3 truncate text-base font-medium text-white">{item.song.title}</p>
                  {item.caption && <p className="mt-1 line-clamp-2 text-sm text-white/75">{item.caption}</p>}
                  <button
                    type="button"
                    onClick={() => playFull(item)}
                    className="mt-4 inline-flex h-10 items-center gap-2 rounded-full border border-gold/50 bg-black/40 px-4 text-sm text-gold backdrop-blur transition hover:bg-gold/10"
                  >
                    <Play size={14} fill="currentColor" /> Play full song
                  </button>
                </div>

                {/* Right rail */}
                <div className="absolute bottom-24 right-3 z-10 flex flex-col items-center gap-5">
                  <RailButton label={item.liked ? "Unlike short" : "Like short"} active={item.liked} count={formatCount(item.likesCount)} onClick={() => toggleLike(item)}>
                    <Heart size={26} fill={item.liked ? "currentColor" : "none"} />
                  </RailButton>
                  <RailButton label="Comments" onClick={() => setCommentsFor(item.song)}>
                    <MessageCircle size={26} />
                  </RailButton>
                  <RailButton label={isSaved ? "Remove from saved" : "Save song"} active={isSaved} onClick={() => toggleSave(item)}>
                    {isSaved ? <Check size={26} /> : <Bookmark size={26} />}
                  </RailButton>
                  <RailButton label="Share" onClick={() => share(item)}>
                    <Share2 size={26} />
                  </RailButton>
                  <RailButton label={muted ? "Unmute" : "Mute"} onClick={() => setMuted((m) => !m)}>
                    {muted ? <Pause size={22} /> : <Music size={22} />}
                  </RailButton>
                </div>
              </div>
            </section>
          );
        })}

        {loading && items.length === 0 && (
          <div className="flex h-full w-full items-center justify-center p-6">
            <Skeleton className="h-full w-full max-w-sm rounded-3xl md:h-[80%]" />
          </div>
        )}
        {error && items.length === 0 && (
          <div className="flex h-full w-full items-center justify-center p-6">
            <ErrorState message={error} onRetry={() => loadMore(null)} />
          </div>
        )}
        {loading && items.length > 0 && (
          <div className="flex h-24 w-full snap-start items-center justify-center text-xs text-secondary">Loading more…</div>
        )}
      </div>

      <Dialog open={commentsFor !== null} onClose={() => setCommentsFor(null)} title="Comments" className="max-w-lg">
        {commentsFor && (
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <CommentsPanel songId={commentsFor.id} signedIn={true} compact />
          </div>
        )}
      </Dialog>
    </>
  );
}

function RailButton({ label, children, onClick, active, count }: { label: string; children: React.ReactNode; onClick: () => void; active?: boolean; count?: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <IconButton
        label={label}
        onClick={onClick}
        className={cn("h-12 w-12 border border-white/10 bg-black/40 backdrop-blur hover:bg-black/60", active ? "text-gold" : "text-white")}
      >
        {children}
      </IconButton>
      {count && <span className="text-[11px] tabular-nums text-white/80">{count}</span>}
    </div>
  );
}
