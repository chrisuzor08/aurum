import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { comments, notifications, profiles, songs } from "@/db/schema";
import { getCurrentUser, requireApiUser } from "@/lib/auth";
import { badRequest, forbidden, notFound, ok, readJson, withErrors } from "@/lib/http";
import { str, uuid } from "@/lib/validate";

/** Song comments with one level of replies (parent_id). Public read; author-only delete (admins may moderate). */
export const GET = withErrors(async (req) => {
  const songId = uuid(new URL(req.url).searchParams.get("songId"), "songId");
  const viewer = await getCurrentUser();
  const rows = await db
    .select({
      id: comments.id,
      body: comments.body,
      parentId: comments.parentId,
      createdAt: comments.createdAt,
      userId: comments.userId,
      username: profiles.username,
      avatarUrl: profiles.avatarUrl,
    })
    .from(comments)
    .innerJoin(profiles, eq(profiles.id, comments.userId))
    .where(eq(comments.songId, songId))
    .orderBy(asc(comments.createdAt))
    .limit(300);
  return ok({
    viewerId: viewer?.id ?? null,
    comments: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  });
});

export const POST = withErrors(async (req) => {
  const user = await requireApiUser();
  const body = await readJson(req);
  const songId = uuid(body.songId, "songId");
  const text = str(body.body, "Comment", { min: 1, max: 1000 });
  const parentId = body.parentId ? uuid(body.parentId, "parentId") : null;

  const [song] = await db.select({ id: songs.id, title: songs.title }).from(songs).where(eq(songs.id, songId)).limit(1);
  if (!song) throw notFound("Song not found");

  let parentAuthor: string | null = null;
  if (parentId) {
    const [parent] = await db.select().from(comments).where(eq(comments.id, parentId)).limit(1);
    if (!parent || parent.songId !== songId) throw badRequest("Reply target not found on this song");
    if (parent.parentId) throw badRequest("Replies can only be one level deep");
    parentAuthor = parent.userId;
  }

  const [row] = await db.insert(comments).values({ userId: user.id, songId, parentId, body: text }).returning();
  if (parentAuthor && parentAuthor !== user.id) {
    await db.insert(notifications).values({
      userId: parentAuthor,
      type: "announcement",
      title: `${user.username} replied to your comment`,
      body: `On “${song.title}”: ${text.slice(0, 120)}`,
      link: `/songs/${songId}#comments`,
    });
  }
  return ok({
    comment: { id: row!.id, body: row!.body, parentId: row!.parentId, createdAt: row!.createdAt.toISOString(), userId: user.id, username: user.username, avatarUrl: user.avatarUrl },
  });
});

export const DELETE = withErrors(async (req) => {
  const user = await requireApiUser();
  const id = uuid(new URL(req.url).searchParams.get("id"), "id");
  const [c] = await db.select({ userId: comments.userId }).from(comments).where(eq(comments.id, id)).limit(1);
  if (!c) throw notFound("Comment not found");
  if (c.userId !== user.id && user.role !== "admin") throw forbidden("You can only delete your own comments");
  await db.delete(comments).where(eq(comments.id, id));
  return ok({ ok: true });
});
