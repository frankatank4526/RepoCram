import type {
  AIProvider,
  AiAnalysisCapability,
  AiModelCapabilityMetadata,
  AiPromptFormat,
  AiProviderDeployment,
} from "./types.ts";

export type AiProviderRoutingPreference =
  | "prefer_local"
  | "prefer_cloud"
  | "prefer_self_hosted"
  | "balanced";

export type AiProviderRouteCandidate = {
  provider: AIProvider;
  model?: AiModelCapabilityMetadata;
  deployment: AiProviderDeployment | "unknown";
  contextWindowTokens?: number;
  supportsStreaming?: boolean;
  promptFormat: AiPromptFormat;
  score: number;
  reasons: string[];
};

const DEFAULT_PROMPT_FORMAT: AiPromptFormat = "chat_messages";

function deploymentPreferenceScore(
  deployment: AiProviderDeployment | "unknown",
  preference: AiProviderRoutingPreference,
) {
  if (preference === "balanced") {
    return deployment === "unknown" ? 0 : 10;
  }

  if (preference === "prefer_local") {
    return deployment === "local" ? 40 : deployment === "self_hosted" ? 20 : 0;
  }

  if (preference === "prefer_self_hosted") {
    return deployment === "self_hosted" ? 40 : deployment === "local" ? 20 : 0;
  }

  return deployment === "cloud" ? 40 : deployment === "self_hosted" ? 10 : 0;
}

function supportsCapability(
  model: AiModelCapabilityMetadata | undefined,
  capability: AiAnalysisCapability,
) {
  return !model?.supportedCapabilities || model.supportedCapabilities.includes(capability);
}

function getModelPromptFormat(model: AiModelCapabilityMetadata | undefined) {
  return model?.promptFormats?.[0] ?? DEFAULT_PROMPT_FORMAT;
}

function getDeployment(provider: AIProvider, model: AiModelCapabilityMetadata | undefined) {
  return model?.deployment ?? provider.metadata?.deployment ?? "unknown";
}

function getCandidateScore({
  deployment,
  contextWindowTokens,
  supportsStreaming,
  preference,
}: {
  deployment: AiProviderDeployment | "unknown";
  contextWindowTokens?: number;
  supportsStreaming?: boolean;
  preference: AiProviderRoutingPreference;
}) {
  let score = deploymentPreferenceScore(deployment, preference);

  if (contextWindowTokens && contextWindowTokens >= 16_000) {
    score += 12;
  } else if (contextWindowTokens && contextWindowTokens >= 8_000) {
    score += 8;
  } else if (contextWindowTokens) {
    score += 4;
  }

  if (supportsStreaming) {
    score += 2;
  }

  return score;
}

function getCandidateReasons({
  provider,
  model,
  deployment,
  contextWindowTokens,
  supportsStreaming,
}: {
  provider: AIProvider;
  model: AiModelCapabilityMetadata | undefined;
  deployment: AiProviderDeployment | "unknown";
  contextWindowTokens?: number;
  supportsStreaming?: boolean;
}) {
  const reasons = [
    `${deployment} deployment`,
    model ? `model metadata: ${model.modelId}` : `provider metadata: ${provider.id}`,
  ];

  if (contextWindowTokens) {
    reasons.push(`${contextWindowTokens} token context window`);
  }

  if (supportsStreaming) {
    reasons.push("streaming-capable");
  }

  return reasons;
}

export function getAiProviderRouteCandidates({
  providers,
  capability,
  preference = "balanced",
}: {
  providers: AIProvider[];
  capability: AiAnalysisCapability;
  preference?: AiProviderRoutingPreference;
}) {
  const candidates = providers.flatMap<AiProviderRouteCandidate>((provider) => {
    const models = provider.metadata?.models;

    if (!models || models.length === 0) {
      const deployment = getDeployment(provider, undefined);
      const supportsStreaming = provider.metadata?.supportsStreaming;

      return [
        {
          provider,
          deployment,
          supportsStreaming,
          promptFormat: DEFAULT_PROMPT_FORMAT,
          score: getCandidateScore({
            deployment,
            supportsStreaming,
            preference,
          }),
          reasons: getCandidateReasons({
            provider,
            model: undefined,
            deployment,
            supportsStreaming,
          }),
        },
      ];
    }

    return models
      .filter((model) => supportsCapability(model, capability))
      .map((model) => {
        const deployment = getDeployment(provider, model);
        const supportsStreaming = model.supportsStreaming ?? provider.metadata?.supportsStreaming;

        return {
          provider,
          model,
          deployment,
          contextWindowTokens: model.contextWindowTokens,
          supportsStreaming,
          promptFormat: getModelPromptFormat(model),
          score: getCandidateScore({
            deployment,
            contextWindowTokens: model.contextWindowTokens,
            supportsStreaming,
            preference,
          }),
          reasons: getCandidateReasons({
            provider,
            model,
            deployment,
            contextWindowTokens: model.contextWindowTokens,
            supportsStreaming,
          }),
        };
      });
  });

  return candidates.sort(
    (a, b) =>
      b.score - a.score ||
      (b.contextWindowTokens ?? 0) - (a.contextWindowTokens ?? 0) ||
      a.provider.id.localeCompare(b.provider.id) ||
      (a.model?.modelId ?? "").localeCompare(b.model?.modelId ?? ""),
  );
}

export function selectAiProviderCandidate({
  providers,
  capability,
  preference = "balanced",
}: {
  providers: AIProvider[];
  capability: AiAnalysisCapability;
  preference?: AiProviderRoutingPreference;
}) {
  return getAiProviderRouteCandidates({
    providers,
    capability,
    preference,
  })[0] ?? null;
}

export function getPromptTokenLimitForCandidate({
  candidate,
  fallbackPromptTokens = 6_000,
  responseTokenReserve = 900,
}: {
  candidate: AiProviderRouteCandidate | null;
  fallbackPromptTokens?: number;
  responseTokenReserve?: number;
}) {
  const contextWindow = candidate?.contextWindowTokens;

  if (!contextWindow) {
    return fallbackPromptTokens;
  }

  return Math.max(1_000, Math.min(fallbackPromptTokens, contextWindow - responseTokenReserve));
}
