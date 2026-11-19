"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/common/ui";
import { Field } from "@/components/library/PlaylistsView";
import { api } from "@/services/api";

export type AuthMode = "login" | "register" | "forgot" | "reset";

const COPY: Record<AuthMode, { title: string; subtitle: string; cta: string }> = {
  login: { title: "Welcome back", subtitle: "Sign in to continue your listening.", cta: "Sign in" },
  register: { title: "Create your AURUM", subtitle: "Join the most considered music platform.", cta: "Create account" },
  forgot: { title: "Reset your password", subtitle: "We’ll send you a secure link to choose a new one.", cta: "Send reset link" },
  reset: { title: "Choose a new password", subtitle: "Use at least 8 characters.", cta: "Update password" },
};

export function AuthForm({ mode, next, token }: { mode: AuthMode; next?: string; token?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<{ message: string; devLink?: string } | null>(null);
  const copy = COPY[mode];
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") {
        const res = await api<{ onboardingDone: boolean }>("/api/auth/login", { method: "POST", json: { email, password } });
        router.replace(res.onboardingDone ? safeNext : "/onboarding");
        router.refresh();
      } else if (mode === "register") {
        await api("/api/auth/register", { method: "POST", json: { email, password, username } });
        router.replace("/onboarding");
        router.refresh();
      } else if (mode === "forgot") {
        const res = await api<{ message: string; devLink?: string }>("/api/auth/forgot", { method: "POST", json: { email } });
        setInfo(res);
      } else {
        await api("/api/auth/reset", { method: "POST", json: { token, password } });
        setInfo({ message: "Your password has been updated. You can sign in now." });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.2),transparent_60%)]" aria-hidden />
      <div className="relative w-full max-w-md">
        <Link href="/" className="font-display mb-10 block text-center text-3xl tracking-[0.3em] text-gold-gradient">AURUM</Link>
        <div className="rounded-3xl border border-gold/15 bg-surface p-7 shadow-gold-lg md:p-9">
          <h1 className="font-display text-3xl">{copy.title}</h1>
          <p className="mt-2 text-sm text-secondary">{copy.subtitle}</p>

          {info ? (
            <div className="mt-6 space-y-4">
              <p role="status" className="rounded-xl border border-gold/30 bg-gold/5 p-4 text-sm text-gold-highlight">{info.message}</p>
              {info.devLink && (
                <p className="break-all rounded-xl border border-dashed border-white/15 p-3 text-xs text-secondary">
                  Development link: <a className="text-gold underline" href={info.devLink}>{info.devLink}</a>
                </p>
              )}
              <Link href="/login"><Button variant="outline" className="w-full">Back to sign in</Button></Link>
            </div>
          ) : (
            <form className="mt-7 space-y-4" onSubmit={submit} noValidate={false}>
              {mode === "register" && (
                <Field label="Username">
                  <input required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} className="input" placeholder="your_name" />
                </Field>
              )}
              {(mode === "login" || mode === "register" || mode === "forgot") && (
                <Field label="Email">
                  <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="you@example.com" />
                </Field>
              )}
              {(mode === "login" || mode === "register" || mode === "reset") && (
                <Field label={mode === "reset" ? "New password" : "Password"}>
                  <input
                    type="password"
                    required
                    minLength={mode === "login" ? 1 : 8}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input"
                  />
                </Field>
              )}
              {mode === "login" && (
                <div className="flex justify-end">
                  <Link href="/forgot-password" className="text-xs text-secondary hover:text-gold">Forgot password?</Link>
                </div>
              )}
              {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/5 p-3 text-sm text-red-300">{error}</p>}
              <Button type="submit" size="lg" className="w-full" disabled={busy || (mode === "reset" && !token)}>
                {busy ? "Please wait…" : copy.cta}
              </Button>
            </form>
          )}

          <p className="mt-7 text-center text-sm text-secondary">
            {mode === "login" && (
              <>New to AURUM? <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-gold hover:underline">Create an account</Link></>
            )}
            {mode === "register" && (
              <>Already have an account? <Link href="/login" className="text-gold hover:underline">Sign in</Link></>
            )}
            {(mode === "forgot" || mode === "reset") && <Link href="/login" className="text-gold hover:underline">Back to sign in</Link>}
          </p>
        </div>
        <p className="mt-6 text-center text-xs text-secondary">By continuing you agree to AURUM’s terms and privacy policy.</p>
      </div>
    </div>
  );
}
