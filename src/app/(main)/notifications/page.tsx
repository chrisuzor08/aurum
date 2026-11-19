import { NotificationsView } from "@/components/library/NotificationsView";
import { PageHeader } from "@/components/common/ui";
import { requirePageUser } from "@/lib/auth";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  await requirePageUser("/notifications");
  return (
    <>
      <PageHeader eyebrow="Activity" title="Notifications" description="New releases from artists you follow, playlist activity, subscription updates and announcements." />
      <NotificationsView />
    </>
  );
}
