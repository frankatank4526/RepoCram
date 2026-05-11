import type {
  RepoAiContextPackage,
  RepoArchitecturalGroup,
  RepoContextChunk,
  RepoContextFileRef,
  RepoContextPriority,
} from "../repo-analysis/types.ts";

export type AiAnalysisCapability = "repository_overview";

export type AiContextAssemblyPurpose =
  | "repository_overview"
  | "architecture_explanation"
  | "flow_explanation";

export type AiPromptMessage = {
  role: "system" | "user";
  content: string;
};

export type AiProviderDeployment = "cloud" | "local" | "self_hosted" | "custom_http";

export type AiProviderFamily =
  | "openai"
  | "anthropic"
  | "gemini"
  | "ollama"
  | "lm_studio"
  | "vllm"
  | "custom";

export type AiPromptFormat =
  | "chat_messages"
  | "single_prompt"
  | "openai_compatible_messages"
  | "custom";

export type AiEstimatedLatency = "low" | "medium" | "high" | "variable";

export type AiModelCapabilityMetadata = {
  modelId: string;
  displayName?: string;
  providerFamily?: AiProviderFamily;
  deployment: AiProviderDeployment;
  contextWindowTokens?: number;
  maxOutputTokens?: number;
  supportsStreaming?: boolean;
  estimatedLatency?: AiEstimatedLatency;
  supportedCapabilities?: AiAnalysisCapability[];
  promptFormats?: AiPromptFormat[];
  notes?: string[];
};

export type AiProviderMetadata = {
  displayName?: string;
  family?: AiProviderFamily;
  deployment: AiProviderDeployment;
  endpointKind?: "hosted_api" | "local_server" | "self_hosted_http" | "custom";
  supportsStreaming?: boolean;
  defaultModel?: string;
  models?: AiModelCapabilityMetadata[];
};

export type AiContextSelectedFile = RepoContextFileRef & {
  selectionReason: string;
};

export type AiContextSelectedChunk = {
  id: string;
  label: string;
  type: RepoContextChunk["type"];
  priority: RepoContextPriority;
  summary: string;
  estimatedTokens: number;
  selectedTokenEstimate: number;
  selectedReason: string;
  files: AiContextSelectedFile[];
  relationshipCount: number;
  architecturalGroupId?: string;
  trimmed: boolean;
};

export type AiContextOmittedChunk = {
  id: string;
  label: string;
  priority: RepoContextPriority;
  estimatedTokens: number;
  reason: string;
};

export type AiContextAssemblyTrace = {
  purpose: AiContextAssemblyPurpose;
  focus: string | null;
  maxPromptTokens: number;
  responseTokenReserve: number;
  availableContextTokens: number;
  estimatedPromptTokens: number;
  selectedTokenEstimate: number;
  selectedChunks: AiContextSelectedChunk[];
  omittedChunks: AiContextOmittedChunk[];
  includedArchitecturalGroups: {
    id: string;
    label: string;
    type: RepoArchitecturalGroup["type"];
    reason: string;
  }[];
  selectedFiles: {
    path: string;
    chunkId: string;
    priority: RepoContextPriority;
    estimatedTokens: number;
    reason: string;
  }[];
  budgeting: {
    strategy: string;
    phase2EstimatedTokens: number;
    phase2MaxRecommendedTokens: number;
    phase2BudgetStatus: RepoAiContextPackage["tokenBudget"]["budgetStatus"];
  };
};

export type AiRepositoryContextPayload = {
  capability: AiAnalysisCapability;
  purpose: AiContextAssemblyPurpose;
  repositorySummary: string;
  detectedFrameworks: string[];
  architecturalGroups: Pick<
    RepoArchitecturalGroup,
    "id" | "label" | "type" | "summary" | "files" | "confidence" | "reasons"
  >[];
  chunks: AiContextSelectedChunk[];
  highlightedFiles: RepoContextFileRef[];
  constraints: string[];
};

export type AssembledAiRepositoryContext = {
  payload: AiRepositoryContextPayload;
  messages: AiPromptMessage[];
  trace: AiContextAssemblyTrace;
};

export type AiProviderRequest = {
  capability: AiAnalysisCapability;
  context: AssembledAiRepositoryContext;
  messages: AiPromptMessage[];
  model?: string;
  promptFormat?: AiPromptFormat;
  maxOutputTokens?: number;
};

export type AiProviderResponse = {
  content: string;
  model?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  metadata?: Record<string, unknown>;
};

export type AIProvider = {
  id: string;
  metadata?: AiProviderMetadata;
  analyzeRepo: (request: AiProviderRequest) => Promise<AiProviderResponse>;
  summarizeArchitecture?: (request: AiProviderRequest) => Promise<AiProviderResponse>;
};

export type AiRepositoryOverviewResult = {
  overview: string;
  providerId: string;
  model?: string;
  context: AssembledAiRepositoryContext;
  usage?: AiProviderResponse["usage"];
};

export type AiRepositoryUnderstandingStatus = "generated" | "fallback" | "unavailable";

export type AiRepositoryUnderstanding = {
  version: "repo-understanding-v1";
  title: string;
  overview: string;
  status: AiRepositoryUnderstandingStatus;
  statusMessage: string;
  providerId: string;
  model?: string;
  generatedUsing: {
    frameworks: string[];
    chunks: {
      id: string;
      label: string;
      type: RepoContextChunk["type"];
      priority: RepoContextPriority;
      estimatedTokens: number;
      files: string[];
    }[];
    architecturalGroups: string[];
    highlightedFiles: string[];
  };
  trace: {
    promptVersion: "repo-understanding-prompt-v1";
    estimatedPromptTokens: number;
    selectedContextTokens: number;
    maxPromptTokens: number;
    selectedChunkCount: number;
    omittedChunkCount: number;
    tokenBudgetStatus: RepoAiContextPackage["tokenBudget"]["budgetStatus"];
    providerDeployment?: AiProviderDeployment;
    promptFormat?: AiPromptFormat;
    fallbackReason?: string;
  };
};
