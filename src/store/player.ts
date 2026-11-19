import { create } from "zustand";
import { api } from "@/services/api";
import * as engine from "@/services/mediaEngine";
import type { PlaybackMode, RepeatMode, SongSummary } from "@/types";

/** Single global playback store. Mini-player, full player, shorts and lyrics all read from here. */
export const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;
const REPEAT_CYCLE: RepeatMode[] = ["off", "all", "one"];
const streamUrl = (id: string, kind: PlaybackMode) => `/api/stream/${id}?kind=${kind}`;

export interface PlayerState {
  // Queue & track identity
  queue: SongSummary[];
  queueIndex: number;
  trackId: string | null;
  // Transport
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  playbackMode: PlaybackMode;
  volume: number;
  shuffle: boolean;
  repeatMode: RepeatMode;
  playbackSpeed: number;
  // Entitlements (hydrated from the server, enforced again on the server)
  isPremium: boolean;
  skipLimitPerHour: number | null;
  skipsRemaining: number | null;
  // UI
  isFullscreen: boolean;
  isQueueOpen: boolean;
  showLyrics: boolean;
  sleepTimerEndsAt: number | null;
  notice: string | null;
  error: string | null;
  // Analytics bookkeeping
  playTrackedId: string | null;

  init(entitlements: { isPremium: boolean; skipLimitPerHour: number | null }): void;
  playSong(song: SongSummary, queue?: SongSummary[]): void;
  playQueueIndex(index: number): void;
  togglePlay(): void;
  next(): Promise<void>;
  prev(): void;
  seek(seconds: number): void;
  setVolume(v: number): void;
  toggleMute(): void;
  toggleShuffle(): void;
  cycleRepeat(): void;
  setSpeed(rate: number): void;
  setMode(mode: PlaybackMode): void;
  playNext(song: SongSummary): void;
  addToQueue(song: SongSummary): void;
  removeFromQueue(index: number): void;
  setSleepTimer(minutes: number | null): void;
  setFullscreen(open: boolean): void;
  toggleQueue(): void;
  toggleLyrics(): void;
  retry(): void;
  flash(message: string): void;
  clearNotice(): void;
  // Engine callbacks
  _tick(current: number, duration: number): void;
  _playState(playing: boolean): void;
  _ended(): void;
  _mediaError(message: string): void;
  _metadata(duration: number): void;
}

let noticeTimer: ReturnType<typeof setTimeout> | undefined;
let mutedFrom: number | null = null;

export const usePlayerStore = create<PlayerState>()((set, get) => {
  const canVideo = (song: SongSummary) => song.hasVideo && get().isPremium;

  /** Starts `queue[index]`. Resolves audio/video by entitlement and media availability. */
  const startIndex = (queue: SongSummary[], index: number, startAt: number, autoplay: boolean) => {
    const song = queue[index];
    if (!song) return;
    let mode: PlaybackMode = get().playbackMode === "video" && canVideo(song) ? "video" : "audio";
    if (mode === "audio" && !song.hasAudio) {
      if (canVideo(song)) mode = "video";
      else {
        engine.pause();
        set({ queue, queueIndex: index, trackId: song.id, isPlaying: false, currentTime: 0, duration: song.duration, error: "No playable media is available for this track yet." });
        return;
      }
    }
    const sameTrack = get().trackId === song.id;
    set({
      queue,
      queueIndex: index,
      trackId: song.id,
      currentTime: startAt,
      duration: song.duration || 0,
      isPlaying: autoplay,
      playbackMode: mode,
      error: null,
      playTrackedId: sameTrack ? get().playTrackedId : null,
    });
    engine.loadTrack(streamUrl(song.id, mode), mode, {
      startAt,
      autoplay,
      playbackRate: get().playbackSpeed,
      volume: get().volume,
    });
  };

  /** Server-enforced skip budget for free users. Returns false when the limit is reached. */
  const consumeSkip = async (): Promise<boolean> => {
    if (get().isPremium) return true;
    try {
      const res = await api<{ remaining: number | null }>("/api/playback", { method: "POST", json: { type: "skip" } });
      set({ skipsRemaining: res.remaining });
      return true;
    } catch (err) {
      get().flash((err as Error).message);
      return false;
    }
  };

  const recordPlay = (current: number) => {
    const s = get();
    const song = s.queue[s.queueIndex];
    if (!song || s.playTrackedId === song.id) return;
    const threshold = Math.min(30, (s.duration || 60) * 0.5);
    if (current < threshold) return;
    set({ playTrackedId: song.id });
    void api("/api/playback", { method: "POST", json: { type: "play", songId: song.id, seconds: Math.round(current) } }).catch(() => undefined);
  };

  return {
    queue: [],
    queueIndex: 0,
    trackId: null,
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    playbackMode: "audio",
    volume: 1,
    shuffle: false,
    repeatMode: "off",
    playbackSpeed: 1,
    isPremium: false,
    skipLimitPerHour: 6,
    skipsRemaining: null,
    isFullscreen: false,
    isQueueOpen: false,
    showLyrics: false,
    sleepTimerEndsAt: null,
    notice: null,
    error: null,
    playTrackedId: null,

    init({ isPremium, skipLimitPerHour }) {
      set({ isPremium, skipLimitPerHour, skipsRemaining: isPremium ? null : get().skipsRemaining ?? skipLimitPerHour });
      if (!isPremium && get().playbackMode === "video") set({ playbackMode: "audio" });
    },

    playSong(song, queue) {
      const base = queue && queue.length > 0 ? [...queue] : [song];
      let index = base.findIndex((s) => s.id === song.id);
      if (index < 0) {
        base.unshift(song);
        index = 0;
      }
      startIndex(base, index, 0, true);
    },

    playQueueIndex(index) {
      const { queue } = get();
      if (index < 0 || index >= queue.length) return;
      startIndex(queue, index, 0, true);
    },

    togglePlay() {
      const s = get();
      if (!s.trackId) {
        if (s.queue.length) startIndex(s.queue, Math.max(0, s.queueIndex), 0, true);
        return;
      }
      if (s.error && !s.isPlaying) return get().retry();
      if (s.isPlaying) {
        set({ isPlaying: false });
        engine.pause();
      } else {
        set({ isPlaying: true });
        engine.play();
      }
    },

    async next() {
      const { queue, queueIndex, shuffle, repeatMode } = get();
      if (queue.length === 0) return;
      if (!(await consumeSkip())) return;
      let index: number;
      if (shuffle && queue.length > 1) {
        do index = Math.floor(Math.random() * queue.length);
        while (index === queueIndex);
      } else if (queueIndex + 1 < queue.length) index = queueIndex + 1;
      else if (repeatMode === "all") index = 0;
      else {
        // End of queue with repeat off: stop at the beginning of the last track.
        set({ isPlaying: false });
        engine.pause();
        engine.seek(0);
        set({ currentTime: 0 });
        return;
      }
      startIndex(queue, index, 0, true);
    },

    prev() {
      const { queue, queueIndex } = get();
      if (queue.length === 0) return;
      if (engine.getTime() > 3) {
        engine.seek(0);
        set({ currentTime: 0 });
        return;
      }
      startIndex(queue, queueIndex > 0 ? queueIndex - 1 : queue.length - 1, 0, true);
    },

    seek(seconds) {
      engine.seek(seconds);
      set({ currentTime: Math.max(0, seconds) });
    },

    setVolume(v) {
      const vol = Math.min(1, Math.max(0, v));
      engine.setVolume(vol);
      mutedFrom = null;
      set({ volume: vol });
    },

    toggleMute() {
      if (mutedFrom === null) {
        mutedFrom = get().volume || 1;
        get().setVolume(0);
      } else {
        const restore = mutedFrom;
        mutedFrom = null;
        get().setVolume(restore);
      }
    },

    toggleShuffle() {
      set({ shuffle: !get().shuffle });
    },

    cycleRepeat() {
      const next = REPEAT_CYCLE[(REPEAT_CYCLE.indexOf(get().repeatMode) + 1) % REPEAT_CYCLE.length]!;
      set({ repeatMode: next });
    },

    setSpeed(rate) {
      engine.setRate(rate);
      set({ playbackSpeed: rate });
    },

    /**
     * Audio | Video switch. Captures the live position, keeps the same track and queue,
     * loads the other source and resumes at the captured time if it was playing.
     */
    setMode(mode) {
      const s = get();
      const song = s.queue[s.queueIndex];
      if (!song) return set({ playbackMode: mode });
      if (mode === s.playbackMode) return;
      if (mode === "video") {
        if (!song.hasVideo) return get().flash("No video is available for this song.");
        if (!s.isPremium) return get().flash("Video playback is a Premium feature.");
      } else if (!song.hasAudio) {
        return get().flash("No audio is available for this song.");
      }
      const t = engine.getTime();
      const wasPlaying = s.isPlaying;
      set({ playbackMode: mode, currentTime: t, error: null });
      engine.loadTrack(streamUrl(song.id, mode), mode, {
        startAt: t,
        autoplay: wasPlaying,
        playbackRate: s.playbackSpeed,
        volume: s.volume,
      });
    },

    playNext(song) {
      const { queue, queueIndex } = get();
      const next = [...queue];
      if (next.length === 0) return startIndex([song], 0, 0, true);
      next.splice(queueIndex + 1, 0, song);
      set({ queue: next });
      get().flash(`“${song.title}” will play next`);
    },

    addToQueue(song) {
      const { queue } = get();
      if (queue.length === 0) return startIndex([song], 0, 0, true);
      set({ queue: [...queue, song] });
      get().flash(`Added “${song.title}” to queue`);
    },

    removeFromQueue(index) {
      const { queue, queueIndex } = get();
      if (index === queueIndex) return get().flash("Can’t remove the track that’s playing");
      const next = queue.filter((_, i) => i !== index);
      set({ queue: next, queueIndex: index < queueIndex ? queueIndex - 1 : queueIndex });
    },

    setSleepTimer(minutes) {
      set({ sleepTimerEndsAt: minutes ? Date.now() + minutes * 60_000 : null });
      get().flash(minutes ? `Sleep timer set for ${minutes} minutes` : "Sleep timer off");
    },

    setFullscreen(open) {
      set({ isFullscreen: open, isQueueOpen: open ? get().isQueueOpen : false });
    },
    toggleQueue() {
      set({ isQueueOpen: !get().isQueueOpen });
    },
    toggleLyrics() {
      set({ showLyrics: !get().showLyrics });
    },

    retry() {
      const s = get();
      const song = s.queue[s.queueIndex];
      if (!song) return;
      startIndex(s.queue, s.queueIndex, engine.getTime(), true);
    },

    flash(message) {
      clearTimeout(noticeTimer);
      set({ notice: message });
      noticeTimer = setTimeout(() => set({ notice: null }), 3500);
    },
    clearNotice() {
      set({ notice: null });
    },

    _tick(current, duration) {
      const s = get();
      set({ currentTime: current, duration: duration || s.duration });
      recordPlay(current);
    },
    _playState(playing) {
      if (get().isPlaying !== playing) set({ isPlaying: playing });
    },
    _ended() {
      const s = get();
      if (s.repeatMode === "one") {
        engine.seek(0);
        set({ currentTime: 0 });
        engine.play();
        return;
      }
      void s.next().catch(() => undefined);
    },
    _mediaError(message) {
      const s = get();
      // Video failed (e.g. server refused a premium stream): fall back to audio without losing position.
      if (s.playbackMode === "video" && s.queue[s.queueIndex]?.hasAudio) {
        s.flash("Video unavailable right now — switched to audio.");
        s.setMode("audio");
        return;
      }
      set({ isPlaying: false, error: message });
    },
    _metadata(duration) {
      if (duration) set({ duration });
    },
  };
});

export const selectCurrentSong = (s: PlayerState): SongSummary | null => s.queue[s.queueIndex] ?? null;
