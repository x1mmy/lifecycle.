"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X as XIcon } from "lucide-react";
import Link from "next/link";
import { useSupabaseAuth } from "~/hooks/useSupabaseAuth";
import { useSubscription } from "~/hooks/useSubscription";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Header } from "~/components/layout/Header";
import { useToast } from "~/hooks/use-toast";

const plans = [
  {
    tier: "free" as const,
    name: "Free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      { name: "Up to 100 products", included: true },
      { name: "Barcode entry (typed)", included: true },
      { name: "Camera scanning", included: false },
      { name: "Public API database (Open Food Facts)", included: true },
      { name: "Community database", included: false },
      { name: "Pre-set categories only", included: true },
      { name: "Email notifications", included: true },
      { name: "Priority support", included: false },
    ],
  },
  {
    tier: "starter" as const,
    name: "Starter",
    monthlyPrice: 12,
    yearlyPrice: 120,
    features: [
      { name: "Up to 500 products", included: true },
      { name: "Barcode entry (typed)", included: true },
      { name: "Camera scanning (25/day)", included: true },
      { name: "Public API database (Open Food Facts)", included: true },
      { name: "Community database", included: true },
      { name: "Custom categories", included: true },
      { name: "Email notifications", included: true },
      { name: "Priority support", included: false },
    ],
  },
  {
    tier: "professional" as const,
    name: "Professional",
    monthlyPrice: 29,
    yearlyPrice: 290,
    features: [
      { name: "Up to 3,000 products", included: true },
      { name: "Barcode entry (typed)", included: true },
      { name: "Camera scanning (unlimited)", included: true },
      { name: "Public API database (Open Food Facts)", included: true },
      { name: "Community database + priority entries", included: true },
      { name: "Custom categories", included: true },
      { name: "Email notifications", included: true },
      { name: "Priority support", included: true },
    ],
  },
];

export default function PricingPage() {
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");
  const { user, isAuthenticated } = useSupabaseAuth();
  const { tier: currentTier, refetch } = useSubscription();
  const createCheckout = api.subscription.createCheckoutSession.useMutation();
  const router = useRouter();
  const { toast } = useToast();

  const handleUpgrade = async (tier: "starter" | "professional") => {
    if (!user?.id) return;

    try {
      const result = await createCheckout.mutateAsync({
        userId: user.id,
        tier,
        interval: billingInterval,
      });

      if (result.updated) {
        // Plan was changed instantly via proration (existing subscriber)
        await refetch();
        toast({
          title: "Plan updated!",
          description: `You're now on the ${result.tier ?? tier} plan. Proration applied.`,
        });
        router.push("/settings");
      } else if (result.url) {
        // New subscriber — redirect to Stripe checkout
        window.location.href = result.url;
      }
    } catch (error) {
      console.error("Checkout error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {isAuthenticated && <Header />}

      <main className="container mx-auto max-w-6xl px-4 py-12">
        <div className="mb-12 text-center">
          <h1 className="mb-3 text-4xl font-bold text-gray-900">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-gray-500">
            Choose the plan that fits your business
          </p>

          {/* Billing Toggle */}
          <div className="mt-8 flex items-center justify-center gap-3">
            <span
              className={`text-sm font-medium ${billingInterval === "monthly" ? "text-gray-900" : "text-gray-500"}`}
            >
              Monthly
            </span>
            <button
              onClick={() =>
                setBillingInterval(billingInterval === "monthly" ? "yearly" : "monthly")
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                billingInterval === "yearly" ? "bg-[#059669]" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                  billingInterval === "yearly" ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <span
              className={`text-sm font-medium ${billingInterval === "yearly" ? "text-gray-900" : "text-gray-500"}`}
            >
              Yearly
              <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                Save ~17%
              </span>
            </span>
          </div>
        </div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = isAuthenticated && currentTier === plan.tier;
            const price = billingInterval === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
            const isPopular = plan.tier === "starter";

            return (
              <div
                key={plan.tier}
                className={`relative rounded-2xl border bg-white p-8 shadow-sm ${
                  isPopular
                    ? "border-[#10B981] ring-2 ring-[#10B981]/20"
                    : "border-gray-200"
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#059669] px-4 py-1 text-xs font-medium text-white">
                    Most Popular
                  </div>
                )}

                <h3 className="text-xl font-semibold text-gray-900">{plan.name}</h3>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-gray-900">
                    ${price}
                  </span>
                  {price > 0 && (
                    <span className="text-sm text-gray-500">
                      /{billingInterval === "monthly" ? "mo" : "yr"}
                    </span>
                  )}
                </div>

                <ul className="mt-8 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature.name} className="flex items-start gap-3">
                      {feature.included ? (
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#10B981]" />
                      ) : (
                        <XIcon className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" />
                      )}
                      <span
                        className={`text-sm ${feature.included ? "text-gray-700" : "text-gray-400"}`}
                      >
                        {feature.name}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-8">
                  {isCurrent ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : plan.tier === "free" ? (
                    isAuthenticated ? (
                      <Button variant="outline" className="w-full" disabled>
                        {currentTier === "free" ? "Current Plan" : "Downgrade via billing portal"}
                      </Button>
                    ) : (
                      <Link href="/signup">
                        <Button variant="outline" className="w-full">
                          Get Started
                        </Button>
                      </Link>
                    )
                  ) : (
                    <Button
                      className="w-full bg-[#059669] hover:bg-[#047857]"
                      onClick={() => handleUpgrade(plan.tier)}
                      disabled={createCheckout.isPending || !isAuthenticated}
                    >
                      {!isAuthenticated
                        ? "Sign up to upgrade"
                        : createCheckout.isPending
                          ? "Redirecting..."
                          : "Upgrade"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
