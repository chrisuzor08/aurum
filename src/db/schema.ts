import {
  bigserial,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

/* ---------- Identity ---------- */

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("user"), // 'user' | 'admin'
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("accounts_email_uq").on(t.email)],
);

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id")
      .primaryKey()
      .references(() => accounts.id, { onDelete: "cascade" }),
    username: text("username").notNull(),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    isPremium: boolean("is_premium").notNull().default(false),
    premiumExpiresAt: timestamp("premium_expires_at", { withTimezone: true }),
    onboardingDone: boolean("onboarding_done").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("profiles_username_uq").on(t.username)],
);

export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const passwordResets = pgTable(
  "password_resets",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
);

export const preferences = pgTable(
  "preferences",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // 'genre' | 'artist' | 'mood'
    value: text("value").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.kind, t.value] })],
);

/* ---------- Catalogue ---------- */

export const artists = pgTable(
  "artists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    bio: text("bio"),
    imageUrl: text("image_url"),
    coverUrl: text("cover_url"),
    verified: boolean("verified").notNull().default(false),
    monthlyListeners: integer("monthly_listeners").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("artists_slug_uq").on(t.slug), index("artists_listeners_idx").on(t.monthlyListeners)],
);

export const albums = pgTable(
  "albums",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    coverUrl: text("cover_url"),
    releaseDate: date("release_date").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("albums_artist_idx").on(t.artistId), index("albums_release_idx").on(t.releaseDate)],
);

export const songs = pgTable(
  "songs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    albumId: uuid("album_id").references(() => albums.id, { onDelete: "set null" }),
    genre: text("genre").notNull(),
    mood: text("mood").notNull(),
    duration: integer("duration").notNull().default(0),
    coverUrl: text("cover_url"),
    audioUrl: text("audio_url"),
    videoUrl: text("video_url"),
    lyricsPlain: text("lyrics_plain"),
    lyricsLrc: text("lyrics_lrc"),
    explicit: boolean("explicit").notNull().default(false),
    releaseDate: date("release_date").notNull(),
    playCount: integer("play_count").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("songs_artist_idx").on(t.artistId),
    index("songs_album_idx").on(t.albumId),
    index("songs_genre_idx").on(t.genre),
    index("songs_mood_idx").on(t.mood),
    index("songs_release_idx").on(t.releaseDate),
    index("songs_playcount_idx").on(t.playCount),
  ],
);

export const shorts = pgTable(
  "shorts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    songId: uuid("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    videoUrl: text("video_url").notNull(),
    caption: text("caption"),
    likesCount: integer("likes_count").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("shorts_song_idx").on(t.songId), index("shorts_created_idx").on(t.createdAt)],
);

export const shortLikes = pgTable(
  "short_likes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    shortId: uuid("short_id")
      .notNull()
      .references(() => shorts.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.shortId] })],
);

/* ---------- User library ---------- */

export const playlists = pgTable(
  "playlists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    coverUrl: text("cover_url"),
    isPublic: boolean("is_public").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("playlists_user_idx").on(t.userId), index("playlists_public_idx").on(t.isPublic)],
);

export const playlistSongs = pgTable(
  "playlist_songs",
  {
    playlistId: uuid("playlist_id")
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
    songId: uuid("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    addedAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.playlistId, t.songId] }),
    index("playlist_songs_pos_idx").on(t.playlistId, t.position),
  ],
);

export const likes = pgTable(
  "likes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    songId: uuid("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.songId] }), index("likes_song_idx").on(t.songId)],
);

export const follows = pgTable(
  "follows",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.artistId] }), index("follows_artist_idx").on(t.artistId)],
);

export const albumSaves = pgTable(
  "album_saves",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    albumId: uuid("album_id")
      .notNull()
      .references(() => albums.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.albumId] })],
);

export const downloads = pgTable(
  "downloads",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    songId: uuid("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    downloadedAt: timestamp("downloaded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.songId] })],
);

/* ---------- Analytics ---------- */

export const playEvents = pgTable(
  "play_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    songId: uuid("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    playedAt: timestamp("played_at", { withTimezone: true }).notNull().defaultNow(),
    secondsListened: integer("seconds_listened").notNull().default(0),
  },
  (t) => [
    index("play_events_played_idx").on(t.playedAt),
    index("play_events_song_played_idx").on(t.songId, t.playedAt),
    index("play_events_user_played_idx").on(t.userId, t.playedAt),
  ],
);

export const skipEvents = pgTable(
  "skip_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [index("skip_events_user_idx").on(t.userId, t.createdAt)],
);

export const chartSnapshots = pgTable(
  "chart_snapshots",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    period: text("period").notNull(), // 'week' | 'month' | 'season'
    periodStart: date("period_start").notNull(),
    songId: uuid("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    rank: integer("rank").notNull(),
    plays: integer("plays").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("chart_snapshots_uq").on(t.period, t.periodStart, t.songId),
    index("chart_snapshots_rank_idx").on(t.period, t.periodStart, t.rank),
  ],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    songId: uuid("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => comments.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("comments_song_idx").on(t.songId, t.createdAt), index("comments_parent_idx").on(t.parentId)],
);

export const searchHistory = pgTable(
  "search_history",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    query: text("query").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("search_history_user_idx").on(t.userId, t.createdAt)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // release | playlist | subscription | announcement
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

/* ---------- Billing ---------- */

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    plan: text("plan").notNull(), // monthly | yearly
    status: text("status").notNull().default("pending"), // pending | active | expired | cancelled | failed
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull().default("NGN"),
    provider: text("provider").notNull().default("mock"), // paystack | mock
    providerReference: text("provider_reference").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("subscriptions_reference_uq").on(t.providerReference),
    index("subscriptions_user_idx").on(t.userId, t.status),
  ],
);

export const paymentEvents = pgTable(
  "payment_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    eventId: text("event_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("payment_events_uq").on(t.provider, t.eventId)],
);
