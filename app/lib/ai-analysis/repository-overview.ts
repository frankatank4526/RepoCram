import type { RepoAiContextPackage } from "../repo-analysis/types.ts";
import { assembleAiRepositoryContext } from "./context-assembly.ts";
import {
  getPromptTokenLimitForCandidate,
  selectAiProviderCandidate,
} from "./provider-routing.ts";
import type {
  AIProvider,
  AiContextAssemblyPurpose,
  AiPromptFormat,
  AiRepositoryOverviewResult,
} from "./types.ts";

export async function generateAiRepositoryOverview({
  aiContext,
  provider,
  focus,
  maxPromptTokens,
  responseTokenReserve,
  maxOutputTokens = 700,
  model,
  promptFormat,
}: {
  aiContext: RepoAiContextPackage;
  provider: AIProvider;
  focus?: string;
  maxPromptTokens?: number;
  responseTokenReserve?: number;
  maxOutputTokens?: number;
  model?: string;
  promptFormat?: AiPromptFormat;
}): Promise<AiRepositoryOverviewResult> {
  const purpose: AiContextAssemblyPurpose = focus
    ? "flow_explanation"
    : "repository_overview";
  const routeCandidate = selectAiProviderCandidate({
    providers: [provider],
    capability: "repository_overview",
  });
  const selectedModel = model ?? routeCandidate?.model?.modelId ?? provider.metadata?.defaultModel;
  const selectedPromptFormat = promptFormat ?? routeCandidate?.promptFormat;
  const context = assembleAiRepositoryContext({
    aiContext,
    purpose,
    focus,
    maxPromptTokens:
      maxPromptTokens ??
      getPromptTokenLimitForCandidate({
        candidate: routeCandidate,
        responseTokenReserve,
      }),
    responseTokenReserve,
  });
  const request = {
    capability: "repository_overview" as const,
    context,
    messages: context.messages,
    model: selectedModel,
    promptFormat: selectedPromptFormat,
    maxOutputTokens,
  };
  const response = provider.summarizeArchitecture
    ? await provider.summarizeArchitecture(request)
    : await provider.analyzeRepo(request);

  return {
    overview: response.content,
    providerId: provider.id,
    model: response.model,
    context,
    usage: response.usage,
  };
}
