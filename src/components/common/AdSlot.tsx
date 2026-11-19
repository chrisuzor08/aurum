import Link from "next/link";
import { Crown } from "lucide-react";

/**
 * Free-tier advertisement placement. This is a house promotion (AURUM Premium), so it never leaks user data
 * to third parties. Rendered only when the server entitlement says `showAds` is true.
 */
export function AdSlot() {
  return (
    <aside aria-label="Sponsored" className="relative mb-10 overflow-hidden rounded-3xl border border-gold/20 bg-surface p-6 md:p-8">
      <span className="absolute right-4 top-4 text-[10px] uppercase tracking-[0.2em] text-secondary">Sponsored</span>
      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <Crown className="mt-1 shrink-0 text-gold" size={28} />
          <div>
            <p className="font-display text-2xl text-white">Listen without interruption.</p>
            <p className="mt-1 max-w-xl text-sm text-secondary">Ad-free music, offline downloads, high-fidelity audio, video and synced lyrics. Cancel anytime.</p>
          </div>
        </div>
        <Link href="/premium" className="inline-flex h-10 shrink-0 items-center rounded-full bg-gold-gradient px-6 text-sm font-semibold text-[#0A0A0A] shadow-gold transition hover:brightness-110">
          Try Premium
        </Link>
      </div>
    </aside>
  );
}
