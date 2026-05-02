import type {
  OneTimeScanTier,
  PlanLimits,
  SubscriptionPlan,
  SubscriptionPlanId,
  SubscriptionUsage,
} from "./lib/pricing";

export type SuggestedTier = OneTimeScanTier;
export type {
  OneTimeScanTier,
  PlanLimits,
  SubscriptionPlan,
  SubscriptionPlanId,
  SubscriptionUsage,
};

export type RepoScanResult = {
  repoName: string;
  owner: string;
  description: string | null;
  stars: number;
  defaultBranch: string;
  languages: Record<string, number>;
  totalFileCount: number;
  estimatedRelevantFileCount: number;
  totalEstimatedTokens: number;
  detectedLanguages: string[];
  detectedFrameworks: string[];
  suggestedTier: SuggestedTier;
  suggestedPrice: number;
  usage?: SubscriptionUsage;
  upgradeMessage?: string | null;
};

export type RepoScanError = {
  error: string;
  code:
    | "INVALID_URL"
    | "PLAN_LIMIT_EXCEEDED"
    | "NOT_FOUND"
    | "PRIVATE_OR_FORBIDDEN"
    | "RATE_LIMITED"
    | "GITHUB_ERROR"
    | "UNKNOWN_ERROR";
};
