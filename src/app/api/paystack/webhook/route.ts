import { activateSubscription, verifyPaystackSignature } from "@/lib/billing";

/**
 * Paystack webhook. The signature (x-paystack-signature, HMAC-SHA512 of the raw body) is verified before
 * anything is trusted. Events are idempotent: duplicate deliveries are recorded once and ignored.
 * Configure the URL in the Paystack dashboard: https://<your-domain>/api/paystack/webhook
 */
interface PaystackEvent {
  event: string;
  data: { id: number | string; reference: string; amount: number; currency: string; status: string };
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyPaystackSignature(raw, req.headers.get("x-paystack-signature"))) {
    return new Response("invalid signature", { status: 401 });
  }
  let event: PaystackEvent;
  try {
    event = JSON.parse(raw) as PaystackEvent;
  } catch {
    return new Response("bad payload", { status: 400 });
  }
  if (event.event === "charge.success" && event.data?.status === "success") {
    try {
      await activateSubscription(event.data.reference, event.data.amount, event.data.currency, "paystack", String(event.data.id), event);
    } catch (err) {
      // Acknowledge to stop retries for unrecoverable cases (unknown reference / amount mismatch); log for review.
      console.error("[paystack webhook]", (err as Error).message, event.data.reference);
    }
  }
  return new Response("ok", { status: 200 });
}
