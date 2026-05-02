export type OneTimeScanTier = "small" | "medium" | "deep";

export type SubscriptionPlanId = "free" | "starter" | "pro" | "team";

export type PlanLimits = {
  scansPerMonth: number;
  allowedScanTiers: OneTimeScanTier[];
  mockPrs: boolean;
  suggestions: "basic" | "priority" | "full";
  teamUsage: boolean;
};

export type SubscriptionPlan = {
  id: SubscriptionPlanId;
  name: string;
  monthlyPrice: number;
  summary: string;
  limits: PlanLimits;
  features: string[];
};

export type SubscriptionUsage = {
  scansUsed: number;
};

export type ScanPermission =
  | { allowed: true }
  | { allowed: false; reason: string };

export type OneTimePricingCopy = {
  tier: OneTimeScanTier;
  name: string;
  priceLabel: string;
  summary: string;
};

export type SubscriptionPricingCopy = {
  id: SubscriptionPlanId;
  name: string;
  priceLabel: string;
  summary: string;
  features: string[];
};

export type PricingDisplayCopy = {
  oneTimeScans: OneTimePricingCopy[];
  subscriptions: SubscriptionPricingCopy[];
};

const ONE_TIME_TIERS: Record<
  OneTimeScanTier,
  {
    price: number;
    maxFiles?: number;
    maxTokens?: number;
  }
> = {
  small: {
    price: 5,
    maxFiles: 40,
    maxTokens: 60_000,
  },
  medium: {
    price: 12,
    maxFiles: 160,
    maxTokens: 240_000,
  },
  deep: {
    price: 25,
  },
};

const SMALL_SCAN_LIMITS = ONE_TIME_TIERS.small as Required<
  (typeof ONE_TIME_TIERS)["small"]
>;
const MEDIUM_SCAN_LIMITS = ONE_TIME_TIERS.medium as Required<
  (typeof ONE_TIME_TIERS)["medium"]
>;

const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "free",
    name: "Free",
    monthlyPrice: 0,
    summary: "3 small scans/month",
    limits: {
      scansPerMonth: 3,
      allowedScanTiers: ["small"],
      mockPrs: false,
      suggestions: "basic",
      teamUsage: false,
    },
    features: ["3 small scans/month", "No mock PRs", "Basic suggestions only"],
  },
  {
    id: "starter",
    name: "Starter",
    monthlyPrice: 9,
    summary: "5 small/medium scans/month",
    limits: {
      scansPerMonth: 5,
      allowedScanTiers: ["small", "medium"],
      mockPrs: true,
      suggestions: "basic",
      teamUsage: false,
    },
    features: ["5 small/medium scans/month", "Mock PRs included", "Basic repo summaries"],
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: 19,
    summary: "20 scans/month",
    limits: {
      scansPerMonth: 20,
      allowedScanTiers: ["small", "medium", "deep"],
      mockPrs: true,
      suggestions: "full",
      teamUsage: false,
    },
    features: ["20 scans/month", "Deep scans allowed", "Mock PRs included", "Priority/full suggestions"],
  },
  {
    id: "team",
    name: "Team",
    monthlyPrice: 49,
    summary: "100 scans/month",
    limits: {
      scansPerMonth: 100,
      allowedScanTiers: ["small", "medium", "deep"],
      mockPrs: true,
      suggestions: "full",
      teamUsage: true,
    },
    features: ["100 scans/month", "Deep scans allowed", "Mock PRs included", "Team/project usage placeholder"],
  },
];

export function getOneTimeTier(fileCount: number, tokens: number): {
  suggestedTier: OneTimeScanTier;
  suggestedPrice: number;
} {
  if (
    fileCount <= SMALL_SCAN_LIMITS.maxFiles &&
    tokens <= SMALL_SCAN_LIMITS.maxTokens
  ) {
    return {
      suggestedTier: "small",
      suggestedPrice: ONE_TIME_TIERS.small.price,
    };
  }

  if (
    fileCount <= MEDIUM_SCAN_LIMITS.maxFiles &&
    tokens <= MEDIUM_SCAN_LIMITS.maxTokens
  ) {
    return {
      suggestedTier: "medium",
      suggestedPrice: ONE_TIME_TIERS.medium.price,
    };
  }

  return {
    suggestedTier: "deep",
    suggestedPrice: ONE_TIME_TIERS.deep.price,
  };
}

export function getSubscriptionPlans() {
  return SUBSCRIPTION_PLANS;
}

export function getSubscriptionPlan(planId: SubscriptionPlanId) {
  return SUBSCRIPTION_PLANS.find((plan) => plan.id === planId);
}

function formatOneTimePrice(price: number) {
  return `$${price}`;
}

function formatMonthlyPrice(price: number) {
  return price === 0 ? "Free" : `$${price}/month`;
}

export function getPricingDisplayCopy(): PricingDisplayCopy {
  return {
    oneTimeScans: [
      {
        tier: "small",
        name: "Small scan",
        priceLabel: formatOneTimePrice(ONE_TIME_TIERS.small.price),
        summary: "One-time scan for compact repositories.",
      },
      {
        tier: "medium",
        name: "Medium scan",
        priceLabel: formatOneTimePrice(ONE_TIME_TIERS.medium.price),
        summary: "One-time scan for moderate repositories.",
      },
      {
        tier: "deep",
        name: "Deep scan",
        priceLabel: formatOneTimePrice(ONE_TIME_TIERS.deep.price),
        summary: "One-time scan for larger repositories.",
      },
    ],
    subscriptions: SUBSCRIPTION_PLANS.map((plan) => ({
      id: plan.id,
      name: plan.name,
      priceLabel: formatMonthlyPrice(plan.monthlyPrice),
      summary: plan.summary,
      features: plan.features,
    })),
  };
}

export function canRunScan(
  plan: SubscriptionPlan,
  usage: SubscriptionUsage,
  requestedTier: OneTimeScanTier,
): ScanPermission {
  if (plan.id === "free" && requestedTier !== "small") {
    return {
      allowed: false,
      reason: "Free plan only supports small scans.",
    };
  }

  if (!plan.limits.allowedScanTiers.includes(requestedTier)) {
    return {
      allowed: false,
      reason: `${plan.name} does not include ${requestedTier} scans.`,
    };
  }

  if (usage.scansUsed >= plan.limits.scansPerMonth) {
    return {
      allowed: false,
      reason: `${plan.name} allows ${plan.limits.scansPerMonth} scans/month.`,
    };
  }

  return { allowed: true };
}

export function incrementScanUsage(usage: SubscriptionUsage): SubscriptionUsage {
  return {
    scansUsed: usage.scansUsed + 1,
  };
}

export function getUpgradeMessage(
  plan: SubscriptionPlan,
  usage: SubscriptionUsage,
) {
  if (plan.id !== "free") {
    return null;
  }

  if (usage.scansUsed === 2) {
    return "You have 1 free scan remaining. Upgrade for more scans and deeper analysis.";
  }

  if (usage.scansUsed >= 3) {
    return "You've used all 3 free scans this month. Upgrade to continue with more scans and advanced features.";
  }

  return null;
}
