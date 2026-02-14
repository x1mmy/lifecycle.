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
      const plan = getPlanConfig(input.tier);
      const priceId = plan.stripePriceIds[input.interval];

      if (!priceId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid plan configuration",
        });
      }

      // Get or create Stripe customer
      const { data: sub } = await supabaseAdmin
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", input.userId)
        .single();

      let customerId = sub?.stripe_customer_id;

      if (!customerId) {
        // Get user email for Stripe customer
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

        await supabaseAdmin
          .from("subscriptions")
          .update({ stripe_customer_id: customerId })
          .eq("user_id", input.userId);
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${APP_URL}/settings?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${APP_URL}/pricing`,
        metadata: { userId: input.userId },
      });

      return { url: session.url };
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

      const subscription = await stripe.subscriptions.retrieve(
        session.subscription as string,
      );

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
