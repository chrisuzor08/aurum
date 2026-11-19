"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Crown, Download, Heart, ListPlus, Play, Share2, Shuffle, UserCheck, UserPlus, BookmarkCheck, BookmarkPlus } from "lucide-react";
import { Button, IconButton } from "@/components/common/ui";
import { AddToPlaylistDialog } from "@/components/player/AddToPlaylistDialog";
import { api } from "@/services/api";
import { usePlayerStore } from "@/store/player";
import type { SongSummary } from "@/types";
import { cn } from "@/utils/cn";

/** Play / Shuffle a list of songs as the queue. */
export function PlayQueueButtons({ songs, shuffle = false, label }: { songs: SongSummary[]; shuffle?: boolean; label: string }) {
  const playSong = usePlayerStore((s) => s.playSong);
  const flash = usePlayerStore((s) => s.flash);
  const start = () => {
    if (songs.length === 0) return flash("Nothing to play yet");
    const st = usePlayerStore.getState();
    if (shuffle && !st.shuffle) st.toggleShuffle();
    const first = shuffle ? songs[Math.floor(Math.random() * songs.length)]! : songs[0]!;
    playSong(first, songs);
  };
  return (
    <Button onClick={start} aria-label={label} disabled={songs.length === 0}>
      {shuffle ? <Shuffle size={16} /> : <Play size={16} fill="currentColor" />}
      {label}
    </Button>
  );
}

export function FollowButton({ artistId, initial, signedIn }: { artistId: string; initial: boolean; signedIn: boolean }) {
  const router = useRouter();
  const [following, setFollowing] = useState(initial);
  const [busy, setBusy] = useState(false);
  const flash = usePlayerStore((s) => s.flash);
  const toggle = async () => {
    if (!signedIn) return router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    setBusy(true);
    try {
      const res = await api<{ following: boolean }>("/api/library", { method: "POST", json: { kind: "follow", id: artistId, on: !following } });
      setFollowing(res.following);
      flash(res.following ? "You’re following this artist" : "Unfollowed");
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button variant={following ? "outline" : "gold"} onClick={toggle} disabled={busy} aria-pressed={following}>
      {following ? <UserCheck size={16} /> : <UserPlus size={16} />}
      {following ? "Following" : "Follow"}
    </Button>
  );
}

export function AlbumSaveButton({ albumId, initial, signedIn }: { albumId: string; initial: boolean; signedIn: boolean }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const flash = usePlayerStore((s) => s.flash);
  const toggle = async () => {
    if (!signedIn) return router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    setBusy(true);
    try {
      const res = await api<{ saved: boolean }>("/api/library", { method: "POST", json: { kind: "album", id: albumId, on: !saved } });
      setSaved(res.saved);
      flash(res.saved ? "Album saved to your library" : "Removed from your library");
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button variant="outline" onClick={toggle} disabled={busy} aria-pressed={saved}>
      {saved ? <BookmarkCheck size={16} /> : <BookmarkPlus size={16} />}
      {saved ? "Saved" : "Save"}
    </Button>
  );
}

/** Action row on a song page: play, like, playlist, share, download (Premium-gated server-side). */
export function SongActions({ song, signedIn, hasAudio, hasVideo }: { song: SongSummary; signedIn: boolean; hasAudio: boolean; hasVideo: boolean }) {
  const router = useRouter();
  const playSong = usePlayerStore((s) => s.playSong);
  const setMode = usePlayerStore((s) => s.setMode);
  const isPremium = usePlayerStore((s) => s.isPremium);
  const flash = usePlayerStore((s) => s.flash);
  const [liked, setLiked] = useState<boolean | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);

  useEffect(() => {
    if (!signedIn) return setLiked(false);
    api<{ liked: boolean }>(`/api/library?kind=status&id=${song.id}`)
      .then((r) => setLiked(r.liked))
      .catch(() => setLiked(false));
  }, [signedIn, song.id]);

  const requireSignIn = () => router.push(`/login?next=${encodeURIComponent(`/songs/${song.id}`)}`);

  const like = async () => {
    if (!signedIn) return requireSignIn();
    const next = !liked;
    try {
      const res = await api<{ liked: boolean }>("/api/library", { method: "POST", json: { kind: "like", id: song.id, on: next } });
      setLiked(res.liked);
      flash(res.liked ? "Added to Liked Songs" : "Removed from Liked Songs");
    } catch (e) {
      flash((e as Error).message);
    }
  };

  const download = async () => {
    if (!signedIn) return requireSignIn();
    if (!isPremium) return router.push("/premium");
    try {
      await api("/api/library", { method: "POST", json: { kind: "download", id: song.id, on: !downloaded } });
      setDownloaded(!downloaded);
      flash(downloaded ? "Removed from downloads" : "Saved for offline listening");
    } catch (e) {
      flash((e as Error).message);
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/songs/${song.id}`;
    try {
      if (navigator.share) await navigator.share({ title: song.title, text: `${song.title} · ${song.artistName} on AURUM`, url });
      else {
        await navigator.clipboard.writeText(url);
        flash("Song link copied");
      }
    } catch {
      /* cancelled */
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={() => playSong(song, [song])} disabled={!hasAudio && !hasVideo}>
        <Play size={16} fill="currentColor" /> Play
      </Button>
      {hasVideo && (
        <Button variant="outline" onClick={() => { playSong(song, [song]); setMode("video"); }}>
          {isPremium ? "Watch video" : <><Crown size={14} /> Video · Premium</>}
        </Button>
      )}
      <IconButton label={liked ? "Unlike" : "Like"} active={Boolean(liked)} aria-pressed={Boolean(liked)} onClick={like} className="border border-white/10">
        <Heart size={18} fill={liked ? "currentColor" : "none"} />
      </IconButton>
      <IconButton label="Add to playlist" onClick={() => (signedIn ? setPlaylistOpen(true) : requireSignIn())} className="border border-white/10">
        <ListPlus size={18} />
      </IconButton>
      <IconButton label="Share song" onClick={share} className="border border-white/10">
        <Share2 size={18} />
      </IconButton>
      <button
        type="button"
        onClick={download}
        className={cn("inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm transition", isPremium ? "border-white/10 hover:border-gold/50 hover:text-gold" : "border-gold/30 text-gold-highlight hover:bg-gold/5")}
      >
        {isPremium ? <Download size={16} /> : <Crown size={14} />}
        {downloaded ? "Downloaded" : isPremium ? "Download" : "Download · Premium"}
      </button>
      {!hasAudio && <p className="w-full text-xs text-secondary">No licensed audio has been published for this track yet.</p>}
      <AddToPlaylistDialog songId={song.id} open={playlistOpen} onClose={() => setPlaylistOpen(false)} />
      <Link href="/premium" className="sr-only">Premium</Link>
    </div>
  );
}
