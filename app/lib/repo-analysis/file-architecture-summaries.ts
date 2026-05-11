import {
  getFileName,
  getPathParts,
  normalizePath,
} from "./path-utils.ts";
import type {
  ImportantFileCategory,
  RepoFileRelationship,
  RepoFileRole,
  RepoFileSummaryKind,
} from "./types.ts";

function hasFramework(detectedFrameworks: string[], framework: string) {
  return detectedFrameworks.includes(framework);
}

function toWords(value: string) {
  return value
    .replace(/\.[^.]+$/, "")
    .replace(/^\d+_/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function singularize(value: string) {
  if (value.endsWith("ies")) {
    return `${value.slice(0, -3)}y`;
  }

  if (value.endsWith("s") && !value.endsWith("ss")) {
    return value.slice(0, -1);
  }

  return value;
}

function getRouteTopic(path: string) {
  const parts = getPathParts(path).filter((part) => !part.startsWith("("));
  const fileName = getFileName(path);
  const apiIndex = parts.indexOf("api");
  const pagesIndex = parts.indexOf("pages");
  const appIndex = parts.indexOf("app");
  const candidate =
    apiIndex > -1
      ? parts[apiIndex + 1]
      : pagesIndex > -1
        ? parts[parts.length - 1] === fileName
          ? parts[parts.length - 2]
          : parts[pagesIndex + 1]
        : appIndex > -1
          ? parts[parts.length - 1] === fileName
            ? parts[parts.length - 2]
            : parts[appIndex + 1]
          : null;

  if (!candidate || ["app", "src", "page", "route", "index", "home"].includes(candidate)) {
    return null;
  }

  return singularize(toWords(candidate));
}

function getNameTopic(path: string) {
  const rawFileName = path.split("/").pop() ?? path;
  const name = toWords(rawFileName.replace(/\.[^.]+$/, ""))
    .replace(/\b(routes?|controllers?|services?|repositories?|models?|schemas?|client|page|home)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return name ? singularize(name) : null;
}

function getTopic(path: string, domain: string | null) {
  return domain ?? getRouteTopic(path) ?? getNameTopic(path);
}

function targetName(relationship: RepoFileRelationship) {
  return relationship.targetPath.split("/").pop() ?? relationship.targetPath;
}

function getRelationshipPhrase({
  role,
  relationships,
}: {
  role: RepoFileRole;
  relationships: RepoFileRelationship[];
}) {
  const strongImport = relationships.find((relationship) => relationship.type === "imports");
  const frameworkFlow = relationships.find(
    (relationship) => relationship.type === "framework_flow",
  );
  const relatedService = relationships.find(
    (relationship) => relationship.type === "related_service",
  );
  const relatedState =
    relationships.find(
      (relationship) =>
        relationship.type === "related_state" &&
        /\b(store|state|session|context)\b/i.test(targetName(relationship)),
    ) ??
    relationships.find((relationship) => relationship.type === "related_state");
  const frontendBackendFlow = relationships.find(
    (relationship) => relationship.type === "frontend_backend_flow",
  );
  const relatedView = relationships.find((relationship) => relationship.type === "related_view");
  const relatedModel = relationships.find((relationship) => relationship.type === "related_model");

  if (strongImport) {
    return ` Imports ${targetName(strongImport)}.`;
  }

  const frontendRelation = frameworkFlow ?? frontendBackendFlow;
  if (role === "frontend_page" && frontendRelation) {
    return ` Connected to ${targetName(frontendRelation)}.`;
  }

  const backendRelation = frameworkFlow ?? frontendBackendFlow;
  if (role === "api_route" && backendRelation) {
    return ` Connected to ${targetName(backendRelation)}.`;
  }

  if (relatedService) {
    return ` Works with ${targetName(relatedService)}.`;
  }

  if (relatedState) {
    return ` Part of the ${targetName(relatedState)} state flow.`;
  }

  if (relatedModel) {
    return ` Related to ${targetName(relatedModel)} model/schema context.`;
  }

  if (relatedView) {
    return ` Related to ${targetName(relatedView)} UI/view context.`;
  }

  return "";
}

function roleLabel(role: RepoFileRole) {
  return role.replaceAll("_", " ");
}

export function getArchitectureFileSummary({
  path,
  kind,
  category,
  role,
  language,
  domain,
  reasons,
  detectedFrameworks,
  relationships,
}: {
  path: string;
  kind: RepoFileSummaryKind;
  category: ImportantFileCategory;
  role: RepoFileRole;
  language?: string;
  domain: string | null;
  reasons: string[];
  detectedFrameworks: string[];
  relationships: RepoFileRelationship[];
}) {
  const normalized = normalizePath(path);
  const fileName = normalized.split("/").pop() ?? normalized;
  const lowerFileName = fileName.toLowerCase();
  const topic = getTopic(normalized, domain);
  const topicSuffix = topic ? ` for ${topic}` : "";
  const relatedPhrase = getRelationshipPhrase({ role, relationships });

  if (kind === "test") {
    return `${fileName} exercises automated test coverage${topicSuffix}.`;
  }

  if (kind === "documentation") {
    return `${fileName} provides onboarding or repository documentation context.`;
  }

  if (kind === "config" || role === "config") {
    return `${fileName} defines project configuration or dependency context.`;
  }

  if (role === "framework_entry") {
    if (hasFramework(detectedFrameworks, "Streamlit") || lowerFileName === "home.py") {
      return `${fileName} appears to be the main Streamlit entry page.`;
    }

    if (hasFramework(detectedFrameworks, "Next.js") && lowerFileName.startsWith("layout.")) {
      return `${fileName} defines the Next.js layout shell.`;
    }

    if (hasFramework(detectedFrameworks, "Next.js")) {
      return `${fileName} appears to be a primary Next.js route entry.`;
    }

    if (hasFramework(detectedFrameworks, "Express")) {
      return `${fileName} appears to be the Express server entry point.`;
    }

    if (hasFramework(detectedFrameworks, "Spring Boot")) {
      return `${fileName} appears to be the Spring Boot application entry point.`;
    }

    return `${fileName} appears to be a ${language ? `${language} ` : ""}runtime entry point.`;
  }

  if (role === "api_route") {
    if (hasFramework(detectedFrameworks, "Next.js")) {
      return `Defines Next.js API route handlers${topicSuffix}.${relatedPhrase}`;
    }

    if (hasFramework(detectedFrameworks, "Express")) {
      return `Defines Express route handlers${topicSuffix}.${relatedPhrase}`;
    }

    if (hasFramework(detectedFrameworks, "FastAPI") || hasFramework(detectedFrameworks, "Flask")) {
      return `Defines Python backend route handlers${topicSuffix}.${relatedPhrase}`;
    }

    return `Defines backend/API route handlers${topicSuffix}.${relatedPhrase}`;
  }

  if (role === "frontend_page") {
    if (hasFramework(detectedFrameworks, "Streamlit")) {
      return `Defines a Streamlit UI page${topicSuffix}.${relatedPhrase}`;
    }

    if (hasFramework(detectedFrameworks, "Next.js")) {
      return `Defines a Next.js page route${topicSuffix}.${relatedPhrase}`;
    }

    return `Defines a frontend page or route${topicSuffix}.${relatedPhrase}`;
  }

  if (role === "frontend_component") {
    return `Defines reusable frontend UI behavior${topicSuffix}.${relatedPhrase}`;
  }

  if (role === "state_management") {
    const stateTopic =
      topic && !/\b(session|state|store|context|hook|provider|reducer)\b/.test(topic)
        ? topic
        : null;

    return `Defines ${stateTopic ? `${stateTopic} ` : ""}session or state management logic.${relatedPhrase}`;
  }

  if (role === "service") {
    return `Implements service-layer application logic${topicSuffix}.${relatedPhrase}`;
  }

  if (role === "controller") {
    return `Defines controller-layer request handling${topicSuffix}.${relatedPhrase}`;
  }

  if (role === "repository") {
    return `Defines data access or repository logic${topicSuffix}.${relatedPhrase}`;
  }

  if (role === "view") {
    return `Defines MVC view or template context${topicSuffix}.${relatedPhrase}`;
  }

  if (role === "model") {
    return `Defines model or schema structures${topicSuffix}.${relatedPhrase}`;
  }

  if (role === "shared_logic") {
    return `Contains shared application logic${topicSuffix}.${relatedPhrase}`;
  }

  if (reasons.length > 0) {
    return `${fileName} is relevant as ${roleLabel(role)} context: ${reasons.join(", ")}.`;
  }

  if (category !== "other") {
    return `${fileName} contributes ${category.replaceAll("_", " ")} context.`;
  }

  return `${fileName} is part of the filtered repository context.`;
}
