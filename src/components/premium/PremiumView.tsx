"use client";

import Link from "next/link";
import { Check, Crown, Minus, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge, Button, ErrorState } from "@/components/common/ui";
import { api, ApiError } from "@/services/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/utils/cn";

interface Props {
  signedIn: boolean;
  isPremium: boolean;
  premiumExpiresAt: string | null;
  paystackLive: boolean;
  plans: { monthly: number; yearly: number };
}

type Plan = "monthly" | "yearly";
type Step = "plans" | "checkout" | "done";

const money = (minor: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(minor / 100);

const ROWS: { label: string; free: string | boolean; premium: string | boolean }[] = [
  { label: "Advertisements", free: "Occasional", premium: false },
  { label: "Skips", free: "Limited · 6 per hour", premium: "Unlimited" },
  { label: "Audio quality", free: "Standard", premium: "High fidelity" },
  { label: "Online streaming", free: true, premium: true },
  { label: "Basic playlists", free: true, premium: true },
  { label: "Exclusive playlists", free: false, premium: true },
  { label: "Offline downloads", free: false, premium: true },
  { label: "Video playback", free: false, premium: true },
  { label: "Synced lyrics", free: false, premium: true },
  { label: "Premium profile badge", free: false, premium: true },
];

export function PremiumView({ signedIn, isPremium, premiumExpiresAt, paystackLive, plans }: Props) {
  const [plan, setPlan] = useState<Plan>("yearly");
  const [step, setStep] = useState<Step>("plans");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [result, setResult] = useState<{ status: string; endsAt: string | null; plan: string } | null>(null);

  // Returning from Paystack (or a refresh mid-checkout): verify the reference server-side.
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("reference");
    if (!ref || !signedIn) return;
    setStep("done");
    api<{ status: string; endsAt: string | null; plan: string }>(`/api/premium?reference=${encodeURIComponent(ref)}`)
      .then((r) => setResult(r))
      .catch((e: Error) => setError(e.message));
  }, [signedIn]);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ provider: string; reference: string; url: string | null; mock: boolean }>("/api/premium", { method: "POST", json: { plan } });
      setReference(res.reference);
      if (res.provider === "paystack" && res.url) {
        window.location.href = res.url;
        return;
      }
      setStep("checkout");
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const confirmMock = async () => {
    if (!reference) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ status: string; endsAt: string | null; plan: string }>("/api/premium", { method: "PUT", json: { reference } });
      setResult(res);
      setStep("done");
      window.history.replaceState(null, "", "/premium");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const amount = plan === "monthly" ? plans.monthly : plans.yearly;

  return (
    <div className="pb-10">
      <section className="relative -mx-4 mb-10 overflow-hidden px-4 py-12 text-center md:-mx-8 md:px-8 md:py-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.22),transparent_60%)]" aria-hidden />
        <div className="relative">
          <Crown className="mx-auto text-gold" size={36} />
          <p className="mt-4 text-xs uppercase tracking-[0.3em] text-gold">AURUM Premium</p>
          <h1 className="font-display mx-auto mt-3 max-w-3xl text-4xl leading-tight md:text-6xl">
            Music, <span className="text-gold-gradient">without compromise.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-secondary">Ad-free, offline, high-fidelity, with video and synced lyrics. Crafted for listeners who notice everything.</p>
        </div>
      </section>

      {!paystackLive && (
        <div role="note" className="mx-auto mb-8 flex max-w-3xl items-start gap-3 rounded-2xl border border-gold/30 bg-gold/5 p-4 text-sm text-gold-highlight">
          <ShieldCheck size={18} className="mt-0.5 shrink-0" />
          <p>
            <strong className="font-semibold">Demonstration checkout.</strong> Payments are simulated until Paystack is configured (<code className="text-xs">PAYSTACK_SECRET_KEY</code>). Premium is still granted only by the server’s confirmation path, never by this page alone.
          </p>
        </div>
      )}

      {isPremium && step === "plans" && (
        <div className="mx-auto mb-8 max-w-3xl rounded-2xl border border-gold/40 bg-surface p-6 text-center shadow-gold">
          <Badge>Premium member</Badge>
          <p className="mt-3 font-display text-2xl">You’re all set.</p>
          {premiumExpiresAt && <p className="mt-1 text-sm text-secondary">Your membership renews through {formatDate(premiumExpiresAt)}.</p>}
        </div>
      )}

      {step === "plans" && (
        <>
          <div role="radiogroup" aria-label="Billing plan" className="mx-auto mb-8 grid max-w-3xl gap-4 md:grid-cols-2">
            {(["monthly", "yearly"] as Plan[]).map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={plan === p}
                onClick={() => setPlan(p)}
                className={cn(
                  "relative rounded-2xl border p-6 text-left transition duration-300",
                  plan === p ? "border-gold bg-elevated shadow-gold" : "border-white/10 bg-surface hover:border-gold/40",
                )}
              >
                {p === "yearly" && <span className="absolute right-4 top-4"><Badge>Save 17%</Badge></span>}
                <p className="font-display text-xl capitalize">{p}</p>
                <p className="mt-3 text-3xl font-semibold text-white">{money(p === "monthly" ? plans.monthly : plans.yearly)}</p>
                <p className="text-sm text-secondary">{p === "monthly" ? "per month" : "per year"}</p>
              </button>
            ))}
          </div>

          <div className="mx-auto flex max-w-md flex-col items-center gap-3">
            {error && <ErrorState message={error} />}
            {signedIn ? (
              !isPremium && (
                <Button size="lg" className="w-full" onClick={start} disabled={busy}>
                  {busy ? "Preparing checkout…" : `Continue · ${money(amount)}`}
                </Button>
              )
            ) : (
              <Link href="/login?next=/premium" className="inline-flex h-12 w-full items-center justify-center rounded-full bg-gold-gradient font-semibold text-[#0A0A0A] shadow-gold">
                Sign in to subscribe
              </Link>
            )}
            <p className="text-center text-xs text-secondary">Cancel anytime. Prices in Nigerian Naira (NGN).</p>
          </div>
        </>
      )}

      {step === "checkout" && (
        <div className="mx-auto max-w-md rounded-3xl border border-gold/20 bg-surface p-6 shadow-gold-lg md:p-8">
          <p className="text-xs uppercase tracking-[0.25em] text-gold">Mock checkout</p>
          <h2 className="font-display mt-2 text-2xl">Confirm your plan</h2>
          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-secondary">Plan</dt><dd className="capitalize">{plan} Premium</dd></div>
            <div className="flex justify-between"><dt className="text-secondary">Amount</dt><dd>{money(amount)}</dd></div>
            <div className="flex justify-between"><dt className="text-secondary">Reference</dt><dd className="truncate pl-4 font-mono text-xs text-secondary">{reference}</dd></div>
          </dl>
          <div className="mt-6 rounded-xl border border-dashed border-gold/40 p-3 text-xs text-gold-highlight">
            Demonstration only — no card is charged. With Paystack configured, this step redirects to Paystack and access is granted by its signed webhook.
          </div>
          <div className="mt-6 flex flex-col gap-3">
            <Button size="lg" onClick={confirmMock} disabled={busy}>
              <Check size={16} /> {busy ? "Confirming…" : "Confirm mock payment"}
            </Button>
            <Button variant="ghost" onClick={() => setStep("plans")}>Back</Button>
          </div>
          {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
        </div>
      )}

      {step === "done" && (
        <div className="mx-auto max-w-md rounded-3xl border border-gold/30 bg-surface p-8 text-center shadow-gold-lg">
          {result?.status === "active" ? (
            <>
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-gold-gradient text-[#0A0A0A] shadow-gold"><Check size={28} /></div>
              <h2 className="font-display mt-5 text-2xl">Welcome to Premium</h2>
              <p className="mt-2 text-sm text-secondary">Your {result.plan} plan is active{result.endsAt ? ` until ${formatDate(result.endsAt)}` : ""}.</p>
              <div className="mt-6 flex flex-col gap-2">
                <Link href="/"><Button className="w-full">Start listening</Button></Link>
                <Link href="/downloads" className="text-sm text-gold hover:underline">Set up offline downloads</Link>
              </div>
            </>
          ) : result ? (
            <>
              <Minus className="mx-auto text-secondary" size={32} />
              <h2 className="font-display mt-4 text-2xl">Payment pending</h2>
              <p className="mt-2 text-sm text-secondary">We haven’t received confirmation yet. This page checks again when you return.</p>
              <Button variant="outline" className="mt-6" onClick={() => window.location.reload()}>Check again</Button>
            </>
          ) : (
            <>
              <h2 className="font-display text-2xl">Checking your payment…</h2>
              {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
            </>
          )}
        </div>
      )}

      <section aria-labelledby="compare" className="mx-auto mt-16 max-w-3xl">
        <h2 id="compare" className="font-display mb-6 text-center text-2xl md:text-3xl">Compare plans</h2>
        <div className="overflow-hidden rounded-2xl border border-white/5 bg-surface">
          <div className="grid grid-cols-[1.4fr_1fr_1fr] border-b border-white/5 bg-elevated/60 px-4 py-3 text-xs uppercase tracking-widest text-secondary md:px-6">
            <span>Feature</span><span className="text-center">Free</span><span className="text-center text-gold">Premium</span>
          </div>
          {ROWS.map((r) => (
            <div key={r.label} className="grid grid-cols-[1.4fr_1fr_1fr] items-center border-b border-white/5 px-4 py-3.5 text-sm last:border-0 md:px-6">
              <span className="text-white/85">{r.label}</span>
              <Cell v={r.free} />
              <Cell v={r.premium} premium />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Cell({ v, premium }: { v: string | boolean; premium?: boolean }) {
  if (typeof v === "string") return <span className={cn("text-center text-xs md:text-sm", premium ? "text-gold-highlight" : "text-secondary")}>{v}</span>;
  return v ? <Check className={cn("mx-auto", premium ? "text-gold" : "text-white/60")} size={16} aria-label="Included" /> : <Minus className="mx-auto text-white/25" size={16} aria-label="Not included" />;
}
