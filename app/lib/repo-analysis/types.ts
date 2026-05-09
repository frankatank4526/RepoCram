import type { OneTimeScanTier, SubscriptionPlan } from "../pricing";

export type RepositoryFile = {
  path: string;
  size?: number;
};

export type RepoDirectorySignal = {
  name: string;
  fileCount: number;
};

export type RepoStructureAnalysis = {
  topDirectories: RepoDirectorySignal[];
  excludedFiles: RepoExcludedFile[];
  relevantFiles: RepoFileSummary[];
  highlightedFiles: RepoFileSummary[];
  repositoryTree: RepositoryStructureTree;
  importantFiles: string[];
  sourceFileCount: number;
  testFileCount: number;
  configFileCount: number;
  documentationFileCount: number;
};

export type RepoStructureSummary = {
  totalFiles: number;
  languages: Record<string, number>;
  topLevelFolders: string[];
  excludedFiles: RepoExcludedFile[];
  relevantFiles: RepoFileSummary[];
  highlightedFiles: RepoFileSummary[];
  repositoryTree: RepositoryStructureTree;
  importantFiles: string[];
  likelyEntryPoints: string[];
  summary: string;
};

export type RepoImprovement = {
  title: string;
  rationale: string;
  priority: "high" | "medium" | "low";
};

export type MockPullRequestIdea = {
  title: string;
  summary: string;
  suggestedFiles: string[];
};

export type AnalysisBudget = {
  sampledFileCount: number;
  estimatedPromptTokens: number;
  strategy: string;
};

export type RepoFileSummaryKind =
  | "source"
  | "test"
  | "config"
  | "documentation"
  | "asset"
  | "data"
  | "other";

export type ImportantFileCategory =
  | "backend_api"
  | "frontend_route"
  | "frontend_component"
  | "shared_logic"
  | "framework_entry"
  | "config"
  | "other";

export type RepoFileSummary = {
  path: string;
  size?: number;
  language?: string;
  kind: RepoFileSummaryKind;
  category: ImportantFileCategory;
  domain: string | null;
  importanceScore: number;
  summary: string;
  reasons: string[];
  highlighted: boolean;
  highlightReason?: "ranked" | "domain_representative";
};

export type RepoExcludedFile = {
  path: string;
  size?: number;
  reason: string;
};

export type RepositoryStructureTree = {
  allRelevant: string;
  highlightedOnly: string;
};

export type RepoQualityAnalysis = {
  summary: string[];
  structure: RepoStructureAnalysis;
  improvements: RepoImprovement[];
  mockPullRequests: MockPullRequestIdea[];
  analysisBudget: AnalysisBudget;
};

export type FileContentMap = Record<string, string>;

export type FrameworkDetectionContext = {
  paths: string[];
  lowerPaths: string[];
  pathSet: Set<string>;
  extensionCounts: Map<string, number>;
  fileContents?: FileContentMap;
  pythonFileCount: number;
  jsFileCount: number;
  tsxFileCount: number;
  javaFileCount: number;
  cppFileCount: number;
  sourceFileCount: number;
  pythonDominant: boolean;
  jsDominant: boolean;
};

export type FrameworkDetectionResult = {
  name: string;
  confidence: number;
  signals: string[];
};

export type FrameworkDetector = {
  name: string;
  languages: string[];
  detect: (context: FrameworkDetectionContext) => FrameworkDetectionResult | null;
};

export type StackSignals = {
  python: boolean;
  streamlit: boolean;
  node: boolean;
  express: boolean;
  java: boolean;
  spring: boolean;
  reactNext: boolean;
};

export type AnalyzeRepositoryQualityInput = {
  files: RepositoryFile[];
  detectedLanguages: string[];
  detectedFrameworks: string[];
  totalEstimatedTokens: number;
  suggestedTier: OneTimeScanTier;
  plan?: SubscriptionPlan;
};
