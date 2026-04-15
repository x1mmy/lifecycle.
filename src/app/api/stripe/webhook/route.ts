import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe, getTierFromPriceId } from "~/lib/stripe";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function getPeriodDates(sub: Stripe.Subscription) {
  return {
    current_period_start: new Date(sub.start_date * 1000).toISOString(),
    current_period_end: sub.cancel_at
      ? new Date(sub.cancel_at * 1000).toISOString()
      : null,
  };
}

function getSubscriptionIdFromInvoice(
  invoice: Stripe.Invoice,
): string | null {
  const subDetails = invoice.parent?.subscription_details;
  if (!subDetails) return null;
  return typeof subDetails.subscription === "string"
    ? subDetails.subscription
    : subDetails.subscription?.id ?? null;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature verification failed:", message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription" || !session.subscription) break;

        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string,
        );
        const userId = session.metadata?.userId;
        if (!userId) {
          console.error("No userId in checkout session metadata");
          break;
        }

        const priceId = subscription.items.data[0]?.price.id;
        if (!priceId) break;
        const tier = getTierFromPriceId(priceId);
        const periods = getPeriodDates(subscription);

        await supabaseAdmin.from("subscriptions").upsert(
          {
            user_id: userId,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subscription.id,
            tier,
            status: subscription.status as string,
            current_period_start: periods.current_period_start,
            current_period_end: periods.current_period_end,
            cancel_at_period_end: subscription.cancel_at_period_end,
          },
          { onConflict: "user_id" },
        );
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const priceId = subscription.items.data[0]?.price.id;
        if (!priceId) break;
        const tier = getTierFromPriceId(priceId);
        const periods = getPeriodDates(subscription);

        await supabaseAdmin
          .from("subscriptions")
          .update({
            tier,
            status: subscription.status as string,
            current_period_start: periods.current_period_start,
            current_period_end: periods.current_period_end,
            cancel_at_period_end: subscription.cancel_at_period_end,
          })
          .eq("stripe_subscription_id", subscription.id);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await supabaseAdmin
          .from("subscriptions")
          .update({
            tier: "free",
            status: "canceled",
            stripe_subscription_id: null,
            cancel_at_period_end: false,
            current_period_start: null,
            current_period_end: null,
          })
          .eq("stripe_subscription_id", subscription.id);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = getSubscriptionIdFromInvoice(invoice);
        if (subscriptionId) {
          await supabaseAdmin
            .from("subscriptions")
            .update({ status: "past_due" })
            .eq("stripe_subscription_id", subscriptionId);
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }
}
