import { useState, useEffect, useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, BadgeCheck, Eye, Loader2, MessageSquareMore, ShieldCheck, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { createManagedHostingCheckout, getBillingPaymentStatus, getCheckoutStatus, getMyHostBillingAccount, parseBillingReturnParams, startBillingPayment } from "@/lib/billing-client";
import type { HostBillingAccount } from "@/types";

type PlanTier = "standard" | "professional" | "premium";

interface PlanFeature {
  text: string;
}

interface Plan {
  id: PlanTier;
  name: string;
  price: string;
  description: string;
  bestFor: string;
  cta: string;
  badge?: string;
  tone: string;
  features: PlanFeature[];
}

interface ManagedOffer {
  id: "managed";
  name: string;
  price: string;
  description: string;
  bestFor: string;
  cta: string;
  badge?: string;
  tone: string;
  features: PlanFeature[];
}

const subscriptionPlans: Plan[] = [
  {
    id: "standard",
    name: "Standard",
    price: "R149 / month",
    description: "For hosts who want an affordable way to get listed, get seen, and start receiving direct enquiries.",
    bestFor: "Apartments, cottages, guest rooms, small BnBs, and hosts who want to test Ideal Stay without high monthly costs.",
    cta: "Start with Standard",
    tone: "border-slate-200 bg-white",
    features: [
      { text: "1 active property listing" },
      { text: "Up to 10 property photos" },
      { text: "Direct guest enquiries" },
      { text: "Host dashboard access" },
      { text: "Basic listing visibility" },
      { text: "0% booking commission" },
    ],
  },
  {
    id: "professional",
    name: "Professional",
    price: "R350 / month",
    description: "For hosts who want stronger visibility, more listing capacity, and better support in getting seen.",
    bestFor: "Hosts who want more than a basic listing and are serious about turning visibility into enquiries.",
    cta: "Get More Visibility",
    badge: "Recommended",
    tone: "border-cyan-200 bg-cyan-50/50",
    features: [
      { text: "Everything in Standard" },
      { text: "Multiple active listings" },
      { text: "Up to 20 property photos per listing" },
      { text: "Listing video support" },
      { text: "Enhanced listing placement" },
      { text: "Listing performance insights" },
      { text: "0% booking commission" },
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: "R499 / month",
    description: "For hosts who want maximum exposure, priority visibility, and faster support when competition is tighter.",
    bestFor: "Guesthouses, lodges, high-value stays, and hosts who want to stand out in competitive areas.",
    cta: "Stand Out with Premium",
    badge: "Maximum Exposure",
    tone: "border-slate-900 bg-slate-950 text-white",
    features: [
      { text: "Everything in Professional" },
      { text: "Featured listing opportunities" },
      { text: "Priority promotional placement" },
      { text: "Stronger promotional rotation" },
      { text: "Advanced performance insights" },
      { text: "Highest priority support" },
      { text: "0% booking commission" },
    ],
  },
];

const managedOffer: ManagedOffer = {
  id: "managed",
  name: "Managed Hosting",
  price: "R650 / month",
  description: "For hosts who want Ideal Stay to manage the listing work while they keep the upside of direct guest enquiries.",
  bestFor: "Busy hosts, premium homes, multi-property operators, and owners who want the visibility without carrying the day-to-day listing workload themselves.",
  cta: "Apply for Managed Hosting",
  badge: "Concierge",
  tone: "border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5_0%,#ffffff_45%,#f0fdf4_100%)]",
  features: [
    { text: "Ideal Stay manages your profile and listing operations" },
    { text: "We keep your listing polished, updated, and visible" },
    { text: "Listing-level payment instructions per property" },
    { text: "Managed support across multiple listings" },
    { text: "You get the upside without handling the admin load" },
    { text: "0% booking commission still applies" },
  ],
};

const plans = [...subscriptionPlans, managedOffer] as const;

const pressurePoints = [
  {
    icon: Wallet,
    title: "Commission pain",
    body: "Every booking should feel like income, not another deduction.",
  },
  {
    icon: ShieldCheck,
    title: "Ownership",
    body: "You own the property. You host the guests. You should keep the booking income.",
  },
  {
    icon: MessageSquareMore,
    title: "Control",
    body: "Stay in control of your guest communication, pricing, availability, and repeat bookings.",
  },
  {
    icon: Eye,
    title: "Visibility",
    body: "A beautiful property does not help if travellers never see it.",
  },
];

const valuePoints = [
  "List your property clearly and professionally",
  "Receive direct enquiries from travellers",
  "Keep control of your guest communication",
  "Keep more of your booking income",
  "Choose self-service or let Ideal Stay manage the listing work for you",
];

const faqs = [
  {
    question: "Do you take commission from bookings?",
    answer: "No. Ideal Stay takes 0% booking commission. Hosts pay a monthly subscription and keep their booking income.",
  },
  {
    question: "How do guests contact me?",
    answer: "Guests send direct enquiries through Ideal Stay so you can manage the conversation and booking process yourself.",
  },
  {
    question: "Can I change plans later?",
    answer: "Yes. Start with one plan and upgrade when you want more visibility or stronger promotional support.",
  },
  {
    question: "Am I locked into a contract?",
    answer: "No. Ideal Stay uses simple monthly plans.",
  },
  {
    question: "Do you manage my property or bookings?",
    answer: "The Standard, Professional, and Premium plans are self-service. Managed Hosting is different: the Ideal Stay team manages the listing/profile operations for you while you keep the commercial benefit of direct enquiries.",
  },
  {
    question: "How do referral rewards work?",
    answer: "Referral rewards are tied to real host conversions. When a host you referred activates a paid subscription, the platform records that reward against your account.",
  },
];

export default function PricingPage({ onBack }: { onBack?: () => void }) {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const isYocoTestMode = `${import.meta.env.VITE_YOCO_PAYMENT_MODE || ''}`.trim().toLowerCase() === 'test';
  const [loadingPlan, setLoadingPlan] = useState<PlanTier | "managed" | null>(null);
  const [currentPlan, setCurrentPlan] = useState<PlanTier>("standard");
  const [searchParams] = useSearchParams();
  const sourceLabel = searchParams.get("source_label") || searchParams.get("region");
  const billingReturn = useMemo(() => parseBillingReturnParams(searchParams), [searchParams]);

  useEffect(() => {
    setCurrentPlan((profile?.hostPlan as PlanTier) || "standard");
  }, [profile?.hostPlan]);

  const billingAccountQuery = useQuery<HostBillingAccount | null>({
    queryKey: ["billing", "host-account", profile?.id ?? user?.id ?? null],
    queryFn: getMyHostBillingAccount,
    enabled: Boolean(profile?.role === "host"),
    retry: 1,
  });
  const billingAccount = billingAccountQuery.data ?? null;
  const fetchingPlan = Boolean(profile?.role === "host" && billingAccountQuery.isLoading);

  const subscriptionPaymentMutation = useMutation({
    mutationFn: (planId: PlanTier) => startBillingPayment({ purpose: "subscription", plan: planId, billingInterval: "monthly" }),
    onSuccess: (checkout) => {
      window.location.assign(checkout.redirectUrl);
    },
    onError: (error) => {
      console.error("Plan upgrade error:", error);
      toast.error(`Upgrade failed: ${error instanceof Error ? error.message : "Could not start checkout."}`);
    },
    onSettled: () => {
      setLoadingPlan(null);
    },
  });

  const managedHostingMutation = useMutation({
    mutationFn: createManagedHostingCheckout,
    onSuccess: (checkout) => {
      window.location.assign(checkout.redirectUrl);
    },
    onError: (error) => {
      console.error("Managed hosting checkout error:", error);
      toast.error(`Managed hosting checkout failed: ${error instanceof Error ? error.message : "Could not start checkout."}`);
    },
    onSettled: () => {
      setLoadingPlan(null);
    },
  });

  useEffect(() => {
    if (billingAccountQuery.error) {
      console.error("Failed to load host billing account for pricing page:", billingAccountQuery.error);
    }
  }, [billingAccountQuery.error]);

  useEffect(() => {
    if (!user || !billingReturn) {
      return;
    }

    let cancelled = false;
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    async function resolveCheckout() {
      try {
        for (let attempt = 0; attempt < 8; attempt += 1) {
          // (|/) Klaasvaakie - standard payments return payment_id; checkout_id is kept for older return URLs.
          const result = billingReturn.paymentId
            ? await getBillingPaymentStatus(billingReturn.paymentId, billingReturn.billingStatus)
            : await getCheckoutStatus(billingReturn.checkoutId!);
          if (cancelled) {
            return;
          }

          if ("purpose" in result && result.purpose !== "subscription" && result.purpose !== "managed_hosting") {
            navigate("/pricing", { replace: true });
            return;
          }

          if (result.status === "paid") {
            const nextProfile = await refreshProfile();
            if (cancelled) {
              return;
            }
            setCurrentPlan((nextProfile?.hostPlan as PlanTier) || currentPlan);
            void queryClient.invalidateQueries({ queryKey: ["billing"] });
            toast.success(
              "purpose" in result && result.purpose === "managed_hosting"
                ? "Managed hosting payment confirmed. The team can now complete onboarding."
                : "Subscription payment confirmed. Your plan access is now live.",
            );
            // Author: (|╲) Klaasvaakie
            navigate(
              "purpose" in result && result.purpose === "subscription"
                ? "/host?modal=subscriptions"
                : "/host",
              { replace: true },
            );
            return;
          }

          if (billingReturn.billingStatus === "cancelled" || result.status === "cancelled") {
            toast.message("Checkout cancelled. No subscription changes were applied.");
            return;
          }

          if (billingReturn.billingStatus === "failed" || result.status === "failed") {
            toast.error("Payment failed. Nothing was upgraded.");
            return;
          }

          if (attempt < 7) {
            await wait(2000);
          }
        }

        toast.message("Payment is still being confirmed. Give the webhook a moment and refresh if needed.");
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to resolve checkout status", error);
        }
      }
    }

    resolveCheckout();
    return () => {
      cancelled = true;
    };
  }, [billingReturn, currentPlan, navigate, queryClient, refreshProfile, user]);

  const handleUpgrade = useCallback(
    async (planId: PlanTier) => {
      if (!user) {
        navigate("/signup?returnTo=%2Fpricing");
        return;
      }

      setLoadingPlan(planId);
      subscriptionPaymentMutation.mutate(planId);
    },
    [navigate, subscriptionPaymentMutation, user],
  );

  const handleManagedHosting = useCallback(() => {
    if (!user) {
      navigate("/signup?returnTo=%2Fpricing&role=host&management=managed");
      return;
    }

    setLoadingPlan("managed");
    managedHostingMutation.mutate();
  }, [managedHostingMutation, navigate, user]);

  if (fetchingPlan) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasActiveHostPlan = billingAccount?.billingSource === "voucher" || billingAccount?.billingSource === "paid";
  const showCurrentPlanState = profile?.role === "host" && hasActiveHostPlan;

  return (
    <div className="mx-auto max-w-7xl space-y-10 pb-16">
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(8,168,200,0.18),_transparent_34%),linear-gradient(135deg,#ffffff_0%,#f8fcfd_45%,#eef9fb_100%)] px-6 py-10 shadow-sm md:px-10 md:py-14">
        <div className="absolute -right-12 top-0 h-56 w-56 rounded-full bg-cyan-200/40 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-48 w-48 rounded-full bg-slate-200/50 blur-3xl" />

        <div className="relative grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-700">
                Host Pricing
              </span>
              <span className="text-sm font-medium uppercase tracking-[0.25em] text-slate-500">
                0% Booking Commission
              </span>
            </div>

            {isYocoTestMode ? (
              <div className="max-w-2xl rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Yoco test mode is active. Use the test card in the checkout flow, then switch
                <span className="mx-1 font-semibold">VITE_YOCO_PAYMENT_MODE</span> and
                <span className="mx-1 font-semibold">YOCO_PAYMENT_MODE</span> back to live when you are done.
              </div>
            ) : null}

            <div className="max-w-3xl space-y-4">
              <h1 className="text-4xl font-black tracking-tight text-slate-950 md:text-6xl">
                Your property. Your guests. Your booking income.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-700 md:text-xl">
                Get your accommodation seen by travellers without giving away commission on every booking.
              </p>
              <p className="max-w-3xl text-base leading-7 text-slate-600">
                Ideal Stay helps hosts list their property, receive direct guest enquiries, and keep control of their
                bookings through simple monthly plans.
              </p>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                0% booking commission. Direct enquiries. Simple monthly pricing.
              </p>
            </div>

            {sourceLabel ? (
              <div className="max-w-2xl rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4 text-sm text-cyan-900">
                <div className="font-bold uppercase tracking-[0.2em] text-cyan-700">Campaign Source</div>
                <p className="mt-2 leading-6">
                  You came through the <span className="font-semibold">{sourceLabel}</span> acquisition path. That
                  attribution stays intact while you review plans.
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => navigate("/signup?returnTo=%2Fpricing")} className="h-12 rounded-full bg-[#08a8c8] px-6 text-base font-semibold text-white hover:bg-[#08a8c8]/90">
                List Your Property
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  document.getElementById("plans")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="h-12 rounded-full border-slate-300 bg-white/80 px-6 text-base font-semibold"
              >
                View Plans
              </Button>
            </div>

            <div className="flex flex-wrap gap-3">
              {!user ? (
                <div className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800">
                  Review the plans first. Sign in only when you are ready to activate one.
                </div>
              ) : profile?.role === "host" && !hasActiveHostPlan ? (
                <div className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-800">
                  Your host profile exists, but no paid billing cycle is active yet.
                </div>
              ) : (
                <div className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">
                  Your current plan: {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
                </div>
              )}

              <Button
                variant="outline"
                onClick={() => {
                  if (onBack) {
                    onBack();
                    return;
                  }
                  navigate(profile?.role === "host" ? "/host" : "/");
                }}
                className="rounded-full border-slate-300 bg-white/80"
              >
                {profile?.role === "host" ? "Back to Host Workspace" : "Back to Explore"}
              </Button>
            </div>
          </div>

          <div className="grid gap-4">
            {pressurePoints.map((point) => (
              <div key={point.title} className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
                <point.icon className="mb-3 h-5 w-5 text-cyan-700" />
                <div className="text-lg font-black text-slate-950">{point.title}</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{point.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div className="space-y-4">
          <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-600">
            Commission Pressure
          </div>
          <h2 className="text-3xl font-black text-slate-950 md:text-4xl">Stop paying more because you got booked.</h2>
          <p className="text-base leading-7 text-slate-600">
            Most booking platforms take a percentage every time your property earns.
          </p>
          <p className="text-base leading-7 text-slate-600">
            The more bookings you get, the more commission you lose.
          </p>
          <p className="text-base leading-7 text-slate-600">
            Ideal Stay works differently. You pay a simple monthly subscription, get your property listed, and keep
            your booking income without commission cuts from us.
          </p>
        </div>

        <div className="rounded-[1.75rem] border border-cyan-200 bg-[linear-gradient(135deg,#ecfeff_0%,#f8fafc_100%)] p-6">
          <div className="space-y-4">
            <p className="text-lg font-black text-slate-950">No booking commission. No hidden percentage. No penalty for doing well.</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white bg-white p-4 shadow-sm">
                <div className="text-3xl font-black text-slate-950">0%</div>
                <div className="mt-1 text-sm font-medium text-slate-600">booking commission</div>
              </div>
              <div className="rounded-2xl border border-white bg-white p-4 shadow-sm">
                <div className="text-3xl font-black text-slate-950">Direct</div>
                <div className="mt-1 text-sm font-medium text-slate-600">guest enquiries</div>
              </div>
              <div className="rounded-2xl border border-white bg-white p-4 shadow-sm">
                <div className="text-3xl font-black text-slate-950">Monthly</div>
                <div className="mt-1 text-sm font-medium text-slate-600">predictable pricing</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm md:p-10">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-600">
            Built for Hosts Who Want Control
          </div>
          <h2 className="text-3xl font-black text-slate-950">Ideal Stay is designed for hosts who want direct visibility and less dependence on high-commission platforms.</h2>
          <p className="text-base leading-7 text-slate-600">
            With Ideal Stay, you pay for visibility and keep your bookings.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {valuePoints.map((point) => (
            <div key={point} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
              <BadgeCheck className="mb-3 h-5 w-5 text-cyan-700" />
              <p className="text-sm font-semibold leading-6 text-slate-700">{point}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="plans" className="space-y-6">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-600">
            Plans
          </div>
          <h2 className="text-3xl font-black text-slate-950 md:text-4xl">Choose how hands-on you want to be.</h2>
          <p className="text-base leading-7 text-slate-600">
            Three options are self-service. The fourth is managed. Every route keeps the same commercial promise: Ideal Stay takes 0% commission from your bookings.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => {
            const isManagedPlan = plan.id === "managed";
            const isCurrent = !isManagedPlan && showCurrentPlanState && currentPlan === plan.id;
            const isLoading = isManagedPlan ? loadingPlan === "managed" : loadingPlan === plan.id;
            const darkCard = plan.id === "premium";
            const accentBarClass = darkCard ? "bg-cyan-400" : isManagedPlan ? "bg-emerald-500" : "bg-[#08a8c8]";
            const badgeClass = darkCard
              ? "bg-white text-slate-950"
              : isManagedPlan
                ? "bg-emerald-600 text-white"
                : "bg-[#08a8c8] text-white";
            const chipClass = darkCard
              ? "bg-white/10 text-cyan-100"
              : isManagedPlan
                ? "bg-emerald-100 text-emerald-800"
                : "bg-slate-100 text-slate-600";
            const featureIconClass = darkCard ? "text-cyan-300" : isManagedPlan ? "text-emerald-600" : "text-emerald-600";
            const bestForCardClass = darkCard
              ? "border-white/10 bg-white/5"
              : isManagedPlan
                ? "border-emerald-200 bg-emerald-50/80"
                : "border-slate-200 bg-slate-50/70";
            const bestForLabelClass = darkCard ? "text-cyan-100" : isManagedPlan ? "text-emerald-700" : "text-slate-500";
            const descriptionClass = darkCard ? "text-slate-200" : "text-slate-600";
            const buttonVariant = darkCard ? "secondary" : isManagedPlan || plan.id === "professional" ? "default" : "outline";
            const buttonClass = darkCard
              ? "border-white/15 bg-white text-slate-950 hover:bg-slate-100"
              : isManagedPlan
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : plan.id === "professional"
                  ? "bg-[#08a8c8] text-white hover:bg-[#08a8c8]/90"
                  : "border-slate-300 bg-white text-slate-950 hover:bg-slate-50";

            return (
              <Card
                key={plan.id}
                className={`relative flex h-full flex-col overflow-hidden border transition-all duration-200 hover:-translate-y-1 hover:shadow-xl ${plan.tone} ${isCurrent ? "ring-2 ring-primary ring-offset-2" : ""}`}
              >
                <div className={`absolute inset-x-0 top-0 h-1 ${accentBarClass}`} />
                {plan.badge ? (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className={`${badgeClass} rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em]`}>
                      {plan.badge}
                    </span>
                  </div>
                ) : null}

                <CardHeader className="pb-4 text-left">
                  <div className="mb-4 flex items-center justify-between">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] ${chipClass}`}>
                      {plan.name}
                    </span>
                    {isCurrent ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                        Current
                      </span>
                    ) : null}
                  </div>

                  <CardTitle className={`text-2xl font-black ${darkCard ? "text-white" : "text-slate-950"}`}>{plan.name}</CardTitle>
                  <div className={`mt-4 text-4xl font-black tracking-tight ${darkCard ? "text-white" : "text-slate-950"}`}>{plan.price}</div>
                  <CardDescription className={`pt-3 text-left leading-6 ${descriptionClass}`}>
                    {plan.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1">
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature.text} className="flex items-start gap-3 text-sm">
                        <BadgeCheck className={`mt-0.5 h-4 w-4 shrink-0 ${featureIconClass}`} />
                        <span className={darkCard ? "text-slate-100" : "font-medium text-slate-700"}>{feature.text}</span>
                      </li>
                    ))}
                  </ul>

                  <div className={`mt-6 rounded-2xl border p-4 ${bestForCardClass}`}>
                    <div className={`text-xs font-bold uppercase tracking-[0.18em] ${bestForLabelClass}`}>Best for</div>
                    <p className={`mt-2 text-sm leading-6 ${descriptionClass}`}>{plan.bestFor}</p>
                  </div>
                </CardContent>

                <CardFooter>
                  <Button
                    onClick={() => isManagedPlan ? handleManagedHosting() : handleUpgrade(plan.id)}
                    disabled={loadingPlan !== null || isCurrent}
                    variant={buttonVariant}
                    className={`h-12 w-full rounded-xl text-base font-semibold ${buttonClass}`}
                  >
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : isCurrent ? (
                      "Current Plan"
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        {plan.cta}
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,#fffdf7_0%,#ffffff_45%,#f8fafc_100%)] p-8 shadow-sm lg:grid-cols-[1fr_1fr] lg:items-center">
        <div className="space-y-4">
          <div className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-amber-700">
            Why This Model Wins
          </div>
          <h2 className="text-3xl font-black text-slate-950">A booking should feel like a win, not a deduction.</h2>
          <p className="text-base leading-7 text-slate-600">
            When a traveller chooses your place, that should be your reward.
          </p>
          <p className="text-base leading-7 text-slate-600">
            Not another percentage lost. Not another platform fee eating into your margin. Not another booking where
            someone else takes a cut before you see the full value.
          </p>
        </div>

        <div className="rounded-[1.75rem] border border-slate-900 bg-slate-950 p-6 text-white">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-200">The simpler deal</p>
          <p className="mt-4 text-3xl font-black">Pay for visibility. Keep your bookings.</p>
          <p className="mt-4 text-base leading-7 text-slate-200">
            Ideal Stay is built for hosts who want the upside of direct interest without watching each booking lose
            margin to another commission cut.
          </p>
        </div>
      </section>

      <section className="grid gap-6 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="space-y-4">
          <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-600">
            Visibility
          </div>
          <h2 className="text-3xl font-black text-slate-950">Your property deserves to be seen.</h2>
          <p className="text-base leading-7 text-slate-600">
            A listing alone is not enough.
          </p>
          <p className="text-base leading-7 text-slate-600">
            Ideal Stay is built to help connect South African accommodation owners with travellers looking for places to
            stay, weekend breaks, holidays, and local getaways.
          </p>
          <p className="text-base leading-7 text-slate-600">
            We are creating a direct discovery path between hosts and guests, without taking commission from every booking.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
            <div className="text-lg font-black text-slate-950">More visibility</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">Stronger property discovery matters more than another hidden listing in a crowded marketplace.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
            <div className="text-lg font-black text-slate-950">More direct interest</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">The goal is not passive presence. The goal is real traveller attention that turns into enquiries.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
            <div className="text-lg font-black text-slate-950">More control</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">Better visibility is only useful if the guest relationship still stays in your hands.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#ecfeff_100%)] p-8 shadow-sm lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div className="space-y-4">
          <div className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">
            Direct Enquiries
          </div>
          <h2 className="text-3xl font-black text-slate-950">Keep the guest relationship in your hands.</h2>
          <p className="text-base leading-7 text-slate-600">
            Direct enquiries help you stay closer to your guests.
          </p>
          <p className="text-base leading-7 text-slate-600">
            You can answer questions, manage expectations, build trust, and encourage repeat bookings without being
            locked behind a platform wall.
          </p>
          <p className="text-base leading-7 text-slate-600">
            Ideal Stay helps travellers discover your property. You stay in control of the booking conversation.
          </p>
        </div>

        <div className="rounded-[1.75rem] border border-cyan-200 bg-white p-6 shadow-sm">
          <div className="space-y-3">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-700">Control stack</p>
            <p className="text-lg font-black text-slate-950">Stay in control of your guest communication, pricing, availability, and repeat bookings.</p>
            <p className="text-sm leading-6 text-slate-600">
              That is the commercial point. More direct contact means fewer boxed-in booking conversations and more room
              to protect your own margin.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm md:p-10">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-600">
            Referral Rewards
          </div>
          <h2 className="text-3xl font-black text-slate-950">Refer other hosts and earn rewards.</h2>
          <p className="text-base leading-7 text-slate-600">
            Know another accommodation owner who wants more visibility without giving away booking margin?
          </p>
          <p className="text-base leading-7 text-slate-600">
            Ideal Stay tracks referral rewards against real host subscription conversions. No complicated levels. No
            recruitment chains. Just a clean reward path tied to actual paid activation.
          </p>
          <Button onClick={() => navigate("/signup?returnTo=%2Fpricing")} className="h-12 rounded-full bg-[#08a8c8] px-6 text-base font-semibold text-white hover:bg-[#08a8c8]/90">
            List Your Property
          </Button>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm md:p-10">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-600">
            FAQ
          </div>
          <h2 className="text-3xl font-black text-slate-950">Frequently Asked Questions</h2>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {faqs.map((faq) => (
            <div key={faq.question} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
              <h3 className="text-lg font-black text-slate-950">{faq.question}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-900 bg-slate-950 p-8 text-white shadow-xl md:p-12">
        <div className="max-w-3xl space-y-5">
          <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
            Final CTA
          </div>
          <h2 className="text-3xl font-black md:text-5xl">Keep more of what your property earns.</h2>
          <p className="text-base leading-7 text-slate-200">
            List your accommodation on Ideal Stay and start building direct visibility without giving away commission on
            every booking.
          </p>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">
            0% booking commission. Direct guest enquiries. Simple monthly plans.
          </p>
          <Button onClick={() => navigate("/signup?returnTo=%2Fpricing")} className="h-12 rounded-full bg-[#08a8c8] px-6 text-base font-semibold text-white hover:bg-[#08a8c8]/90">
            List Your Property Today
          </Button>
        </div>
      </section>
    </div>
  );
}
