import Link from "next/link";
import { Crown, Download } from "lucide-react";
import { TrackListView } from "@/components/library/TrackListView";
import { Button, EmptyState, PageHeader } from "@/components/common/ui";
import { requirePageUser } from "@/lib/auth";
import { isPremiumActive } from "@/lib/entitlements";

export const metadata = { title: "Downloads" };

/** Downloads are a Premium entitlement, checked on the server before the list (and the download API) is used. */
export default async function DownloadsPage() {
  const user = await requirePageUser("/downloads");
  return (
    <>
      <PageHeader eyebrow="Offline" title="Downloads" description="Tracks saved for offline listening. Available with AURUM Premium." />
      {isPremiumActive(user) ? (
        <TrackListView kind="downloads" emptyTitle="Nothing downloaded yet" emptyText="Use the download action on any track to save it for offline listening." />
      ) : (
        <EmptyState
          icon={<Crown size={28} />}
          title="Downloads are a Premium feature"
          text="Upgrade to save tracks for offline listening, with high-quality audio and no advertisements."
          action={
            <Link href="/premium">
              <Button>
                <Download size={16} /> See Premium plans
              </Button>
            </Link>
          }
        />
      )}
    </>
  );
}
