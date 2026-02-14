import Stripe from "stripe";
import { env } from "~/env";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-01-28.clover",
  typescript: true,
});

export type SubscriptionTier = "free" | "starter" | "professional";
export type SubscriptionStatus =
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "trialing"
  | "unpaid"
  | "paused";

export const PLAN_CONFIG = {
  free: {
    name: "Free",
    productLimit: 100,
    cameraScanLimit: 0,
    canCameraScan: false,
    canCustomCategories: false,
    canCommunityDb: false,
    canPrioritySupport: false,
    monthlyPrice: 0,
    yearlyPrice: 0,
    stripePriceIds: {
      monthly: null,
      yearly: null,
    },
  },
  starter: {
    name: "Starter",
    productLimit: 500,
    cameraScanLimit: 25,
    canCameraScan: true,
    canCustomCategories: true,
    canCommunityDb: true,
    canPrioritySupport: false,
    monthlyPrice: 12,
    yearlyPrice: 120,
    stripePriceIds: {
      monthly: env.STRIPE_STARTER_MONTHLY_PRICE_ID,
      yearly: env.STRIPE_STARTER_YEARLY_PRICE_ID,
    },
  },
  professional: {
    name: "Professional",
    productLimit: 3000,
    cameraScanLimit: Infinity,
    canCameraScan: true,
    canCustomCategories: true,
    canCommunityDb: true,
    canPrioritySupport: true,
    monthlyPrice: 29,
    yearlyPrice: 290,
    stripePriceIds: {
      monthly: env.STRIPE_PRO_MONTHLY_PRICE_ID,
      yearly: env.STRIPE_PRO_YEARLY_PRICE_ID,
    },
  },
} as const;

export function getTierFromPriceId(priceId: string): SubscriptionTier {
  if (
    priceId === PLAN_CONFIG.starter.stripePriceIds.monthly ||
    priceId === PLAN_CONFIG.starter.stripePriceIds.yearly
  ) {
    return "starter";
  }
  if (
    priceId === PLAN_CONFIG.professional.stripePriceIds.monthly ||
    priceId === PLAN_CONFIG.professional.stripePriceIds.yearly
  ) {
    return "professional";
  }
  return "free";
}

export function getPlanConfig(tier: SubscriptionTier) {
  return PLAN_CONFIG[tier];
}
