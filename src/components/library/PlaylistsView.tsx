"use client";

import Link from "next/link";
import { Globe, Lock, Plus, ListMusic } from "lucide-react";
import { useState } from "react";
import { Artwork, Button, Dialog, EmptyState, ErrorState, Skeleton } from "@/components/common/ui";
import { useApi } from "@/hooks/useApi";
import { api } from "@/services/api";
import { usePlayerStore } from "@/store/player";

interface PlaylistRow {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  songCount: number;
  coverUrl: string | null;
}

export function PlaylistsView() {
  const { data, error, loading, retry, setData } = useApi<{ playlists: PlaylistRow[] }>("/api/playlists");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const flash = usePlayerStore((s) => s.flash);

  const create = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const res = await api<{ playlist: PlaylistRow }>("/api/playlists", { method: "POST", json: { name, description, isPublic } });
      setData({ playlists: [res.playlist, ...(data?.playlists ?? [])] });
      setOpen(false);
      setName("");
      setDescription("");
      setIsPublic(false);
      flash("Playlist created");
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="mb-6 flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} /> New playlist
        </Button>
      </div>

      {loading && !data && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full" />
          ))}
        </div>
      )}
      {error && <ErrorState message={error} onRetry={retry} />}
      {data && data.playlists.length === 0 && (
        <EmptyState icon={<ListMusic size={28} />} title="No playlists yet" text="Create one, then add songs from any player, card or song page." action={<Button onClick={() => setOpen(true)}>Create your first playlist</Button>} />
      )}
      {data && data.playlists.length > 0 && (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {data.playlists.map((p) => (
            <li key={p.id}>
              <Link href={`/playlists/${p.id}`} className="group block rounded-2xl border border-white/5 bg-surface p-3 transition duration-300 hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-gold">
                <div className="aspect-square overflow-hidden rounded-xl">
                  <Artwork src={p.coverUrl} seed={p.name} alt="" rounded="rounded-xl" />
                </div>
                <p className="mt-3 truncate font-medium text-white group-hover:text-gold">{p.name}</p>
                <p className="flex items-center gap-1 text-xs text-secondary">
                  {p.isPublic ? <Globe size={11} /> : <Lock size={11} />} {p.songCount} songs · {p.isPublic ? "Public" : "Private"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="New playlist">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <Field label="Name">
            <input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Late-night gold" />
          </Field>
          <Field label="Description (optional)">
            <textarea maxLength={300} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className="input resize-none" />
          </Field>
          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-white/10 px-4 py-3 text-sm">
            <span>
              <span className="block text-white">Public playlist</span>
              <span className="text-xs text-secondary">Anyone with the link can view it.</span>
            </span>
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="h-4 w-4 accent-[#D4AF37]" />
          </label>
          {formError && <p role="alert" className="text-sm text-red-300">{formError}</p>}
          <Button type="submit" className="w-full" disabled={saving || !name.trim()}>
            {saving ? "Creating…" : "Create playlist"}
          </Button>
        </form>
      </Dialog>
    </>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-widest text-secondary">{label}</span>
      {children}
    </label>
  );
}
