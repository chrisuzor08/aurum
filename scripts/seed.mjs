// AURUM seed script (plain Node, no build step).
//   node --env-file=.env scripts/seed.mjs           # seeds once (skips if catalogue exists)
//   node --env-file=.env scripts/seed.mjs --reset   # wipes content + accounts, then seeds
//
// Audio: SoundHelix sample tracks (royalty-free demo music by Thomas Schürger, CC BY 3.0 — attribution required).
// Video: Big Buck Bunny sample clip (Blender Foundation, CC BY 3.0). Both are clearly-marked DEMO assets.
// Artists, albums, lyrics and copy are original placeholder content. Covers are generated in-app.
import pg from "pg";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (use node --env-file=.env)");
const reset = process.argv.includes("--reset");
const client = new pg.Client({ connectionString: url });
await client.connect();

const hashPassword = (pw) => {
  const salt = randomBytes(16);
  const key = scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
};

const existing = await client.query("SELECT COUNT(*)::int AS c FROM songs");
if (existing.rows[0].c > 0 && !reset) {
  console.log("[seed] Catalogue already populated — nothing to do. Use --reset to reseed.");
  await client.end();
  process.exit(0);
}

const DEMO_AUDIO = (n) => `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${(n % 16) + 1}.mp3`;
const DEMO_VIDEO = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

const ARTISTS = [
  { name: "Ada Vireo", verified: true, listeners: 2430000, bio: "Ada Vireo writes intimate acoustic songs built on fingerpicked guitar and whispered harmonies." },
  { name: "Kofi Solane", verified: true, listeners: 1870000, bio: "Afro-soul vocalist and producer blending Accra rhythms with late-night jazz harmony." },
  { name: "Lumen Hart", verified: true, listeners: 1520000, bio: "Electronic architect crafting slow-building synth landscapes for focus and flight." },
  { name: "Mira Okonkwo", verified: false, listeners: 980000, bio: "Rising R&B voice with a velvet tone and a taste for cinematic arrangements." },
  { name: "Dorian Vale", verified: true, listeners: 1210000, bio: "Smoky jazz pianist who treats every standard like a new confession." },
  { name: "Sable Aoki", verified: false, listeners: 640000, bio: "Ambient composer making music for rain, rooftops and quiet mornings." },
  { name: "Nia Rivers", verified: false, listeners: 710000, bio: "Hip-hop poet with a jazz-inflected flow and a knack for cinematic hooks." },
  { name: "Felix Marrow", verified: true, listeners: 1640000, bio: "Pop songwriter known for bright hooks and melancholic bridges." },
  { name: "Ayo Kestrel", verified: false, listeners: 530000, bio: "Night-drive electronic producer and vinyl-sampling experimentalist." },
  { name: "Juno Halden", verified: false, listeners: 420000, bio: "Folk-leaning singer-songwriter writing about cities, trains and returning home." },
  { name: "Iris Ardent", verified: true, listeners: 1330000, bio: "Classical crossover violinist turning string quartets into pop-sized stories." },
  { name: "Caspian Reyes", verified: false, listeners: 360000, bio: "Rock-tinged indie act with long, widescreen guitar outros." },
];

const ALBUMS = [
  { artist: 0, title: "Porcelain Hours", date: "2025-03-14" },
  { artist: 1, title: "Golden Hour Sessions", date: "2025-06-02" },
  { artist: 2, title: "Signal & Shore", date: "2024-11-22" },
  { artist: 3, title: "Velvet Architecture", date: "2025-09-05" },
  { artist: 4, title: "Blue Room Standards", date: "2024-02-18" },
  { artist: 5, title: "Rainfall Atlas", date: "2025-01-10" },
];

const TITLES = [
  "Paper Lanterns", "Slow Tide", "Kettle & Rain", "Morning Ledger", "Quiet Engines", "Honey Static",
  "Midnight Ferry", "Copper Sun", "Lowlight Hymn", "Garden of Glass", "Heavier Than Light", "Afterglow Avenue",
  "Night Market", "Salt & Silver", "Hollow Bells", "Northbound", "Halo Drive", "Feather Weight",
  "Cinnamon Skyline", "Glasshouse", "Ivory Thunder", "Paper Crown", "Ember Parade", "Stillwater",
  "Velvet Alarm", "Carousel Sky", "Dust & Gold", "Open Windows", "Second Spring", "Undertow Lullaby",
  "Golden Static", "Lantern Walk", "Wild Lilac", "Quiet Thunder", "Atlas of Rain", "Sunday Furnace",
];

const LINES = [
  "We moved like light across the water",
  "Hold the quiet, let the city breathe",
  "Gold on the rooftops, a promise in the rain",
  "Every window glows a little brighter tonight",
  "Carry the silence like a careful song",
  "Turn the dial, let the static sing to us",
  "Slow down, the best part is still coming",
  "I kept your name in a pocket of my coat",
  "Across the bridge where the trains run late",
  "Breathe in, breathe out, the room is ours",
  "A thousand small suns, one steady hand",
  "We were never lost, only a little far from home",
  "Every ending is a doorway if you let it be",
  "Let the bass fall like rain on the glass",
  "Stay with me till the sky turns pearl",
  "Sing it soft, we will hear it anyway",
];

const GENRES = ["Afro-soul", "Jazz", "Electronic", "Acoustic", "Hip-hop", "Ambient", "Pop", "R&B"];
const MOODS = ["Uplifting", "Calm", "Romantic", "Focus", "Energetic", "Melancholic", "Night"];

const lrcFor = (i) =>
  Array.from({ length: 8 }, (_, k) => {
    const t = 8 + k * 14.5 + (i % 3) * 0.5;
    const m = Math.floor(t / 60);
    const s = (t % 60).toFixed(2).padStart(5, "0");
    return `[${String(m).padStart(2, "0")}:${s}] ${LINES[(i + k) % LINES.length]}`;
  }).join("\n");
const plainFor = (i) => Array.from({ length: 8 }, (_, k) => LINES[(i + k) % LINES.length]).join("\n");

const SHORT_CAPTIONS = [
  "Golden hour in three minutes.", "The chorus you will hum all day.", "Rain on the window, volume low.",
  "Written on a train somewhere north.", "A bassline for late-night drives.", "Three chords and a whole heart.",
  "Our favourite take from the studio.", "Make room for the second verse.",
];

try {
  await client.query("BEGIN");
  if (reset) {
    await client.query("TRUNCATE accounts, artists RESTART IDENTITY CASCADE");
    console.log("[seed] reset: cleared accounts and catalogue");
  }

  // Accounts: admin + demo listener + 40 synthetic fans (unusable password hashes).
  const adminId = randomUUID();
  const demoId = randomUUID();
  await client.query("INSERT INTO accounts (id, email, password_hash, role) VALUES ($1,$2,$3,'admin'),($4,$5,$6,'user')", [
    adminId, "admin@aurum.demo", hashPassword("AurumAdmin2026!"), demoId, "listener@aurum.demo", hashPassword("AurumListener2026!"),
  ]);
  await client.query(
    `INSERT INTO profiles (id, username, display_name, onboarding_done) VALUES ($1,'aurum_admin','AURUM Admin',true),($2,'demo_listener','Demo Listener',true)`,
    [adminId, demoId],
  );
  const fanIds = [];
  for (let n = 1; n <= 40; n++) {
    const id = randomUUID();
    fanIds.push(id);
    await client.query("INSERT INTO accounts (id, email, password_hash) VALUES ($1,$2,$3)", [id, `fan${n}@aurum.demo`, `disabled$${randomBytes(8).toString("hex")}`]);
    await client.query("INSERT INTO profiles (id, username, display_name, onboarding_done) VALUES ($1,$2,$3,true)", [id, `fan_${n}`, `Fan ${n}`]);
  }
  const listeners = [demoId, ...fanIds];

  // Artists
  const artistIds = [];
  for (const a of ARTISTS) {
    const { rows } = await client.query(
      "INSERT INTO artists (name, slug, bio, verified, monthly_listeners) VALUES ($1,$2,$3,$4,$5) RETURNING id",
      [a.name, a.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), a.bio, a.verified, a.listeners],
    );
    artistIds.push(rows[0].id);
  }

  // Albums (album k belongs to artist k)
  const albumIds = [];
  for (const al of ALBUMS) {
    const { rows } = await client.query("INSERT INTO albums (artist_id, title, release_date) VALUES ($1,$2,$3) RETURNING id", [artistIds[al.artist], al.title, al.date]);
    albumIds.push(rows[0].id);
  }

  // Songs (36)
  const songIds = [];
  const durations = [];
  for (let i = 0; i < TITLES.length; i++) {
    const artistIdx = i % ARTISTS.length;
    const albumIdx = artistIdx < ALBUMS.length && i < 24 ? artistIdx : null;
    const duration = 150 + ((i * 37) % 110);
    durations.push(duration);
    const releaseDays = (i * 13) % 700;
    const { rows } = await client.query(
      `INSERT INTO songs (title, artist_id, album_id, genre, mood, duration, audio_url, video_url, lyrics_plain, lyrics_lrc, explicit, release_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, (CURRENT_DATE - ($12::int * INTERVAL '1 day'))::date) RETURNING id`,
      [
        TITLES[i],
        artistIds[artistIdx],
        albumIdx === null ? null : albumIds[albumIdx],
        GENRES[i % GENRES.length],
        MOODS[i % MOODS.length],
        duration,
        DEMO_AUDIO(i),
        i % 4 === 0 ? DEMO_VIDEO : null,
        plainFor(i),
        lrcFor(i),
        i % 11 === 10,
        releaseDays,
      ],
    );
    songIds.push(rows[0].id);
  }

  // Shorts: 15–60 s vertical clips linked to songs with video (demo clip, looped at 60 s in the feed).
  let shortCount = 0;
  for (let i = 0; i < songIds.length; i += 4) {
    await client.query("INSERT INTO shorts (song_id, video_url, caption, likes_count) VALUES ($1,$2,$3,$4)", [
      songIds[i], DEMO_VIDEO, SHORT_CAPTIONS[shortCount % SHORT_CAPTIONS.length], 20 + ((shortCount * 53) % 900),
    ]);
    shortCount++;
  }

  // Play events: 1,800 events over 120 days, skewed to popular songs and recent days (deterministic-ish spread).
  const weights = songIds.map((_, i) => 1 / Math.pow(i % 12 + 1, 1.05));
  const totalW = weights.reduce((a, b) => a + b, 0);
  const pick = () => {
    let r = Math.random() * totalW;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return i;
    }
    return weights.length - 1;
  };
  const evUsers = [], evSongs = [], evAt = [], evSecs = [];
  const now = Date.now();
  for (let e = 0; e < 1800; e++) {
    const s = pick();
    const days = Math.floor(120 * Math.random() ** 1.7);
    const at = new Date(now - days * 86400000 - Math.floor(Math.random() * 86400000));
    evUsers.push(listeners[Math.floor(Math.random() * listeners.length)]);
    evSongs.push(songIds[s]);
    evAt.push(at.toISOString());
    evSecs.push(30 + Math.floor(Math.random() * (durations[s] - 30)));
  }
  await client.query(
    "INSERT INTO play_events (user_id, song_id, played_at, seconds_listened) SELECT * FROM unnest($1::uuid[], $2::uuid[], $3::timestamptz[], $4::int[])",
    [evUsers, evSongs, evAt, evSecs],
  );
  await client.query(`
    UPDATE songs s SET play_count = sub.c
    FROM (SELECT song_id, COUNT(*)::int AS c FROM play_events GROUP BY song_id) sub
    WHERE s.id = sub.song_id`);

  // Demo listener library: follows, likes, playlists, notifications.
  for (const a of artistIds.slice(0, 3)) await client.query("INSERT INTO follows (user_id, artist_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [demoId, a]);
  for (const s of songIds.slice(0, 5)) await client.query("INSERT INTO likes (user_id, song_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [demoId, s]);
  await client.query("INSERT INTO album_saves (user_id, album_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [demoId, albumIds[0]]);

  const playlists = [
    { name: "Late Night Gold", pub: true, songs: songIds.slice(0, 8) },
    { name: "Focus Flow", pub: false, songs: songIds.filter((_, i) => i % 3 === 2).slice(0, 7) },
  ];
  for (const p of playlists) {
    const { rows } = await client.query("INSERT INTO playlists (user_id, name, description, is_public) VALUES ($1,$2,$3,$4) RETURNING id", [
      demoId, p.name, p.name === "Focus Flow" ? "Quiet, steady momentum for deep work." : "Warm lights, slow tempos, golden tones.", p.pub,
    ]);
    for (let i = 0; i < p.songs.length; i++) {
      await client.query("INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES ($1,$2,$3)", [rows[0].id, p.songs[i], i + 1]);
    }
  }

  await client.query(
    `INSERT INTO comments (user_id, song_id, body) VALUES ($1,$2,'This one stays with me. The second verse hits so softly.'),($3,$2,'Played this on repeat during the train ride.'),($4,$5,'Synth work here is unreal.')`,
    [fanIds[0], songIds[0], fanIds[1], fanIds[2], songIds[2]],
  );
  await client.query(
    `INSERT INTO notifications (user_id, type, title, body, link) VALUES
      ($1,'announcement','Welcome to AURUM','Explore Top Charts, AURUM Shorts and your personalised Home.','/'),
      ($1,'release','Ada Vireo released a new album','Porcelain Hours is out now.','/albums/' || $2)`,
    [demoId, albumIds[0]],
  );

  await client.query("COMMIT");
  console.log(`[seed] done: ${ARTISTS.length} artists, ${ALBUMS.length} albums, ${TITLES.length} songs, ${shortCount} shorts, 1,800 play events, 42 accounts`);
  console.log("[seed] admin:    admin@aurum.demo / AurumAdmin2026!");
  console.log("[seed] listener: listener@aurum.demo / AurumListener2026!");
} catch (err) {
  await client.query("ROLLBACK");
  console.error("[seed] failed — rolled back:", err);
  process.exitCode = 1;
} finally {
  await client.end();
}
