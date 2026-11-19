import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requirePageUser } from "@/lib/auth";
import { ArtistCard } from "@/components/music/MusicCards";
import { EmptyState, PageHeader } from "@/components/common/ui";

export const metadata = { title: "Followed Artists" };

export default async function FollowingPage() {
  const user = await requirePageUser("/following");
  const res = await db.execute<{ id: string; name: string; image_url: string | null; verified: boolean; monthly_listeners: number }>(sql`
    SELECT a.id, a.name, a.image_url, a.verified, a.monthly_listeners
    FROM follows f JOIN artists a ON a.id = f.artist_id
    WHERE f.user_id = ${user.id}::uuid ORDER BY f.created_at DESC`);
  return (
    <>
      <PageHeader eyebrow="Your library" title="Followed Artists" description="You’ll be notified when they release something new." />
      {res.rows.length === 0 ? (
        <EmptyState title="You’re not following anyone yet" text="Follow artists from their page to hear about new releases first." action={<Link href="/search" className="text-sm text-gold hover:underline">Find artists</Link>} />
      ) : (
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-5">
          {res.rows.map((a) => (
            <ArtistCard key={a.id} id={a.id} name={a.name} imageUrl={a.image_url} verified={a.verified} monthlyListeners={a.monthly_listeners} />
          ))}
        </div>
      )}
    </>
  );
}
