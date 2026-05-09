import type { SubscriptionPlan } from "../pricing";
import type { RepoImprovement, RepoStructureAnalysis, RepositoryFile } from "./types.ts";

const VISIBLE_TEST_FILE_CAVEAT =
  "This is based on visible test files only; integration or end-to-end tests may cover multiple source files.";

function hasPath(files: RepositoryFile[], predicate: (path: string) => boolean) {
  return files.some((file) => predicate(file.path.toLowerCase()));
}

function hasFramework(detectedFrameworks: string[], framework: string) {
  return detectedFrameworks.includes(framework);
}

function hasAnyFramework(detectedFrameworks: string[], frameworks: string[]) {
  return frameworks.some((framework) => detectedFrameworks.includes(framework));
}

function addImprovement(
  improvements: RepoImprovement[],
  improvement: RepoImprovement,
) {
  if (!improvements.some((item) => item.title === improvement.title)) {
    improvements.push(improvement);
  }
}

export function getImprovementLimit(plan?: SubscriptionPlan) {
  if (!plan) {
    return 5;
  }

  if (plan.limits.suggestions === "full") {
    return 7;
  }

  if (plan.limits.suggestions === "priority") {
    return 5;
  }

  return 3;
}

export function getImprovements(
  files: RepositoryFile[],
  structure: RepoStructureAnalysis,
  totalEstimatedTokens: number,
  detectedFrameworks: string[],
) {
  const improvements: RepoImprovement[] = [];
  const visibleSourceToTestFileRatio =
    structure.sourceFileCount / Math.max(structure.testFileCount, 1);

  if (structure.testFileCount === 0 && structure.sourceFileCount > 0) {
    addImprovement(improvements, {
      title: "Expand automated test coverage",
      rationale: `No visible test files were found for the detected source files. ${VISIBLE_TEST_FILE_CAVEAT}`,
      priority: "high",
    });
  } else if (
    structure.sourceFileCount >= 20 &&
    visibleSourceToTestFileRatio > 10
  ) {
    addImprovement(improvements, {
      title: "Expand automated test coverage",
      rationale: `The scan found limited visible test files relative to the amount of source code. ${VISIBLE_TEST_FILE_CAVEAT}`,
      priority: "medium",
    });
  } else if (
    structure.sourceFileCount >= 20 &&
    visibleSourceToTestFileRatio > 5
  ) {
    addImprovement(improvements, {
      title: "Review automated test coverage",
      rationale: `The scan found a modest visible test-file signal relative to the amount of source code. ${VISIBLE_TEST_FILE_CAVEAT}`,
      priority: "low",
    });
  }

  if (!hasPath(files, (path) => path === "readme.md")) {
    addImprovement(improvements, {
      title: "Add a root README",
      rationale: "A concise setup and architecture note improves onboarding and future AI summaries.",
      priority: "high",
    });
  }

  if (!hasPath(files, (path) => path.startsWith(".github/workflows/"))) {
    addImprovement(improvements, {
      title: "Add continuous integration checks",
      rationale: "No GitHub Actions workflow was detected in the relevant tree.",
      priority: "medium",
    });
  }

  if (
    detectedFrameworks.includes("Next.js") &&
    !hasPath(files, (path) => path.includes("error.") || path.includes("loading."))
  ) {
    addImprovement(improvements, {
      title: "Review route loading and error states",
      rationale: "Next.js apps benefit from explicit loading and error boundaries around async routes.",
      priority: "high",
    });
  }

  if (
    hasFramework(detectedFrameworks, "Next.js") &&
    hasPath(files, (path) => path.includes("/api/")) &&
    !hasPath(files, (path) => path.includes("/api/") && path.includes("/lib/"))
  ) {
    addImprovement(improvements, {
      title: "Organize Next.js API route logic",
      rationale: "API route files are present; shared validation and service logic can keep route handlers focused.",
      priority: "medium",
    });
  }

  if (
    hasFramework(detectedFrameworks, "React") &&
    !hasFramework(detectedFrameworks, "Next.js") &&
    hasPath(files, (path) => path.includes("/components/")) &&
    !hasPath(files, (path) => path.includes("/hooks/"))
  ) {
    addImprovement(improvements, {
      title: "Separate React view logic into hooks",
      rationale: "Component files are visible but hook-level organization is limited in the scanned tree.",
      priority: "medium",
    });
  }

  if (
    hasAnyFramework(detectedFrameworks, ["Express", "Node.js"]) &&
    hasPath(files, (path) => path.includes("/routes/")) &&
    !hasPath(files, (path) => path.includes("/middleware/") || path.includes("errorhandler"))
  ) {
    addImprovement(improvements, {
      title: "Add centralized Node error middleware",
      rationale: "Route modules are visible, but no obvious middleware layer was found for shared error handling.",
      priority: "high",
    });
  }

  if (
    hasFramework(detectedFrameworks, "Flask") &&
    !hasPath(files, (path) => path.includes("/blueprints/") || path.includes("blueprint"))
  ) {
    addImprovement(improvements, {
      title: "Introduce Flask blueprint structure",
      rationale: "Flask apps stay easier to grow when routes are grouped into blueprints with service logic separated.",
      priority: "medium",
    });
  }

  if (
    hasFramework(detectedFrameworks, "Django") &&
    !hasPath(files, (path) => path.includes("/apps/") || path.includes("/settings/"))
  ) {
    addImprovement(improvements, {
      title: "Review Django app and settings organization",
      rationale: "Django projects benefit from clear app boundaries and environment-specific settings modules.",
      priority: "medium",
    });
  }

  if (
    hasFramework(detectedFrameworks, "FastAPI") &&
    !hasPath(files, (path) => path.includes("/routers/") || path.includes("/dependencies"))
  ) {
    addImprovement(improvements, {
      title: "Split FastAPI routers and dependencies",
      rationale: "FastAPI route files are easier to maintain when routers and dependency providers are organized explicitly.",
      priority: "medium",
    });
  }

  if (
    hasFramework(detectedFrameworks, "Spring Boot") &&
    structure.sourceFileCount > 0 &&
    !(
      hasPath(files, (path) => path.includes("controller")) &&
      hasPath(files, (path) => path.includes("service")) &&
      hasPath(files, (path) => path.includes("repository"))
    )
  ) {
    addImprovement(improvements, {
      title: "Review Spring Boot layering",
      rationale: "Spring Boot apps are easier to test and evolve with clear controller, service, repository, and configuration boundaries.",
      priority: "medium",
    });
  }

  if (structure.documentationFileCount <= 1 && structure.sourceFileCount > 20) {
    addImprovement(improvements, {
      title: "Document key workflows",
      rationale: "The repository has meaningful source surface but limited documentation files.",
      priority: "medium",
    });
  }

  if (totalEstimatedTokens > 180_000) {
    addImprovement(improvements, {
      title: "Split future AI analysis into focused passes",
      rationale: "The filtered repo is large enough that chunked summaries will control cost and context drift.",
      priority: "low",
    });
  }

  return improvements.sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 };

    return rank[a.priority] - rank[b.priority] || a.title.localeCompare(b.title);
  });
}
