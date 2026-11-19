import { eq } from "drizzle-orm";
import { db } from "@/db";
import { songs } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isPremiumActive } from "@/lib/entitlements";
import { forbidden, notFound, withErrors } from "@/lib/http";
import { uuid } from "@/lib/validate";

type Ctx = { params: Promise<{ songId: string }> };

/**
 * The ONLY way the player obtains media for a song. Entitlements are checked here on the server:
 *  - kind=audio: available to everyone (licensed streams).
 *  - kind=video: Premium only. Enforced from the database, not from the UI.
 * Raw storage URLs are returned via redirect, never embedded in client state.
 */
export const GET = withErrors<Ctx>(async (req, { params }) => {
  const { songId } = await params;
  uuid(songId, "songId");
  const kind = new URL(req.url).searchParams.get("kind") === "video" ? "video" : "audio";

  const [song] = await db.select({ audioUrl: songs.audioUrl, videoUrl: songs.videoUrl }).from(songs).where(eq(songs.id, songId)).limit(1);
  if (!song) throw notFound("Song not found");

  if (kind === "video") {
    const user = await getCurrentUser();
    if (!isPremiumActive(user)) throw forbidden("Video playback is a Premium feature.");
    if (!song.videoUrl) throw notFound("No video is available for this song");
    return redirect(song.videoUrl);
  }
  if (!song.audioUrl) throw notFound("No audio is available for this song");
  return redirect(song.audioUrl);
});

function redirect(location: string) {
  return new Response(null, { status: 302, headers: { Location: location, "Cache-Control": "private, no-store" } });
}

