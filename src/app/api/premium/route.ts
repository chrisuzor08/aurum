import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions, accounts } from "@/db/schema";
import { requireApiUser } from "@/lib/auth";
import { activateSubscription, createPendingSubscription, initializePaystack, paystackConfigured, PLANS, type PlanKey } from "@/lib/billing";
import { badRequest, notFound, ok, readJson, withErrors } from "@/lib/http";
import { oneOf, str } from "@/lib/validate";

/**
 * Checkout architecture:
 *  POST  -> creates a PENDING subscription and returns a checkout URL (Paystack when configured, otherwise MOCK).
 *  GET   -> verifies a reference server-to-server with Paystack (when configured) and reports status.
 *  PUT   -> MOCK provider confirmation (only when Paystack is NOT configured). Activation still goes through
 *           activateSubscription(), the same trusted function the webhook uses.
 * The browser never sets premium status directly.
 */
export const POST = withErrors(async (req) => {
  const user = await requireApiUser();
  const body = await readJson(req);
  const plan = oneOf(body.plan, ["monthly", "yearly"] as const, "plan") as PlanKey;
  const sub = await createPendingSubscription(user.id, plan);
  const cfg = PLANS[plan];

  if (paystackConfigured()) {
    const [acc] = await db.select({ email: accounts.email }).from(accounts).where(eq(accounts.id, user.id)).limit(1);
    const callback = `${new URL(req.url).origin}/premium?reference=${sub.providerReference}`;
    const url = await initializePaystack(acc!.email, sub.providerReference, cfg.amountMinor, cfg.currency, callback);
    return ok({ provider: "paystack", reference: sub.providerReference, url, mock: false });
  }
  return ok({ provider: "mock", reference: sub.providerReference, url: null, mock: true, amountMinor: cfg.amountMinor, currency: cfg.currency, plan });
});

export const GET = withErrors(async (req) => {
  const user = await requireApiUser();
  const reference = str(new URL(req.url).searchParams.get("reference"), "reference", { max: 120 });
  const [sub] = await db.select().from(subscriptions).where(and(eq(subscriptions.providerReference, reference), eq(subscriptions.userId, user.id))).limit(1);
  if (!sub) throw notFound("Checkout not found");

  if (sub.status === "pending" && paystackConfigured()) {
    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    });
    const json = (await res.json()) as { status: boolean; data?: { status: string; amount: number; currency: string; id: number } };
    if (json.status && json.data?.status === "success") {
      await activateSubscription(reference, json.data.amount, json.data.currency, "paystack", `verify_${json.data.id}`, json.data);
    }
  }
  const [fresh] = await db.select().from(subscriptions).where(eq(subscriptions.id, sub.id)).limit(1);
  return ok({ status: fresh!.status, plan: fresh!.plan, endsAt: fresh!.endsAt?.toISOString() ?? null, provider: fresh!.provider });
});

export const PUT = withErrors(async (req) => {
  const user = await requireApiUser();
  if (paystackConfigured()) throw badRequest("Mock confirmation is disabled because Paystack is configured. Complete payment with Paystack.");
  const body = await readJson(req);
  const reference = str(body.reference, "reference", { max: 120 });
  const [sub] = await db.select().from(subscriptions).where(and(eq(subscriptions.providerReference, reference), eq(subscriptions.userId, user.id))).limit(1);
  if (!sub) throw notFound("Checkout not found");
  if (sub.provider !== "mock") throw badRequest("This checkout belongs to a different provider");
  const activated = await activateSubscription(reference, sub.amountMinor, sub.currency, "mock", `mock_${reference}`, { mock: true, reference });
  return ok({ status: activated.status, plan: activated.plan, endsAt: activated.endsAt?.toISOString() ?? null, provider: "mock" });
});
