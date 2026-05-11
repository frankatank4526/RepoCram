import { getApplicationDomain } from "./domains.ts";
import {
  SOURCE_EXTENSIONS,
  STATIC_ASSET_EXTENSIONS,
  getExtension,
  getFileName,
  hasMvcSignal,
  isBackendApiPath,
  isConfigFile,
  isDataArtifactFile,
  isDocumentationFile,
  isFrontendComponentFile,
  isFrontendPageFile,
  isKnownRuntimeEntry,
  isLogicFile,
  isRouteFile,
  isSchemaContextFile,
  isTestFile,
  normalizePath,
} from "./path-utils.ts";
import type { ImportantFileCategory, RepoFileSummaryKind } from "./types.ts";

export function getImportantFileCategory(path: string): ImportantFileCategory {
  if (isKnownRuntimeEntry(path) || /Application\.java$/i.test(path.split("/").pop() ?? "")) {
    return "framework_entry";
  }

  if (isSchemaContextFile(path) || isConfigFile(path)) {
    return "config";
  }

  if (isBackendApiPath(path) && !isRouteFile(path)) {
    return "backend_api";
  }

  if (isFrontendPageFile(path)) {
    return "frontend_route";
  }

  if (isFrontendComponentFile(path)) {
    return "frontend_component";
  }

  if (isLogicFile(path)) {
    return "shared_logic";
  }

  return "other";
}

export function getFileSummaryKind(path: string): RepoFileSummaryKind {
  const extension = getExtension(path);

  if (STATIC_ASSET_EXTENSIONS.has(extension)) {
    return "asset";
  }

  if (isDataArtifactFile(path)) {
    return "data";
  }

  if (isTestFile(path)) {
    return "test";
  }

  if (isDocumentationFile(path)) {
    return "documentation";
  }

  if (isSchemaContextFile(path)) {
    return "config";
  }

  if (isConfigFile(path)) {
    return "config";
  }

  if (SOURCE_EXTENSIONS.has(extension)) {
    return "source";
  }

  return "other";
}

export function getFileSummaryReasons(path: string, category: ImportantFileCategory) {
  const normalized = normalizePath(path).toLowerCase();
  const reasons: string[] = [];

  if (isKnownRuntimeEntry(normalized)) {
    reasons.push("runtime entry point");
  }

  if (category === "backend_api") {
    reasons.push("backend or API path");
  }

  if (category === "frontend_route") {
    reasons.push("frontend route");
  }

  if (category === "frontend_component") {
    reasons.push("frontend component");
  }

  if (category === "shared_logic") {
    reasons.push("shared application logic");
  }

  if (hasMvcSignal(normalized)) {
    reasons.push("MVC/service layer signal");
  }

  if (getApplicationDomain(normalized)) {
    reasons.push("domain-oriented path");
  }

  if (isTestFile(normalized)) {
    reasons.push("test coverage signal");
  }

  if (isDocumentationFile(normalized)) {
    reasons.push("documentation context");
  }

  if (isConfigFile(normalized)) {
    reasons.push("project configuration");
  }

  if (reasons.length === 0 && SOURCE_EXTENSIONS.has(getExtension(normalized))) {
    reasons.push("source file");
  }

  return [...new Set(reasons)].slice(0, 4);
}

export { isConfigFile, isDocumentationFile, isTestFile };
