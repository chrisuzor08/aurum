import { AuthForm } from "@/components/auth/AuthForm";

export const metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  return <AuthForm mode="register" next={sp.next} />;
}
