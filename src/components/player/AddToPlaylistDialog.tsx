"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { Button, Dialog } from "@/components/common/ui";
import { useApi } from "@/hooks/useApi";
import { api } from "@/services/api";
import { usePlayerStore } from "@/store/player";
import Link from "next/link";

interface PlaylistLite {
  id: string;
  name: string;
  songCount: number;
}

/** Adds a song to one of the signed-in user's playlists, or creates a new one inline. */
export function AddToPlaylistDialog({ songId, open, onClose }: { songId: string; open: boolean; onClose: () => void }) {
  const { data, error, loading, retry, setData } = useApi<{ playlists: PlaylistLite[] }>(open ? "/api/playlists" : null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const flash = usePlayerStore((s) => s.flash);

  const add = async (playlistId: string, label: string) => {
    setBusy(playlistId);
    setErr(null);
    try {
      await api(`/api/playlists/${playlistId}`, { method: "POST", json: { action: "add", songId } });
      setDone(playlistId);
      flash(`Added to ${label}`);
      setTimeout(onClose, 500);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const create = async () => {
    if (!name.trim()) return;
    setBusy("new");
    setErr(null);
    try {
      const res = await api<{ playlist: PlaylistLite }>("/api/playlists", { method: "POST", json: { name: name.trim() } });
      setData({ playlists: [res.playlist, ...(data?.playlists ?? [])] });
      setName("");
      await add(res.playlist.id, res.playlist.name);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Add to playlist">
      {error && (
        <div className="text-sm text-secondary">
          {error === "Sign in required" ? (
            <p>
              <Link href="/login" className="text-gold underline">Sign in</Link> to build playlists.
            </p>
          ) : (
            <p>{error}</p>
          )}
          <Button variant="outline" size="sm" className="mt-3" onClick={retry}>Retry</Button>
        </div>
      )}
      {loading && <p className="text-sm text-secondary">Loading your playlists…</p>}
      {data && (
        <>
          <div className="mb-4 flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New playlist name"
              maxLength={80}
              aria-label="New playlist name"
              className="h-10 flex-1 rounded-full border border-white/10 bg-surface px-4 text-sm outline-none focus:border-gold"
            />
            <Button size="sm" onClick={create} disabled={!name.trim() || busy !== null}>
              <Plus size={16} /> Create
            </Button>
          </div>
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {data.playlists.length === 0 && <li className="py-4 text-center text-sm text-secondary">No playlists yet — create your first one above.</li>}
            {data.playlists.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => add(p.id, p.name)}
                  disabled={busy !== null}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm transition hover:bg-white/5 disabled:opacity-50"
                >
                  <span className="truncate text-white">{p.name}</span>
                  <span className="flex items-center gap-2 text-xs text-secondary">
                    {p.songCount} songs
                    {done === p.id && <Check size={14} className="text-gold" />}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {err && <p role="alert" className="mt-3 text-sm text-red-300">{err}</p>}
    </Dialog>
  );
}
