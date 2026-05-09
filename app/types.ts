import type {
  AnalysisBudget,
  RepoExcludedFile,
  RepoFileSummary,
  RepositoryStructureTree,
  MockPullRequestIdea,
  RepoImprovement,
  RepoStructureAnalysis,
} from "./lib/repo-analysis";
import type {
  OneTimeScanTier as PricingOneTimeScanTier,
  PlanLimits as PricingPlanLimits,
  SubscriptionPlan as PricingSubscriptionPlan,
  SubscriptionPlanId as PricingSubscriptionPlanId,
  SubscriptionUsage as PricingSubscriptionUsage,
} from "./lib/pricing";

export type SuggestedTier = PricingOneTimeScanTier;
export type OneTimeScanTier = PricingOneTimeScanTier;
export type PlanLimits = PricingPlanLimits;
export type SubscriptionPlan = PricingSubscriptionPlan;
export type SubscriptionPlanId = PricingSubscriptionPlanId;
export type SubscriptionUsage = PricingSubscriptionUsage;
export type {
  AnalysisBudget,
  RepoExcludedFile,
  RepoFileSummary,
  RepositoryStructureTree,
  MockPullRequestIdea,
  RepoImprovement,
  RepoStructureAnalysis,
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
  summary: string[];
  structure: RepoStructureAnalysis;
  improvements: RepoImprovement[];
  mockPullRequests: MockPullRequestIdea[];
  analysisBudget: AnalysisBudget;
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
