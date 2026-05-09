import {
  CONFIG_EXTENSIONS,
  ENTRY_EXTENSIONS,
  SOURCE_EXTENSIONS,
  STATIC_ASSET_EXTENSIONS,
  getExtension,
  getFileName,
  getPathDepth,
  getPathParts,
  getStackSignals,
  hasDescriptiveFileName,
  hasImportantKeyword,
  hasMediumImportanceSignal,
  hasMvcSignal,
  hasProjectSignal,
  isApiFile,
  isCommonSourceArea,
  isConfigFile,
  isDataArtifactFile,
  isExecutableSourceFile,
  isExpressLogicFile,
  isKnownRuntimeEntry,
  isNodeEntryFile,
  isPythonEntryFile,
  isPythonLogicFile,
  isRootAppRoute,
  isRouteFile,
  isSchemaContextFile,
  isSpringJavaFile,
  isTemporaryOrGeneratedOutput,
  isTestFile,
  isTopLevelFeatureRoute,
  normalizePath,
} from "./path-utils.ts";
import type { StackSignals } from "./types.ts";

export function getFileImportanceScore(path: string, stackSignals?: StackSignals) {
  const normalized = normalizePath(path).toLowerCase();
  const fileName = getFileName(normalized);
  const extension = getExtension(normalized);
  const stacks = stackSignals ?? getStackSignals([normalized]);
  let score = 0;

  if (STATIC_ASSET_EXTENSIONS.has(extension)) {
    return 0;
  }

  if (isDataArtifactFile(normalized) || isTemporaryOrGeneratedOutput(normalized)) {
    return 0;
  }

  if (isSchemaContextFile(normalized)) {
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

export function getEntryPointScore(path: string) {
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

export function sortScoredPaths(paths: string[], getScore: (path: string) => number) {
  return paths
    .map((path) => ({ path, score: getScore(path) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .map((item) => item.path);
}

export function getImportantFileLimit(fileCount: number) {
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
