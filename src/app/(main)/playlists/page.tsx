import { PlaylistsView } from "@/components/library/PlaylistsView";
import { PageHeader } from "@/components/common/ui";
import { requirePageUser } from "@/lib/auth";

export const metadata = { title: "My Playlists" };

export default async function PlaylistsPage() {
  await requirePageUser("/playlists");
  return (
    <>
      <PageHeader eyebrow="Your library" title="My Playlists" description="Curate sequences for any mood. Make them public to share with the world." />
      <PlaylistsView />
    </>
  );
}
