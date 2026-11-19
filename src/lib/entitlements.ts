import type { CurrentUser, Entitlements } from "@/types";

/**
 * Centralised monetisation + premium rules.
 * Every server-side gate (video streams, downloads, skips, ads) reads from here.
 * Premium is derived from profiles.is_premium AND an unexpired premium_expires_at,
 * and profiles.is_premium is only ever written by the billing backend (webhook / verified checkout).
 */
export const FREE_SKIP_LIMIT_PER_HOUR = Number(process.env.FREE_SKIP_LIMIT_PER_HOUR ?? 6);
export const FREE_AD_EVERY_N_SECTIONS = 3;

export function isPremiumActive(user: Pick<CurrentUser, "isPremium" | "premiumExpiresAt"> | null): boolean {
  if (!user || !user.isPremium) return false;
  if (!user.premiumExpiresAt) return true;
  return new Date(user.premiumExpiresAt).getTime() > Date.now();
}

export function getEntitlements(user: CurrentUser | null): Entitlements {
  const premium = isPremiumActive(user);
  return {
    isPremium: premium,
    canStreamVideo: premium,
    canDownload: premium,
    showAds: !premium,
    skipLimitPerHour: premium ? null : FREE_SKIP_LIMIT_PER_HOUR,
  };
}
