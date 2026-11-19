"use client";

import Link from "next/link";
import { MessageSquareReply, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Artwork, Button, EmptyState, ErrorState, Skeleton } from "@/components/common/ui";
import { useApi } from "@/hooks/useApi";
import { api } from "@/services/api";
import { usePlayerStore } from "@/store/player";
import { relativeTime } from "@/lib/format";

interface Comment {
  id: string;
  body: string;
  parentId: string | null;
  createdAt: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
}

/** Threaded song comments (one reply level). Public read; authors can delete their own comments. */
export function CommentsPanel({ songId, signedIn }: { songId: string; signedIn: boolean; compact?: boolean }) {
  const { data, error, loading, retry, setData } = useApi<{ comments: Comment[]; viewerId: string | null }>(`/api/comments?songId=${songId}`);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const flash = usePlayerStore((s) => s.flash);

  const roots = useMemo(() => (data?.comments ?? []).filter((c) => !c.parentId), [data]);
  const repliesOf = (id: string) => (data?.comments ?? []).filter((c) => c.parentId === id);

  const post = async (body: string, parentId: string | null) => {
    setPosting(true);
    try {
      const res = await api<{ comment: Comment }>("/api/comments", { method: "POST", json: { songId, body, parentId } });
      setData({ comments: [...(data?.comments ?? []), res.comment], viewerId: data?.viewerId ?? null });
      if (parentId) {
        setReplyTo(null);
        setReplyDraft("");
      } else setDraft("");
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setPosting(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await api(`/api/comments?id=${id}`, { method: "DELETE" });
      setData({ comments: (data?.comments ?? []).filter((c) => c.id !== id && c.parentId !== id), viewerId: data?.viewerId ?? null });
    } catch (e) {
      flash((e as Error).message);
    }
  };

  return (
    <div>
      {signedIn ? (
        <form
          className="mb-6 flex gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) void post(draft.trim(), null);
          }}
        >
          <label className="sr-only" htmlFor="comment-input">Write a comment</label>
          <textarea
            id="comment-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={1000}
            rows={2}
            placeholder="Share what this track means to you…"
            className="input min-h-12 flex-1 resize-none"
          />
          <Button type="submit" disabled={posting || !draft.trim()} className="self-end">
            {posting ? "Posting…" : "Post"}
          </Button>
        </form>
      ) : (
        <p className="mb-6 text-sm text-secondary">
          <Link href={`/login?next=${encodeURIComponent(`/songs/${songId}`)}`} className="text-gold hover:underline">Sign in</Link> to join the conversation.
        </p>
      )}

      {loading && !data && (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}
      {error && <ErrorState message={error} onRetry={retry} />}
      {data && roots.length === 0 && <EmptyState title="No comments yet" text="Be the first to share your thoughts." />}

      <ul className="space-y-5">
        {roots.map((c) => (
          <li key={c.id}>
            <CommentItem c={c} viewerId={data?.viewerId ?? null} onDelete={() => remove(c.id)} onReply={signedIn ? () => setReplyTo(replyTo === c.id ? null : c.id) : undefined} />
            {repliesOf(c.id).length > 0 && (
              <ul className="ml-12 mt-3 space-y-3 border-l border-white/5 pl-4">
                {repliesOf(c.id).map((r) => (
                  <li key={r.id}>
                    <CommentItem c={r} viewerId={data?.viewerId ?? null} onDelete={() => remove(r.id)} />
                  </li>
                ))}
              </ul>
            )}
            {replyTo === c.id && (
              <form
                className="ml-12 mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (replyDraft.trim()) void post(replyDraft.trim(), c.id);
                }}
              >
                <label className="sr-only" htmlFor={`reply-${c.id}`}>Reply to {c.username}</label>
                <input id={`reply-${c.id}`} autoFocus value={replyDraft} onChange={(e) => setReplyDraft(e.target.value)} maxLength={1000} className="input h-10 flex-1" placeholder={`Reply to ${c.username}`} />
                <Button size="sm" type="submit" disabled={posting || !replyDraft.trim()}>Reply</Button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CommentItem({ c, viewerId, onDelete, onReply }: { c: Comment; viewerId: string | null; onDelete: () => void; onReply?: () => void }) {
  return (
    <div className="flex gap-3">
      <div className="h-9 w-9 shrink-0">
        <Artwork src={c.avatarUrl} seed={c.username} alt="" rounded="rounded-full" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-medium text-white">{c.username}</span>
          <span className="ml-2 text-xs text-secondary">{relativeTime(c.createdAt)}</span>
        </p>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-white/80">{c.body}</p>
        <div className="mt-2 flex gap-4 text-xs text-secondary">
          {onReply && (
            <button type="button" onClick={onReply} className="flex items-center gap-1 hover:text-gold">
              <MessageSquareReply size={12} /> Reply
            </button>
          )}
          {viewerId === c.userId && (
            <button type="button" onClick={onDelete} className="flex items-center gap-1 hover:text-red-300">
              <Trash2 size={12} /> Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
