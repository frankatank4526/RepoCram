import assert from "node:assert/strict";
import test from "node:test";
import {
  assembleAiRepositoryContext,
  createRepositoryUnderstanding,
  generateAiRepositoryOverview,
  getPromptTokenLimitForCandidate,
  selectAiProviderCandidate,
  type AIProvider,
  type AiProviderRequest,
} from "../app/lib/ai-analysis.ts";
import {
  analyzeRepositoryQuality,
  detectRepositoryFrameworks,
  type RepoAiContextPackage,
  type RepoContextFileRef,
} from "../app/lib/repo-analysis.ts";

function analyzeFreestyleFood() {
  const files = [
    { path: "freestyle-food/README.md", size: 1200 },
    { path: "freestyle-food/package.json", size: 900 },
    { path: "freestyle-food/next.config.ts", size: 300 },
    { path: "freestyle-food/app/layout.tsx", size: 1600 },
    { path: "freestyle-food/app/(freestyle-food)/account/page.tsx", size: 1800 },
    { path: "freestyle-food/app/(freestyle-food)/account/Session.tsx", size: 3600 },
    { path: "freestyle-food/app/(freestyle-food)/account/store.ts", size: 1600 },
    { path: "freestyle-food/app/(freestyle-food)/recipes/page.tsx", size: 1800 },
    { path: "freestyle-food/app/(freestyle-food)/recipes/client.ts", size: 1900 },
    { path: "freestyle-food/app/(freestyle-food)/recipes/RecipeMaker.tsx", size: 4200 },
    { path: "freestyle-food/app/api/categories/route.ts", size: 1800 },
    { path: "freestyle-food/app/api/recipes/route.ts", size: 2300 },
    { path: "freestyle-food/app/favicon.ico", size: 6000 },
  ];
  const paths = files.map((file) => file.path);

  return analyzeRepositoryQuality({
    files,
    detectedLanguages: ["TypeScript", "Markdown"],
    detectedFrameworks: detectRepositoryFrameworks(paths, {
      "freestyle-food/package.json": JSON.stringify({
        dependencies: { next: "16.0.0", react: "19.0.0" },
      }),
    }),
    totalEstimatedTokens: 18_000,
    suggestedTier: "medium",
  });
}

function makeFileRef({
  path,
  priority,
  estimatedTokens,
  highlighted = true,
}: {
  path: string;
  priority: RepoContextFileRef["priority"];
  estimatedTokens: number;
  highlighted?: boolean;
}): RepoContextFileRef {
  return {
    path,
    role: path.includes("route") ? "api_route" : "frontend_page",
    category: path.includes("route") ? "backend_api" : "frontend_route",
    domain: path.split("/")[1] ?? null,
    highlighted,
    priority,
    estimatedTokens,
    summary: `${path} deterministic summary.`,
    reasons: ["test context"],
  };
}

function makeSyntheticAiContext(): RepoAiContextPackage {
  const criticalFile = makeFileRef({
    path: "app/orders/page.tsx",
    priority: "critical",
    estimatedTokens: 260,
  });
  const mediumFile = makeFileRef({
    path: "components/MarketingPanel.tsx",
    priority: "medium",
    estimatedTokens: 260,
  });
  const lowFile = makeFileRef({
    path: "docs/notes.md",
    priority: "low",
    estimatedTokens: 260,
    highlighted: false,
  });

  return {
    version: "phase3-groundwork-v1",
    detectedFrameworks: ["Next.js", "React"],
    repositorySummary: "Synthetic repository context for prompt budgeting tests.",
    tokenBudget: {
      estimatedTokens: 2_000,
      maxRecommendedTokens: 12_000,
      budgetStatus: "within_budget",
      fileTokenEstimate: 1_200,
      summaryTokenEstimate: 200,
      relationshipTokenEstimate: 0,
      strategy: "test strategy",
    },
    highlightedFiles: [criticalFile, mediumFile],
    architecturalGroups: [
      {
        id: "orders-flow",
        label: "Orders Flow",
        type: "frontend_backend_flow",
        summary: "Orders page and route context.",
        files: ["app/orders/page.tsx"],
        roles: ["frontend_page", "api_route"],
        relationshipTypes: ["framework_flow"],
        confidence: "strong",
        reasons: ["orders flow"],
      },
    ],
    representativeFlows: [
      {
        id: "group:orders-flow",
        label: "Orders Flow",
        type: "architectural_group",
        summary: "Orders page and route context.",
        priority: "critical",
        estimatedTokens: 360,
        files: [criticalFile],
        relationships: [],
        architecturalGroupId: "orders-flow",
        reasons: ["orders flow"],
      },
    ],
    chunks: [
      {
        id: "group:orders-flow",
        label: "Orders Flow",
        type: "architectural_group",
        summary: "Orders page and route context.",
        priority: "critical",
        estimatedTokens: 360,
        files: [criticalFile],
        relationships: [],
        architecturalGroupId: "orders-flow",
        reasons: ["orders flow"],
      },
      {
        id: "highlighted-reading-list",
        label: "Highlighted Reading List",
        type: "highlighted_files",
        summary: "Secondary highlighted files.",
        priority: "medium",
        estimatedTokens: 360,
        files: [mediumFile],
        relationships: [],
        reasons: ["fallback"],
      },
      {
        id: "low-docs",
        label: "Low Docs",
        type: "domain_context",
        summary: "Low-priority docs.",
        priority: "low",
        estimatedTokens: 360,
        files: [lowFile],
        relationships: [],
        reasons: ["low priority"],
      },
    ],
    prioritization: {
      highPriorityFiles: ["app/orders/page.tsx"],
      deferredFiles: ["docs/notes.md"],
      reasons: ["test context"],
    },
  };
}

test("AI context assembly builds overview prompts from Phase 2 architectural chunks", () => {
  const analysis = analyzeFreestyleFood();
  const assembled = assembleAiRepositoryContext({
    aiContext: analysis.structure.aiContext,
    maxPromptTokens: 8_000,
  });
  const selectedLabels = assembled.trace.selectedChunks.map((chunk) => chunk.label);

  assert.ok(selectedLabels.includes("Recipe Flow"));
  assert.ok(selectedLabels.includes("Account Auth Flow"));
  assert.ok(assembled.payload.detectedFrameworks.includes("Next.js"));
  assert.ok(
    assembled.trace.selectedFiles.some(
      (file) => file.path === "freestyle-food/app/api/recipes/route.ts",
    ),
  );
  assert.ok(assembled.trace.estimatedPromptTokens <= assembled.trace.maxPromptTokens);
  assert.match(assembled.messages[1].content, /curated context/i);
});

test("AI context assembly trims lower-value chunks when prompt budget is tight", () => {
  const assembled = assembleAiRepositoryContext({
    aiContext: makeSyntheticAiContext(),
    maxPromptTokens: 1_800,
    responseTokenReserve: 900,
  });
  const selectedLabels = assembled.trace.selectedChunks.map((chunk) => chunk.label);
  const omittedLabels = assembled.trace.omittedChunks.map((chunk) => chunk.label);

  assert.deepEqual(selectedLabels, ["Orders Flow"]);
  assert.ok(omittedLabels.includes("Highlighted Reading List"));
  assert.ok(omittedLabels.includes("Low Docs"));
  assert.ok(
    assembled.trace.includedArchitecturalGroups.some(
      (group) => group.label === "Orders Flow",
    ),
  );
  assert.ok(assembled.trace.selectedTokenEstimate <= assembled.trace.availableContextTokens);
});

test("AI repository overview uses provider abstraction without live API calls", async () => {
  const analysis = analyzeFreestyleFood();
  let capturedRequest: AiProviderRequest | null = null;
  const provider: AIProvider = {
    id: "mock-provider",
    async summarizeArchitecture(request) {
      capturedRequest = request;

      return {
        content:
          "This curated overview identifies a Next.js/React app with recipe and account flows grounded in selected architectural chunks.",
        model: "mock-architecture-model",
        usage: {
          promptTokens: request.context.trace.estimatedPromptTokens,
          completionTokens: 24,
          totalTokens: request.context.trace.estimatedPromptTokens + 24,
        },
      };
    },
    async analyzeRepo() {
      throw new Error("summarizeArchitecture should be used when available");
    },
  };
  const result = await generateAiRepositoryOverview({
    aiContext: analysis.structure.aiContext,
    provider,
    maxPromptTokens: 8_000,
  });

  assert.ok(capturedRequest);
  assert.equal(capturedRequest?.capability, "repository_overview");
  assert.equal(result.providerId, "mock-provider");
  assert.equal(result.model, "mock-architecture-model");
  assert.match(result.overview, /Next\.js\/React app/);
  assert.ok(
    result.context.trace.selectedChunks.some((chunk) => chunk.label === "Recipe Flow"),
  );
});

test("AI provider metadata supports local and cloud routing groundwork", () => {
  const cloudProvider: AIProvider = {
    id: "cloud-openai-compatible",
    metadata: {
      displayName: "Cloud OpenAI-compatible Provider",
      family: "openai",
      deployment: "cloud",
      endpointKind: "hosted_api",
      defaultModel: "cloud-deep",
      models: [
        {
          modelId: "cloud-deep",
          providerFamily: "openai",
          deployment: "cloud",
          contextWindowTokens: 128_000,
          supportsStreaming: true,
          supportedCapabilities: ["repository_overview"],
          promptFormats: ["openai_compatible_messages"],
        },
      ],
    },
    async analyzeRepo() {
      throw new Error("not called");
    },
  };
  const localProvider: AIProvider = {
    id: "local-ollama",
    metadata: {
      displayName: "Local Ollama",
      family: "ollama",
      deployment: "local",
      endpointKind: "local_server",
      defaultModel: "local-summary",
      models: [
        {
          modelId: "local-summary",
          providerFamily: "ollama",
          deployment: "local",
          contextWindowTokens: 8_192,
          supportsStreaming: false,
          estimatedLatency: "medium",
          supportedCapabilities: ["repository_overview"],
          promptFormats: ["chat_messages"],
        },
      ],
    },
    async analyzeRepo() {
      throw new Error("not called");
    },
  };
  const selectedLocal = selectAiProviderCandidate({
    providers: [cloudProvider, localProvider],
    capability: "repository_overview",
    preference: "prefer_local",
  });
  const selectedCloud = selectAiProviderCandidate({
    providers: [cloudProvider, localProvider],
    capability: "repository_overview",
    preference: "prefer_cloud",
  });

  assert.equal(selectedLocal?.provider.id, "local-ollama");
  assert.equal(selectedLocal?.model?.modelId, "local-summary");
  assert.equal(selectedLocal?.deployment, "local");
  assert.equal(selectedLocal?.promptFormat, "chat_messages");
  assert.equal(selectedCloud?.provider.id, "cloud-openai-compatible");
  assert.equal(selectedCloud?.promptFormat, "openai_compatible_messages");
  assert.equal(
    getPromptTokenLimitForCandidate({
      candidate: selectedLocal,
      fallbackPromptTokens: 12_000,
      responseTokenReserve: 900,
    }),
    7_292,
  );
});

test("AI repository overview passes model and prompt format hints without vendor coupling", async () => {
  const analysis = analyzeFreestyleFood();
  let capturedRequest: AiProviderRequest | null = null;
  const provider: AIProvider = {
    id: "local-lm-studio",
    metadata: {
      family: "lm_studio",
      deployment: "local",
      endpointKind: "local_server",
      defaultModel: "local-repo-summary",
      models: [
        {
          modelId: "local-repo-summary",
          providerFamily: "lm_studio",
          deployment: "local",
          contextWindowTokens: 4_096,
          promptFormats: ["openai_compatible_messages"],
          supportedCapabilities: ["repository_overview"],
        },
      ],
    },
    async analyzeRepo(request) {
      capturedRequest = request;

      return {
        content: "Local overview from curated context.",
      };
    },
  };
  const result = await generateAiRepositoryOverview({
    aiContext: analysis.structure.aiContext,
    provider,
  });

  assert.equal(result.providerId, "local-lm-studio");
  assert.equal(capturedRequest?.model, "local-repo-summary");
  assert.equal(capturedRequest?.promptFormat, "openai_compatible_messages");
  assert.ok((capturedRequest?.context.trace.maxPromptTokens ?? 0) <= 3_196);
  assert.match(result.overview, /Local overview/);
});

test("repository understanding exposes a concise provider-generated UI payload", async () => {
  const analysis = analyzeFreestyleFood();
  const provider: AIProvider = {
    id: "mock-visible-provider",
    metadata: {
      deployment: "cloud",
      defaultModel: "visible-summary-model",
      models: [
        {
          modelId: "visible-summary-model",
          deployment: "cloud",
          contextWindowTokens: 16_000,
          supportedCapabilities: ["repository_overview"],
          promptFormats: ["chat_messages"],
        },
      ],
    },
    async analyzeRepo(request) {
      assert.equal(request.capability, "repository_overview");
      assert.ok(request.messages[1].content.includes("Prioritized representative context chunks"));

      return {
        content:
          "This repository appears to use Next.js and React for recipe and account workflows.\n\nThe summary is grounded in selected architecture chunks.",
        model: request.model,
      };
    },
  };
  const understanding = await createRepositoryUnderstanding({
    aiContext: analysis.structure.aiContext,
    provider,
  });

  assert.equal(understanding.status, "generated");
  assert.equal(understanding.providerId, "mock-visible-provider");
  assert.equal(understanding.model, "visible-summary-model");
  assert.ok(understanding.generatedUsing.chunks.some((chunk) => chunk.label === "Recipe Flow"));
  assert.ok(understanding.trace.estimatedPromptTokens <= understanding.trace.maxPromptTokens);
  assert.equal(understanding.trace.promptVersion, "repo-understanding-prompt-v1");
  assert.match(understanding.overview, /Next\.js and React/);
});

test("repository understanding falls back gracefully when no provider is configured", async () => {
  const analysis = analyzeFreestyleFood();
  const understanding = await createRepositoryUnderstanding({
    aiContext: analysis.structure.aiContext,
    maxPromptTokens: 8_000,
  });

  assert.equal(understanding.status, "fallback");
  assert.equal(understanding.providerId, "deterministic-context-fallback");
  assert.match(understanding.statusMessage, /AI provider unavailable/);
  assert.match(understanding.overview, /This repository appears to be/);
  assert.ok(understanding.generatedUsing.frameworks.includes("Next.js"));
  assert.ok(understanding.generatedUsing.chunks.length > 0);
  assert.ok(understanding.trace.fallbackReason);
});

test("repository understanding falls back gracefully after provider failure", async () => {
  const analysis = analyzeFreestyleFood();
  const provider: AIProvider = {
    id: "failing-provider",
    metadata: {
      deployment: "self_hosted",
    },
    async analyzeRepo() {
      throw new Error("self-hosted endpoint unavailable");
    },
  };
  const understanding = await createRepositoryUnderstanding({
    aiContext: analysis.structure.aiContext,
    provider,
  });

  assert.equal(understanding.status, "fallback");
  assert.equal(understanding.providerId, "failing-provider");
  assert.match(understanding.statusMessage, /AI provider failed/);
  assert.equal(understanding.trace.providerDeployment, "self_hosted");
  assert.equal(understanding.trace.fallbackReason, "self-hosted endpoint unavailable");
});
