import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications, paymentEvents, profiles, subscriptions } from "@/db/schema";

/**
 * Billing architecture.
 *  - Checkout creates a PENDING subscription row (server-side) with a unique reference.
 *  - Money is confirmed ONLY by the payment provider: Paystack webhook (HMAC-SHA512 signed),
 *    or the verify endpoint called server-to-server with the secret key.
 *  - Only `activateSubscription()` flips profiles.is_premium, and it is called from trusted server code.
 *  - Without PAYSTACK_SECRET_KEY the app runs a clearly-labelled MOCK provider so the flow can be demonstrated.
 */
export const PLANS = {
  monthly: { label: "Monthly", amountMinor: 500000, days: 30, currency: "NGN" }, // NGN 5,000
  yearly: { label: "Yearly", amountMinor: 5000000, days: 365, currency: "NGN" }, // NGN 50,000
} as const;
export type PlanKey = keyof typeof PLANS;

export const paystackConfigured = () => Boolean(process.env.PAYSTACK_SECRET_KEY);

export async function createPendingSubscription(userId: string, plan: PlanKey) {
  const cfg = PLANS[plan];
  const reference = `aurum_${plan}_${randomUUID()}`;
  const [row] = await db
    .insert(subscriptions)
    .values({
      userId,
      plan,
      status: "pending",
      amountMinor: cfg.amountMinor,
      currency: cfg.currency,
      provider: paystackConfigured() ? "paystack" : "mock",
      providerReference: reference,
    })
    .returning();
  return row!;
}

/** Calls Paystack's initialize endpoint (server-side, secret key never leaves the server). */
export async function initializePaystack(email: string, reference: string, amountMinor: number, currency: string, callbackUrl: string) {
  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, amount: amountMinor, currency, reference, callback_url: callbackUrl }),
  });
  const json = (await res.json()) as { status: boolean; message: string; data?: { authorization_url: string } };
  if (!res.ok || !json.status || !json.data) throw new Error(`Paystack initialize failed: ${json.message}`);
  return json.data.authorization_url;
}

/** Verifies Paystack's x-paystack-signature header (HMAC-SHA512 of the raw body with the secret key). */
export function verifyPaystackSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !signature) return false;
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The ONLY code path that grants premium. Idempotent: replaying the same reference is a no-op.
 * Validates amount/currency against the stored subscription before activating.
 */
export async function activateSubscription(reference: string, paidMinor: number, currency: string, provider: string, eventId: string, rawEvent: unknown) {
  return db.transaction(async (tx) => {
    await tx.insert(paymentEvents).values({ provider, eventId, eventType: "charge.success", payload: rawEvent as object }).onConflictDoNothing();
    const [sub] = await tx.select().from(subscriptions).where(eq(subscriptions.providerReference, reference)).for("update");
    if (!sub) throw new Error("Unknown payment reference");
    if (sub.status === "active") return sub; // idempotent
    if (paidMinor < sub.amountMinor || currency !== sub.currency) throw new Error("Amount or currency mismatch");

    const plan = PLANS[sub.plan as PlanKey];
    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + plan.days * 24 * 60 * 60 * 1000);
    const [updated] = await tx
      .update(subscriptions)
      .set({ status: "active", startedAt, endsAt, updatedAt: startedAt })
      .where(eq(subscriptions.id, sub.id))
      .returning();

    // Extend from the later of now or current expiry.
    const [profile] = await tx.select().from(profiles).where(eq(profiles.id, sub.userId)).for("update");
    const base = profile?.premiumExpiresAt && profile.premiumExpiresAt > startedAt ? profile.premiumExpiresAt : startedAt;
    const newExpiry = new Date(base.getTime() + plan.days * 24 * 60 * 60 * 1000);
    await tx.execute(sql`SELECT set_config('app.service_role', 'on', true)`);
    await tx.update(profiles).set({ isPremium: true, premiumExpiresAt: newExpiry, updatedAt: startedAt }).where(eq(profiles.id, sub.userId));
    await tx.insert(notifications).values({
      userId: sub.userId,
      type: "subscription",
      title: "Welcome to AURUM Premium",
      body: `Your ${plan.label.toLowerCase()} plan is active. Enjoy ad-free, offline and high-fidelity listening.`,
      link: "/premium",
    });
    return updated!;
  });
}

export async function latestSubscription(userId: string) {
  const rows = await db.select().from(subscriptions).where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active"))).orderBy(desc(subscriptions.endsAt)).limit(1);
  return rows[0] ?? null;
}
