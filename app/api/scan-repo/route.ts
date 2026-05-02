import { NextRequest, NextResponse } from "next/server";
import {
  canRunScan,
  getOneTimeTier,
  getSubscriptionPlan,
  getUpgradeMessage,
  incrementScanUsage,
} from "../../lib/pricing";
import { shouldScanRepositoryPath } from "../../lib/repo-filter";
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
      "User-Agent": "RepoCram",
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

function detectFrameworks(files: GitHubTreeItem[]) {
  const pathList = files.map((file) => file.path.toLowerCase());
  const paths = new Set(pathList);
  const frameworks = new Set<string>();

  if (
    paths.has("next.config.js") ||
    paths.has("next.config.mjs") ||
    paths.has("next.config.ts") ||
    pathList.some((path) => path.startsWith("app/") || path.startsWith("pages/"))
  ) {
    frameworks.add("Next.js");
  }

  if (paths.has("vite.config.js") || paths.has("vite.config.ts")) {
    frameworks.add("Vite");
  }

  if (pathList.some((path) => path.endsWith(".svelte") || path.includes("svelte.config."))) {
    frameworks.add("Svelte");
  }

  if (pathList.some((path) => path.endsWith(".vue") || path.includes("nuxt.config."))) {
    frameworks.add(paths.has("nuxt.config.ts") || paths.has("nuxt.config.js") ? "Nuxt" : "Vue");
  }

  if (pathList.some((path) => path.includes("angular.json"))) {
    frameworks.add("Angular");
  }

  if (pathList.some((path) => path.includes("django") || path.includes("manage.py"))) {
    frameworks.add("Django");
  }

  if (pathList.some((path) => path.includes("rails") || path === "gemfile")) {
    frameworks.add("Rails");
  }

  if (pathList.some((path) => path === "go.mod")) {
    frameworks.add("Go module");
  }

  if (pathList.some((path) => path === "cargo.toml")) {
    frameworks.add("Rust/Cargo");
  }

  if (
    pathList.some(
      (path) =>
        path.endsWith(".jsx") ||
        path.endsWith(".tsx") ||
        path.includes("react"),
    )
  ) {
    frameworks.add("React");
  }

  return [...frameworks].sort();
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
    const relevantFiles = files.filter((file) =>
      shouldScanRepositoryPath(file.path),
    );
    const totalEstimatedTokens = estimateTokens(relevantFiles);
    const detectedLanguages = detectLanguages(relevantFiles, languages);
    const detectedFrameworks = detectFrameworks(relevantFiles);
    const tier = getOneTimeTier(relevantFiles.length, totalEstimatedTokens);
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
      estimatedRelevantFileCount: relevantFiles.length,
      totalEstimatedTokens,
      detectedLanguages,
      detectedFrameworks,
      ...tier,
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
