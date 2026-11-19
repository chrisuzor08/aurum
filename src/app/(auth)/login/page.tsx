import { AuthForm } from "@/components/auth/AuthForm";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  if (await getCurrentUser()) redirect(sp.next && sp.next.startsWith("/") ? sp.next : "/");
  return <AuthForm mode="login" next={sp.next} />;
}
