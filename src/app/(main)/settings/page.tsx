import { SettingsPanel } from "@/components/profile/ProfileView";
import { PageHeader } from "@/components/common/ui";
import { requirePageUser } from "@/lib/auth";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requirePageUser("/settings");
  return (
    <>
      <PageHeader eyebrow="Account" title="Settings" description="Playback, plan and account controls." />
      <SettingsPanel />
    </>
  );
}
