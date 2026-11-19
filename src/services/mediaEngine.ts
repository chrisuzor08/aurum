/**
 * Media engine: owns the ONE audio element and the ONE video element.
 * Only the "active" element is ever allowed to play. Switching kinds pauses and
 * releases the previous element before the next one loads, so two streams never overlap.
 * This module is framework-free; the Zustand store and PlayerProvider drive it.
 */
export type MediaKind = "audio" | "video";

export interface EngineHandlers {
  onTime(current: number, duration: number): void;
  onPlayState(playing: boolean): void;
  onEnded(): void;
  onError(message: string): void;
  onMetadata(duration: number): void;
}

export interface LoadOptions {
  startAt: number;
  autoplay: boolean;
  playbackRate: number;
  volume: number;
}

let audioEl: HTMLAudioElement | null = null;
let videoEl: HTMLVideoElement | null = null;
let active: HTMLMediaElement | null = null;
let handlers: EngineHandlers | null = null;
let loadToken = 0;

const elementFor = (kind: MediaKind) => (kind === "video" ? videoEl : audioEl);

export function registerMedia(audio: HTMLAudioElement, video: HTMLVideoElement, h: EngineHandlers): void {
  audioEl = audio;
  videoEl = video;
  handlers = h;
  for (const media of [audio, video]) {
    media.addEventListener("timeupdate", () => {
      if (media === active) handlers?.onTime(media.currentTime, media.duration || 0);
    });
    media.addEventListener("play", () => {
      if (media === active) handlers?.onPlayState(true);
    });
    media.addEventListener("pause", () => {
      if (media === active && !media.ended) handlers?.onPlayState(false);
    });
    media.addEventListener("ended", () => {
      if (media === active) handlers?.onEnded();
    });
    media.addEventListener("loadedmetadata", () => {
      if (media === active) handlers?.onMetadata(media.duration || 0);
    });
    media.addEventListener("error", () => {
      if (media === active && media.getAttribute("src")) handlers?.onError(media.error?.message || "Playback failed");
    });
  }
}

/** Releases both elements (used on unmount to avoid leaked connections). */
export function unregisterMedia(): void {
  for (const m of [audioEl, videoEl]) {
    if (!m) continue;
    m.pause();
    m.removeAttribute("src");
    m.load();
  }
  active = null;
  handlers = null;
}

/**
 * Loads a stream into the element for `kind`, optionally resuming at `startAt`.
 * Every other element is paused first, so a mode switch never produces parallel playback.
 */
export function loadTrack(src: string, kind: MediaKind, opts: LoadOptions): void {
  const next = elementFor(kind);
  if (!next) return;
  const prev = active;
  const my = ++loadToken;
  active = next;

  for (const m of [audioEl, videoEl]) if (m && m !== next) m.pause();
  if (prev && prev !== next) {
    prev.removeAttribute("src");
    prev.load();
  }

  next.playbackRate = opts.playbackRate;
  next.volume = opts.volume;

  const onReady = () => {
    if (my !== loadToken) return;
    if (opts.startAt > 0) next.currentTime = opts.startAt;
    if (opts.autoplay) {
      next.play().catch((err: Error) => {
        if (my !== loadToken) return;
        handlers?.onPlayState(false);
        if (err.name !== "AbortError") handlers?.onError(`Playback was blocked: ${err.message}`);
      });
    } else {
      handlers?.onPlayState(false);
    }
  };
  next.addEventListener("loadedmetadata", onReady, { once: true });
  next.src = src;
  next.load();
}

export const play = (): void => {
  void active?.play().catch(() => undefined);
};
export const pause = (): void => active?.pause();
export const toggle = (): void => (active?.paused ? play() : pause());
export const seek = (t: number): void => {
  if (!active) return;
  const max = active.duration || t;
  active.currentTime = Math.max(0, Math.min(t, max));
};
export const getTime = (): number => active?.currentTime ?? 0;
export const getDuration = (): number => (active?.duration && Number.isFinite(active.duration) ? active.duration : 0);
export const isPaused = (): boolean => active?.paused ?? true;
export const activeKind = (): MediaKind | null => (active === videoEl ? "video" : active === audioEl ? "audio" : null);

export function setVolume(v: number): void {
  for (const m of [audioEl, videoEl]) if (m) m.volume = v;
}
export function setRate(r: number): void {
  for (const m of [audioEl, videoEl]) if (m) m.playbackRate = r;
}
