import Link from "next/link";
import { Download, Heart, History, ListMusic, Users } from "lucide-react";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requirePageUser } from "@/lib/auth";
import { AlbumCard } from "@/components/music/MusicCards";
import { CardRow } from "@/components/common/CardRow";
import { PageHeader, Section } from "@/components/common/ui";

export const metadata = { title: "Library" };

export default async function LibraryPage() {
  const user = await requirePageUser("/library");
  const saved = await db.execute<{ id: string; title: string; cover_url: string | null; artist_name: string }>(sql`
    SELECT al.id, al.title, al.cover_url, a.name AS artist_name
    FROM album_saves sv JOIN albums al ON al.id = sv.album_id JOIN artists a ON a.id = al.artist_id
    WHERE sv.user_id = ${user.id}::uuid ORDER BY sv.created_at DESC LIMIT 20`);
  const hub = [
    { href: "/liked", label: "Liked Songs", icon: Heart },
    { href: "/playlists", label: "My Playlists", icon: ListMusic },
    { href: "/following", label: "Followed Artists", icon: Users },
    { href: "/downloads", label: "Downloads", icon: Download },
    { href: "/history", label: "Listening History", icon: History },
  ];
  return (
    <>
      <PageHeader eyebrow="Your library" title="Library" description={`Everything you’ve saved, ${user.displayName || user.username}.`} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {hub.map((h) => (
          <Link key={h.href} href={h.href} className="group flex flex-col gap-4 rounded-2xl border border-white/5 bg-surface p-5 transition duration-300 hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-gold">
            <h.icon size={22} className="text-gold" />
            <span className="text-sm font-medium text-white group-hover:text-gold">{h.label}</span>
          </Link>
        ))}
      </div>
      <Section title="Saved Albums" id="saved-albums">
        {saved.rows.length === 0 ? (
          <p className="text-sm text-secondary">Albums you save appear here. Open any album and tap <span className="text-gold">Save</span>.</p>
        ) : (
          <CardRow label="Saved albums">
            {saved.rows.map((a) => (
              <AlbumCard key={a.id} id={a.id} title={a.title} coverUrl={a.cover_url} artistName={a.artist_name} />
            ))}
          </CardRow>
        )}
      </Section>
    </>
  );
}
