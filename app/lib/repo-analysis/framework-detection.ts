import {
  getExtension,
  getFileName,
  getPathParts,
  getTopLevelFolder,
  isNodeEntryFile,
  isPythonEntryFile,
  isRouteFile,
  isRuntimeImportantPath,
  isSpringJavaFile,
  normalizePath,
} from "./path-utils.ts";
import type {
  FileContentMap,
  FrameworkDetectionContext,
  FrameworkDetectionResult,
  FrameworkDetector,
  RepositoryFile,
} from "./types.ts";

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
