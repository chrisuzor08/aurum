import { AuthForm } from "@/components/auth/AuthForm";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const sp = await searchParams;
  return <AuthForm mode="reset" token={sp.token ?? ""} />;
}
