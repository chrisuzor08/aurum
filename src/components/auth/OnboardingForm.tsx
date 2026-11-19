"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/common/ui";
import { api } from "@/services/api";
import { cn } from "@/utils/cn";

interface Option {
  value: string;
  label: string;
}

interface Props {
  genres: Option[];
  moods: Option[];
  artists: { id: string; name: string }[];
  displayName: string;
}

/** Post-registration onboarding. Saves preferences to the profile and follows the chosen artists. */
export function OnboardingForm({ genres, moods, artists, displayName }: Props) {
  const router = useRouter();
  const [picked, setPicked] = useState<{ genres: string[]; moods: string[]; artists: string[] }>({ genres: [], moods: [], artists: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (kind: keyof typeof picked, value: string) =>
    setPicked((p) => ({ ...p, [kind]: p[kind].includes(value) ? p[kind].filter((v) => v !== value) : [...p[kind], value] }));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api("/api/profile", { method: "PUT", json: picked });
      router.replace("/");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const Group = ({ title, hint, kind, options }: { title: string; hint: string; kind: keyof typeof picked; options: Option[] }) => (
    <section aria-labelledby={`g-${kind}`} className="mb-10">
      <h2 id={`g-${kind}`} className="font-display text-2xl">{title}</h2>
      <p className="mb-4 text-sm text-secondary">{hint}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = picked[kind].includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(kind, o.value)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-4 py-2 text-sm capitalize transition duration-200",
                on ? "border-gold bg-gold/15 text-gold-highlight shadow-gold" : "border-white/10 text-white/75 hover:border-gold/40 hover:text-white",
              )}
            >
              {on && <Check size={14} />} {o.label}
            </button>
          );
        })}
      </div>
    </section>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-xs uppercase tracking-[0.25em] text-gold">Step into AURUM</p>
      <h1 className="font-display mt-2 text-4xl md:text-5xl">Welcome, {displayName}.</h1>
      <p className="mt-3 max-w-xl text-secondary">Tell us what moves you. We’ll tune Home, Made For You and Search to your taste. You can change this anytime.</p>
      <div className="mt-10">
        <Group title="Favourite genres" hint="Pick as many as you like." kind="genres" options={genres} />
        <Group title="Preferred moods" hint="When do you usually listen?" kind="moods" options={moods} />
        <section aria-labelledby="g-artists" className="mb-10">
          <h2 id="g-artists" className="font-display text-2xl">Favourite artists</h2>
          <p className="mb-4 text-sm text-secondary">We’ll follow these artists for you, so new releases reach your notifications.</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {artists.map((a) => {
              const on = picked.artists.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle("artists", a.id)}
                  className={cn("flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition", on ? "border-gold bg-gold/10 text-gold-highlight" : "border-white/10 text-white/80 hover:border-gold/40")}
                >
                  {a.name}
                  {on && <Check size={14} />}
                </button>
              );
            })}
          </div>
        </section>
      </div>
      {error && <p role="alert" className="mb-4 text-sm text-red-300">{error}</p>}
      <div className="sticky bottom-24 flex flex-col gap-3 rounded-2xl border border-gold/20 bg-elevated/95 p-4 shadow-gold backdrop-blur md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-secondary">{picked.genres.length} genres · {picked.moods.length} moods · {picked.artists.length} artists</p>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={() => router.replace("/")}>Skip for now</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Continue"}</Button>
        </div>
      </div>
    </div>
  );
}
