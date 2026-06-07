import { NextRequest, NextResponse } from "next/server";
import {
  createAIProviderFromConfig,
  createRepositoryUnderstanding,
  getAIProviderConfig,
} from "../../lib/ai-analysis";
import {
  canRunScan,
  getOneTimeTier,
  getSubscriptionPlan,
  getUpgradeMessage,
  incrementScanUsage,
} from "../../lib/pricing";
import {
  analyzeRepositoryQuality,
  detectRepositoryFrameworks,
} from "../../lib/repo-analysis";
import { classifyRepositoryPath } from "../../lib/repo-filter";
import type {
  RepoScanError,
  RepoScanResult,
  SubscriptionPlanId,
  SubscriptionUsage,
} from "../../types";

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".py": "Python",
  ".rb": "Ruby",
  ".go": "Go",
  ".rs": "Rust",
  ".java": "Java",
  ".kt": "Kotlin",
  ".swift": "Swift",
  ".php": "PHP",
  ".cs": "C#",
  ".cpp": "C++",
  ".c": "C",
  ".h": "C/C++",
  ".html": "HTML",
  ".css": "CSS",
  ".scss": "SCSS",
  ".vue": "Vue",
  ".svelte": "Svelte",
  ".md": "Markdown",
  ".json": "JSON",
  ".yml": "YAML",
  ".yaml": "YAML",
};

type GitHubRepo = {
  name: string;
  owner: { login: string };
  description: string | null;
  stargazers_count: number;
  default_branch: string;
};

type GitHubTreeItem = {
  path: string;
  type: "blob" | "tree" | string;
  size?: number;
};

type GitHubTreeResponse = {
  tree: GitHubTreeItem[];
  truncated: boolean;
};

type ParsedRepoUrl = {
  owner: string;
  repo: string;
};

type ScanRepoRequest = {
  repoUrl?: unknown;
  subscriptionPlanId?: SubscriptionPlanId;
  usage?: SubscriptionUsage;
};

function jsonError(
  status: number,
  code: RepoScanError["code"],
  error: string,
) {
  return NextResponse.json({ code, error } satisfies RepoScanError, { status });
}

function parseGitHubUrl(value: unknown): ParsedRepoUrl | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const url = new URL(value.trim());
    if (url.hostname.toLowerCase() !== "github.com") {
      return null;
    }

    const [owner, repoWithSuffix] = url.pathname
      .split("/")
      .filter(Boolean);

    if (!owner || !repoWithSuffix) {
      return null;
    }

    const repo = repoWithSuffix.replace(/\.git$/i, "");
    if (!repo || owner.includes("..") || repo.includes("..")) {
      return null;
    }

    return { owner, repo };
  } catch {
    return null;
  }
}

async function githubFetch<T>(path: string): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "RepoPilot",
    },
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    const rateRemaining = response.headers.get("x-ratelimit-remaining");

    if (response.status === 403 && rateRemaining === "0") {
      throw new GitHubApiError("RATE_LIMITED", response.status);
    }

    if (response.status === 404) {
      throw new GitHubApiError("NOT_FOUND", response.status);
    }

    if (response.status === 401 || response.status === 403) {
      throw new GitHubApiError("PRIVATE_OR_FORBIDDEN", response.status);
    }

    throw new GitHubApiError("GITHUB_ERROR", response.status);
  }

  return response.json() as Promise<T>;
}

class GitHubApiError extends Error {
  constructor(
    readonly code: RepoScanError["code"],
    readonly status: number,
  ) {
    super(code);
  }
}

function getExtension(path: string) {
  const fileName = path.split("/").pop() ?? "";
  const dotIndex = fileName.lastIndexOf(".");

  return dotIndex > -1 ? fileName.slice(dotIndex).toLowerCase() : "";
}

function estimateTokens(files: GitHubTreeItem[]) {
  const estimatedChars = files.reduce((sum, file) => {
    if (typeof file.size !== "number") {
      return sum + 800;
    }

    return sum + Math.min(file.size, 1_000_000);
  }, 0);

  return Math.ceil(estimatedChars / 4);
}

function detectLanguages(files: GitHubTreeItem[], languages: Record<string, number>) {
  const detected = new Set(Object.keys(languages));

  files.forEach((file) => {
    const language = EXTENSION_LANGUAGE_MAP[getExtension(file.path)];
    if (language) {
      detected.add(language);
    }
  });

  return Array.from(detected).sort();
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ScanRepoRequest;
    const parsed = parseGitHubUrl(body.repoUrl);
    const subscriptionPlan = body.subscriptionPlanId
      ? getSubscriptionPlan(body.subscriptionPlanId)
      : undefined;
    const usage = body.usage ?? { scansUsed: 0 };

    if (!parsed) {
      return jsonError(
        400,
        "INVALID_URL",
        "Enter a public GitHub repository URL like https://github.com/owner/repo.",
      );
    }

    if (subscriptionPlan) {
      const monthlyPermission = canRunScan(subscriptionPlan, usage, "small");

      if (!monthlyPermission.allowed) {
        return jsonError(
          403,
          "PLAN_LIMIT_EXCEEDED",
          getUpgradeMessage(subscriptionPlan, usage) ?? monthlyPermission.reason,
        );
      }
    }

    const repo = await githubFetch<GitHubRepo>(
      `/repos/${parsed.owner}/${parsed.repo}`,
    );
    const [languages, tree] = await Promise.all([
      githubFetch<Record<string, number>>(
        `/repos/${parsed.owner}/${parsed.repo}/languages`,
      ),
      githubFetch<GitHubTreeResponse>(
        `/repos/${parsed.owner}/${parsed.repo}/git/trees/${repo.default_branch}?recursive=1`,
      ),
    ]);

    const files = tree.tree.filter((item) => item.type === "blob");
    const relevantTreeFiles = files.filter((file) =>
      classifyRepositoryPath(file.path).shouldScan,
    );
    const totalEstimatedTokens = estimateTokens(relevantTreeFiles);
    const detectedLanguages = detectLanguages(relevantTreeFiles, languages);
    const detectedFrameworks = detectRepositoryFrameworks(relevantTreeFiles);
    const tier = getOneTimeTier(relevantTreeFiles.length, totalEstimatedTokens);
    const qualityAnalysis = analyzeRepositoryQuality({
      files,
      detectedLanguages,
      detectedFrameworks,
      totalEstimatedTokens,
      suggestedTier: tier.suggestedTier,
      plan: subscriptionPlan,
    });
    const aiProviderConfig = getAIProviderConfig();
    const aiProvider = createAIProviderFromConfig(aiProviderConfig);
    const repositoryUnderstanding = await createRepositoryUnderstanding({
      aiContext: qualityAnalysis.structure.aiContext,
      provider: aiProvider,
    });
    let updatedUsage: SubscriptionUsage | undefined;
    let upgradeMessage: string | null | undefined;

    if (subscriptionPlan) {
      const permission = canRunScan(
        subscriptionPlan,
        usage,
        tier.suggestedTier,
      );

      if (!permission.allowed) {
        return jsonError(
          403,
          "PLAN_LIMIT_EXCEEDED",
          getUpgradeMessage(subscriptionPlan, usage) ?? permission.reason,
        );
      }

      updatedUsage = incrementScanUsage(usage);
      upgradeMessage = getUpgradeMessage(subscriptionPlan, updatedUsage);
    }

    const result: RepoScanResult = {
      repoName: repo.name,
      owner: repo.owner.login,
      description: repo.description,
      stars: repo.stargazers_count,
      defaultBranch: repo.default_branch,
      languages,
      totalFileCount: files.length,
      estimatedRelevantFileCount: relevantTreeFiles.length,
      totalEstimatedTokens,
      detectedLanguages,
      detectedFrameworks,
      ...tier,
      ...qualityAnalysis,
      repositoryUnderstanding,
      usage: updatedUsage,
      upgradeMessage,
    };

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GitHubApiError) {
      if (error.code === "RATE_LIMITED") {
        return jsonError(
          429,
          "RATE_LIMITED",
          "GitHub rate limit reached. Try again later or add authentication in a future version.",
        );
      }

      if (error.code === "NOT_FOUND") {
        return jsonError(
          404,
          "NOT_FOUND",
          "Repository not found. Check the owner and repo name, and make sure it is public.",
        );
      }

      if (error.code === "PRIVATE_OR_FORBIDDEN") {
        return jsonError(
          403,
          "PRIVATE_OR_FORBIDDEN",
          "GitHub blocked this request. The repository may be private or unavailable without authentication.",
        );
      }

      return jsonError(
        error.status,
        "GITHUB_ERROR",
        "GitHub returned an unexpected error while scanning the repository.",
      );
    }

    return jsonError(
      500,
      "UNKNOWN_ERROR",
      "Something went wrong while scanning the repository.",
    );
  }
}
