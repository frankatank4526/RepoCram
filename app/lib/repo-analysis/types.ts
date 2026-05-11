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
  fileRelationships: RepoFileRelationship[];
  architecturalGroups: RepoArchitecturalGroup[];
  aiContext: RepoAiContextPackage;
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
  fileRelationships: RepoFileRelationship[];
  architecturalGroups: RepoArchitecturalGroup[];
  aiContext: RepoAiContextPackage;
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

export type RepoFileRole =
  | "api_route"
  | "frontend_page"
  | "frontend_component"
  | "shared_logic"
  | "framework_entry"
  | "config"
  | "state_management"
  | "service"
  | "model"
  | "controller"
  | "repository"
  | "view"
  | "test"
  | "documentation"
  | "asset"
  | "data"
  | "other";

export type RepoFileRelationshipType =
  | "imports"
  | "frontend_backend_flow"
  | "related_state"
  | "related_service"
  | "related_model"
  | "related_controller"
  | "related_view"
  | "same_domain"
  | "same_feature"
  | "framework_flow";

export type RepoFileRelationshipConfidence = "strong" | "moderate" | "weak";

export type RepoFileRelationship = {
  sourcePath: string;
  targetPath: string;
  type: RepoFileRelationshipType;
  confidence: RepoFileRelationshipConfidence;
  reason: string;
  groupKey?: string;
  groupLabel?: string;
};

export type RepoArchitecturalGroupType =
  | "feature_flow"
  | "auth_flow"
  | "frontend_backend_flow"
  | "mvc_group"
  | "state_flow"
  | "api_group"
  | "persona_workflow";

export type RepoArchitecturalGroup = {
  id: string;
  label: string;
  type: RepoArchitecturalGroupType;
  summary: string;
  files: string[];
  roles: RepoFileRole[];
  relationshipTypes: RepoFileRelationshipType[];
  confidence: RepoFileRelationshipConfidence;
  reasons: string[];
};

export type RepoContextPriority = "critical" | "high" | "medium" | "low";

export type RepoContextChunkType =
  | "framework_overview"
  | "architectural_group"
  | "highlighted_files"
  | "relationship_cluster"
  | "domain_context";

export type RepoContextBudgetStatus = "within_budget" | "near_limit" | "over_budget";

export type RepoContextTokenBudget = {
  estimatedTokens: number;
  maxRecommendedTokens: number;
  budgetStatus: RepoContextBudgetStatus;
  fileTokenEstimate: number;
  summaryTokenEstimate: number;
  relationshipTokenEstimate: number;
  strategy: string;
};

export type RepoContextFileRef = {
  path: string;
  role: RepoFileRole;
  category: ImportantFileCategory;
  domain: string | null;
  highlighted: boolean;
  priority: RepoContextPriority;
  estimatedTokens: number;
  summary: string;
  reasons: string[];
};

export type RepoContextChunk = {
  id: string;
  label: string;
  type: RepoContextChunkType;
  summary: string;
  priority: RepoContextPriority;
  estimatedTokens: number;
  files: RepoContextFileRef[];
  relationships: RepoFileRelationship[];
  architecturalGroupId?: string;
  reasons: string[];
};

export type RepoAiContextPackage = {
  version: "phase3-groundwork-v1";
  detectedFrameworks: string[];
  repositorySummary: string;
  tokenBudget: RepoContextTokenBudget;
  highlightedFiles: RepoContextFileRef[];
  architecturalGroups: RepoArchitecturalGroup[];
  representativeFlows: RepoContextChunk[];
  chunks: RepoContextChunk[];
  prioritization: {
    highPriorityFiles: string[];
    deferredFiles: string[];
    reasons: string[];
  };
};

export type RepoFileSummary = {
  path: string;
  size?: number;
  language?: string;
  kind: RepoFileSummaryKind;
  category: ImportantFileCategory;
  role: RepoFileRole;
  domain: string | null;
  importanceScore: number;
  summary: string;
  reasons: string[];
  relationships: RepoFileRelationship[];
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
  fileContents?: FileContentMap;
};
