"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, Globe, Lock, Pencil, Search, Share2, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Artwork, Badge, Button, Dialog, EmptyState, ErrorState, IconButton, Skeleton } from "@/components/common/ui";
import { SongRow } from "@/components/music/MusicCards";
import { PlayQueueButtons } from "@/components/library/LibraryActions";
import { Field } from "@/components/library/PlaylistsView";
import { useApi } from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import { api } from "@/services/api";
import { usePlayerStore } from "@/store/player";
import { formatDuration, formatTotalDuration } from "@/lib/format";
import type { SongSummary } from "@/types";

interface PlaylistMeta {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  coverUrl: string | null;
  ownerName: string;
  isOwner: boolean;
  songCount: number;
  totalDuration: number;
}

export function PlaylistDetail({ id }: { id: string }) {
  const router = useRouter();
  const { data, error, loading, retry } = useApi<{ playlist: PlaylistMeta; songs: SongSummary[] }>(`/api/playlists/${id}`);
  const flash = usePlayerStore((s) => s.flash);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [q, setQ] = useState("");
  const debounced = useDebounce(q.trim(), 300);
  const search = useApi<{ songs: SongSummary[] }>(debounced ? `/api/search?q=${encodeURIComponent(debounced)}` : null);

  if (loading && !data)
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  if (error) return <ErrorState message={error === "Playlist not found" ? "This playlist doesn’t exist or is private." : error} onRetry={retry} />;
  if (!data) return null;
  const { playlist: p, songs } = data;

  const act = async (fn: () => Promise<unknown>, success?: string) => {
    try {
      await fn();
      if (success) flash(success);
      retry();
    } catch (e) {
      flash((e as Error).message);
    }
  };

  const shareLink = async () => {
    if (!p.isPublic) return flash("Make this playlist public to share it");
    const url = `${window.location.origin}/playlists/${p.id}`;
    try {
      if (navigator.share) await navigator.share({ title: p.name, url });
      else {
        await navigator.clipboard.writeText(url);
        flash("Playlist link copied");
      }
    } catch {
      /* cancelled */
    }
  };

  return (
    <>
      <section className="relative -mx-4 mb-8 overflow-hidden md:-mx-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(212,175,55,0.2),transparent_60%)]" aria-hidden />
        <div className="relative flex flex-col items-center gap-6 px-4 pb-8 pt-8 md:flex-row md:items-end md:gap-8 md:px-8">
          <div className="w-52 shrink-0 overflow-hidden rounded-2xl shadow-gold-lg md:w-60">
            <Artwork src={p.coverUrl} seed={p.name} alt={`${p.name} cover`} rounded="rounded-2xl" />
          </div>
          <div className="text-center md:text-left">
            <p className="flex items-center justify-center gap-2 text-xs uppercase tracking-[0.25em] text-gold md:justify-start">
              Playlist {p.isPublic ? <Globe size={12} /> : <Lock size={12} />} {p.isPublic ? "Public" : "Private"}
            </p>
            <h1 className="font-display mt-2 text-4xl md:text-5xl">{p.name}</h1>
            {p.description && <p className="mt-2 max-w-xl text-sm text-secondary">{p.description}</p>}
            <p className="mt-3 text-sm text-white/80">
              {p.ownerName} <span className="text-secondary">· {p.songCount} songs · {formatTotalDuration(p.totalDuration)}</span>
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3 md:justify-start">
              <PlayQueueButtons songs={songs} label="Play" />
              <PlayQueueButtons songs={songs} shuffle label="Shuffle" />
              <Button variant="outline" onClick={shareLink}>
                <Share2 size={16} /> Share
              </Button>
              {p.isOwner && (
                <>
                  <IconButton label="Edit playlist" onClick={() => setEditOpen(true)} className="border border-white/10">
                    <Pencil size={16} />
                  </IconButton>
                  <IconButton label="Delete playlist" onClick={() => setConfirmDelete(true)} className="border border-red-400/30 text-red-300">
                    <Trash2 size={16} />
                  </IconButton>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {songs.length === 0 ? (
        <EmptyState title="This playlist is empty" text={p.isOwner ? "Search below to add your first songs." : "No songs have been added yet."} />
      ) : (
        <div className="space-y-1 rounded-2xl border border-white/5 bg-surface p-2">
          {songs.map((s, i) => (
            <SongRow
              key={`${s.id}-${i}`}
              song={s}
              index={i + 1}
              queue={songs}
              showAlbum
              actions={
                p.isOwner ? (
                  <div className="flex items-center">
                    <IconButton label={`Move ${s.title} up`} className="h-8 w-8" disabled={i === 0} onClick={() => act(() => api(`/api/playlists/${p.id}`, { method: "POST", json: { action: "move", songId: s.id, direction: "up" } }))}>
                      <ArrowUp size={14} />
                    </IconButton>
                    <IconButton label={`Move ${s.title} down`} className="h-8 w-8" disabled={i === songs.length - 1} onClick={() => act(() => api(`/api/playlists/${p.id}`, { method: "POST", json: { action: "move", songId: s.id, direction: "down" } }))}>
                      <ArrowDown size={14} />
                    </IconButton>
                    <IconButton label={`Remove ${s.title}`} className="h-8 w-8" onClick={() => act(() => api(`/api/playlists/${p.id}`, { method: "POST", json: { action: "remove", songId: s.id } }), "Removed from playlist")}>
                      <X size={14} />
                    </IconButton>
                  </div>
                ) : undefined
              }
            />
          ))}
        </div>
      )}
      <p className="mt-3 text-right text-xs text-secondary">Total runtime {formatDuration(p.totalDuration)}</p>

      {p.isOwner && (
        <section className="mt-10" aria-labelledby="add-songs">
          <h2 id="add-songs" className="font-display mb-3 text-xl">Add songs</h2>
          <label className="relative block">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gold" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search songs to add" className="input h-11 w-full pl-11" />
          </label>
          {debounced && search.data && (
            <ul className="mt-3 space-y-1 rounded-2xl border border-white/5 bg-surface p-2">
              {search.data.songs.length === 0 && <li className="p-3 text-sm text-secondary">No songs match “{debounced}”.</li>}
              {search.data.songs.slice(0, 10).map((s) => (
                <li key={s.id}>
                  <div className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 hover:bg-white/5">
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{s.title}</span>
                      <span className="block truncate text-xs text-secondary">{s.artistName}</span>
                    </span>
                    <Button size="sm" variant="outline" disabled={songs.some((x) => x.id === s.id)} onClick={() => act(() => api(`/api/playlists/${p.id}`, { method: "POST", json: { action: "add", songId: s.id } }), `Added “${s.title}”`)}>
                      {songs.some((x) => x.id === s.id) ? "Added" : "Add"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <EditPlaylistDialog open={editOpen} onClose={() => setEditOpen(false)} playlist={p} onSaved={() => { setEditOpen(false); retry(); }} />

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete playlist?">
        <p className="mb-6 text-sm text-secondary">“{p.name}” and its track order will be permanently removed. Songs stay in the catalogue.</p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={async () => {
              try {
                await api(`/api/playlists/${p.id}`, { method: "DELETE" });
                flash("Playlist deleted");
                router.push("/playlists");
              } catch (e) {
                flash((e as Error).message);
              }
            }}
          >
            Delete
          </Button>
        </div>
      </Dialog>
      <Link href="/playlists" className="sr-only">Back to playlists</Link>
    </>
  );
}

function EditPlaylistDialog({ open, onClose, playlist, onSaved }: { open: boolean; onClose: () => void; playlist: PlaylistMeta; onSaved: () => void }) {
  const [name, setName] = useState(playlist.name);
  const [description, setDescription] = useState(playlist.description ?? "");
  const [isPublic, setIsPublic] = useState(playlist.isPublic);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  return (
    <Dialog open={open} onClose={onClose} title="Edit playlist">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          setErr(null);
          try {
            await api(`/api/playlists/${playlist.id}`, { method: "PATCH", json: { name, description, isPublic } });
            onSaved();
          } catch (e2) {
            setErr((e2 as Error).message);
          } finally {
            setSaving(false);
          }
        }}
      >
        <Field label="Name">
          <input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </Field>
        <Field label="Description">
          <textarea rows={2} maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} className="input resize-none" />
        </Field>
        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-white/10 px-4 py-3 text-sm">
          <span>
            <span className="block text-white">Public</span>
            <span className="text-xs text-secondary">Public playlists can be shared and found in search.</span>
          </span>
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="h-4 w-4 accent-[#D4AF37]" />
        </label>
        {err && <p role="alert" className="text-sm text-red-300">{err}</p>}
        <Button type="submit" className="w-full" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
      </form>
    </Dialog>
  );
}
