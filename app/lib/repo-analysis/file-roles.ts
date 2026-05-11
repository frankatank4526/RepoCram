import {
  getDescriptiveFileName,
  getExtension,
  getFileName,
  getPathParts,
  isBackendApiPath,
  isKnownRuntimeEntry,
  isRouteFile,
  normalizePath,
} from "./path-utils.ts";
import type {
  ImportantFileCategory,
  RepoFileRole,
  RepoFileSummaryKind,
  StackSignals,
} from "./types.ts";

function hasFramework(detectedFrameworks: string[], framework: string) {
  return detectedFrameworks.includes(framework);
}

function hasAnyPathPart(path: string, parts: string[]) {
  const pathParts = getPathParts(path);

  return parts.some((part) => pathParts.includes(part));
}

function hasNameToken(path: string, pattern: RegExp) {
  return pattern.test(getDescriptiveFileName(path));
}

function descriptiveName(path: string) {
  return getDescriptiveFileName(path).toLowerCase();
}

function isNextApiRoute(path: string) {
  const parts = getPathParts(path);

  return parts.includes("app") && parts.includes("api") && getFileName(path) === "route.ts";
}

function isStreamlitEntry(path: string, stackSignals: StackSignals) {
  const fileName = getFileName(path);

  return (
    stackSignals.streamlit &&
    getExtension(path) === ".py" &&
    (fileName === "home.py" || fileName === "streamlit_app.py")
  );
}

function isSpringApplicationEntry(path: string) {
  return getExtension(path) === ".java" && /Application\.java$/i.test(path.split("/").pop() ?? "");
}

export function getFileRole({
  path,
  kind,
  category,
  detectedFrameworks,
  stackSignals,
}: {
  path: string;
  kind: RepoFileSummaryKind;
  category: ImportantFileCategory;
  detectedFrameworks: string[];
  stackSignals: StackSignals;
}): RepoFileRole {
  const normalized = normalizePath(path).toLowerCase();
  const fileName = getFileName(normalized);

  if (kind === "test") {
    return "test";
  }

  if (kind === "documentation") {
    return "documentation";
  }

  if (kind === "asset") {
    return "asset";
  }

  if (kind === "data") {
    return "data";
  }

  if (category === "config" || kind === "config") {
    return "config";
  }

  if (
    category === "framework_entry" ||
    isKnownRuntimeEntry(normalized) ||
    isStreamlitEntry(normalized, stackSignals) ||
    isSpringApplicationEntry(path)
  ) {
    return "framework_entry";
  }

  if (
    isNextApiRoute(normalized) ||
    hasNameToken(normalized, /(^|[-_])(routes?|handlers?)([-_]|$)/) ||
    hasAnyPathPart(normalized, ["routes", "route", "handlers", "handler"]) ||
    (hasFramework(detectedFrameworks, "Express") && isBackendApiPath(normalized))
  ) {
    return "api_route";
  }

  if (
    hasNameToken(normalized, /(^|[-_])(controllers?|controller)([-_]|$)/) ||
    descriptiveName(normalized).endsWith("controller") ||
    hasAnyPathPart(normalized, ["controllers", "controller"]) ||
    /Controller\.java$/i.test(path.split("/").pop() ?? "")
  ) {
    return "controller";
  }

  if (
    hasNameToken(normalized, /(^|[-_])(services?|service|client)([-_]|$)/) ||
    descriptiveName(normalized).endsWith("service") ||
    descriptiveName(normalized).endsWith("client") ||
    hasAnyPathPart(normalized, ["services", "service"])
  ) {
    return "service";
  }

  if (
    hasNameToken(normalized, /(^|[-_])(repositories?|repository|repo)([-_]|$)/) ||
    descriptiveName(normalized).endsWith("repository") ||
    hasAnyPathPart(normalized, ["repositories", "repository", "repos", "repo"]) ||
    /Repository\.java$/i.test(path.split("/").pop() ?? "")
  ) {
    return "repository";
  }

  if (
    hasNameToken(normalized, /(^|[-_])(models?|model|schemas?|schema)([-_]|$)/) ||
    descriptiveName(normalized).endsWith("model") ||
    descriptiveName(normalized).endsWith("schema") ||
    hasAnyPathPart(normalized, ["models", "model", "schemas", "schema"])
  ) {
    return "model";
  }

  if (
    hasNameToken(normalized, /(^|[-_])(views?|view|templates?|template)([-_]|$)/) ||
    descriptiveName(normalized).endsWith("view") ||
    hasAnyPathPart(normalized, ["views", "view", "templates", "template"])
  ) {
    return "view";
  }

  if (
    hasNameToken(normalized, /(^|[-_])(session|state|store|context|provider|reducer|hook)([-_]|$)/) ||
    descriptiveName(normalized).includes("session") ||
    descriptiveName(normalized).endsWith("store") ||
    descriptiveName(normalized).endsWith("state") ||
    ["session.tsx", "session.ts", "store.ts", "state.ts"].includes(fileName) ||
    hasAnyPathPart(normalized, ["stores", "store", "state", "context", "hooks"])
  ) {
    return "state_management";
  }

  if (
    category === "frontend_route" ||
    isRouteFile(normalized) ||
    (stackSignals.streamlit && getExtension(normalized) === ".py" && hasAnyPathPart(normalized, ["pages"]))
  ) {
    return "frontend_page";
  }

  if (category === "frontend_component") {
    return "frontend_component";
  }

  if (category === "backend_api") {
    return "api_route";
  }

  if (category === "shared_logic") {
    return "shared_logic";
  }

  return "other";
}
