import { ProfileView } from "@/components/profile/ProfileView";
import { requirePageUser } from "@/lib/auth";

export const metadata = { title: "My Profile" };

export default async function ProfilePage() {
  await requirePageUser("/profile");
  return <ProfileView />;
}
