import type { OneTimeScanTier, SubscriptionPlan } from "./pricing";

export type RepositoryFile = {
  path: string;
  size?: number;
};

export type RepoDirectorySignal = {
  name: string;
  fileCount: number;
};

export type RepoStructureAnalysis = {
  topDirectories: RepoDirectorySignal[];
  importantFiles: string[];
  sourceFileCount: number;
  testFileCount: number;
  configFileCount: number;
  documentationFileCount: number;
};

export type RepoStructureSummary = {
  totalFiles: number;
  languages: Record<string, number>;
  topLevelFolders: string[];
  importantFiles: string[];
  likelyEntryPoints: string[];
  summary: string;
};

export type RepoImprovement = {
  title: string;
  rationale: string;
  priority: "high" | "medium" | "low";
};

export type MockPullRequestIdea = {
  title: string;
  summary: string;
  suggestedFiles: string[];
};

export type AnalysisBudget = {
  sampledFileCount: number;
  estimatedPromptTokens: number;
  strategy: string;
};

export type RepoQualityAnalysis = {
  summary: string[];
  structure: RepoStructureAnalysis;
  improvements: RepoImprovement[];
  mockPullRequests: MockPullRequestIdea[];
  analysisBudget: AnalysisBudget;
};

export type FileContentMap = Record<string, string>;

type ImportantFileCategory = "api" | "logic" | "route" | "config" | "other";

type FrameworkDetectionContext = {
  paths: string[];
  lowerPaths: string[];
  pathSet: Set<string>;
  extensionCounts: Map<string, number>;
  fileContents?: FileContentMap;
  pythonFileCount: number;
  jsFileCount: number;
  tsxFileCount: number;
  javaFileCount: number;
  cppFileCount: number;
  sourceFileCount: number;
  pythonDominant: boolean;
  jsDominant: boolean;
};

type FrameworkDetectionResult = {
  name: string;
  confidence: number;
  signals: string[];
};

type FrameworkDetector = {
  name: string;
  languages: string[];
  detect: (context: FrameworkDetectionContext) => FrameworkDetectionResult | null;
};

type StackSignals = {
  python: boolean;
  streamlit: boolean;
  node: boolean;
  express: boolean;
  java: boolean;
  spring: boolean;
  reactNext: boolean;
};

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

const ENTRY_EXTENSIONS = new Set([
  ".java",
  ".js",
  ".jsx",
  ".py",
  ".ts",
  ".tsx",
]);

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
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
  ".svelte": "Svelte",
  ".swift": "Swift",
  ".toml": "TOML",
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".vue": "Vue",
  ".yaml": "YAML",
  ".yml": "YAML",
};

const CONFIG_EXTENSIONS = new Set([
  ".json",
  ".toml",
  ".yaml",
  ".yml",
]);

const STATIC_ASSET_EXTENSIONS = new Set([
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

const VISIBLE_TEST_FILE_CAVEAT =
  "This is based on visible test files only; integration or end-to-end tests may cover multiple source files.";

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

function normalizePath(path: string) {
  return path.replaceAll("\\", "/").split("/").filter(Boolean).join("/");
}

function getFileName(path: string) {
  return path.split("/").pop()?.toLowerCase() ?? "";
}

function getExtension(path: string) {
  const fileName = getFileName(path);
  const dotIndex = fileName.lastIndexOf(".");

  return dotIndex > -1 ? fileName.slice(dotIndex) : "";
}

function getRootDirectory(path: string) {
  const [root] = path.split("/");

  return path.includes("/") ? root : "(root)";
}

function getPathDepth(path: string) {
  return normalizePath(path).split("/").filter(Boolean).length;
}

function getPathParts(path: string) {
  return normalizePath(path).toLowerCase().split("/").filter(Boolean);
}

function hasImportantKeyword(path: string) {
  const fileName = getFileName(path).replace(/\.[^.]+$/, "");

  return IMPORTANT_KEYWORDS.some((keyword) => fileName.includes(keyword));
}

function hasMvcSignal(path: string) {
  const parts = getPathParts(path);
  const fileName = getDescriptiveFileName(path);

  return (
    parts.some((part) => MVC_PATH_SEGMENTS.has(part)) ||
    [...MVC_PATH_SEGMENTS].some((segment) => fileName.includes(segment))
  );
}

function hasProjectSignal(path: string) {
  const fileName = getFileName(path);

  return PROJECT_SIGNAL_PATTERNS.some((pattern) => pattern.test(fileName));
}

function hasMediumImportanceSignal(path: string) {
  const fileName = getFileName(path);

  return MEDIUM_IMPORTANCE_PATTERNS.some((pattern) => pattern.test(fileName));
}

function isCommonSourceArea(path: string) {
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

function isExecutableSourceFile(path: string) {
  return ENTRY_EXTENSIONS.has(getExtension(path));
}

function isKnownRuntimeEntry(path: string) {
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

function isRuntimeImportantPath(path: string) {
  const normalized = normalizePath(path).toLowerCase();

  return (
    isExecutableSourceFile(normalized) &&
    (isCommonSourceArea(normalized) ||
      hasImportantKeyword(normalized) ||
      isKnownRuntimeEntry(normalized))
  );
}

function isRouteFile(path: string) {
  const fileName = getFileName(path);

  return fileName === "page.tsx" || fileName === "page.ts";
}

function getAppSegmentIndex(path: string) {
  return getPathParts(path).indexOf("app");
}

function isRootAppRoute(path: string) {
  const parts = getPathParts(path);
  const appIndex = getAppSegmentIndex(path);

  return appIndex > -1 && parts[appIndex + 1] === getFileName(path);
}

function isTopLevelFeatureRoute(path: string) {
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

function isApiFile(path: string) {
  return getPathParts(path).includes("api");
}

function getDescriptiveFileName(path: string) {
  return getFileName(path).replace(/\.[^.]+$/, "");
}

function hasDescriptiveFileName(path: string) {
  const name = getDescriptiveFileName(path);

  return name.length > 6 && !["index", "main", "app"].includes(name);
}

function isLogicFile(path: string) {
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

function isPythonEntryFile(path: string) {
  const fileName = getFileName(path);

  return fileName === "app.py" || fileName === "main.py" || fileName === "streamlit_app.py";
}

function isPythonLogicFile(path: string) {
  return getExtension(path) === ".py" && (hasMvcSignal(path) || isPythonEntryFile(path));
}

function isNodeEntryFile(path: string) {
  const fileName = getFileName(path);
  const extension = getExtension(path);

  return (
    [".js", ".ts"].includes(extension) &&
    ["server.js", "server.ts", "app.js", "app.ts", "index.js", "index.ts"].includes(fileName)
  );
}

function isExpressLogicFile(path: string) {
  const extension = getExtension(path);

  return [".js", ".ts"].includes(extension) && hasMvcSignal(path);
}

function isSpringJavaFile(path: string) {
  const fileName = path.split("/").pop() ?? "";

  return (
    getExtension(path) === ".java" &&
    /(?:Application|Controller|Service|Repository|Config)\.java$/i.test(fileName)
  );
}

function getStackSignals(paths: string[]): StackSignals {
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

function getTopLevelFolder(path: string) {
  const parts = normalizePath(path).split("/").filter(Boolean);

  return parts.length > 1 ? parts[0] : null;
}

function getFileImportanceScore(path: string, stackSignals?: StackSignals) {
  const normalized = normalizePath(path).toLowerCase();
  const fileName = getFileName(normalized);
  const extension = getExtension(normalized);
  const stacks = stackSignals ?? getStackSignals([normalized]);
  let score = 0;

  if (STATIC_ASSET_EXTENSIONS.has(extension)) {
    return 0;
  }

  if (isTestFile(normalized)) {
    return 0;
  }

  if (
    normalized.includes("/generated/") ||
    normalized.includes("/build/") ||
    normalized.includes("/target/")
  ) {
    return 0;
  }

  if (isExecutableSourceFile(normalized)) {
    score += 3;
  }

  if (isApiFile(normalized)) {
    score += 3;
  }

  if (isCommonSourceArea(normalized)) {
    score += 2;
  }

  if (hasImportantKeyword(normalized)) {
    score += 1;
  }

  if (hasMvcSignal(normalized)) {
    score += 2;
  }

  if (isKnownRuntimeEntry(normalized)) {
    score += 3;
  }

  if (stacks.python && extension === ".py") {
    score += 2;
  }

  if (stacks.python && isPythonEntryFile(normalized)) {
    score += 6;
  }

  if (stacks.streamlit && fileName === "streamlit_app.py") {
    score += 5;
  } else if (stacks.streamlit && extension === ".py" && getPathParts(normalized).includes("pages")) {
    score += 2;
  }

  if (stacks.python && isPythonLogicFile(normalized)) {
    score += 4;
  }

  if (stacks.express && isNodeEntryFile(normalized)) {
    score += 6;
  }

  if (stacks.express && isExpressLogicFile(normalized)) {
    score += 4;
  }

  if (stacks.spring && extension === ".java") {
    score += 2;
  }

  if (stacks.spring && isSpringJavaFile(normalized)) {
    score += 6;
  }

  if (
    stacks.spring &&
    getPathParts(normalized).includes("src") &&
    getPathParts(normalized).includes("main") &&
    getPathParts(normalized).includes("java")
  ) {
    score += 2;
  }

  if (isRootAppRoute(normalized)) {
    score += 3;
  } else if (isTopLevelFeatureRoute(normalized)) {
    score += 2;
  }

  if (
    getPathParts(normalized).includes("src") ||
    getPathParts(normalized).includes("app") ||
    getPathParts(normalized).includes("lib")
  ) {
    score += 1;
  }

  if (!isConfigFile(normalized) && !isRouteFile(normalized)) {
    score += 1;
  }

  if (hasDescriptiveFileName(normalized)) {
    score += 1;
  }

  if (/^[A-Z]/.test(path.split("/").pop() ?? "")) {
    score += 2;
  }

  if (isRouteFile(normalized)) {
    score -= 1;
  }

  if (hasMediumImportanceSignal(normalized)) {
    score += 2;
  }

  if (hasProjectSignal(normalized)) {
    score += 1;
  }

  if (getPathDepth(normalized) <= 2 && SOURCE_EXTENSIONS.has(extension)) {
    score += 1;
  }

  if (getPathDepth(normalized) > 4) {
    score -= 1;
  }

  if (CONFIG_EXTENSIONS.has(extension) && score === 0) {
    score += 1;
  }

  return score;
}

function getEntryPointScore(path: string) {
  const normalized = normalizePath(path);
  const extension = getExtension(normalized);
  let score = 0;

  if (!ENTRY_EXTENSIONS.has(extension)) {
    return 0;
  }

  if (hasImportantKeyword(normalized)) {
    score += 4;
  }

  if (isCommonSourceArea(normalized)) {
    score += 2;
  }

  if (getPathDepth(normalized) <= 2) {
    score += 1;
  }

  return score;
}

function getStructureKind(paths: string[]) {
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

function countByExtension(paths: string[]) {
  const counts = new Map<string, number>();

  paths.forEach((path) => {
    const extension = getExtension(path);

    if (extension) {
      counts.set(extension, (counts.get(extension) ?? 0) + 1);
    }
  });

  return counts;
}

function getExtensionCount(counts: Map<string, number>, extensions: string[]) {
  return extensions.reduce((sum, extension) => sum + (counts.get(extension) ?? 0), 0);
}

function hasContentSignal(
  fileContents: FileContentMap | undefined,
  predicate: (path: string, content: string) => boolean,
) {
  if (!fileContents) {
    return false;
  }

  return Object.entries(fileContents).some(([path, content]) =>
    predicate(normalizePath(path).toLowerCase(), content.toLowerCase()),
  );
}

function getFrameworkDetectionContext(
  files: string[] | RepositoryFile[],
  fileContents?: FileContentMap,
): FrameworkDetectionContext {
  const paths = files.map((file) =>
    normalizePath(typeof file === "string" ? file : file.path),
  );
  const lowerPaths = paths.map((path) => path.toLowerCase());
  const pathSet = new Set(lowerPaths);
  const extensionCounts = countByExtension(lowerPaths);
  const pythonFileCount = getExtensionCount(extensionCounts, [".py"]);
  const jsFileCount = getExtensionCount(extensionCounts, [
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
  ]);
  const tsxFileCount = getExtensionCount(extensionCounts, [".tsx"]);
  const javaFileCount = getExtensionCount(extensionCounts, [".java"]);
  const cppFileCount = getExtensionCount(extensionCounts, [
    ".c",
    ".cc",
    ".cpp",
    ".cxx",
    ".h",
    ".hpp",
  ]);
  const sourceFileCount = pythonFileCount + jsFileCount + javaFileCount + cppFileCount;
  const pythonDominant =
    pythonFileCount > 0 && pythonFileCount >= Math.max(jsFileCount, javaFileCount, 1);
  const jsDominant =
    jsFileCount > 0 && jsFileCount >= Math.max(pythonFileCount, javaFileCount, 1);

  return {
    paths,
    lowerPaths,
    pathSet,
    extensionCounts,
    fileContents,
    pythonFileCount,
    jsFileCount,
    tsxFileCount,
    javaFileCount,
    cppFileCount,
    sourceFileCount,
    pythonDominant,
    jsDominant,
  };
}

function hasPathSignal(
  context: FrameworkDetectionContext,
  predicate: (path: string) => boolean,
) {
  return context.lowerPaths.some(predicate);
}

function hasPackageDependency(context: FrameworkDetectionContext, dependency: string) {
  return hasContentSignal(
    context.fileContents,
    (path, content) =>
      getFileName(path) === "package.json" &&
      new RegExp(`"${dependency}"\\s*:`).test(content),
  );
}

function hasTextDependency(
  context: FrameworkDetectionContext,
  fileNamePattern: RegExp,
  dependency: string,
) {
  return hasContentSignal(
    context.fileContents,
    (path, content) =>
      fileNamePattern.test(getFileName(path)) &&
      new RegExp(`(^|[^a-z0-9_-])${dependency}([^a-z0-9_-]|$)`).test(content),
  );
}

function hasPythonImport(context: FrameworkDetectionContext, moduleName: string) {
  return hasContentSignal(
    context.fileContents,
    (path, content) =>
      path.endsWith(".py") &&
      new RegExp(`(^|\\s)(import\\s+${moduleName}\\b|from\\s+${moduleName}\\b)`).test(
        content,
      ),
  );
}

function frameworkResult(
  name: string,
  confidence: number,
  signals: string[],
  minimumConfidence = 0.5,
) {
  if (confidence < minimumConfidence || signals.length < 2) {
    return null;
  }

  return {
    name,
    confidence: Math.min(Number(confidence.toFixed(2)), 1),
    signals,
  };
}

function addSignal(
  signals: string[],
  condition: boolean,
  label: string,
  weight: number,
) {
  if (!condition) {
    return 0;
  }

  signals.push(label);
  return weight;
}

const FRAMEWORK_DETECTORS: FrameworkDetector[] = [
  {
    name: "Next.js",
    languages: ["ts", "tsx", "js", "jsx"],
    detect: (context) => {
      const signals: string[] = [];
      const hasNextConfig = hasPathSignal(context, (path) =>
        /^next\.config\./.test(getFileName(path)),
      );
      const hasAppOrPagesTsx = hasPathSignal(
        context,
        (path) =>
          (getPathParts(path).includes("app") || getPathParts(path).includes("pages")) &&
          path.endsWith(".tsx"),
      );
      const hasNextDependency = hasPackageDependency(context, "next");

      if (!context.jsDominant && !hasNextDependency) {
        return null;
      }

      const confidence =
        addSignal(signals, context.jsDominant, "JavaScript/TypeScript source is prominent", 0.1) +
        addSignal(signals, hasNextConfig, "next.config.* is present", 0.4) +
        addSignal(signals, hasAppOrPagesTsx, "App or Pages Router TSX files are present", 0.35) +
        addSignal(signals, hasNextDependency, "package.json references next", 0.25);

      return frameworkResult("Next.js", confidence, signals, 0.65);
    },
  },
  {
    name: "React",
    languages: ["ts", "tsx", "js", "jsx"],
    detect: (context) => {
      const signals: string[] = [];
      const hasJsx = getExtensionCount(context.extensionCounts, [".jsx", ".tsx"]) > 0;
      const hasComponentPath = hasPathSignal(
        context,
        (path) =>
          getPathParts(path).includes("components") ||
          (path.endsWith(".tsx") && !isRouteFile(path)),
      );
      const hasReactDependency = hasPackageDependency(context, "react");
      const confidence =
        addSignal(signals, context.jsDominant, "JavaScript/TypeScript source is prominent", 0.1) +
        addSignal(signals, hasJsx, "JSX/TSX files are present", 0.35) +
        addSignal(signals, hasComponentPath, "component-style files are present", 0.2) +
        addSignal(signals, hasReactDependency, "package.json references react", 0.35);

      return frameworkResult("React", confidence, signals, 0.45);
    },
  },
  {
    name: "Express",
    languages: ["js", "ts"],
    detect: (context) => {
      const signals: string[] = [];
      const hasExpressDependency = hasPackageDependency(context, "express");
      const hasEntryFile = hasPathSignal(context, isNodeEntryFile);
      const hasBackendFolders = hasPathSignal(context, (path) =>
        getPathParts(path).some((part) =>
          ["routes", "controllers", "middleware", "services"].includes(part),
        ),
      );
      const confidence =
        addSignal(signals, context.jsDominant, "JavaScript/TypeScript source is prominent", 0.1) +
        addSignal(signals, hasExpressDependency, "package.json references express", 0.45) +
        addSignal(signals, hasEntryFile, "server/app/index entry file is present", 0.25) +
        addSignal(signals, hasBackendFolders, "backend route/controller/service folders are present", 0.25);

      return frameworkResult("Express", confidence, signals, 0.55);
    },
  },
  {
    name: "Node.js",
    languages: ["js", "ts"],
    detect: (context) => {
      const signals: string[] = [];
      const hasPackageJson = context.lowerPaths.some((path) => getFileName(path) === "package.json");
      const hasBackendEntry = hasPathSignal(context, isNodeEntryFile);
      const hasBackendFolders = hasPathSignal(context, (path) =>
        getPathParts(path).some((part) =>
          ["routes", "controllers", "middleware", "services"].includes(part),
        ),
      );
      const hasFrontendRouter = hasPathSignal(
        context,
        (path) =>
          /^next\.config\./.test(getFileName(path)) ||
          getPathParts(path).includes("components"),
      );
      const confidence =
        addSignal(signals, context.jsDominant, "JavaScript/TypeScript source is prominent", 0.15) +
        addSignal(signals, hasPackageJson, "package.json is present", 0.25) +
        addSignal(signals, hasBackendEntry, "server/app/index entry file is present", 0.3) +
        addSignal(signals, hasBackendFolders, "backend route/controller/service folders are present", 0.25);

      if (hasFrontendRouter && !hasBackendEntry && !hasBackendFolders) {
        return null;
      }

      return frameworkResult("Node.js", confidence, signals, 0.5);
    },
  },
  {
    name: "Vite",
    languages: ["ts", "tsx", "js", "jsx"],
    detect: (context) => {
      const signals: string[] = [];
      const hasViteConfig = hasPathSignal(context, (path) =>
        /^vite\.config\./.test(getFileName(path)),
      );
      const hasViteDependency = hasPackageDependency(context, "vite");
      const confidence =
        addSignal(signals, context.jsDominant, "JavaScript/TypeScript source is prominent", 0.1) +
        addSignal(signals, hasViteConfig, "vite.config.* is present", 0.65) +
        addSignal(signals, hasViteDependency, "package.json references vite", 0.25);

      return frameworkResult("Vite", confidence, signals, 0.6);
    },
  },
  {
    name: "Streamlit",
    languages: ["py"],
    detect: (context) => {
      const signals: string[] = [];
      const hasStreamlitPath = hasPathSignal(
        context,
        (path) =>
          path.includes(".streamlit") ||
          getFileName(path) === "streamlit_app.py" ||
          getFileName(path).includes("streamlit"),
      );
      const hasStreamlitDependency =
        hasTextDependency(context, /^requirements.*\.txt$/, "streamlit") ||
        hasTextDependency(context, /^pyproject\.toml$/, "streamlit") ||
        hasPythonImport(context, "streamlit");
      const confidence =
        addSignal(signals, context.pythonDominant, "Python source is prominent", 0.15) +
        addSignal(signals, hasStreamlitPath, "Streamlit path or entry naming is present", 0.45) +
        addSignal(signals, hasStreamlitDependency, "Streamlit dependency/import is present", 0.4);

      return frameworkResult("Streamlit", confidence, signals, 0.55);
    },
  },
  {
    name: "Flask",
    languages: ["py"],
    detect: (context) => {
      const signals: string[] = [];
      const hasFlaskDependency =
        hasTextDependency(context, /^requirements.*\.txt$/, "flask") ||
        hasTextDependency(context, /^pyproject\.toml$/, "flask") ||
        hasPythonImport(context, "flask");
      const hasRuntimeShape = hasPathSignal(
        context,
        (path) =>
          isPythonEntryFile(path) ||
          getPathParts(path).some((part) => ["routes", "views", "templates"].includes(part)),
      );
      const confidence =
        addSignal(signals, context.pythonDominant, "Python source is prominent", 0.15) +
        addSignal(signals, hasFlaskDependency, "Flask dependency/import is present", 0.5) +
        addSignal(signals, hasRuntimeShape, "Flask-style entry/routes/views are present", 0.25);

      return frameworkResult("Flask", confidence, signals, 0.55);
    },
  },
  {
    name: "Django",
    languages: ["py"],
    detect: (context) => {
      const signals: string[] = [];
      const hasManagePy = context.pathSet.has("manage.py");
      const hasSettingsPy = hasPathSignal(context, (path) => getFileName(path) === "settings.py");
      const hasDjangoDependency =
        hasTextDependency(context, /^requirements.*\.txt$/, "django") ||
        hasTextDependency(context, /^pyproject\.toml$/, "django") ||
        hasPythonImport(context, "django");
      const confidence =
        addSignal(signals, context.pythonFileCount > 0, "Python files are present", 0.1) +
        addSignal(signals, hasManagePy, "manage.py is present", 0.4) +
        addSignal(signals, hasSettingsPy, "settings.py is present", 0.25) +
        addSignal(signals, hasDjangoDependency, "Django dependency/import is present", 0.3);

      return frameworkResult("Django", confidence, signals, 0.6);
    },
  },
  {
    name: "FastAPI",
    languages: ["py"],
    detect: (context) => {
      const signals: string[] = [];
      const hasFastApiDependency =
        hasTextDependency(context, /^requirements.*\.txt$/, "fastapi") ||
        hasTextDependency(context, /^pyproject\.toml$/, "fastapi") ||
        hasPythonImport(context, "fastapi");
      const hasApiShape = hasPathSignal(
        context,
        (path) =>
          isPythonEntryFile(path) ||
          getPathParts(path).some((part) => ["api", "routes", "schemas"].includes(part)),
      );
      const confidence =
        addSignal(signals, context.pythonDominant, "Python source is prominent", 0.15) +
        addSignal(signals, hasFastApiDependency, "FastAPI dependency/import is present", 0.5) +
        addSignal(signals, hasApiShape, "API/routes/schema files are present", 0.25);

      return frameworkResult("FastAPI", confidence, signals, 0.55);
    },
  },
  {
    name: "Python",
    languages: ["py"],
    detect: (context) => {
      const signals: string[] = [];
      const hasPythonManifest =
        hasPathSignal(
          context,
          (path) => /^requirements.*\.txt$/.test(getFileName(path)) || getFileName(path) === "pyproject.toml",
        );
      const confidence =
        addSignal(signals, context.pythonDominant, "Python source is prominent", 0.4) +
        addSignal(signals, hasPythonManifest, "Python dependency manifest is present", 0.25);

      return frameworkResult("Python", confidence, signals, 0.55);
    },
  },
  {
    name: "Spring Boot",
    languages: ["java"],
    detect: (context) => {
      const signals: string[] = [];
      const hasSpringDependency =
        hasTextDependency(context, /^pom\.xml$/, "spring-boot") ||
        hasTextDependency(context, /^build\.gradle/, "spring-boot");
      const hasApplicationFile = hasPathSignal(
        context,
        (path) => getExtension(path) === ".java" && /Application\.java$/i.test(path.split("/").pop() ?? ""),
      );
      const hasSpringShape = hasPathSignal(context, isSpringJavaFile);
      const hasBuildFile =
        context.pathSet.has("pom.xml") ||
        hasPathSignal(context, (path) => /^build\.gradle/.test(getFileName(path)));
      const confidence =
        addSignal(signals, context.javaFileCount > 0, "Java files are present", 0.1) +
        addSignal(signals, hasBuildFile, "Maven/Gradle build file is present", 0.15) +
        addSignal(signals, hasSpringDependency, "spring-boot dependency is present", 0.45) +
        addSignal(signals, hasApplicationFile, "Application.java entry file is present", 0.25) +
        addSignal(signals, hasSpringShape, "Spring-style controller/service/repository files are present", 0.2);

      return frameworkResult("Spring Boot", confidence, signals, 0.6);
    },
  },
  {
    name: "Maven/Gradle",
    languages: ["java", "kotlin"],
    detect: (context) => {
      const signals: string[] = [];
      const hasBuildFile =
        context.pathSet.has("pom.xml") ||
        hasPathSignal(context, (path) => /^build\.gradle/.test(getFileName(path)));
      const confidence =
        addSignal(signals, context.javaFileCount > 0, "Java files are present", 0.2) +
        addSignal(signals, hasBuildFile, "Maven/Gradle build file is present", 0.65);

      return frameworkResult("Maven/Gradle", confidence, signals, 0.65);
    },
  },
  {
    name: "CMake",
    languages: ["c", "cpp"],
    detect: (context) => {
      const signals: string[] = [];
      const hasCMake = hasPathSignal(context, (path) => getFileName(path) === "cmakelists.txt");
      const confidence =
        addSignal(signals, context.cppFileCount > 0, "C/C++ files are present", 0.2) +
        addSignal(signals, hasCMake, "CMakeLists.txt is present", 0.7);

      return frameworkResult("CMake", confidence, signals, 0.7);
    },
  },
  {
    name: "Docker",
    languages: ["general"],
    detect: (context) => {
      const signals: string[] = [];
      const hasDockerfile = hasPathSignal(context, (path) => getFileName(path) === "dockerfile");
      const hasCompose = hasPathSignal(context, (path) => /^docker-compose\./.test(getFileName(path)));
      const confidence =
        addSignal(signals, context.sourceFileCount > 0, "source files are present", 0.1) +
        addSignal(signals, hasDockerfile, "Dockerfile is present", 0.6) +
        addSignal(signals, hasCompose, "docker-compose file is present", 0.25);

      return frameworkResult("Docker", confidence, signals, 0.65);
    },
  },
  {
    name: "Monorepo",
    languages: ["general"],
    detect: (context) => {
      const signals: string[] = [];
      const packageJsonCount = context.lowerPaths.filter(
        (path) => getFileName(path) === "package.json",
      ).length;
      const topLevelWorkspaces = new Set(
        context.lowerPaths
          .map((path) => getTopLevelFolder(path))
          .filter((folder): folder is string =>
            Boolean(folder && ["apps", "packages", "services"].includes(folder)),
          ),
      );
      const servicePackageCount = context.lowerPaths.filter(
        (path) =>
          getFileName(path) === "package.json" &&
          getPathParts(path).some((part) => ["apps", "packages", "services"].includes(part)),
      ).length;
      const confidence =
        addSignal(signals, packageJsonCount > 1, "multiple package.json files are present", 0.45) +
        addSignal(signals, topLevelWorkspaces.size > 0, "workspace-style top-level folders are present", 0.2) +
        addSignal(signals, servicePackageCount > 1, "multiple app/package/service manifests are present", 0.3);

      return frameworkResult("Monorepo", confidence, signals, 0.65);
    },
  },
];

export function detectRepositoryFrameworks(
  files: string[] | RepositoryFile[],
  fileContents?: FileContentMap,
) {
  const context = getFrameworkDetectionContext(files, fileContents);

  return FRAMEWORK_DETECTORS
    .map((detector) => detector.detect(context))
    .filter((result): result is FrameworkDetectionResult => Boolean(result))
    .sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name))
    .slice(0, 3)
    .map((result) => result.name);
}

function getSizeLabel(fileCount: number) {
  if (fileCount <= 10) {
    return "small";
  }

  if (fileCount <= 80) {
    return "moderate";
  }

  return "large";
}

function sortScoredPaths(paths: string[], getScore: (path: string) => number) {
  return paths
    .map((path) => ({ path, score: getScore(path) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .map((item) => item.path);
}

function getImportantFileLimit(fileCount: number) {
  if (fileCount < 50) {
    return 10;
  }

  if (fileCount < 150) {
    return 12;
  }

  if (fileCount < 300) {
    return 16;
  }

  return 20;
}

function getImportantFileCategory(path: string): ImportantFileCategory {
  if (isApiFile(path) && !isRouteFile(path)) {
    return "api";
  }

  if (isLogicFile(path)) {
    return "logic";
  }

  if (isRouteFile(path)) {
    return "route";
  }

  if (isConfigFile(path)) {
    return "config";
  }

  return "other";
}

function getFeatureGroup(path: string) {
  const parts = getPathParts(path);
  const routeGroupIndex = parts.findIndex(
    (part) => part.startsWith("(") && part.endsWith(")"),
  );

  if (routeGroupIndex > -1 && parts[routeGroupIndex + 1]) {
    return parts[routeGroupIndex + 1];
  }

  const appIndex = parts.indexOf("app");
  if (appIndex > -1 && parts[appIndex + 1]) {
    return parts[appIndex + 1];
  }

  const srcIndex = parts.indexOf("src");
  if (srcIndex > -1 && parts[srcIndex + 1]) {
    return parts[srcIndex + 1];
  }

  return parts[0] ?? path;
}

function selectImportantFiles(paths: string[]) {
  const limit = getImportantFileLimit(paths.length);
  const stackSignals = getStackSignals(paths);
  const scored = paths
    .map((path) => ({
      path,
      score: getFileImportanceScore(path, stackSignals),
      category: getImportantFileCategory(path),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  const sorted = scored.map((item) => item.path);
  const selected = new Set<string>();
  const categoryTargets: Record<ImportantFileCategory, number> = {
    api: Math.max(1, Math.round(limit * 0.25)),
    logic: Math.max(1, Math.round(limit * 0.35)),
    route: Math.max(1, Math.round(limit * 0.25)),
    config: Math.max(1, Math.round(limit * 0.15)),
    other: Math.max(1, Math.round(limit * 0.1)),
  };
  const getSelectedCategoryCount = (category: string) =>
    [...selected].filter((path) => getImportantFileCategory(path) === category).length;
  const addPath = (path: string) => {
    if (selected.size < limit) {
      selected.add(path);
    }
  };
  const addDiverseFromBucket = (
    bucket: string[],
    maxCount: number,
    getGroup: (path: string) => string,
  ) => {
    let added = bucket.filter((path) => selected.has(path)).length;
    const seenGroups = new Set<string>();

    bucket.forEach((path) => {
      if (selected.size >= limit || added >= maxCount) {
        return;
      }

      const group = getGroup(path);
      if (selected.has(path) || seenGroups.has(group)) {
        return;
      }

      selected.add(path);
      seenGroups.add(group);
      added += 1;
    });

    bucket.forEach((path) => {
      if (selected.size >= limit || added >= maxCount || selected.has(path)) {
        return;
      }

      selected.add(path);
      added += 1;
    });
  };
  const routeFiles = sorted.filter(isRouteFile);
  const apiFiles = sorted.filter((path) => isApiFile(path) && !isRouteFile(path));
  const logicFiles = sorted.filter(
    (path) => isLogicFile(path) && !isApiFile(path),
  );
  const configFiles = sorted.filter(isConfigFile);

  [apiFiles, logicFiles, routeFiles].forEach((bucket) => {
    if (bucket.length > 0) {
      addPath(bucket[0]);
    }
  });

  addDiverseFromBucket(routeFiles, categoryTargets.route, getFeatureGroup);
  addDiverseFromBucket(logicFiles, categoryTargets.logic, getFeatureGroup);

  scored.forEach((item) => {
    if (selected.size >= limit || selected.has(item.path)) {
      return;
    }

    if (getSelectedCategoryCount(item.category) < categoryTargets[item.category]) {
      addPath(item.path);
    }
  });

  scored.forEach((item) => {
    if (selected.size >= limit || selected.has(item.path)) {
      return;
    }

    const target = categoryTargets[item.category];
    const currentCount = getSelectedCategoryCount(item.category);
    const hasOverflowScore = item.score >= 7;

    if (currentCount < target + 1 || hasOverflowScore) {
      addPath(item.path);
    }
  });

  return [...selected];
}

function isTestFile(path: string) {
  const normalized = path.toLowerCase();

  return (
    normalized.includes("/test/") ||
    normalized.includes("/tests/") ||
    normalized.includes("__tests__") ||
    normalized.includes(".test.") ||
    normalized.includes(".spec.")
  );
}

function isDocumentationFile(path: string) {
  const normalized = path.toLowerCase();

  return (
    normalized.endsWith(".md") ||
    normalized.startsWith("docs/") ||
    normalized.includes("/docs/")
  );
}

function isConfigFile(path: string) {
  const fileName = getFileName(path);

  return (
    hasProjectSignal(path) ||
    hasMediumImportanceSignal(path) ||
    CONFIG_EXTENSIONS.has(getExtension(path)) ||
    fileName.endsWith(".xml") ||
    fileName.endsWith(".gradle")
  );
}

export function analyzeRepoStructure(files: string[]): RepoStructureSummary {
  const normalizedFiles = files.map(normalizePath).filter(Boolean);
  const languages: Record<string, number> = {};
  const topLevelFolders = new Set<string>();

  normalizedFiles.forEach((path) => {
    const language = EXTENSION_LANGUAGE_MAP[getExtension(path)];
    const topLevelFolder = getTopLevelFolder(path);

    if (language) {
      languages[language] = (languages[language] ?? 0) + 1;
    }

    if (topLevelFolder) {
      topLevelFolders.add(topLevelFolder);
    }
  });

  const mainLanguages = Object.entries(languages)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([language]) => language);
  const structureKind = getStructureKind(normalizedFiles);
  const sizeLabel = getSizeLabel(normalizedFiles.length);

  return {
    totalFiles: normalizedFiles.length,
    languages,
    topLevelFolders: [...topLevelFolders].sort(),
    importantFiles: selectImportantFiles(normalizedFiles),
    likelyEntryPoints: sortScoredPaths(normalizedFiles, getEntryPointScore).slice(0, 8),
    summary: `${sizeLabel} ${structureKind} repository with ${normalizedFiles.length} analyzed files${
      mainLanguages.length > 0 ? `, led by ${mainLanguages.join(", ")}` : ""
    }.`,
  };
}

function getStructureAnalysis(files: RepositoryFile[]): RepoStructureAnalysis {
  const directoryCounts = new Map<string, number>();
  const paths = files.map((file) => file.path);
  let sourceFileCount = 0;
  let testFileCount = 0;
  let configFileCount = 0;
  let documentationFileCount = 0;

  files.forEach((file) => {
    const root = getRootDirectory(file.path);
    directoryCounts.set(root, (directoryCounts.get(root) ?? 0) + 1);

    if (SOURCE_EXTENSIONS.has(getExtension(file.path))) {
      sourceFileCount += 1;
    }

    if (isTestFile(file.path)) {
      testFileCount += 1;
    }

    if (isConfigFile(file.path)) {
      configFileCount += 1;
    }

    if (isDocumentationFile(file.path)) {
      documentationFileCount += 1;
    }
  });

  return {
    topDirectories: [...directoryCounts.entries()]
      .map(([name, fileCount]) => ({ name, fileCount }))
      .sort((a, b) => b.fileCount - a.fileCount || a.name.localeCompare(b.name))
      .slice(0, 6),
    importantFiles: selectImportantFiles(paths),
    sourceFileCount,
    testFileCount,
    configFileCount,
    documentationFileCount,
  };
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

function getSummary(
  files: RepositoryFile[],
  detectedLanguages: string[],
  detectedFrameworks: string[],
  structure: RepoStructureAnalysis,
) {
  const summary: string[] = [];
  const topDirectoryNames = structure.topDirectories
    .slice(0, 3)
    .map((directory) => directory.name)
    .join(", ");
  const stack = [...detectedFrameworks, ...detectedLanguages.slice(0, 3)];

  summary.push(
    topDirectoryNames
      ? `Structure centers on ${topDirectoryNames}, with ${structure.sourceFileCount} source files selected for analysis.`
      : "Repository structure is mostly root-level files, so deeper folder organization may be limited.",
  );

  summary.push(
    stack.length > 0
      ? `Primary stack signals: ${stack.join(", ")}.`
      : "No strong framework signal was detected from the filtered file tree.",
  );

  summary.push(
    structure.testFileCount > 0
      ? `Testing is visible in ${structure.testFileCount} relevant files.`
      : "No obvious test files were found in the relevant scan set.",
  );

  if (hasPath(files, (path) => path === "readme.md")) {
    summary.push("A root README is present, giving the analyzer a documentation anchor.");
  } else {
    summary.push("A root README was not found, which may limit onboarding context.");
  }

  return summary;
}

function getImprovementLimit(plan?: SubscriptionPlan) {
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

function addImprovement(
  improvements: RepoImprovement[],
  improvement: RepoImprovement,
) {
  if (!improvements.some((item) => item.title === improvement.title)) {
    improvements.push(improvement);
  }
}

function getImprovements(
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

function getMockPullRequests(
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

function getAnalysisBudget(
  files: RepositoryFile[],
  totalEstimatedTokens: number,
  suggestedTier: OneTimeScanTier,
): AnalysisBudget {
  const sampledFileLimit = {
    small: 12,
    medium: 24,
    deep: 40,
  }[suggestedTier];
  const promptTokenLimit = {
    small: 18_000,
    medium: 36_000,
    deep: 60_000,
  }[suggestedTier];

  return {
    sampledFileCount: Math.min(files.length, sampledFileLimit),
    estimatedPromptTokens: Math.min(totalEstimatedTokens, promptTokenLimit),
    strategy: "Use tree-level heuristics first, then sample the most relevant files for any paid AI pass.",
  };
}

export function analyzeRepositoryQuality({
  files,
  detectedLanguages,
  detectedFrameworks,
  totalEstimatedTokens,
  suggestedTier,
  plan,
}: {
  files: RepositoryFile[];
  detectedLanguages: string[];
  detectedFrameworks: string[];
  totalEstimatedTokens: number;
  suggestedTier: OneTimeScanTier;
  plan?: SubscriptionPlan;
}): RepoQualityAnalysis {
  const structure = getStructureAnalysis(files);
  const improvements = getImprovements(
    files,
    structure,
    totalEstimatedTokens,
    detectedFrameworks,
  ).slice(0, getImprovementLimit(plan));

  return {
    summary: getSummary(files, detectedLanguages, detectedFrameworks, structure),
    structure,
    improvements,
    mockPullRequests: getMockPullRequests(
      files,
      structure,
      improvements,
      detectedFrameworks,
      plan,
    ),
    analysisBudget: getAnalysisBudget(files, totalEstimatedTokens, suggestedTier),
  };
}
