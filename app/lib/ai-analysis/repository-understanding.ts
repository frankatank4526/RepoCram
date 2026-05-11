import type { RepoAiContextPackage } from "../repo-analysis/types.ts";
import { assembleAiRepositoryContext } from "./context-assembly.ts";
import { selectAiProviderCandidate } from "./provider-routing.ts";
import { generateAiRepositoryOverview } from "./repository-overview.ts";
import type {
  AIProvider,
  AiRepositoryUnderstanding,
  AssembledAiRepositoryContext,
} from "./types.ts";

const PROMPT_VERSION = "repo-understanding-prompt-v1";

function sentenceList(items: string[]) {
  if (items.length === 0) {
    return "";
  }

  if (items.length === 1) {
    return items[0];
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function getRolePhrase(context: AssembledAiRepositoryContext) {
  const roles = new Set(
    context.trace.selectedChunks.flatMap((chunk) => chunk.files.map((file) => file.role)),
  );
  const phrases: string[] = [];

  if (roles.has("frontend_page") || roles.has("frontend_component")) {
    phrases.push("frontend routes/components");
  }

  if (roles.has("api_route") || roles.has("controller")) {
    phrases.push("backend/API entry points");
  }

  if (roles.has("state_management")) {
    phrases.push("state or session management");
  }

  if (roles.has("service") || roles.has("repository") || roles.has("model")) {
    phrases.push("service/model layers");
  }

  return sentenceList(phrases);
}

function getFlowLabels(context: AssembledAiRepositoryContext) {
  return context.trace.selectedChunks
    .filter((chunk) => chunk.type === "architectural_group")
    .map((chunk) => chunk.label)
    .slice(0, 5);
}

function getFallbackOverview(context: AssembledAiRepositoryContext) {
  const frameworks = sentenceList(context.payload.detectedFrameworks.slice(0, 5));
  const flows = getFlowLabels(context);
  const flowPhrase = sentenceList(flows);
  const rolePhrase = getRolePhrase(context);
  const summary = context.payload.repositorySummary.replace(/\.$/, "");
  const firstParagraph = frameworks
    ? `This repository appears to be a ${frameworks} project. ${summary}.`
    : `This repository appears to be organized around the scanned source, configuration, and documentation context. ${summary}.`;
  const secondParagraph = flowPhrase
    ? `The strongest architectural signals are ${flowPhrase}. These selected flows are grounded in deterministic relationships, highlighted files, and file summaries rather than a raw repository dump.`
    : "The strongest architectural signals come from highlighted files, framework/context chunks, and deterministic file summaries rather than a raw repository dump.";
  const thirdParagraph = rolePhrase
    ? `The selected context emphasizes ${rolePhrase}, giving an onboarding-oriented view of how the application is organized.`
    : "The selected context gives an onboarding-oriented view of the repository organization while keeping prompt size bounded.";

  return [firstParagraph, secondParagraph, thirdParagraph].join("\n\n");
}

function getGeneratedUsing(context: AssembledAiRepositoryContext) {
  return {
    frameworks: context.payload.detectedFrameworks,
    chunks: context.trace.selectedChunks.map((chunk) => ({
      id: chunk.id,
      label: chunk.label,
      type: chunk.type,
      priority: chunk.priority,
      estimatedTokens: chunk.selectedTokenEstimate,
      files: chunk.files.map((file) => file.path),
    })),
    architecturalGroups: context.trace.includedArchitecturalGroups.map((group) => group.label),
    highlightedFiles: context.payload.highlightedFiles.map((file) => file.path),
  };
}

function toUnderstanding({
  overview,
  status,
  statusMessage,
  providerId,
  model,
  context,
  provider,
  fallbackReason,
}: {
  overview: string;
  status: AiRepositoryUnderstanding["status"];
  statusMessage: string;
  providerId: string;
  model?: string;
  context: AssembledAiRepositoryContext;
  provider?: AIProvider;
  fallbackReason?: string;
}): AiRepositoryUnderstanding {
  const routeCandidate = selectAiProviderCandidate({
    providers: [
      provider ?? {
        id: providerId,
        metadata: {
          deployment: "local",
        },
        async analyzeRepo() {
          return { content: overview };
        },
      },
    ],
    capability: "repository_overview",
  });

  return {
    version: "repo-understanding-v1",
    title: "Repository Understanding",
    overview,
    status,
    statusMessage,
    providerId,
    model,
    generatedUsing: getGeneratedUsing(context),
    trace: {
      promptVersion: PROMPT_VERSION,
      estimatedPromptTokens: context.trace.estimatedPromptTokens,
      selectedContextTokens: context.trace.selectedTokenEstimate,
      maxPromptTokens: context.trace.maxPromptTokens,
      selectedChunkCount: context.trace.selectedChunks.length,
      omittedChunkCount: context.trace.omittedChunks.length,
      tokenBudgetStatus: context.trace.budgeting.phase2BudgetStatus,
      providerDeployment: routeCandidate?.deployment === "unknown" ? undefined : routeCandidate?.deployment,
      promptFormat: routeCandidate?.promptFormat,
      fallbackReason,
    },
  };
}

export async function createRepositoryUnderstanding({
  aiContext,
  provider,
  maxPromptTokens,
  responseTokenReserve,
}: {
  aiContext: RepoAiContextPackage;
  provider?: AIProvider;
  maxPromptTokens?: number;
  responseTokenReserve?: number;
}): Promise<AiRepositoryUnderstanding> {
  if (!provider) {
    const context = assembleAiRepositoryContext({
      aiContext,
      maxPromptTokens,
      responseTokenReserve,
    });

    return toUnderstanding({
      overview: getFallbackOverview(context),
      status: "fallback",
      statusMessage:
        "AI provider unavailable. Showing a deterministic overview generated from the same curated context.",
      providerId: "deterministic-context-fallback",
      context,
      fallbackReason: "no AI provider configured",
    });
  }

  try {
    const result = await generateAiRepositoryOverview({
      aiContext,
      provider,
      maxPromptTokens,
      responseTokenReserve,
    });

    return toUnderstanding({
      overview: result.overview,
      status: "generated",
      statusMessage: "Generated from prioritized architectural context.",
      providerId: result.providerId,
      model: result.model,
      context: result.context,
      provider,
    });
  } catch (error) {
    const context = assembleAiRepositoryContext({
      aiContext,
      maxPromptTokens,
      responseTokenReserve,
    });

    return toUnderstanding({
      overview: getFallbackOverview(context),
      status: "fallback",
      statusMessage:
        "AI provider failed. Showing a deterministic overview generated from the same curated context.",
      providerId: provider.id,
      context,
      provider,
      fallbackReason: error instanceof Error ? error.message : "provider failure",
    });
  }
}
