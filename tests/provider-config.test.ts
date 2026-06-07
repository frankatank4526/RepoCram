import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createAIProviderFromConfig,
  getAIProviderConfig,
  getAIProviderDebugStatus,
  validateProviderConfig,
  type AIProviderEnv,
} from "../app/lib/ai-analysis.ts";

const workspace = new URL("../", import.meta.url);

function readWorkspaceFile(path: string) {
  return readFileSync(new URL(path, workspace), "utf8");
}

test("provider env parsing disables AI gracefully when no provider is configured", () => {
  const config = getAIProviderConfig({});
  const validation = validateProviderConfig(config);

  assert.equal(config.enabled, false);
  assert.equal(config.provider, "none");
  assert.equal(config.status, "disabled");
  assert.equal(validation.valid, false);
  assert.match(config.warnings.join("\n"), /AI_PROVIDER is not configured/);
  assert.equal(createAIProviderFromConfig(config), undefined);
});

test("OpenAI provider config validates API key and default model without exposing secrets", () => {
  const config = getAIProviderConfig({
    AI_PROVIDER: "openai",
    OPENAI_API_KEY: "sk-test-secret",
  });
  const status = getAIProviderDebugStatus(config);

  assert.equal(config.enabled, true);
  assert.equal(config.provider, "openai");
  assert.equal(config.status, "configured");
  assert.equal(config.openai.model, "gpt-4.1-mini");
  assert.equal(status.enabled, true);
  assert.ok(status.debugMessages.some((message) => message.includes("OpenAI provider configured")));
  assert.ok(!JSON.stringify(status).includes("sk-test-secret"));
});

test("OpenAI provider config reports missing key without crashing", () => {
  const config = getAIProviderConfig({
    AI_PROVIDER: "openai",
    OPENAI_MODEL: "gpt-4.1-mini",
  });

  assert.equal(config.enabled, false);
  assert.equal(config.provider, "openai");
  assert.equal(config.status, "invalid");
  assert.match(config.warnings.join("\n"), /Missing OPENAI_API_KEY/);
  assert.equal(createAIProviderFromConfig(config), undefined);
});

test("provider env parsing recognizes future Ollama config but keeps runtime disabled", () => {
  const config = getAIProviderConfig({
    AI_PROVIDER: "ollama",
    OLLAMA_BASE_URL: "http://localhost:11434",
    OLLAMA_MODEL: "llama-test",
  });

  assert.equal(config.enabled, false);
  assert.equal(config.provider, "ollama");
  assert.equal(config.status, "unsupported");
  assert.match(config.warnings.join("\n"), /runtime adapter is not implemented/);
  assert.equal(createAIProviderFromConfig(config), undefined);
});

test("OpenAI provider adapter uses configured endpoint with mocked fetch", async () => {
  const originalFetch = globalThis.fetch;
  const requests: { input: RequestInfo | URL; init?: RequestInit }[] = [];
  const env: AIProviderEnv = {
    AI_PROVIDER: "openai",
    OPENAI_API_KEY: "sk-test-secret",
    OPENAI_MODEL: "gpt-test",
    OPENAI_BASE_URL: "https://example.test/v1",
  };
  const config = getAIProviderConfig(env);
  const provider = createAIProviderFromConfig(config);

  assert.ok(provider);

  globalThis.fetch = (async (input, init) => {
    requests.push({ input, init });

    return new Response(
      JSON.stringify({
        model: "gpt-test",
        choices: [{ message: { content: "Grounded test overview." } }],
        usage: {
          prompt_tokens: 12,
          completion_tokens: 4,
          total_tokens: 16,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }) as typeof fetch;

  try {
    const response = await provider.analyzeRepo({
      capability: "repository_overview",
      context: {
        payload: {
          capability: "repository_overview",
          purpose: "repository_overview",
          repositorySummary: "test",
          detectedFrameworks: [],
          architecturalGroups: [],
          chunks: [],
          highlightedFiles: [],
          constraints: [],
        },
        messages: [],
        trace: {
          purpose: "repository_overview",
          focus: null,
          maxPromptTokens: 1000,
          responseTokenReserve: 100,
          availableContextTokens: 900,
          estimatedPromptTokens: 100,
          selectedTokenEstimate: 50,
          selectedChunks: [],
          omittedChunks: [],
          includedArchitecturalGroups: [],
          selectedFiles: [],
          budgeting: {
            strategy: "test",
            phase2EstimatedTokens: 50,
            phase2MaxRecommendedTokens: 1000,
            phase2BudgetStatus: "within_budget",
          },
        },
      },
      messages: [{ role: "user", content: "Summarize" }],
      maxOutputTokens: 64,
    });

    assert.equal(response.content, "Grounded test overview.");
    assert.equal(response.usage?.totalTokens, 16);
    assert.equal(String(requests[0]?.input), "https://example.test/v1/chat/completions");
    assert.equal(
      (requests[0]?.init?.headers as Record<string, string>).Authorization,
      "Bearer sk-test-secret",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("env files are ignored while .env.example remains committable", () => {
  const gitignore = readWorkspaceFile(".gitignore");
  const envExample = readWorkspaceFile(".env.example");

  [".env", ".env.local", ".env.development", ".env.production"].forEach((entry) => {
    assert.match(gitignore, new RegExp(`(^|\\n)${entry.replace(".", "\\.")}(\\n|$)`));
  });
  assert.match(gitignore, /!\.env\.example/);
  assert.match(envExample, /OPENAI_API_KEY=""/);
  assert.match(envExample, /AI_PROVIDER=""/);
  assert.ok(!envExample.includes("sk-"));
});
