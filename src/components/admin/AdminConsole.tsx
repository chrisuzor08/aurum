"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { BarChart3, Disc3, Film, ListMusic, MessageSquareWarning, Mic2, Music, Trash2, Upload, Users } from "lucide-react";
import { Badge, Button, Card, IconButton, Section } from "@/components/common/ui";
import { Field } from "@/components/library/PlaylistsView";
import { api, uploadWithProgress, ApiError } from "@/services/api";
import { formatCount } from "@/lib/format";
import { usePlayerStore } from "@/store/player";

export interface AdminStats {
  totalUsers: number;
  activeUsers7d: number;
  totalSongs: number;
  totalStreams: number;
  premiumSubscribers: number;
  revenueMinor: number;
  topSongs: { id: string; title: string; artistName: string; plays: number }[];
  topArtists: { id: string; name: string; plays: number }[];
}
interface ArtistRow { id: string; name: string; verified: boolean; monthlyListeners: number; bio: string | null }
interface AlbumRow { id: string; title: string; artistId: string; releaseDate: string }
interface SongRowAdmin { id: string; title: string; artistName: string; playCount: number; hasAudio: boolean; hasVideo: boolean }
interface ShortRowAdmin { id: string; caption: string | null; songTitle: string; likesCount: number }
interface CommentRowAdmin { id: string; body: string; username: string; songTitle: string }

export interface AdminProps {
  stats: AdminStats;
  artists: ArtistRow[];
  albums: AlbumRow[];
  songs: SongRowAdmin[];
  shorts: ShortRowAdmin[];
  comments: CommentRowAdmin[];
}

const TABS = [
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "upload", label: "Upload song", icon: Upload },
  { key: "artists", label: "Artists", icon: Mic2 },
  { key: "albums", label: "Albums", icon: Disc3 },
  { key: "catalogue", label: "Catalogue", icon: Music },
  { key: "shorts", label: "Shorts", icon: Film },
  { key: "moderation", label: "Moderation", icon: MessageSquareWarning },
] as const;
type Tab = (typeof TABS)[number]["key"];

export function AdminConsole(props: AdminProps) {
  const [tab, setTab] = useState<Tab>("overview");
  return (
    <div>
      <div role="tablist" aria-label="Admin sections" className="no-scrollbar mb-8 flex gap-2 overflow-x-auto pb-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm transition ${tab === t.key ? "bg-gold-gradient font-semibold text-[#0A0A0A] shadow-gold" : "border border-white/10 text-secondary hover:text-white"}`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>
      {tab === "overview" && <Overview stats={props.stats} />}
      {tab === "upload" && <SongUploadForm artists={props.artists} albums={props.albums} />}
      {tab === "artists" && <ArtistsPanel artists={props.artists} />}
      {tab === "albums" && <AlbumsPanel artists={props.artists} albums={props.albums} />}
      {tab === "catalogue" && <CataloguePanel songs={props.songs} />}
      {tab === "shorts" && <ShortsPanel songs={props.songs} shorts={props.shorts} />}
      {tab === "moderation" && <ModerationPanel comments={props.comments} />}
    </div>
  );
}

/* ---------- Overview ---------- */

function Overview({ stats }: { stats: AdminStats }) {
  const router = useRouter();
  const flash = usePlayerStore((s) => s.flash);
  const [period, setPeriod] = useState("week");
  const [busy, setBusy] = useState(false);
  const cards = [
    { label: "Total users", value: formatCount(stats.totalUsers), icon: Users },
    { label: "Active (7 days)", value: formatCount(stats.activeUsers7d), icon: BarChart3 },
    { label: "Songs", value: formatCount(stats.totalSongs), icon: Music },
    { label: "Total streams", value: formatCount(stats.totalStreams), icon: ListMusic },
    { label: "Premium subscribers", value: formatCount(stats.premiumSubscribers), icon: Mic2 },
    { label: "Subscription revenue", value: new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(stats.revenueMinor / 100), icon: Disc3 },
  ];
  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label} className="p-5">
            <c.icon size={18} className="text-gold" />
            <p className="mt-4 font-display text-3xl">{c.value}</p>
            <p className="mt-1 text-xs uppercase tracking-widest text-secondary">{c.label}</p>
          </Card>
        ))}
      </div>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-display mb-3 text-lg">Most played songs</h3>
          <ol className="space-y-2 text-sm">
            {stats.topSongs.length === 0 && <li className="text-secondary">No plays recorded yet.</li>}
            {stats.topSongs.map((s, i) => (
              <li key={s.id} className="flex justify-between gap-4"><span className="truncate">{i + 1}. {s.title} <span className="text-secondary">· {s.artistName}</span></span><span className="tabular-nums text-gold">{formatCount(s.plays)}</span></li>
            ))}
          </ol>
        </Card>
        <Card className="p-5">
          <h3 className="font-display mb-3 text-lg">Most popular artists</h3>
          <ol className="space-y-2 text-sm">
            {stats.topArtists.length === 0 && <li className="text-secondary">No plays recorded yet.</li>}
            {stats.topArtists.map((a, i) => (
              <li key={a.id} className="flex justify-between gap-4"><span>{i + 1}. {a.name}</span><span className="tabular-nums text-gold">{formatCount(a.plays)}</span></li>
            ))}
          </ol>
        </Card>
      </div>
      <Section title="Publish chart snapshot" action={null}>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Period">
            <select value={period} onChange={(e) => setPeriod(e.target.value)} className="input h-10 w-44">
              <option value="week">This week</option>
              <option value="month">This month</option>
              <option value="season">This season</option>
            </select>
          </Field>
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const fd = new FormData();
                fd.append("period", period);
                const res = await api<{ count: number }>("/api/admin/charts", { method: "POST", body: fd });
                flash(`Snapshot saved · ${res.count} ranked songs`);
                router.refresh();
              } catch (e) {
                flash((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Save snapshot
          </Button>
        </div>
      </Section>
    </>
  );
}

/* ---------- Forms ---------- */

function useFormSubmit(endpoint: string, method: "POST" | "PATCH" = "POST") {
  const router = useRouter();
  const flash = usePlayerStore((s) => s.flash);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent<HTMLFormElement>, onDone?: () => void) => {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    setProgress(0);
    try {
      await uploadWithProgress(endpoint, form, setProgress, method);
      flash("Saved to AURUM");
      e.currentTarget.reset();
      onDone?.();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setProgress(null);
    }
  };
  return { submit, progress, error };
}

function ProgressBar({ value }: { value: number | null }) {
  if (value === null) return null;
  return (
    <div className="mt-3" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-gold-gradient transition-[width] duration-200" style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <p className="mt-1 text-xs text-secondary">{value < 1 ? `Uploading ${Math.round(value * 100)}%` : "Processing…"}</p>
    </div>
  );
}

function SongUploadForm({ artists, albums }: { artists: ArtistRow[]; albums: AlbumRow[] }) {
  const { submit, progress, error } = useFormSubmit("/api/admin/songs");
  const [artistId, setArtistId] = useState(artists[0]?.id ?? "");
  const artistAlbums = albums.filter((a) => a.artistId === artistId);
  if (artists.length === 0) return <Card className="p-6 text-sm text-secondary">Create an artist first in the Artists tab.</Card>;
  return (
    <Card className="p-6">
      <h3 className="font-display mb-1 text-xl">Upload a song</h3>
      <p className="mb-6 text-sm text-secondary">Attach licensed audio and/or a music video. Files are validated for type and size before storage. Lyrics accept plain text or LRC timestamps.</p>
      <form className="grid gap-4 md:grid-cols-2" onSubmit={(e) => submit(e)}>
        <Field label="Title"><input name="title" required className="input" maxLength={200} /></Field>
        <Field label="Artist">
          <select name="artistId" required className="input" value={artistId} onChange={(e) => setArtistId(e.target.value)}>
            {artists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <Field label="Album (optional)">
          <select name="albumId" className="input" defaultValue="">
            <option value="">— Single —</option>
            {artistAlbums.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
          </select>
        </Field>
        <Field label="Release date"><input type="date" name="releaseDate" required className="input" defaultValue={new Date().toISOString().slice(0, 10)} /></Field>
        <Field label="Genre"><input name="genre" required list="genres" className="input" placeholder="Afro-soul" /></Field>
        <Field label="Mood"><input name="mood" required list="moods" className="input" placeholder="Uplifting" /></Field>
        <Field label="Duration (m:ss or seconds)"><input name="duration" required className="input" placeholder="3:42" /></Field>
        <label className="flex items-center gap-3 self-end text-sm"><input type="checkbox" name="explicit" value="true" className="h-4 w-4 accent-[#D4AF37]" /> Explicit content</label>
        <Field label="Audio file (MP3, WAV, M4A, AAC, OGG · max 40 MB)"><input type="file" name="audio" accept="audio/mpeg,audio/wav,audio/mp4,audio/aac,audio/ogg" className="file-input" /></Field>
        <Field label="Music video (MP4, WebM · max 120 MB)"><input type="file" name="video" accept="video/mp4,video/webm" className="file-input" /></Field>
        <Field label="Cover artwork (JPG, PNG, WebP · max 8 MB)"><input type="file" name="cover" accept="image/jpeg,image/png,image/webp" className="file-input" /></Field>
        <Field label="…or licensed audio URL (https)"><input name="audioUrl" type="url" className="input" placeholder="https://…" /></Field>
        <Field label="…or licensed video URL (https)"><input name="videoUrl" type="url" className="input" placeholder="https://…" /></Field>
        <Field label="Plain lyrics"><textarea name="lyricsPlain" rows={5} className="input resize-y" placeholder={"Line one\nLine two"} /></Field>
        <Field label="Synced lyrics (LRC)"><textarea name="lyricsLrc" rows={5} className="input resize-y font-mono text-xs" placeholder={"[00:12.50] First line\n[00:16.20] Second line"} /></Field>
        <div className="md:col-span-2">
          <Button type="submit" disabled={progress !== null}><Upload size={16} /> {progress !== null ? "Uploading…" : "Publish song"}</Button>
          <ProgressBar value={progress} />
          {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
        </div>
      </form>
      <datalist id="genres">{["Afro-soul", "Jazz", "Electronic", "Acoustic", "Hip-hop", "Classical", "Ambient", "Pop", "R&B", "Rock"].map((g) => <option key={g} value={g} />)}</datalist>
      <datalist id="moods">{["Uplifting", "Calm", "Romantic", "Focus", "Energetic", "Melancholic", "Night"].map((m) => <option key={m} value={m} />)}</datalist>
      <style>{`.file-input{font-size:.875rem;color:#a1a1a1}.file-input::file-selector-button{margin-right:.75rem;border-radius:9999px;border:1px solid rgba(212,175,55,.5);background:transparent;color:#D4AF37;padding:.4rem .9rem;cursor:pointer}`}</style>
    </Card>
  );
}

function ArtistsPanel({ artists }: { artists: ArtistRow[] }) {
  const create = useFormSubmit("/api/admin/artists");
  const [editing, setEditing] = useState<ArtistRow | null>(null);
  const edit = useFormSubmit(`/api/admin/artists?id=${editing?.id ?? ""}`, "PATCH");
  const flash = usePlayerStore((s) => s.flash);
  const router = useRouter();
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <Card className="p-6">
        <h3 className="font-display mb-4 text-xl">{editing ? `Edit ${editing.name}` : "Create artist"}</h3>
        {editing ? (
          <form key={editing.id} className="space-y-4" onSubmit={(e) => edit.submit(e, () => setEditing(null))}>
            <Field label="Name"><input name="name" defaultValue={editing.name} required className="input" /></Field>
            <Field label="Biography"><textarea name="bio" rows={4} defaultValue={editing.bio ?? ""} className="input resize-y" /></Field>
            <Field label="Monthly listeners"><input name="monthlyListeners" type="number" min={0} defaultValue={editing.monthlyListeners} className="input" /></Field>
            <label className="flex items-center gap-3 text-sm"><input type="checkbox" name="verified" value="true" defaultChecked={editing.verified} className="h-4 w-4 accent-[#D4AF37]" /> Verified artist</label>
            <Field label="Portrait (optional)"><input type="file" name="image" accept="image/jpeg,image/png,image/webp" className="file-input" /></Field>
            <div className="flex gap-2"><Button type="submit" disabled={edit.progress !== null}>Save</Button><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
            <ProgressBar value={edit.progress} />
            {edit.error && <p role="alert" className="text-sm text-red-300">{edit.error}</p>}
          </form>
        ) : (
          <form className="space-y-4" onSubmit={(e) => create.submit(e)}>
            <Field label="Name"><input name="name" required className="input" maxLength={120} /></Field>
            <Field label="Biography"><textarea name="bio" rows={4} className="input resize-y" /></Field>
            <Field label="Monthly listeners"><input name="monthlyListeners" type="number" min={0} defaultValue={0} className="input" /></Field>
            <label className="flex items-center gap-3 text-sm"><input type="checkbox" name="verified" value="true" className="h-4 w-4 accent-[#D4AF37]" /> Verified artist</label>
            <Field label="Portrait (optional)"><input type="file" name="image" accept="image/jpeg,image/png,image/webp" className="file-input" /></Field>
            <Button type="submit" disabled={create.progress !== null}>Create artist</Button>
            <ProgressBar value={create.progress} />
            {create.error && <p role="alert" className="text-sm text-red-300">{create.error}</p>}
          </form>
        )}
      </Card>
      <Card className="p-4">
        <ul className="divide-y divide-white/5">
          {artists.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm">{a.name} {a.verified && <Badge>Verified</Badge>}</p>
                <p className="text-xs text-secondary">{formatCount(a.monthlyListeners)} monthly listeners</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(a)}>Edit</Button>
                <IconButton label={`Delete ${a.name}`} className="h-8 w-8" onClick={async () => {
                  if (!confirm(`Delete ${a.name} and all of their songs and albums?`)) return;
                  try { await api(`/api/admin/artists?id=${a.id}`, { method: "DELETE" }); flash("Artist removed"); router.refresh(); } catch (e) { flash((e as Error).message); }
                }}><Trash2 size={14} /></IconButton>
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <style>{`.file-input{font-size:.875rem;color:#a1a1a1}.file-input::file-selector-button{margin-right:.75rem;border-radius:9999px;border:1px solid rgba(212,175,55,.5);background:transparent;color:#D4AF37;padding:.4rem .9rem;cursor:pointer}`}</style>
    </div>
  );
}

function AlbumsPanel({ artists, albums }: { artists: ArtistRow[]; albums: AlbumRow[] }) {
  const { submit, progress, error } = useFormSubmit("/api/admin/albums");
  const flash = usePlayerStore((s) => s.flash);
  const router = useRouter();
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <Card className="p-6">
        <h3 className="font-display mb-4 text-xl">Create album</h3>
        <form className="space-y-4" onSubmit={(e) => submit(e)}>
          <Field label="Artist">
            <select name="artistId" required className="input">{artists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          </Field>
          <Field label="Title"><input name="title" required className="input" maxLength={160} /></Field>
          <Field label="Release date"><input type="date" name="releaseDate" required className="input" /></Field>
          <Field label="Cover (optional)"><input type="file" name="cover" accept="image/jpeg,image/png,image/webp" className="file-input" /></Field>
          <Button type="submit" disabled={progress !== null}>Create album</Button>
          <ProgressBar value={progress} />
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        </form>
      </Card>
      <Card className="p-4">
        <ul className="divide-y divide-white/5">
          {albums.length === 0 && <li className="p-4 text-sm text-secondary">No albums yet.</li>}
          {albums.map((al) => (
            <li key={al.id} className="flex items-center justify-between gap-3 py-3">
              <span className="min-w-0 truncate text-sm">{al.title} <span className="text-secondary">· {al.releaseDate}</span></span>
              <IconButton label={`Delete ${al.title}`} className="h-8 w-8" onClick={async () => {
                if (!confirm(`Delete album “${al.title}”? Its songs stay in the catalogue.`)) return;
                try { await api(`/api/admin/albums?id=${al.id}`, { method: "DELETE" }); flash("Album removed"); router.refresh(); } catch (e) { flash((e as Error).message); }
              }}><Trash2 size={14} /></IconButton>
            </li>
          ))}
        </ul>
      </Card>
      <style>{`.file-input{font-size:.875rem;color:#a1a1a1}.file-input::file-selector-button{margin-right:.75rem;border-radius:9999px;border:1px solid rgba(212,175,55,.5);background:transparent;color:#D4AF37;padding:.4rem .9rem;cursor:pointer}`}</style>
    </div>
  );
}

function CataloguePanel({ songs }: { songs: SongRowAdmin[] }) {
  const flash = usePlayerStore((s) => s.flash);
  const router = useRouter();
  return (
    <Card className="p-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase tracking-widest text-secondary">
            <tr><th className="p-3">Title</th><th className="p-3">Artist</th><th className="p-3">Media</th><th className="p-3 text-right">Plays</th><th className="p-3 text-right">Remove</th></tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {songs.map((s) => (
              <tr key={s.id}>
                <td className="p-3"><a href={`/songs/${s.id}`} className="hover:text-gold">{s.title}</a></td>
                <td className="p-3 text-secondary">{s.artistName}</td>
                <td className="p-3"><span className="flex gap-1">{s.hasAudio ? <Badge tone="muted">Audio</Badge> : <Badge tone="muted">No audio</Badge>}{s.hasVideo && <Badge>Video</Badge>}</span></td>
                <td className="p-3 text-right tabular-nums">{formatCount(s.playCount)}</td>
                <td className="p-3 text-right">
                  <IconButton label={`Remove ${s.title}`} className="h-8 w-8" onClick={async () => {
                    if (!confirm(`Remove “${s.title}” from AURUM? This cannot be undone.`)) return;
                    try { await api(`/api/admin/songs?id=${s.id}`, { method: "DELETE" }); flash("Song removed"); router.refresh(); } catch (e) { flash((e as Error).message); }
                  }}><Trash2 size={14} /></IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ShortsPanel({ songs, shorts }: { songs: SongRowAdmin[]; shorts: ShortRowAdmin[] }) {
  const { submit, progress, error } = useFormSubmit("/api/admin/shorts");
  const flash = usePlayerStore((s) => s.flash);
  const router = useRouter();
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <Card className="p-6">
        <h3 className="font-display mb-4 text-xl">Publish a short</h3>
        <p className="mb-4 text-xs text-secondary">Shorts should be 15–60 seconds; longer clips loop at 60 seconds in the feed.</p>
        <form className="space-y-4" onSubmit={(e) => submit(e)}>
          <Field label="Song">
            <select name="songId" required className="input">{songs.map((s) => <option key={s.id} value={s.id}>{s.title} — {s.artistName}</option>)}</select>
          </Field>
          <Field label="Caption"><input name="caption" maxLength={200} className="input" /></Field>
          <Field label="Vertical video (MP4 / WebM)"><input type="file" name="video" accept="video/mp4,video/webm" required className="file-input" /></Field>
          <Button type="submit" disabled={progress !== null}>Publish short</Button>
          <ProgressBar value={progress} />
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        </form>
      </Card>
      <Card className="p-4">
        <ul className="divide-y divide-white/5">
          {shorts.length === 0 && <li className="p-4 text-sm text-secondary">No shorts published.</li>}
          {shorts.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-3">
              <span className="min-w-0"><span className="block truncate text-sm">{s.songTitle}</span><span className="block truncate text-xs text-secondary">{s.caption ?? "No caption"} · {formatCount(s.likesCount)} likes</span></span>
              <IconButton label="Remove short" className="h-8 w-8" onClick={async () => {
                try { await api(`/api/admin/shorts?id=${s.id}`, { method: "DELETE" }); flash("Short removed"); router.refresh(); } catch (e) { flash((e as Error).message); }
              }}><Trash2 size={14} /></IconButton>
            </li>
          ))}
        </ul>
      </Card>
      <style>{`.file-input{font-size:.875rem;color:#a1a1a1}.file-input::file-selector-button{margin-right:.75rem;border-radius:9999px;border:1px solid rgba(212,175,55,.5);background:transparent;color:#D4AF37;padding:.4rem .9rem;cursor:pointer}`}</style>
    </div>
  );
}

function ModerationPanel({ comments }: { comments: CommentRowAdmin[] }) {
  const flash = usePlayerStore((s) => s.flash);
  const router = useRouter();
  return (
    <Card className="p-4">
      {comments.length === 0 && <p className="p-4 text-sm text-secondary">No comments to review.</p>}
      <ul className="divide-y divide-white/5">
        {comments.map((c) => (
          <li key={c.id} className="flex items-start justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="text-xs text-secondary">{c.username} on <span className="text-white/80">{c.songTitle}</span></p>
              <p className="mt-1 text-sm text-white/85">{c.body}</p>
            </div>
            <Button size="sm" variant="danger" onClick={async () => {
              try { await api(`/api/admin/comments?id=${c.id}`, { method: "DELETE" }); flash("Comment removed"); router.refresh(); } catch (e) { flash((e as Error).message); }
            }}>Remove</Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
