"use client";

import { useSupabaseAuth } from "~/hooks/useSupabaseAuth";
import { api } from "~/trpc/react";
import type { SubscriptionTier } from "~/types";

export function useSubscription() {
  const { user } = useSupabaseAuth();

  const { data, isLoading, refetch } = api.subscription.getSubscription.useQuery(
    { userId: user?.id ?? "" },
    { enabled: !!user?.id },
  );

  const tier: SubscriptionTier = data?.tier ?? "free";

  return {
    // Core subscription data
    tier,
    status: data?.status ?? "active",
    isLoading,
    refetch,

    // Usage stats
    usage: data?.usage ?? {
      productCount: 0,
      productLimit: 100,
      dailyScanCount: 0,
      dailyScanLimit: 0,
    },

    // Feature flags
    features: data?.features ?? {
      canCameraScan: false,
      canCustomCategories: false,
      canCommunityDb: false,
      canPrioritySupport: false,
    },

    // Convenience booleans
    canCreateProduct:
      (data?.usage.productCount ?? 0) < (data?.usage.productLimit ?? 100),
    canCameraScan:
      (data?.features.canCameraScan ?? false) &&
      ((data?.usage.dailyScanLimit ?? 0) === Infinity ||
        (data?.usage.dailyScanCount ?? 0) < (data?.usage.dailyScanLimit ?? 0)),
    canCustomCategories: data?.features.canCustomCategories ?? false,
    isFree: tier === "free",
    isStarter: tier === "starter",
    isPro: tier === "professional",

    // Subscription metadata
    cancelAtPeriodEnd: data?.cancelAtPeriodEnd ?? false,
    currentPeriodEnd: data?.currentPeriodEnd ?? null,
  };
}
