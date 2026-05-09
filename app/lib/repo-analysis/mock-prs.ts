import type {
  MockPullRequestIdea,
  RepoImprovement,
  RepoStructureAnalysis,
  RepositoryFile,
} from "./types.ts";
import type { SubscriptionPlan } from "../pricing";

const SOURCE_EXTENSIONS = new Set([
  ".c",
  ".cpp",
  ".cs",
  ".go",
  ".java",
  ".js",
  ".jsx",
  ".kt",
  ".php",
  ".py",
  ".rb",
  ".rs",
  ".svelte",
  ".swift",
  ".ts",
  ".tsx",
  ".vue",
]);

function getFileName(path: string) {
  return path.split("/").pop()?.toLowerCase() ?? "";
}

function getExtension(path: string) {
  const fileName = getFileName(path);
  const dotIndex = fileName.lastIndexOf(".");

  return dotIndex > -1 ? fileName.slice(dotIndex) : "";
}

function hasPath(files: RepositoryFile[], predicate: (path: string) => boolean) {
  return files.some((file) => predicate(file.path.toLowerCase()));
}

function hasFramework(detectedFrameworks: string[], framework: string) {
  return detectedFrameworks.includes(framework);
}

function hasAnyFramework(detectedFrameworks: string[], frameworks: string[]) {
  return frameworks.some((framework) => detectedFrameworks.includes(framework));
}

export function getMockPullRequests(
  files: RepositoryFile[],
  structure: RepoStructureAnalysis,
  improvements: RepoImprovement[],
  detectedFrameworks: string[],
  plan?: SubscriptionPlan,
) {
  if (plan && !plan.limits.mockPrs) {
    return [];
  }

  const ideas: MockPullRequestIdea[] = [];
  const testTarget = files.find((file) => SOURCE_EXTENSIONS.has(getExtension(file.path)));
  const docsTarget = hasPath(files, (path) => path === "readme.md")
    ? ["README.md"]
    : ["README.md", "docs/architecture.md"];

  if (improvements.some((item) => item.title === "Add continuous integration checks")) {
    ideas.push({
      title: "Add baseline CI workflow",
      summary: "Run install, lint, and tests on pull requests before changes merge.",
      suggestedFiles: [".github/workflows/ci.yml", "package.json"],
    });
  }

  if (improvements.some((item) => item.title === "Expand automated test coverage")) {
    ideas.push({
      title: "Add focused regression tests",
      summary: "Cover the highest-value source paths surfaced by the repo scan.",
      suggestedFiles: testTarget ? [testTarget.path, "tests/"] : ["tests/"],
    });
  }

  if (
    hasFramework(detectedFrameworks, "Next.js") &&
    improvements.some((item) => item.title === "Review route loading and error states")
  ) {
    ideas.push({
      title: "Add loading and error boundaries to async routes",
      summary: "Introduce route-level loading and error files around the highest-value app routes.",
      suggestedFiles: ["app/loading.tsx", "app/error.tsx"],
    });
  }

  if (
    hasFramework(detectedFrameworks, "React") &&
    improvements.some((item) => item.title === "Separate React view logic into hooks")
  ) {
    ideas.push({
      title: "Refactor component logic into reusable hooks",
      summary: "Move repeated state and side-effect logic out of components into focused hook modules.",
      suggestedFiles: ["src/hooks/", "src/components/"],
    });
  }

  if (
    hasAnyFramework(detectedFrameworks, ["Express", "Node.js"]) &&
    improvements.some((item) => item.title === "Add centralized Node error middleware")
  ) {
    ideas.push({
      title: "Add shared Express error middleware",
      summary: "Centralize request error handling and wire it through the route stack.",
      suggestedFiles: ["src/middleware/errorHandler.ts", "src/routes/"],
    });
  }

  if (
    hasFramework(detectedFrameworks, "Flask") &&
    improvements.some((item) => item.title === "Introduce Flask blueprint structure")
  ) {
    ideas.push({
      title: "Introduce blueprint-based routing structure",
      summary: "Group Flask routes into blueprints and move reusable business logic into services.",
      suggestedFiles: ["app/blueprints/", "app/services/"],
    });
  }

  if (
    hasFramework(detectedFrameworks, "FastAPI") &&
    improvements.some((item) => item.title === "Split FastAPI routers and dependencies")
  ) {
    ideas.push({
      title: "Split routers and centralize dependency injection",
      summary: "Organize FastAPI route modules and dependency providers around feature boundaries.",
      suggestedFiles: ["app/routers/", "app/dependencies.py"],
    });
  }

  if (
    hasFramework(detectedFrameworks, "Spring Boot") &&
    improvements.some((item) => item.title === "Review Spring Boot layering")
  ) {
    ideas.push({
      title: "Separate controller service repository layers",
      summary: "Clarify Spring Boot package boundaries and move business logic out of controllers.",
      suggestedFiles: ["src/main/java/**/controller/", "src/main/java/**/service/"],
    });
  }

  if (structure.documentationFileCount <= 1) {
    ideas.push({
      title: "Improve project onboarding docs",
      summary: "Document local setup, scan boundaries, and the main architecture entry points.",
      suggestedFiles: docsTarget,
    });
  }

  return ideas.slice(0, 3);
}
