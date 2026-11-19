export type Role = "user" | "admin";
export type PlaybackMode = "audio" | "video";
export type RepeatMode = "off" | "all" | "one";
export type PeriodKey = "week" | "month" | "season";

/** Client-safe song shape. Raw media URLs never leave the server: media is always requested via /api/stream/:id. */
export interface SongSummary {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  albumId: string | null;
  albumTitle?: string | null;
  genre: string;
  mood: string;
  duration: number;
  coverUrl: string | null;
  hasAudio: boolean;
  hasVideo: boolean;
  explicit: boolean;
  releaseDate?: string;
  playCount: number;
  lyricsLrc: string | null;
  lyricsPlain: string | null;
}

export interface CurrentUser {
  id: string;
  email: string;
  role: Role;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  isPremium: boolean;
  premiumExpiresAt: string | null;
  onboardingDone: boolean;
}

export interface Entitlements {
  isPremium: boolean;
  canStreamVideo: boolean;
  canDownload: boolean;
  showAds: boolean;
  /** null = unlimited skips */
  skipLimitPerHour: number | null;
}

export interface ChartEntry {
  rank: number;
  previousRank: number | null;
  movement: "up" | "down" | "same" | "new";
  plays: number;
  song: SongSummary;
}

export interface ApiErrorBody {
  error: string;
  code?: string;
}
