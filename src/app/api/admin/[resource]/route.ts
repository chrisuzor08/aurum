import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { albums, artists, comments, shorts, songs } from "@/db/schema";
import { requireApiAdmin } from "@/lib/auth";
import { snapshotChart } from "@/lib/charts";
import { badRequest, notFound, ok, withErrors } from "@/lib/http";
import { parseLrc } from "@/lib/lrc";
import { saveUpload } from "@/lib/storage";
import { oneOf, uuid } from "@/lib/validate";
import type { PeriodKey } from "@/types";

type Ctx = { params: Promise<{ resource: string }> };

/* Admin endpoints accept multipart/form-data so files and metadata travel together. Every route is admin-only. */

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) + "-" + randomBytes(3).toString("hex");

function fields(form: FormData) {
  const text = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v.trim() : "";
  };
  const file = (k: string) => {
    const v = form.get(k);
    return v instanceof File && v.size > 0 ? v : null;
  };
  return { text, file };
}

const dateStr = (v: string, field: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw badRequest(`${field} must be a date (YYYY-MM-DD)`);
  return v;
};

/** Accepts seconds ("215") or m:ss ("3:35"). */
function parseDuration(v: string): number {
  if (/^\d+:\d{1,2}$/.test(v)) {
    const [m, s] = v.split(":").map(Number);
    return m! * 60 + s!;
  }
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0 || n > 60 * 60 * 3) throw badRequest("Duration must be seconds or m:ss (max 3 hours)");
  return n;
}

const bool = (v: string) => v === "true" || v === "on" || v === "1";
const requireText = (v: string, field: string, max = 200) => {
  if (!v) throw badRequest(`${field} is required`);
  if (v.length > max) throw badRequest(`${field} must be at most ${max} characters`);
  return v;
};
const httpsUrl = (v: string, field: string) => {
  if (!v) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
    return u.toString();
  } catch {
    throw badRequest(`${field} must be a valid http(s) URL`);
  }
};

export const POST = withErrors<Ctx>(async (req, { params }) => {
  const admin = await requireApiAdmin();
  const { resource } = await params;
  const { text, file } = fields(await req.formData());

  switch (resource) {
    case "artists": {
      const image = file("image");
      const [row] = await db
        .insert(artists)
        .values({
          name: requireText(text("name"), "Name", 120),
          slug: slugify(text("name") || "artist"),
          bio: text("bio").slice(0, 4000) || null,
          verified: bool(text("verified")),
          monthlyListeners: Math.max(0, Number(text("monthlyListeners")) || 0),
          imageUrl: image ? await saveUpload("covers", image) : null,
          coverUrl: null,
        })
        .returning({ id: artists.id });
      return ok({ id: row!.id });
    }

    case "albums": {
      const cover = file("cover");
      const artistId = uuid(text("artistId"), "artistId");
      const [row] = await db
        .insert(albums)
        .values({
          artistId,
          title: requireText(text("title"), "Title", 160),
          releaseDate: dateStr(text("releaseDate"), "Release date"),
          coverUrl: cover ? await saveUpload("covers", cover) : null,
        })
        .returning({ id: albums.id });
      return ok({ id: row!.id });
    }

    case "songs": {
      const lrc = text("lyricsLrc");
      if (lrc && parseLrc(lrc).length === 0) throw badRequest("LRC lyrics need at least one [mm:ss.xx] timestamped line");
      const audioFile = file("audio");
      const videoFile = file("video");
      const audioUrl = audioFile ? await saveUpload("audio", audioFile) : httpsUrl(text("audioUrl"), "Audio URL");
      const videoUrl = videoFile ? await saveUpload("video", videoFile) : httpsUrl(text("videoUrl"), "Video URL");
      // Never create a "playable" song without media behind it.
      if (!audioUrl && !videoUrl) throw badRequest("Upload an audio file or video, or provide a licensed media URL");
      const coverFile = file("cover");
      const artistId = uuid(text("artistId"), "artistId");
      const albumId = text("albumId") ? uuid(text("albumId"), "albumId") : null;
      const releaseDate = dateStr(text("releaseDate") || new Date().toISOString().slice(0, 10), "Release date");

      const row = await db.transaction(async (tx) => {
        const [song] = await tx
          .insert(songs)
          .values({
            title: requireText(text("title"), "Title"),
            artistId,
            albumId,
            genre: requireText(text("genre"), "Genre", 40),
            mood: requireText(text("mood"), "Mood", 40),
            duration: parseDuration(text("duration")),
            coverUrl: coverFile ? await saveUpload("covers", coverFile) : null,
            audioUrl,
            videoUrl,
            lyricsPlain: text("lyricsPlain").slice(0, 20000) || null,
            lyricsLrc: lrc || null,
            explicit: bool(text("explicit")),
            releaseDate,
          })
          .returning({ id: songs.id, title: songs.title });
        // New-release notifications for everyone who follows this artist.
        await tx.execute(sql`
          INSERT INTO notifications (user_id, type, title, body, link)
          SELECT f.user_id, 'release', a.name || ' has a new release',
                 ${song!.title}, '/songs/' || ${song!.id}::text
          FROM follows f JOIN artists a ON a.id = f.artist_id
          WHERE f.artist_id = ${artistId}::uuid`);
        return song!;
      });
      return ok({ id: row.id, by: admin.username });
    }

    case "shorts": {
      const songId = uuid(text("songId"), "songId");
      const video = file("video");
      const videoUrl = video ? await saveUpload("video", video) : httpsUrl(text("videoUrl"), "Video URL");
      if (!videoUrl) throw badRequest("A short needs a video file or URL");
      const [row] = await db
        .insert(shorts)
        .values({ songId, videoUrl, caption: text("caption").slice(0, 200) || null })
        .returning({ id: shorts.id });
      return ok({ id: row!.id });
    }

    case "charts": {
      const period = oneOf(text("period") || "week", ["week", "month", "season"] as const, "period") as PeriodKey;
      return ok({ count: await snapshotChart(period) });
    }

    default:
      throw notFound("Unknown admin resource");
  }
});

export const PATCH = withErrors<Ctx>(async (req, { params }) => {
  await requireApiAdmin();
  const { resource } = await params;
  const id = uuid(new URL(req.url).searchParams.get("id"), "id");
  const { text, file } = fields(await req.formData());
  const pick = (k: string) => (text(k) ? text(k) : undefined);

  switch (resource) {
    case "artists": {
      const image = file("image");
      await db
        .update(artists)
        .set({
          ...(pick("name") && { name: pick("name")!.slice(0, 120) }),
          ...(text("bio") !== "" && { bio: text("bio").slice(0, 4000) }),
          ...(text("verified") !== "" && { verified: bool(text("verified")) }),
          ...(pick("monthlyListeners") && { monthlyListeners: Math.max(0, Number(pick("monthlyListeners")) || 0) }),
          ...(image && { imageUrl: await saveUpload("covers", image) }),
          updatedAt: new Date(),
        })
        .where(eq(artists.id, id));
      return ok({ ok: true });
    }
    case "albums": {
      const cover = file("cover");
      await db
        .update(albums)
        .set({
          ...(pick("title") && { title: pick("title")!.slice(0, 160) }),
          ...(pick("releaseDate") && { releaseDate: dateStr(pick("releaseDate")!, "Release date") }),
          ...(cover && { coverUrl: await saveUpload("covers", cover) }),
          updatedAt: new Date(),
        })
        .where(eq(albums.id, id));
      return ok({ ok: true });
    }
    case "songs": {
      const lrc = text("lyricsLrc");
      if (lrc && parseLrc(lrc).length === 0) throw badRequest("LRC lyrics need at least one [mm:ss.xx] timestamped line");
      const audio = file("audio");
      const video = file("video");
      const cover = file("cover");
      await db
        .update(songs)
        .set({
          ...(pick("title") && { title: pick("title")!.slice(0, 200) }),
          ...(pick("genre") && { genre: pick("genre")!.slice(0, 40) }),
          ...(pick("mood") && { mood: pick("mood")!.slice(0, 40) }),
          ...(pick("duration") && { duration: parseDuration(pick("duration")!) }),
          ...(text("explicit") !== "" && { explicit: bool(text("explicit")) }),
          ...(text("lyricsPlain") !== "" && { lyricsPlain: text("lyricsPlain").slice(0, 20000) }),
          ...(text("lyricsLrc") !== "" && { lyricsLrc: lrc }),
          ...(audio && { audioUrl: await saveUpload("audio", audio) }),
          ...(video && { videoUrl: await saveUpload("video", video) }),
          ...(cover && { coverUrl: await saveUpload("covers", cover) }),
          updatedAt: new Date(),
        })
        .where(eq(songs.id, id));
      return ok({ ok: true });
    }
    default:
      throw notFound("Unknown admin resource");
  }
});

/** Moderation: remove inappropriate content. */
export const DELETE = withErrors<Ctx>(async (req, { params }) => {
  await requireApiAdmin();
  const { resource } = await params;
  const id = uuid(new URL(req.url).searchParams.get("id"), "id");
  switch (resource) {
    case "songs":
      await db.delete(songs).where(eq(songs.id, id));
      break;
    case "shorts":
      await db.delete(shorts).where(eq(shorts.id, id));
      break;
    case "comments":
      await db.delete(comments).where(eq(comments.id, id));
      break;
    case "artists":
      await db.delete(artists).where(eq(artists.id, id));
      break;
    case "albums":
      await db.delete(albums).where(eq(albums.id, id));
      break;
    default:
      throw notFound("Unknown admin resource");
  }
  return ok({ ok: true });
});
