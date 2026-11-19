import { AuthForm } from "@/components/auth/AuthForm";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return <AuthForm mode="forgot" />;
}
