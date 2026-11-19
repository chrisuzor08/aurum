"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown, Heart, ListMusic, ListPlus, Lock, MessageSquare, Minus, Pause, Play, Plus, Repeat, Repeat1, Share2, Shuffle,
  SkipBack, SkipForward, Timer, Volume1, Volume2, VolumeX, X, Mic2, Film, Music2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Artwork, Button, IconButton } from "@/components/common/ui";
import { AddToPlaylistDialog } from "@/components/player/AddToPlaylistDialog";
import { Lyrics } from "@/components/player/Lyrics";
import { api } from "@/services/api";
import { PLAYBACK_SPEEDS, usePlayerStore, selectCurrentSong } from "@/store/player";
import { formatDuration } from "@/lib/format";
import { cn } from "@/utils/cn";

const SLEEP_OPTIONS = [5, 15, 30, 45, 60];

export function FullPlayer() {
  const open = usePlayerStore((s) => s.isFullscreen);
  const song = usePlayerStore(selectCurrentSong);
  return <AnimatePresence>{open && song && <FullPlayerSheet key="full" />}</AnimatePresence>;
}

function FullPlayerSheet() {
  const router = useRouter();
  const s = usePlayerStore();
  const song = usePlayerStore(selectCurrentSong)!;
  const [liked, setLiked] = useState<boolean | null>(null);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [sleepOpen, setSleepOpen] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [volumeBeforeMute, setVolumeBeforeMute] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setLiked(null);
    api<{ liked: boolean }>(`/api/library?kind=status&id=${song.id}`)
      .then((r) => !cancelled && setLiked(r.liked))
      .catch(() => !cancelled && setLiked(false));
    return () => {
      cancelled = true;
    };
  }, [song.id]);

  const toggleLike = async () => {
    if (liked === null) return;
    try {
      const res = await api<{ liked: boolean }>("/api/library", { method: "POST", json: { kind: "like", id: song.id, on: !liked } });
      setLiked(res.liked);
      s.flash(res.liked ? "Added to Liked Songs" : "Removed from Liked Songs");
    } catch (e) {
      const msg = (e as Error).message;
      if (/sign in/i.test(msg)) router.push(`/login?next=${encodeURIComponent(`/songs/${song.id}`)}`);
      else s.flash(msg);
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/songs/${song.id}`;
    try {
      if (navigator.share) await navigator.share({ title: song.title, text: `${song.title} · ${song.artistName} on AURUM`, url });
      else {
        await navigator.clipboard.writeText(url);
        s.flash("Song link copied");
      }
    } catch {
      /* user cancelled */
    }
  };

  const toggleMute = () => {
    if (s.volume > 0) {
      setVolumeBeforeMute(s.volume);
      s.setVolume(0);
    } else s.setVolume(volumeBeforeMute || 1);
  };

  const progress = s.duration > 0 ? s.currentTime : 0;
  const VolumeIcon = s.volume === 0 ? VolumeX : s.volume < 0.5 ? Volume1 : Volume2;
  const isVideo = s.playbackMode === "video";
  const videoAvailable = song.hasVideo;
  const audioAvailable = song.hasAudio;
  const nextIndex = s.queueIndex + 1;

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Full screen player"
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 32, stiffness: 300 }}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.18),transparent_70%)]" aria-hidden />

      <header className="relative z-[70] flex h-14 shrink-0 items-center justify-between px-3">
        <IconButton label="Minimise player" onClick={() => s.setFullscreen(false)}>
          <ChevronDown size={24} />
        </IconButton>
        <p className="text-[11px] uppercase tracking-[0.25em] text-gold">Now playing</p>
        <div className="flex items-center gap-1">
          <IconButton label="Show queue" active={s.isQueueOpen} aria-pressed={s.isQueueOpen} onClick={s.toggleQueue}>
            <ListMusic size={20} />
          </IconButton>
          <IconButton label="Close player" onClick={() => s.setFullscreen(false)} className="md:hidden">
            <X size={20} />
          </IconButton>
        </div>
      </header>

      {/* Mode toggle lives in the header band; the video itself is rendered by PlayerProvider in this exact slot. */}
      <div className="relative z-[70] mx-auto mb-2 flex shrink-0 justify-center">
        <div role="radiogroup" aria-label="Playback mode" className="inline-flex rounded-full border border-white/10 bg-surface p-1 text-xs">
          <ModeButton active={!isVideo} disabled={!audioAvailable} onClick={() => s.setMode("audio")} icon={<Music2 size={14} />} label="Audio" />
          <ModeButton
            active={isVideo}
            disabled={!videoAvailable}
            locked={videoAvailable && !s.isPremium}
            onClick={() => s.setMode("video")}
            icon={<Film size={14} />}
            label="Video"
          />
        </div>
      </div>

      {isVideo && <div aria-hidden className="mx-auto aspect-video w-full max-w-3xl shrink-0" />}

      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:gap-10 md:px-10 md:py-6">
        <div className="flex flex-col items-center justify-center px-6 md:w-1/2 md:px-0">
          {isVideo ? null : showLyrics ? (
            <div className="h-[46vh] w-full max-w-md md:h-[60vh]">
              <Lyrics song={song} />
            </div>
          ) : (
            <div className="w-full max-w-[min(80vw,420px)] overflow-hidden rounded-2xl shadow-gold-lg md:max-w-md">
              <Artwork src={song.coverUrl} seed={song.title} alt={`${song.title} cover art`} rounded="rounded-2xl" priority />
            </div>
          )}
          {!isVideo && (
            <div className="mt-3 flex items-center gap-2">
              <Button size="sm" variant={showLyrics ? "gold" : "outline"} onClick={() => setShowLyrics((v) => !v)} aria-pressed={showLyrics}>
                <Mic2 size={14} /> {showLyrics ? "Show artwork" : "Lyrics"}
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-col px-6 pb-10 md:w-1/2 md:px-0 md:pb-0">
          {isVideo && (
            <div className="mb-4 flex justify-center">
              <Button size="sm" variant="outline" onClick={() => setShowLyrics((v) => !v)} aria-pressed={showLyrics}>
                <Mic2 size={14} /> {showLyrics ? "Hide lyrics" : "Lyrics"}
              </Button>
            </div>
          )}
          {isVideo && showLyrics && (
            <div className="mb-4 h-48">
              <Lyrics song={song} />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="font-display truncate text-2xl text-white md:text-4xl">{song.title}</h2>
            <p className="mt-1 truncate text-sm text-secondary">
              <Link href={`/artists/${song.artistId}`} onClick={() => s.setFullscreen(false)} className="hover:text-gold">{song.artistName}</Link>
              {song.albumTitle && song.albumId && (
                <> · <Link href={`/albums/${song.albumId}`} onClick={() => s.setFullscreen(false)} className="hover:text-gold">{song.albumTitle}</Link></>
              )}
            </p>
          </div>

          {/* Seek bar */}
          <div className="mt-6">
            <input
              type="range"
              min={0}
              max={s.duration || 0}
              step={0.1}
              value={Math.min(progress, s.duration || 0)}
              onChange={(e) => s.seek(Number(e.target.value))}
              aria-label="Seek"
              aria-valuetext={`${formatDuration(progress)} of ${formatDuration(s.duration)}`}
              className="gold-range w-full"
              style={{ ["--pct" as string]: `${s.duration ? (progress / s.duration) * 100 : 0}%` }}
            />
            <div className="mt-1 flex justify-between text-xs tabular-nums text-secondary">
              <span>{formatDuration(progress)}</span>
              <span>{formatDuration(s.duration || song.duration)}</span>
            </div>
          </div>

          {/* Transport */}
          <div className="mt-4 flex items-center justify-between">
            <IconButton label={s.shuffle ? "Shuffle on" : "Shuffle off"} active={s.shuffle} aria-pressed={s.shuffle} onClick={s.toggleShuffle}>
              <Shuffle size={20} />
            </IconButton>
            <IconButton label="Previous track" onClick={s.prev} className="h-12 w-12">
              <SkipBack size={26} fill="currentColor" />
            </IconButton>
            <button
              type="button"
              onClick={s.togglePlay}
              aria-label={s.isPlaying ? "Pause" : "Play"}
              className="grid h-20 w-20 place-items-center rounded-full bg-gold-gradient text-[#0A0A0A] shadow-gold-lg transition hover:scale-105 active:scale-95"
            >
              {s.isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
            </button>
            <IconButton label="Next track" onClick={() => void s.next()} className="h-12 w-12">
              <SkipForward size={26} fill="currentColor" />
            </IconButton>
            <IconButton label={`Repeat: ${s.repeatMode}`} active={s.repeatMode !== "off"} aria-pressed={s.repeatMode !== "off"} onClick={s.cycleRepeat}>
              {s.repeatMode === "one" ? <Repeat1 size={20} /> : <Repeat size={20} />}
            </IconButton>
          </div>
          {!s.isPremium && s.skipsRemaining !== null && (
            <p className="mt-3 text-center text-xs text-secondary">
              {s.skipsRemaining} skips left this hour ·{" "}
              <Link href="/premium" className="text-gold hover:underline">Unlimited with Premium</Link>
            </p>
          )}
          {s.error && <p role="alert" className="mt-3 text-center text-sm text-red-300">{s.error} <button className="underline" onClick={s.retry}>Retry</button></p>}

          {/* Secondary actions */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-4">
            <IconButton label={liked ? "Unlike" : "Like"} active={Boolean(liked)} aria-pressed={Boolean(liked)} onClick={toggleLike} disabled={liked === null}>
              <Heart size={20} fill={liked ? "currentColor" : "none"} />
            </IconButton>
            <IconButton label="Add to playlist" onClick={() => setPlaylistOpen(true)}>
              <ListPlus size={20} />
            </IconButton>
            <IconButton label="Share song" onClick={share}>
              <Share2 size={20} />
            </IconButton>
            <IconButton label="Comments" onClick={() => { s.setFullscreen(false); router.push(`/songs/${song.id}#comments`); }}>
              <MessageSquare size={20} />
            </IconButton>
            <div className="relative">
              <IconButton label="Sleep timer" active={s.sleepTimerEndsAt !== null} aria-expanded={sleepOpen} onClick={() => setSleepOpen((o) => !o)}>
                <Timer size={20} />
              </IconButton>
              {sleepOpen && (
                <div role="menu" className="absolute bottom-12 right-0 z-10 w-40 overflow-hidden rounded-xl border border-white/10 bg-elevated py-1 shadow-card">
                  {SLEEP_OPTIONS.map((m) => (
                    <button key={m} role="menuitem" className="block w-full px-4 py-2 text-left text-sm hover:bg-white/5 hover:text-gold" onClick={() => { s.setSleepTimer(m); setSleepOpen(false); }}>
                      {m} minutes
                    </button>
                  ))}
                  <button role="menuitem" className="block w-full px-4 py-2 text-left text-sm text-secondary hover:bg-white/5" onClick={() => { s.setSleepTimer(null); setSleepOpen(false); }}>
                    Off
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => s.setSpeed(PLAYBACK_SPEEDS[(PLAYBACK_SPEEDS.indexOf(s.playbackSpeed as (typeof PLAYBACK_SPEEDS)[number]) + 1) % PLAYBACK_SPEEDS.length]!)}
              aria-label={`Playback speed ${s.playbackSpeed}x`}
              className="h-10 min-w-14 rounded-full border border-white/10 px-3 text-sm tabular-nums text-white/80 transition hover:border-gold/50 hover:text-gold"
            >
              {s.playbackSpeed}×
            </button>
          </div>

          {s.sleepTimerEndsAt && <p className="mt-2 text-xs text-gold">Sleep timer active · playback stops automatically</p>}

          <div className="mt-5 flex items-center gap-3">
            <IconButton label={s.volume === 0 ? "Unmute" : "Mute"} onClick={toggleMute}>
              <VolumeIcon size={18} />
            </IconButton>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={s.volume}
              onChange={(e) => s.setVolume(Number(e.target.value))}
              aria-label="Volume"
              className="gold-range w-full"
              style={{ ["--pct" as string]: `${s.volume * 100}%` }}
            />
          </div>

          {s.isQueueOpen && (
            <div className="mt-6 rounded-2xl border border-white/5 bg-surface p-3">
              <p className="mb-2 px-2 text-xs uppercase tracking-widest text-secondary">Up next</p>
              {s.queue.length <= 1 && <p className="px-2 py-3 text-sm text-secondary">Nothing else in the queue. Add tracks from any card with the ⋯ menu.</p>}
              <ol className="max-h-72 space-y-1 overflow-y-auto">
                {s.queue.map((q, i) => (
                  <li key={`${q.id}-${i}`} className={cn("flex items-center gap-3 rounded-xl px-2 py-2", i === s.queueIndex && "bg-gold/10")}>
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => s.playQueueIndex(i)} aria-label={`Play ${q.title}`}>
                      <div className="h-9 w-9 shrink-0"><Artwork src={q.coverUrl} seed={q.title} alt="" rounded="rounded-md" /></div>
                      <div className="min-w-0">
                        <p className={cn("truncate text-sm", i === s.queueIndex ? "text-gold" : "text-white")}>{q.title}</p>
                        <p className="truncate text-xs text-secondary">{q.artistName}</p>
                      </div>
                    </button>
                    {i !== s.queueIndex && (
                      <IconButton label={`Remove ${q.title} from queue`} className="h-8 w-8" onClick={() => s.removeFromQueue(i)}>
                        <Minus size={14} />
                      </IconButton>
                    )}
                  </li>
                ))}
              </ol>
              {nextIndex < s.queue.length && <p className="mt-2 px-2 text-xs text-secondary">{s.queue.length - nextIndex} more after this</p>}
            </div>
          )}
          {!audioAvailable && videoAvailable && !s.isPremium && (
            <p className="mt-4 flex items-center gap-2 text-xs text-gold"><Lock size={12} /> Video playback unlocks with Premium.</p>
          )}
          <Link href={`/songs/${song.id}`} onClick={() => s.setFullscreen(false)} className="mt-6 text-center text-xs text-secondary hover:text-gold">
            View song details & comments
          </Link>
        </div>
      </div>

      <AddToPlaylistDialog songId={song.id} open={playlistOpen} onClose={() => setPlaylistOpen(false)} />
    </motion.div>
  );
}

function ModeButton({ active, disabled, locked, onClick, icon, label }: { active: boolean; disabled?: boolean; locked?: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      title={disabled ? `${label} not available for this song` : locked ? "Premium feature" : label}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-4 py-1.5 font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
        active ? "bg-gold-gradient text-[#0A0A0A] shadow-gold" : "text-white/70 hover:text-white",
      )}
    >
      {icon} {label}
      {locked && <Lock size={11} aria-label="Premium" />}
    </button>
  );
}
