import type { StackSignals } from "./types.ts";

export const SOURCE_EXTENSIONS = new Set([
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

export const ENTRY_EXTENSIONS = new Set([
  ".java",
  ".js",
  ".jsx",
  ".py",
  ".ts",
  ".tsx",
]);

export const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  ".c": "C",
  ".cpp": "C++",
  ".cs": "C#",
  ".css": "CSS",
  ".go": "Go",
  ".h": "C/C++",
  ".html": "HTML",
  ".java": "Java",
  ".js": "JavaScript",
  ".json": "JSON",
  ".jsx": "JavaScript",
  ".kt": "Kotlin",
  ".md": "Markdown",
  ".php": "PHP",
  ".py": "Python",
  ".rb": "Ruby",
  ".rs": "Rust",
  ".scss": "SCSS",
  ".sql": "SQL",
  ".svelte": "Svelte",
  ".swift": "Swift",
  ".toml": "TOML",
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".vue": "Vue",
  ".yaml": "YAML",
  ".yml": "YAML",
};

export const CONFIG_EXTENSIONS = new Set([
  ".json",
  ".toml",
  ".yaml",
  ".yml",
]);

export const STATIC_ASSET_EXTENSIONS = new Set([
  ".ico",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".pdf",
  ".zip",
  ".class",
  ".jar",
  ".dll",
  ".exe",
]);

export const DATA_ARTIFACT_EXTENSIONS = new Set([
  ".csv",
  ".jsonl",
  ".parquet",
  ".sqlite",
  ".db",
  ".log",
]);

const SCHEMA_CONTEXT_EXTENSIONS = new Set([".sql"]);

const TEMP_OUTPUT_SEGMENTS = new Set([
  ".cache",
  "cache",
  "coverage",
  "export",
  "exports",
  "generated",
  "output",
  "outputs",
  "temp",
  "tmp",
]);

const IMPORTANT_KEYWORDS = [
  "app",
  "client",
  "controller",
  "handler",
  "helper",
  "hook",
  "important",
  "index",
  "main",
  "manager",
  "model",
  "page",
  "repo",
  "repository",
  "server",
  "service",
  "start",
  "store",
  "util",
  "view",
];

const PROJECT_SIGNAL_PATTERNS = [
  /^package\.json$/,
  /^readme\./,
  /^pom\.xml$/,
  /^build\.gradle/,
  /^settings\.gradle/,
  /^requirements.*\.txt$/,
  /^pyproject\.toml$/,
  /^go\.mod$/,
  /^cargo\.toml$/,
];

const MEDIUM_IMPORTANCE_PATTERNS = [
  /^package\.json$/,
  /^readme\./,
  /^requirements.*\.txt$/,
  /^tsconfig\.json$/,
  /^next\.config\./,
  /^pom\.xml$/,
  /^build\.gradle/,
  /^dockerfile$/,
  /^docker-compose\./,
];

const MVC_PATH_SEGMENTS = new Set([
  "controllers",
  "controller",
  "models",
  "model",
  "views",
  "view",
  "routes",
  "route",
  "services",
  "service",
  "repositories",
  "repository",
  "middleware",
  "components",
  "component",
  "hooks",
  "hook",
  "stores",
  "store",
  "utils",
  "util",
  "lib",
  "schemas",
  "schema",
  "database",
  "db",
  "config",
]);

export function normalizePath(path: string) {
  return path.replaceAll("\\", "/").split("/").filter(Boolean).join("/");
}

export function getFileName(path: string) {
  return path.split("/").pop()?.toLowerCase() ?? "";
}

export function getExtension(path: string) {
  const fileName = getFileName(path);
  const dotIndex = fileName.lastIndexOf(".");

  return dotIndex > -1 ? fileName.slice(dotIndex) : "";
}

export function getRootDirectory(path: string) {
  const [root] = path.split("/");

  return path.includes("/") ? root : "(root)";
}

export function getPathDepth(path: string) {
  return normalizePath(path).split("/").filter(Boolean).length;
}

export function getPathParts(path: string) {
  return normalizePath(path).toLowerCase().split("/").filter(Boolean);
}

export function hasImportantKeyword(path: string) {
  const fileName = getFileName(path).replace(/\.[^.]+$/, "");

  return IMPORTANT_KEYWORDS.some((keyword) => fileName.includes(keyword));
}

export function getDescriptiveFileName(path: string) {
  return getFileName(path).replace(/\.[^.]+$/, "");
}

export function hasMvcSignal(path: string) {
  const parts = getPathParts(path);
  const fileName = getDescriptiveFileName(path);

  return (
    parts.some((part) => MVC_PATH_SEGMENTS.has(part)) ||
    [...MVC_PATH_SEGMENTS].some((segment) => fileName.includes(segment))
  );
}

export function hasProjectSignal(path: string) {
  const fileName = getFileName(path);

  return PROJECT_SIGNAL_PATTERNS.some((pattern) => pattern.test(fileName));
}

export function hasMediumImportanceSignal(path: string) {
  const fileName = getFileName(path);

  return MEDIUM_IMPORTANCE_PATTERNS.some((pattern) => pattern.test(fileName));
}

export function isCommonSourceArea(path: string) {
  const parts = getPathParts(path);

  return (
    parts.includes("src") ||
    parts.includes("app") ||
    parts.includes("api") ||
    parts.includes("pages") ||
    parts.includes("server") ||
    parts.includes("client")
  );
}

export function isExecutableSourceFile(path: string) {
  return ENTRY_EXTENSIONS.has(getExtension(path));
}

export function isDataArtifactFile(path: string) {
  return DATA_ARTIFACT_EXTENSIONS.has(getExtension(path));
}

export function isSchemaContextFile(path: string) {
  return SCHEMA_CONTEXT_EXTENSIONS.has(getExtension(path));
}

export function isTemporaryOrGeneratedOutput(path: string) {
  const parts = getPathParts(path);
  const fileName = getFileName(path);

  return (
    parts.some((part) => TEMP_OUTPUT_SEGMENTS.has(part)) ||
    /(?:^|[-_.])(export|generated|output|temp|tmp|cache)(?:[-_.]|$)/.test(fileName)
  );
}

export function isKnownRuntimeEntry(path: string) {
  const normalized = normalizePath(path).toLowerCase();
  const fileName = getFileName(normalized);

  return (
    normalized === "app/page.tsx" ||
    normalized === "app/page.ts" ||
    normalized === "app/layout.tsx" ||
    normalized === "app/layout.ts" ||
    normalized.endsWith("/app/page.tsx") ||
    normalized.endsWith("/app/page.ts") ||
    normalized.endsWith("/app/layout.tsx") ||
    normalized.endsWith("/app/layout.ts") ||
    fileName === "main.py" ||
    fileName === "app.py" ||
    fileName.includes("__main__")
  );
}

export function isRuntimeImportantPath(path: string) {
  const normalized = normalizePath(path).toLowerCase();

  return (
    isExecutableSourceFile(normalized) &&
    (isCommonSourceArea(normalized) ||
      hasImportantKeyword(normalized) ||
      isKnownRuntimeEntry(normalized))
  );
}

export function isRouteFile(path: string) {
  const fileName = getFileName(path);

  return fileName === "page.tsx" || fileName === "page.ts";
}

function getAppSegmentIndex(path: string) {
  return getPathParts(path).indexOf("app");
}

export function isRootAppRoute(path: string) {
  const parts = getPathParts(path);
  const appIndex = getAppSegmentIndex(path);

  return appIndex > -1 && parts[appIndex + 1] === getFileName(path);
}

export function isTopLevelFeatureRoute(path: string) {
  const parts = getPathParts(path);
  const appIndex = getAppSegmentIndex(path);

  if (appIndex === -1 || !isRouteFile(path)) {
    return false;
  }

  const routeSegments = parts.slice(appIndex + 1, -1).filter((part) =>
    !part.startsWith("("),
  );

  return routeSegments.length === 1;
}

export function isApiFile(path: string) {
  return getPathParts(path).includes("api");
}

export function hasDescriptiveFileName(path: string) {
  const name = getDescriptiveFileName(path);

  return name.length > 6 && !["index", "main", "app"].includes(name);
}

export function isConfigFile(path: string) {
  const fileName = getFileName(path);

  return (
    hasProjectSignal(path) ||
    hasMediumImportanceSignal(path) ||
    CONFIG_EXTENSIONS.has(getExtension(path)) ||
    fileName.endsWith(".xml") ||
    fileName.endsWith(".gradle")
  );
}

export function isLogicFile(path: string) {
  const normalized = normalizePath(path).toLowerCase();

  return (
    isExecutableSourceFile(normalized) &&
    !isConfigFile(normalized) &&
    !isRouteFile(normalized) &&
    (hasDescriptiveFileName(normalized) ||
      hasImportantKeyword(normalized) ||
      isCommonSourceArea(normalized))
  );
}

export function isFrontendComponentFile(path: string) {
  const extension = getExtension(path);
  const parts = getPathParts(path);

  return (
    [".jsx", ".tsx"].includes(extension) &&
    !isRouteFile(path) &&
    (parts.includes("components") ||
      parts.includes("component") ||
      parts.includes("app") ||
      parts.includes("pages"))
  );
}

export function isFrontendPath(path: string) {
  const parts = getPathParts(path);

  return (
    isRouteFile(path) ||
    isFrontendComponentFile(path) ||
    parts.includes("frontend") ||
    parts.includes("client") ||
    parts.includes("pages") ||
    parts.includes("components")
  );
}

export function isBackendApiPath(path: string) {
  const parts = getPathParts(path);

  return (
    isApiFile(path) ||
    parts.includes("backend") ||
    parts.includes("server") ||
    parts.includes("routes") ||
    parts.includes("controllers") ||
    parts.includes("controller")
  );
}

export function isFrontendPageFile(path: string) {
  const parts = getPathParts(path);

  return (
    isRouteFile(path) ||
    (isExecutableSourceFile(path) && parts.includes("pages") && !isBackendApiPath(path))
  );
}

export function isPythonEntryFile(path: string) {
  const fileName = getFileName(path);

  return fileName === "app.py" || fileName === "main.py" || fileName === "streamlit_app.py";
}

export function isPythonLogicFile(path: string) {
  return getExtension(path) === ".py" && (hasMvcSignal(path) || isPythonEntryFile(path));
}

export function isNodeEntryFile(path: string) {
  const fileName = getFileName(path);
  const extension = getExtension(path);

  return (
    [".js", ".ts"].includes(extension) &&
    ["server.js", "server.ts", "app.js", "app.ts", "index.js", "index.ts"].includes(fileName)
  );
}

export function isExpressLogicFile(path: string) {
  const extension = getExtension(path);

  return [".js", ".ts"].includes(extension) && hasMvcSignal(path);
}

export function isSpringJavaFile(path: string) {
  const fileName = path.split("/").pop() ?? "";

  return (
    getExtension(path) === ".java" &&
    /(?:Application|Controller|Service|Repository|Config)\.java$/i.test(fileName)
  );
}

export function getStackSignals(paths: string[]): StackSignals {
  const normalizedPaths = paths.map((path) => normalizePath(path).toLowerCase());
  const pathSet = new Set(normalizedPaths);
  const python = normalizedPaths.some((path) => path.endsWith(".py"));
  const java = normalizedPaths.some((path) => path.endsWith(".java"));
  const node =
    normalizedPaths.some((path) => getFileName(path) === "package.json") &&
    normalizedPaths.some((path) => [".js", ".jsx", ".ts", ".tsx"].includes(getExtension(path)));
  const reactNext =
    normalizedPaths.some((path) => /^next\.config\./.test(getFileName(path))) &&
    normalizedPaths.some((path) => getPathParts(path).includes("app") && path.endsWith(".tsx"));
  const express =
    node &&
    normalizedPaths.some(
      (path) =>
        isNodeEntryFile(path) ||
        getPathParts(path).some((part) =>
          ["routes", "controllers", "middleware", "services"].includes(part),
        ),
    );
  const spring =
    java &&
    (pathSet.has("pom.xml") ||
      normalizedPaths.some((path) => getFileName(path).startsWith("build.gradle")) ||
      normalizedPaths.some(isSpringJavaFile));
  const streamlit =
    python &&
    normalizedPaths.some(
      (path) =>
        path.includes(".streamlit") ||
        getFileName(path) === "streamlit_app.py" ||
        getFileName(path).includes("streamlit"),
    );

  return {
    python,
    streamlit,
    node,
    express,
    java,
    spring,
    reactNext,
  };
}

export function getTopLevelFolder(path: string) {
  const parts = normalizePath(path).split("/").filter(Boolean);

  return parts.length > 1 ? parts[0] : null;
}

export function getStructureKind(paths: string[]) {
  const normalizedPaths = paths.map((path) => normalizePath(path).toLowerCase());
  const hasFrontendSignal = normalizedPaths.some(
    (path) =>
      path === "package.json" ||
      path.startsWith("app/") ||
      path.startsWith("pages/") ||
      path.startsWith("components/") ||
      path.endsWith(".tsx") ||
      path.endsWith(".jsx"),
  );
  const hasBackendSignal = normalizedPaths.some(
    (path) =>
      path.startsWith("api/") ||
      path.startsWith("server/") ||
      path.includes("/api/") ||
      path.includes("/server/") ||
      path === "pom.xml" ||
      path.startsWith("build.gradle") ||
      path.endsWith(".java") ||
      path.endsWith(".py"),
  );

  if (hasFrontendSignal && hasBackendSignal) {
    return "mixed frontend/backend";
  }

  if (hasFrontendSignal) {
    return "frontend-oriented";
  }

  if (hasBackendSignal) {
    return "backend-oriented";
  }

  return "general-purpose";
}

export function getSizeLabel(fileCount: number) {
  if (fileCount <= 10) {
    return "small";
  }

  if (fileCount <= 80) {
    return "moderate";
  }

  return "large";
}

export function isTestFile(path: string) {
  const normalized = path.toLowerCase();

  return (
    normalized.includes("/test/") ||
    normalized.includes("/tests/") ||
    normalized.includes("__tests__") ||
    normalized.includes(".test.") ||
    normalized.includes(".spec.")
  );
}

export function isDocumentationFile(path: string) {
  const normalized = path.toLowerCase();

  return (
    normalized.endsWith(".md") ||
    normalized.startsWith("docs/") ||
    normalized.includes("/docs/")
  );
}
