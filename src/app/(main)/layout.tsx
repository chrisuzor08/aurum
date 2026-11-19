import type { ReactNode } from "react";
import { AppShell, type ShellUser } from "@/components/navigation/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { isPremiumActive } from "@/lib/entitlements";

export default async function MainLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const shell: ShellUser | null = user
    ? { username: user.username, avatarUrl: user.avatarUrl, isPremium: isPremiumActive(user), role: user.role }
    : null;
  return <AppShell user={shell}>{children}</AppShell>;
}
