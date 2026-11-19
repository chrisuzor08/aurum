"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePlayerStore, selectCurrentSong } from "@/store/player";
import * as engine from "@/services/mediaEngine";

/**
 * Mounts the single <audio> and <video> elements, wires them to the store, and provides
 * Media Session metadata/actions, desktop keyboard shortcuts and the sleep timer.
 * Lives in the root layout so playback survives navigation between pages.
 */
export function PlayerProvider({ isPremium, skipLimitPerHour, children }: { isPremium: boolean; skipLimitPerHour: number | null; children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const init = usePlayerStore((s) => s.init);
  const showVideo = usePlayerStore((s) => s.isFullscreen && s.playbackMode === "video");

  useEffect(() => {
    init({ isPremium, skipLimitPerHour });
  }, [isPremium, skipLimitPerHour, init]);

  // Register media elements with the engine (single pipeline).
  useEffect(() => {
    const a = audioRef.current;
    const v = videoRef.current;
    if (!a || !v) return;
    const st = () => usePlayerStore.getState();
    engine.registerMedia(a, v, {
      onTime: (c, d) => st()._tick(c, d),
      onPlayState: (p) => st()._playState(p),
      onEnded: () => st()._ended(),
      onError: (m) => st()._mediaError(m),
      onMetadata: (d) => st()._metadata(d),
    });
    return () => engine.unregisterMedia();
  }, []);

  // Smooth ~10 Hz clock for seek bar and synchronized lyrics (timeupdate alone is ~4 Hz).
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      if (now - last > 100 && !engine.isPaused()) {
        last = now;
        usePlayerStore.getState()._tick(engine.getTime(), engine.getDuration());
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Sleep timer.
  useEffect(() => {
    const id = setInterval(() => {
      const s = usePlayerStore.getState();
      if (s.sleepTimerEndsAt && Date.now() >= s.sleepTimerEndsAt) {
        engine.pause();
        usePlayerStore.setState({ isPlaying: false, sleepTimerEndsAt: null });
        s.flash("Sleep timer ended playback. Goodnight.");
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Media Session API: lock-screen / notification controls and metadata.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    const st = () => usePlayerStore.getState();
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => { if (!st().isPlaying) st().togglePlay(); }],
      ["pause", () => { if (st().isPlaying) st().togglePlay(); }],
      ["previoustrack", () => st().prev()],
      ["nexttrack", () => void st().next()],
      ["seekbackward", (d) => st().seek(Math.max(0, engine.getTime() - (d.seekOffset ?? 10)))],
      ["seekforward", (d) => st().seek(engine.getTime() + (d.seekOffset ?? 10))],
      ["seekto", (d) => d.seekTime !== undefined && st().seek(d.seekTime)],
    ];
    for (const [action, handler] of handlers) {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        /* action not supported by this browser */
      }
    }
    const unsub = usePlayerStore.subscribe((s, prev) => {
      const song = selectCurrentSong(s);
      ms.playbackState = s.isPlaying ? "playing" : song ? "paused" : "none";
      if (song && (song.id !== selectCurrentSong(prev)?.id || !ms.metadata)) {
        const art = song.coverUrl ? [{ src: song.coverUrl, sizes: "512x512", type: "image/jpeg" }] : [];
        ms.metadata = new MediaMetadata({ title: song.title, artist: song.artistName, album: song.albumTitle ?? "AURUM", artwork: art });
      }
      if (s.duration > 0 && "setPositionState" in ms) {
        try {
          ms.setPositionState({ duration: s.duration, playbackRate: s.playbackSpeed, position: Math.min(s.currentTime, s.duration) });
        } catch {
          /* ignore invalid state */
        }
      }
    });
    return () => {
      unsub();
      for (const [action] of handlers) {
        try {
          ms.setActionHandler(action, null);
        } catch {
          /* noop */
        }
      }
    };
  }, []);

  // Desktop keyboard shortcuts (ignored while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (t && (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable)) return;
      const st = usePlayerStore.getState();
      switch (e.key) {
        case " ":
          if (t?.tagName === "BUTTON" || t?.tagName === "A") return;
          e.preventDefault();
          st.togglePlay();
          break;
        case "ArrowRight":
          st.seek(engine.getTime() + (e.shiftKey ? 30 : 5));
          break;
        case "ArrowLeft":
          st.seek(Math.max(0, engine.getTime() - (e.shiftKey ? 30 : 5)));
          break;
        case "ArrowUp":
          e.preventDefault();
          st.setVolume(st.volume + 0.05);
          break;
        case "ArrowDown":
          e.preventDefault();
          st.setVolume(st.volume - 0.05);
          break;
        case "n":
        case "N":
          void st.next();
          break;
        case "p":
        case "P":
          st.prev();
          break;
        case "m":
        case "M":
          st.toggleMute();
          break;
        case "Escape":
          if (st.isFullscreen) st.setFullscreen(false);
          break;
        default:
          return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Pause and release media when the tab is closed or hidden for a long time is left to the browser;
  // here we only make sure elements are released on full page unload.
  useEffect(() => {
    const release = () => engine.pause();
    window.addEventListener("pagehide", release);
    return () => window.removeEventListener("pagehide", release);
  }, []);

  return (
    <>
      {children}
      <audio ref={audioRef} preload="metadata" playsInline className="hidden" aria-hidden />
      {/* Video stays mounted (so it keeps decoding) but is only shown full-width when the full player is in video mode. */}
      <div
        aria-hidden={!showVideo}
        className={
          showVideo
            ? "fixed inset-x-0 top-14 z-[60] mx-auto aspect-video w-full max-w-3xl bg-black shadow-gold-lg"
            : "pointer-events-none fixed -left-[9999px] top-0 h-px w-px overflow-hidden"
        }
      >
        <video ref={videoRef} playsInline preload="metadata" className="h-full w-full bg-black object-contain" aria-label="Music video" />
      </div>
    </>
  );
}
