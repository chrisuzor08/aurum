import { TrackListView } from "@/components/library/TrackListView";
import { PageHeader } from "@/components/common/ui";
import { requirePageUser } from "@/lib/auth";

export const metadata = { title: "Liked Songs" };

export default async function LikedPage() {
  await requirePageUser("/liked");
  return (
    <>
      <PageHeader eyebrow="Your library" title="Liked Songs" description="Every track you’ve hearted, in the order you loved it." />
      <TrackListView kind="likes" emptyTitle="No liked songs yet" emptyText="Tap the heart on any track in the player to save it here." />
    </>
  );
}
