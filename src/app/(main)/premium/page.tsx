import { PremiumView } from "@/components/premium/PremiumView";
import { getCurrentUser } from "@/lib/auth";
import { isPremiumActive } from "@/lib/entitlements";
import { paystackConfigured, PLANS } from "@/lib/billing";

export const metadata = { title: "Premium" };

export default async function PremiumPage() {
  const user = await getCurrentUser();
  return (
    <PremiumView
      signedIn={Boolean(user)}
      isPremium={isPremiumActive(user)}
      premiumExpiresAt={user?.premiumExpiresAt ?? null}
      paystackLive={paystackConfigured()}
      plans={{ monthly: PLANS.monthly.amountMinor, yearly: PLANS.yearly.amountMinor }}
    />
  );
}
