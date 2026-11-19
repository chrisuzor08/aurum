"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, Crown, LogOut, Settings2 } from "lucide-react";
import { useState } from "react";
import { Artwork, Badge, Button, Card, PageHeader, Section, Skeleton, ErrorState } from "@/components/common/ui";
import { Field } from "@/components/library/PlaylistsView";
import { useApi } from "@/hooks/useApi";
import { api, uploadWithProgress } from "@/services/api";
import { usePlayerStore } from "@/store/player";
import { formatDate, formatCount } from "@/lib/format";
import type { CurrentUser } from "@/types";

interface ProfileData {
  user: CurrentUser;
  counts: { likes: number; follows: number; playlists: number };
  preferences: { genres: string[]; moods: string[]; artists: string[] };
}

export function ProfileView() {
  const { data, error, loading, retry, setData } = useApi<ProfileData>("/api/profile");
  const flash = usePlayerStore((s) => s.flash);
  const [username, setUsername] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<number | null>(null);

  if (loading && !data)
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (!data) return null;
  const u = data.user;

  const save = async () => {
    setSaving(true);
    setFormError(null);
    try {
      await api("/api/profile", { method: "PATCH", json: { username: username ?? u.username, displayName: displayName ?? u.displayName ?? "" } });
      flash("Profile updated");
      setUsername(null);
      setDisplayName(null);
      retry();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    const form = new FormData();
    form.append("avatar", file);
    setUploading(0);
    try {
      await uploadWithProgress<{ avatarUrl: string }>("/api/profile", form, (f) => setUploading(f));
      flash("Avatar updated");
      retry();
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setUploading(null);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Your profile" title={u.displayName || u.username} description={`@${u.username}`} />

      <div className="grid gap-6 md:grid-cols-[320px_1fr]">
        <Card className="p-6 text-center">
          <label className="group relative mx-auto block h-32 w-32 cursor-pointer overflow-hidden rounded-full border border-gold/40 shadow-gold">
            <Artwork src={u.avatarUrl} seed={u.username} alt="Your avatar" rounded="rounded-full" />
            <span className="absolute inset-0 grid place-items-center bg-black/60 opacity-0 transition group-hover:opacity-100">
              <Camera className="text-gold" size={22} />
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              aria-label="Upload avatar"
              onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
            />
          </label>
          {uploading !== null && (
            <div className="mx-auto mt-4 h-1 w-32 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={Math.round(uploading * 100)} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-gold-gradient transition-[width]" style={{ width: `${uploading * 100}%` }} />
            </div>
          )}
          <p className="mt-4 font-display text-xl">{u.displayName || u.username}</p>
          <p className="text-sm text-secondary">{u.email}</p>
          <div className="mt-3 flex justify-center">
            {u.isPremium ? <Badge>Premium member</Badge> : <Badge tone="muted">Free plan</Badge>}
          </div>
          <dl className="mt-6 grid grid-cols-3 gap-2 text-center">
            <Stat label="Liked" value={data.counts.likes} />
            <Stat label="Following" value={data.counts.follows} />
            <Stat label="Playlists" value={data.counts.playlists} />
          </dl>
        </Card>

        <div className="space-y-6">
          <Card className="p-6" >
            <h2 id="edit" className="font-display mb-4 scroll-mt-24 text-xl">Edit profile</h2>
            <form
              className="grid gap-4 md:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <Field label="Username">
                <input value={username ?? u.username} onChange={(e) => setUsername(e.target.value.toLowerCase())} minLength={3} maxLength={24} className="input" />
              </Field>
              <Field label="Display name">
                <input value={displayName ?? u.displayName ?? ""} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} className="input" />
              </Field>
              {formError && <p role="alert" className="text-sm text-red-300 md:col-span-2">{formError}</p>}
              <div className="md:col-span-2">
                <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
              </div>
            </form>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl">Your taste</h2>
              <Link href="/onboarding" className="text-sm text-gold hover:underline">Update preferences</Link>
            </div>
            <PrefList title="Genres" items={data.preferences.genres} />
            <PrefList title="Moods" items={data.preferences.moods} />
            <p className="mt-4 text-xs text-secondary">Saved {data.preferences.artists.length} favourite artists as follows.</p>
          </Card>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-elevated/60 py-3">
      <dt className="text-[11px] uppercase tracking-widest text-secondary">{label}</dt>
      <dd className="font-display text-xl text-white">{value}</dd>
    </div>
  );
}

function PrefList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-xs uppercase tracking-widest text-secondary">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-secondary">Not set yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((i) => (
            <Badge key={i} tone="muted">{i}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}

/** Settings page body: plan, playback limits, and account actions (logout is a real server-side session revoke). */
export function SettingsPanel() {
  const router = useRouter();
  const { data, error, loading, retry } = useApi<ProfileData>("/api/profile");
  const [loggingOut, setLoggingOut] = useState(false);
  const logout = async () => {
    setLoggingOut(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/");
      router.refresh();
    }
  };
  if (loading && !data) return <Skeleton className="h-64 w-full" />;
  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (!data) return null;
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="p-6">
        <h2 className="font-display mb-4 flex items-center gap-2 text-xl"><Crown size={18} className="text-gold" /> Plan</h2>
        <p className="text-sm text-white/85">{data.user.isPremium ? "AURUM Premium" : "AURUM Free"}</p>
        <ul className="mt-3 space-y-2 text-sm text-secondary">
          <li>Skips: {data.user.isPremium ? "Unlimited" : "6 per hour"}</li>
          <li>Audio: {data.user.isPremium ? "High fidelity" : "Standard"}</li>
          <li>Video & downloads: {data.user.isPremium ? "Included" : "Premium only"}</li>
          {data.user.premiumExpiresAt && <li>Renews through {formatDate(data.user.premiumExpiresAt)}</li>}
        </ul>
        <Link href="/premium" className="mt-5 inline-flex h-10 items-center rounded-full border border-gold/50 px-5 text-sm text-gold hover:bg-gold/10">
          {data.user.isPremium ? "Manage plan" : "Upgrade to Premium"}
        </Link>
      </Card>
      <Card className="p-6">
        <h2 className="font-display mb-4 flex items-center gap-2 text-xl"><Settings2 size={18} className="text-gold" /> Playback shortcuts</h2>
        <ul className="space-y-2 text-sm text-secondary">
          <li><kbd className="kbd">Space</kbd> Play / pause</li>
          <li><kbd className="kbd">←</kbd> <kbd className="kbd">→</kbd> Seek 5 s (Shift: 30 s)</li>
          <li><kbd className="kbd">↑</kbd> <kbd className="kbd">↓</kbd> Volume</li>
          <li><kbd className="kbd">N</kbd> Next · <kbd className="kbd">P</kbd> Previous · <kbd className="kbd">M</kbd> Mute</li>
        </ul>
      </Card>
      <Card className="p-6 md:col-span-2">
        <h2 className="font-display mb-2 text-xl">Session</h2>
        <p className="mb-5 text-sm text-secondary">Signing out revokes this device’s session on the server.</p>
        <Button variant="outline" onClick={logout} disabled={loggingOut}>
          <LogOut size={16} /> {loggingOut ? "Signing out…" : "Logout"}
        </Button>
      </Card>
    </div>
  );
}
