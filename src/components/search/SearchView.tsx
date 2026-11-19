"use client";

import Link from "next/link";
import { Clock, Search, Trash2, X, ListMusic, Mic2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AlbumCard, ArtistCard, GenreTile, SongRow } from "@/components/music/MusicCards";
import { Button, EmptyState, ErrorState, Section, Skeleton } from "@/components/common/ui";
import { CardRow } from "@/components/common/CardRow";
import { useDebounce } from "@/hooks/useDebounce";
import { useApi } from "@/hooks/useApi";
import { api } from "@/services/api";
import { cn } from "@/utils/cn";
import type { SongSummary } from "@/types";

interface SearchResponse {
  query: string;
  songs: SongSummary[];
  artists: { id: string; name: string; imageUrl: string | null; verified: boolean; monthlyListeners: number }[];
  albums: { id: string; title: string; coverUrl: string | null; artistId: string; artistName: string; releaseDate: string }[];
  playlists: { id: string; name: string; songCount: number; ownerName: string }[];
  lyrics: { song: SongSummary; snippet: string }[];
  suggestions: string[];
}

interface Facets {
  genres: { value: string; count: number }[];
  moods: { value: string; count: number }[];
}

const LOCAL_HISTORY_KEY = "aurum.search.history";

function readLocalHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_HISTORY_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function SearchView({ initialQuery, initialGenre, initialMood }: { initialQuery: string; initialGenre: string | null; initialMood: string | null }) {
  const [input, setInput] = useState(initialQuery);
  const [genre, setGenre] = useState<string | null>(initialGenre);
  const [mood, setMood] = useState<string | null>(initialMood);
  const [history, setHistory] = useState<string[]>([]);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const debounced = useDebounce(input.trim(), 300);
  const facets = useApi<Facets>("/api/search?facets=1");

  const params = new URLSearchParams();
  if (debounced.length >= 1) params.set("q", debounced);
  if (genre) params.set("genre", genre);
  if (mood) params.set("mood", mood);
  const searchUrl = params.toString() ? `/api/search?${params.toString()}` : null;
  const results = useApi<SearchResponse>(searchUrl);

  // Load history: account history when signed in, otherwise this device's history.
  useEffect(() => {
    api<{ history: string[] }>("/api/search?history=1")
      .then((r) => {
        setSignedIn(true);
        setHistory(r.history);
      })
      .catch(() => {
        setSignedIn(false);
        setHistory(readLocalHistory());
      });
  }, []);

  // Keep the URL shareable without triggering navigation.
  useEffect(() => {
    const qs = new URLSearchParams();
    if (debounced) qs.set("q", debounced);
    if (genre) qs.set("genre", genre);
    if (mood) qs.set("mood", mood);
    const url = `${window.location.pathname}${qs.toString() ? `?${qs}` : ""}`;
    window.history.replaceState(null, "", url);
  }, [debounced, genre, mood]);

  // Persist a query once it has produced results.
  useEffect(() => {
    if (!results.data || debounced.length < 2) return;
    const hasHits = results.data.songs.length + results.data.artists.length + results.data.albums.length + results.data.playlists.length + results.data.lyrics.length > 0;
    if (!hasHits) return;
    if (signedIn) {
      api("/api/search", { method: "POST", json: { query: debounced } })
        .then(() => setHistory((h) => [debounced.toLowerCase(), ...h.filter((x) => x !== debounced.toLowerCase())].slice(0, 8)))
        .catch(() => undefined);
    } else {
      const next = [debounced, ...readLocalHistory().filter((x) => x !== debounced)].slice(0, 8);
      localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(next));
      setHistory(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.data]);

  const clearHistory = async () => {
    if (signedIn) await api("/api/search?history=1", { method: "DELETE" }).catch(() => undefined);
    localStorage.removeItem(LOCAL_HISTORY_KEY);
    setHistory([]);
  };

  const data = results.data;
  const hasAny = data && (data.songs.length || data.artists.length || data.albums.length || data.playlists.length || data.lyrics.length);
  const searching = debounced.length >= 1;

  return (
    <div>
      <div className="sticky top-16 z-20 -mx-4 mb-6 bg-background/90 px-4 pb-4 pt-2 backdrop-blur-xl md:-mx-8 md:px-8">
        <label htmlFor="search-input" className="relative block">
          <span className="sr-only">Search songs, artists, albums, playlists and lyrics</span>
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gold" />
          <input
            id="search-input"
            type="search"
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setInput("")}
            placeholder="Songs, artists, albums, playlists, lyrics…"
            className="h-13 w-full rounded-full border border-white/10 bg-surface py-3 pl-12 pr-12 text-base text-white outline-none transition placeholder:text-secondary focus:border-gold focus:shadow-gold"
          />
          {input && (
            <button type="button" aria-label="Clear search" onClick={() => setInput("")} className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-secondary hover:text-gold">
              <X size={16} />
            </button>
          )}
        </label>
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filters">
          {facets.data?.genres.map((g) => (
            <Chip key={g.value} active={genre === g.value} onClick={() => setGenre(genre === g.value ? null : g.value)}>
              {g.value}
            </Chip>
          ))}
          {facets.data?.moods.map((m) => (
            <Chip key={m.value} active={mood === m.value} onClick={() => setMood(mood === m.value ? null : m.value)} tone="mood">
              {m.value}
            </Chip>
          ))}
        </div>
      </div>

      {!searching && (
        <>
          {history.length > 0 && (
            <Section
              title="Recent searches"
              action={
                <button type="button" onClick={clearHistory} className="flex items-center gap-1 text-xs text-secondary hover:text-gold">
                  <Trash2 size={12} /> Clear history
                </button>
              }
            >
              <ul className="flex flex-wrap gap-2">
                {history.map((h) => (
                  <li key={h}>
                    <button type="button" onClick={() => setInput(h)} className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-white/80 hover:border-gold/40 hover:text-gold">
                      <Clock size={12} /> {h}
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          <Section title="Browse genres">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {facets.data?.genres.slice(0, 8).map((g) => (
                <button key={g.value} type="button" onClick={() => setGenre(g.value)} className="text-left">
                  <GenreTile label={g.value} count={g.count} href="#" />
                </button>
              ))}
            </div>
          </Section>
          <Section title="Browse moods">
            <div className="flex flex-wrap gap-2">
              {facets.data?.moods.map((m) => (
                <Chip key={m.value} tone="mood" active={mood === m.value} onClick={() => setMood(mood === m.value ? null : m.value)}>
                  {m.value}
                </Chip>
              ))}
            </div>
          </Section>
        </>
      )}

      {searching && results.loading && !data && (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      )}
      {searching && results.error && <ErrorState message={results.error} onRetry={results.retry} />}

      {searching && data && !hasAny && (
        <div className="space-y-6">
          <EmptyState
            icon={<Search size={28} />}
            title={`No results for “${debounced}”`}
            text="Check the spelling, try fewer words, or search for an artist or a lyric you remember."
          />
          {data.suggestions.length > 0 && (
            <div>
              <p className="mb-2 text-xs uppercase tracking-widest text-secondary">Did you mean</p>
              <div className="flex flex-wrap gap-2">
                {data.suggestions.map((s) => (
                  <Chip key={s} onClick={() => setInput(s)}>{s}</Chip>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {searching && data && hasAny && (
        <div className={cn("transition-opacity", results.loading && "opacity-60")}>
          {data.songs.length > 0 && (
            <Section title="Songs">
              <div className="space-y-1 rounded-2xl border border-white/5 bg-surface p-2">
                {data.songs.map((s, i) => (
                  <SongRow key={s.id} song={s} index={i + 1} queue={data.songs} showAlbum />
                ))}
              </div>
            </Section>
          )}
          {data.artists.length > 0 && (
            <Section title="Artists">
              <CardRow label="Artists">
                {data.artists.map((a) => (
                  <ArtistCard key={a.id} {...a} />
                ))}
              </CardRow>
            </Section>
          )}
          {data.albums.length > 0 && (
            <Section title="Albums">
              <CardRow label="Albums">
                {data.albums.map((a) => (
                  <AlbumCard key={a.id} id={a.id} title={a.title} coverUrl={a.coverUrl} artistName={a.artistName} subtitle={`${a.artistName} · ${a.releaseDate.slice(0, 4)}`} />
                ))}
              </CardRow>
            </Section>
          )}
          {data.playlists.length > 0 && (
            <Section title="Playlists">
              <ul className="grid gap-2 md:grid-cols-2">
                {data.playlists.map((p) => (
                  <li key={p.id}>
                    <Link href={`/playlists/${p.id}`} className="flex items-center gap-3 rounded-xl border border-white/5 bg-surface p-3 transition hover:border-gold/40">
                      <ListMusic className="text-gold" size={20} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-white">{p.name}</span>
                        <span className="block text-xs text-secondary">{p.songCount} songs · by {p.ownerName}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {data.lyrics.length > 0 && (
            <Section title="In lyrics">
              <ul className="space-y-2">
                {data.lyrics.map((l) => (
                  <li key={l.song.id}>
                    <Link href={`/songs/${l.song.id}#comments`} className="block rounded-xl border border-white/5 bg-surface p-4 transition hover:border-gold/40">
                      <span className="flex items-center gap-2 text-sm text-white"><Mic2 size={14} className="text-gold" /> {l.song.title} <span className="text-secondary">· {l.song.artistName}</span></span>
                      <span className="mt-1 block text-sm italic text-white/70">“…{l.snippet}…”</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}
      {searching && data && !hasAny && <div className="mt-6 flex justify-center"><Button variant="ghost" size="sm" onClick={() => setInput("")}>Clear search</Button></div>}
    </div>
  );
}

function Chip({ children, active, onClick, tone = "genre" }: { children: React.ReactNode; active?: boolean; onClick: () => void; tone?: "genre" | "mood" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 rounded-full border px-4 py-1.5 text-xs capitalize transition duration-200",
        active ? "border-gold bg-gold/15 text-gold-highlight shadow-gold" : tone === "mood" ? "border-white/10 text-white/70 hover:border-gold/40" : "border-white/10 text-white/70 hover:border-gold/40 hover:text-gold",
      )}
    >
      {children}
    </button>
  );
}
