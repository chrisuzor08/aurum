import { TrackListView } from "@/components/library/TrackListView";
import { PageHeader } from "@/components/common/ui";
import { requirePageUser } from "@/lib/auth";

export const metadata = { title: "Listening History" };

export default async function HistoryPage() {
  await requirePageUser("/history");
  return (
    <>
      <PageHeader eyebrow="Your library" title="Listening History" description="Your recent plays, newest first. Only you can see this." />
      <TrackListView kind="history" showPlayed emptyTitle="No listening history yet" emptyText="Songs you play for at least 30 seconds appear here." />
    </>
  );
}
