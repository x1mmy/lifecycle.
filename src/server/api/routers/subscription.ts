import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { supabaseAdmin } from "~/lib/supabase-admin";
import {
  stripe,
  getPlanConfig,
  getTierFromPriceId,
  type SubscriptionTier,
} from "~/lib/stripe";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const subscriptionRouter = createTRPCRouter({
  getSubscription: publicProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .query(async ({ input }) => {
      // Get subscription
      const { data: sub } = await supabaseAdmin
        .from("subscriptions")
        .select("*")
        .eq("user_id", input.userId)
        .single();

      const tier: SubscriptionTier = (sub?.tier as SubscriptionTier) ?? "free";
      const plan = getPlanConfig(tier);

      // Get product count
      const { count: productCount } = await supabaseAdmin
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("user_id", input.userId);

      // Get today's scan count
      const today = new Date().toISOString().split("T")[0];
      const { data: scanData } = await supabaseAdmin
        .from("daily_scan_counts")
        .select("scan_count")
        .eq("user_id", input.userId)
        .eq("scan_date", today)
        .single();

      return {
        tier,
        status: sub?.status ?? "active",
        stripeCustomerId: sub?.stripe_customer_id ?? null,
        stripeSubscriptionId: sub?.stripe_subscription_id ?? null,
        currentPeriodStart: sub?.current_period_start ?? null,
        currentPeriodEnd: sub?.current_period_end ?? null,
        cancelAtPeriodEnd: sub?.cancel_at_period_end ?? false,
        usage: {
          productCount: productCount ?? 0,
          productLimit: plan.productLimit,
          dailyScanCount: scanData?.scan_count ?? 0,
          dailyScanLimit: plan.cameraScanLimit,
        },
        features: {
          canCameraScan: plan.canCameraScan,
          canCustomCategories: plan.canCustomCategories,
          canCommunityDb: plan.canCommunityDb,
          canPrioritySupport: plan.canPrioritySupport,
        },
      };
    }),

  createCheckoutSession: publicProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        tier: z.enum(["starter", "professional"]),
        interval: z.enum(["monthly", "yearly"]),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const plan = getPlanConfig(input.tier);
        const priceId = plan.stripePriceIds[input.interval];

        console.log("[createCheckout] tier:", input.tier, "interval:", input.interval, "priceId:", priceId);

        if (!priceId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid plan configuration",
          });
        }

        // Check for existing subscription
        const { data: sub } = await supabaseAdmin
          .from("subscriptions")
          .select("stripe_customer_id, stripe_subscription_id")
          .eq("user_id", input.userId)
          .maybeSingle();

        let customerId = sub?.stripe_customer_id;
        console.log("[createCheckout] existing customerId:", customerId, "existing subId:", sub?.stripe_subscription_id);

        // If user already has an active Stripe subscription, update it with proration
        if (customerId && sub?.stripe_subscription_id) {
          try {
            const existingSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);

            if (existingSub.status === "active" || existingSub.status === "trialing") {
              const itemId = existingSub.items.data[0]?.id;
              if (itemId) {
                // Update the subscription in place — Stripe handles proration automatically
                const updatedSub = await stripe.subscriptions.update(sub.stripe_subscription_id, {
                  items: [{ id: itemId, price: priceId }],
                  proration_behavior: "create_prorations",
                });

                const newPriceId = updatedSub.items.data[0]?.price.id;
                const newTier = newPriceId ? getTierFromPriceId(newPriceId) : input.tier;

                // Update database
                await supabaseAdmin
                  .from("subscriptions")
                  .update({
                    tier: newTier,
                    status: updatedSub.status as string,
                  })
                  .eq("user_id", input.userId);

                console.log("[createCheckout] updated existing subscription to", newTier);

                // Return null url to signal the pricing page that the change was instant
                return { url: null, updated: true, tier: newTier };
              }
            }
          } catch (err) {
            // Existing subscription may be invalid/cancelled — fall through to new checkout
            console.error("[createCheckout] Failed to update existing sub, creating new checkout:", err);
          }
        }

        // No existing subscription — create new checkout session
        if (!customerId) {
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("email")
            .eq("id", input.userId)
            .single();

          const customer = await stripe.customers.create({
            email: profile?.email,
            metadata: { userId: input.userId },
          });
          customerId = customer.id;
          console.log("[createCheckout] created new customer:", customerId);

          await supabaseAdmin
            .from("subscriptions")
            .upsert(
              {
                user_id: input.userId,
                stripe_customer_id: customerId,
                tier: "free",
                status: "active",
              },
              { onConflict: "user_id" },
            );
        }

        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          mode: "subscription",
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: `${APP_URL}/settings?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${APP_URL}/pricing`,
          metadata: { userId: input.userId },
        });

        console.log("[createCheckout] session created, url:", session.url);

        return { url: session.url, updated: false, tier: null };
      } catch (error) {
        console.error("[createCheckout] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to create checkout session",
        });
      }
    }),

  createPortalSession: publicProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const { data: sub } = await supabaseAdmin
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", input.userId)
        .single();

      if (!sub?.stripe_customer_id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No billing account found",
        });
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        return_url: `${APP_URL}/settings`,
      });

      return { url: session.url };
    }),

  verifyCheckoutSession: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        userId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input }) => {
      const session = await stripe.checkout.sessions.retrieve(input.sessionId);

      if (session.payment_status !== "paid" || !session.subscription) {
        return { success: false };
      }

      // Verify the session belongs to this user
      if (session.metadata?.userId !== input.userId) {
        return { success: false };
      }

      const newSubscriptionId = session.subscription as string;

      // Cancel any existing subscription before activating the new one
      const { data: existingSub } = await supabaseAdmin
        .from("subscriptions")
        .select("stripe_subscription_id")
        .eq("user_id", input.userId)
        .single();

      if (
        existingSub?.stripe_subscription_id &&
        existingSub.stripe_subscription_id !== newSubscriptionId
      ) {
        try {
          await stripe.subscriptions.cancel(existingSub.stripe_subscription_id);
        } catch (err) {
          // Old subscription may already be cancelled — continue
          console.error("[verifyCheckout] Failed to cancel old subscription:", err);
        }
      }

      const subscription = await stripe.subscriptions.retrieve(newSubscriptionId);

      const priceId = subscription.items.data[0]?.price.id;
      if (!priceId) return { success: false };

      const tier = getTierFromPriceId(priceId);

      await supabaseAdmin.from("subscriptions").upsert(
        {
          user_id: input.userId,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: subscription.id,
          tier,
          status: subscription.status as string,
          current_period_start: new Date(
            subscription.start_date * 1000,
          ).toISOString(),
          current_period_end: subscription.cancel_at
            ? new Date(subscription.cancel_at * 1000).toISOString()
            : null,
          cancel_at_period_end: subscription.cancel_at_period_end,
        },
        { onConflict: "user_id" },
      );

      return { success: true, tier };
    }),

  recordScan: publicProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const today = new Date().toISOString().split("T")[0];

      const { data, error } = await supabaseAdmin.rpc("increment_scan_count", {
        p_user_id: input.userId,
        p_scan_date: today,
      });

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to record scan",
        });
      }

      return { scanCount: data as number };
    }),

  checkLimit: publicProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        feature: z.enum([
          "create_product",
          "camera_scan",
          "custom_category",
          "community_db",
        ]),
      }),
    )
    .query(async ({ input }) => {
      // Get subscription
      const { data: sub } = await supabaseAdmin
        .from("subscriptions")
        .select("tier")
        .eq("user_id", input.userId)
        .single();

      const tier: SubscriptionTier =
        (sub?.tier as SubscriptionTier) ?? "free";
      const plan = getPlanConfig(tier);

      switch (input.feature) {
        case "create_product": {
          const { count } = await supabaseAdmin
            .from("products")
            .select("*", { count: "exact", head: true })
            .eq("user_id", input.userId);
          return {
            allowed: (count ?? 0) < plan.productLimit,
            current: count ?? 0,
            limit: plan.productLimit,
            tier,
          };
        }
        case "camera_scan": {
          if (!plan.canCameraScan) {
            return { allowed: false, current: 0, limit: 0, tier };
          }
          const today = new Date().toISOString().split("T")[0];
          const { data: scanData } = await supabaseAdmin
            .from("daily_scan_counts")
            .select("scan_count")
            .eq("user_id", input.userId)
            .eq("scan_date", today)
            .single();
          const scanCount = scanData?.scan_count ?? 0;
          return {
            allowed:
              plan.cameraScanLimit === Infinity ||
              scanCount < plan.cameraScanLimit,
            current: scanCount,
            limit: plan.cameraScanLimit,
            tier,
          };
        }
        case "custom_category":
          return {
            allowed: plan.canCustomCategories,
            current: 0,
            limit: plan.canCustomCategories ? Infinity : 0,
            tier,
          };
        case "community_db":
          return {
            allowed: plan.canCommunityDb,
            current: 0,
            limit: plan.canCommunityDb ? Infinity : 0,
            tier,
          };
      }
    }),
});
