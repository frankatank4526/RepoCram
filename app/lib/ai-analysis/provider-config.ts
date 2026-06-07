import type { AIProvider, AiProviderMetadata } from "./types.ts";

export type AIProviderName = "none" | "openai" | "ollama";

export type AIProviderEnv = Record<string, string | undefined>;

export type OpenAIProviderConfig = {
  provider: "openai";
  apiKey: string;
  model: string;
  baseUrl: string;
};

export type OllamaProviderConfig = {
  provider: "ollama";
  baseUrl: string;
  model: string;
};

export type AIProviderConfig =
  | {
      enabled: false;
      provider: "none";
      status: "disabled";
      warnings: string[];
      debugMessages: string[];
    }
  | {
      enabled: false;
      provider: AIProviderName;
      status: "invalid";
      warnings: string[];
      debugMessages: string[];
    }
  | {
      enabled: true;
      provider: "openai";
      status: "configured";
      openai: OpenAIProviderConfig;
      warnings: string[];
      debugMessages: string[];
    }
  | {
      enabled: false;
      provider: "ollama";
      status: "unsupported";
      ollama: Partial<OllamaProviderConfig>;
      warnings: string[];
      debugMessages: string[];
    };

const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";

function readEnvValue(env: AIProviderEnv, key: string) {
  const value = env[key]?.trim();

  return value ? value : undefined;
}

function normalizeProvider(value: string | undefined): AIProviderName {
  if (!value || value === "none" || value === "disabled") {
    return "none";
  }

  if (value === "openai" || value === "ollama") {
    return value;
  }

  return "none";
}

function maskSecret(value: string | undefined) {
  if (!value) {
    return "missing";
  }

  return "configured";
}

export function getAIProviderConfig(env: AIProviderEnv = process.env): AIProviderConfig {
  const rawProvider = readEnvValue(env, "AI_PROVIDER")?.toLowerCase();
  const provider = normalizeProvider(rawProvider);

  if (rawProvider && provider === "none" && rawProvider !== "none" && rawProvider !== "disabled") {
    return {
      enabled: false,
      provider: "none",
      status: "invalid",
      warnings: [`Unsupported AI_PROVIDER value: ${rawProvider}`],
      debugMessages: ["AI provider disabled because the configured provider is unsupported."],
    };
  }

  if (provider === "none") {
    return {
      enabled: false,
      provider: "none",
      status: "disabled",
      warnings: ["AI_PROVIDER is not configured; deterministic repository understanding fallback will be used."],
      debugMessages: ["No AI provider configured."],
    };
  }

  if (provider === "ollama") {
    const baseUrl = readEnvValue(env, "OLLAMA_BASE_URL");
    const model = readEnvValue(env, "OLLAMA_MODEL");

    return {
      enabled: false,
      provider: "ollama",
      status: "unsupported",
      ollama: {
        provider: "ollama",
        baseUrl,
        model,
      },
      warnings: [
        "OLLAMA provider configuration is recognized, but the runtime adapter is not implemented yet.",
      ],
      debugMessages: [
        `Ollama base URL: ${baseUrl ? "configured" : "missing"}`,
        `Ollama model: ${model ?? "missing"}`,
      ],
    };
  }

  const apiKey = readEnvValue(env, "OPENAI_API_KEY");
  const model = readEnvValue(env, "OPENAI_MODEL") ?? DEFAULT_OPENAI_MODEL;
  const baseUrl = readEnvValue(env, "OPENAI_BASE_URL") ?? DEFAULT_OPENAI_BASE_URL;

  if (!apiKey) {
    return {
      enabled: false,
      provider: "openai",
      status: "invalid",
      warnings: ["Missing OPENAI_API_KEY for AI_PROVIDER=openai."],
      debugMessages: [
        "OpenAI provider disabled because OPENAI_API_KEY is missing.",
        `Using model ${model} once configured.`,
      ],
    };
  }

  return {
    enabled: true,
    provider: "openai",
    status: "configured",
    openai: {
      provider: "openai",
      apiKey,
      model,
      baseUrl,
    },
    warnings: [],
    debugMessages: [
      "OpenAI provider configured.",
      `Using model ${model}.`,
      `OPENAI_API_KEY is ${maskSecret(apiKey)}.`,
    ],
  };
}

export function validateProviderConfig(config: AIProviderConfig) {
  return {
    valid: config.enabled,
    status: config.status,
    provider: config.provider,
    warnings: config.warnings,
    debugMessages: config.debugMessages,
  };
}

export function getProviderMetadataFromConfig(config: AIProviderConfig): AiProviderMetadata | null {
  if (config.enabled && config.provider === "openai") {
    return {
      displayName: "OpenAI",
      family: "openai",
      deployment: "cloud",
      endpointKind: "hosted_api",
      supportsStreaming: false,
      defaultModel: config.openai.model,
      models: [
        {
          modelId: config.openai.model,
          providerFamily: "openai",
          deployment: "cloud",
          supportsStreaming: false,
          supportedCapabilities: ["repository_overview"],
          promptFormats: ["openai_compatible_messages"],
        },
      ],
    };
  }

  if ("ollama" in config) {
    return {
      displayName: "Ollama",
      family: "ollama",
      deployment: "local",
      endpointKind: "local_server",
      supportsStreaming: false,
      defaultModel: config.ollama.model,
      models: config.ollama.model
        ? [
            {
              modelId: config.ollama.model,
              providerFamily: "ollama",
              deployment: "local",
              supportsStreaming: false,
              supportedCapabilities: ["repository_overview"],
              promptFormats: ["chat_messages"],
            },
          ]
        : [],
    };
  }

  return null;
}

export function getAIProviderDebugStatus(config: AIProviderConfig) {
  return {
    provider: config.provider,
    status: config.status,
    enabled: config.enabled,
    warnings: config.warnings,
    debugMessages: config.debugMessages,
  };
}

export function createAIProviderFromConfig(config: AIProviderConfig): AIProvider | undefined {
  const metadata = getProviderMetadataFromConfig(config);

  if (!config.enabled || config.provider !== "openai" || !metadata) {
    return undefined;
  }

  return {
    id: "openai",
    metadata,
    async analyzeRepo(request) {
      const response = await fetch(`${config.openai.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.openai.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: request.model ?? config.openai.model,
          messages: request.messages,
          max_tokens: request.maxOutputTokens,
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI provider request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as {
        model?: string;
        choices?: { message?: { content?: string } }[];
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };
      const content = payload.choices?.[0]?.message?.content?.trim();

      if (!content) {
        throw new Error("OpenAI provider returned an empty response.");
      }

      return {
        content,
        model: payload.model ?? request.model ?? config.openai.model,
        usage: {
          promptTokens: payload.usage?.prompt_tokens,
          completionTokens: payload.usage?.completion_tokens,
          totalTokens: payload.usage?.total_tokens,
        },
      };
    },
  };
}
