import {
  getExtension,
  getFileName,
  getPathParts,
  normalizePath,
} from "./path-utils.ts";
import type {
  FileContentMap,
  RepoFileRelationship,
  RepoFileRelationshipConfidence,
  RepoFileRelationshipType,
  RepoFileRole,
  RepoFileSummary,
} from "./types.ts";

type RelationshipFile = Pick<RepoFileSummary, "path" | "role" | "domain">;

const FEATURE_STOP_PARTS = new Set([
  "api",
  "app",
  "backend",
  "client",
  "components",
  "controllers",
  "frontend",
  "hooks",
  "java",
  "lib",
  "main",
  "models",
  "pages",
  "repositories",
  "resources",
  "routes",
  "server",
  "services",
  "src",
  "templates",
  "view",
  "views",
]);

function hasFramework(detectedFrameworks: string[], framework: string) {
  return detectedFrameworks.includes(framework);
}

function titleCase(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
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

function normalizeFeatureToken(value: string) {
  return singularize(
    value
      .replace(/^\d+_/, "")
      .replace(/\.[^.]+$/, "")
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase(),
  );
}

function getFeatureKey(file: RelationshipFile) {
  if (file.domain) {
    return file.domain;
  }

  const fileFeature = normalizeFeatureToken(getFileName(file.path)).replace(
    /_?(controller|service|repository|repo|model|schema|view|template|routes?|client|store|session)$/,
    "",
  );

  if (
    fileFeature &&
    !FEATURE_STOP_PARTS.has(fileFeature) &&
    !["index", "main", "page", "route", "app"].includes(fileFeature)
  ) {
    return fileFeature;
  }

  const parts = getPathParts(file.path)
    .filter((part) => !part.startsWith("("))
    .map(normalizeFeatureToken)
    .filter(Boolean);
  const fileName = getFileName(file.path);
  const apiIndex = parts.indexOf("api");

  if (apiIndex > -1 && parts[apiIndex + 1]) {
    return parts[apiIndex + 1];
  }

  const pageIndex = parts.indexOf("pages");
  if (pageIndex > -1 && parts[pageIndex + 1]) {
    return parts[pageIndex + 1];
  }

  const appIndex = parts.indexOf("app");
  if (appIndex > -1) {
    const routeParts = parts.slice(appIndex + 1, -1).filter((part) => !FEATURE_STOP_PARTS.has(part));
    if (routeParts[0]) {
      return routeParts[routeParts.length - 1];
    }
  }

  const parent = parts.slice(0, -1).reverse().find((part) => !FEATURE_STOP_PARTS.has(part));
  if (parent) {
    return parent;
  }

  const baseName = normalizeFeatureToken(fileName);
  return baseName || null;
}

function getGroup(featureKey: string | null, domain: string | null) {
  const key = featureKey ?? domain;

  if (!key) {
    return {};
  }

  const labelSuffix = ["driver", "customer", "store", "analyst", "admin"].includes(key)
    ? "Workflow"
    : "Flow";

  return {
    groupKey: key,
    groupLabel: `${titleCase(key)} ${labelSuffix}`,
  };
}

function confidenceRank(confidence: RepoFileRelationshipConfidence) {
  return {
    strong: 3,
    moderate: 2,
    weak: 1,
  }[confidence];
}

function relationshipPriority(type: RepoFileRelationshipType) {
  return {
    imports: 12,
    framework_flow: 11,
    related_state: 10,
    related_service: 9,
    frontend_backend_flow: 8,
    related_controller: 7,
    related_model: 7,
    related_view: 7,
    same_feature: 4,
    same_domain: 3,
  }[type];
}

function addRelationship(
  relationships: RepoFileRelationship[],
  relationship: RepoFileRelationship,
) {
  if (relationship.sourcePath === relationship.targetPath) {
    return;
  }

  const existingIndex = relationships.findIndex(
    (item) =>
      item.sourcePath === relationship.sourcePath &&
      item.targetPath === relationship.targetPath &&
      item.type === relationship.type,
  );

  if (existingIndex === -1) {
    relationships.push(relationship);
    return;
  }

  if (
    confidenceRank(relationship.confidence) >
    confidenceRank(relationships[existingIndex].confidence)
  ) {
    relationships[existingIndex] = relationship;
  }
}

function addBidirectionalRelationship(
  relationships: RepoFileRelationship[],
  source: RelationshipFile,
  target: RelationshipFile,
  type: RepoFileRelationshipType,
  confidence: RepoFileRelationshipConfidence,
  reason: string,
  featureKey: string | null,
) {
  const group = getGroup(featureKey, source.domain ?? target.domain);

  addRelationship(relationships, {
    sourcePath: source.path,
    targetPath: target.path,
    type,
    confidence,
    reason,
    ...group,
  });
  addRelationship(relationships, {
    sourcePath: target.path,
    targetPath: source.path,
    type,
    confidence,
    reason,
    ...group,
  });
}

function extractImportSpecifiers(path: string, content: string) {
  const extension = getExtension(path);
  const specifiers: string[] = [];

  if ([".ts", ".tsx", ".js", ".jsx"].includes(extension)) {
    for (const match of content.matchAll(/import\s+(?:[^'"]+\s+from\s+)?["']([^"']+)["']/g)) {
      specifiers.push(match[1]);
    }

    for (const match of content.matchAll(/import\(["']([^"']+)["']\)/g)) {
      specifiers.push(match[1]);
    }
  }

  if (extension === ".py") {
    for (const match of content.matchAll(/^\s*from\s+([.\w]+)\s+import\s+/gm)) {
      specifiers.push(match[1]);
    }

    for (const match of content.matchAll(/^\s*import\s+([.\w]+)/gm)) {
      specifiers.push(match[1]);
    }
  }

  if (extension === ".java") {
    for (const match of content.matchAll(/^\s*import\s+([\w.]+);/gm)) {
      specifiers.push(match[1]);
    }
  }

  return specifiers;
}

function resolveRelativeImport(sourcePath: string, specifier: string, pathSet: Set<string>) {
  if (!specifier.startsWith(".")) {
    return null;
  }

  const sourceParts = normalizePath(sourcePath).split("/");
  sourceParts.pop();
  const rawParts = [...sourceParts, ...specifier.split("/")];
  const resolvedParts: string[] = [];

  rawParts.forEach((part) => {
    if (!part || part === ".") {
      return;
    }

    if (part === "..") {
      resolvedParts.pop();
      return;
    }

    resolvedParts.push(part);
  });

  const base = resolvedParts.join("/");
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    `${base}.py`,
    `${base}.java`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
    `${base}/index.js`,
    `${base}/index.jsx`,
  ].map(normalizePath);

  return candidates.find((candidate) => pathSet.has(candidate)) ?? null;
}

function resolveNamedImport(specifier: string, files: RelationshipFile[]) {
  const importToken = normalizeFeatureToken(specifier.split(".").pop() ?? specifier);

  if (!importToken) {
    return null;
  }

  return (
    files.find((file) => normalizeFeatureToken(getFileName(file.path)) === importToken)?.path ??
    null
  );
}

function getRoleRelationshipType(
  sourceRole: RepoFileRole,
  targetRole: RepoFileRole,
): RepoFileRelationshipType | null {
  if (sourceRole === "state_management" || targetRole === "state_management") {
    return "related_state";
  }

  if (sourceRole === "frontend_page" && targetRole === "api_route") {
    return "frontend_backend_flow";
  }

  if (sourceRole === "api_route" && targetRole === "frontend_page") {
    return "frontend_backend_flow";
  }

  if (sourceRole === "service" || targetRole === "service") {
    return "related_service";
  }

  if (sourceRole === "model" || targetRole === "model") {
    return "related_model";
  }

  if (sourceRole === "controller" || targetRole === "controller") {
    return "related_controller";
  }

  if (sourceRole === "view" || targetRole === "view") {
    return "related_view";
  }

  if (sourceRole === "frontend_component" || targetRole === "frontend_component") {
    return "related_view";
  }

  return null;
}

function isComplementaryRolePair(sourceRole: RepoFileRole, targetRole: RepoFileRole) {
  return Boolean(getRoleRelationshipType(sourceRole, targetRole));
}

function isMeaningfulRelationshipRole(role: RepoFileRole) {
  return !["asset", "config", "data", "documentation", "other", "test"].includes(role);
}

function getFrameworkFlowType(
  source: RelationshipFile,
  target: RelationshipFile,
  detectedFrameworks: string[],
) {
  const roles = new Set([source.role, target.role]);
  const frontendBackendPair = roles.has("frontend_page") && roles.has("api_route");
  const mvcPair =
    roles.has("controller") &&
    (roles.has("model") || roles.has("view") || roles.has("service"));

  if (
    frontendBackendPair &&
    (hasFramework(detectedFrameworks, "Next.js") ||
      (hasFramework(detectedFrameworks, "Streamlit") && hasFramework(detectedFrameworks, "FastAPI")))
  ) {
    return "framework_flow";
  }

  if (mvcPair && hasFramework(detectedFrameworks, "Spring Boot")) {
    return "framework_flow";
  }

  return null;
}

function sortRelationships(relationships: RepoFileRelationship[]) {
  return relationships.sort(
    (a, b) =>
      a.sourcePath.localeCompare(b.sourcePath) ||
      confidenceRank(b.confidence) - confidenceRank(a.confidence) ||
      relationshipPriority(b.type) - relationshipPriority(a.type) ||
      a.targetPath.localeCompare(b.targetPath) ||
      a.type.localeCompare(b.type),
  );
}

function limitRelationshipsPerSource(relationships: RepoFileRelationship[], limit = 8) {
  const counts = new Map<string, number>();

  return relationships.filter((relationship) => {
    const count = counts.get(relationship.sourcePath) ?? 0;

    if (count >= limit) {
      return false;
    }

    counts.set(relationship.sourcePath, count + 1);
    return true;
  });
}

export function getFileRelationships({
  files,
  detectedFrameworks,
  fileContents,
}: {
  files: RelationshipFile[];
  detectedFrameworks: string[];
  fileContents?: FileContentMap;
}) {
  const relationships: RepoFileRelationship[] = [];
  const normalizedFiles = files.map((file) => ({
    ...file,
    path: normalizePath(file.path),
  }));
  const pathSet = new Set(normalizedFiles.map((file) => file.path));
  const fileByPath = new Map(normalizedFiles.map((file) => [file.path, file]));
  const featureByPath = new Map(
    normalizedFiles.map((file) => [file.path, getFeatureKey(file)]),
  );

  if (fileContents) {
    Object.entries(fileContents).forEach(([rawPath, content]) => {
      const path = normalizePath(rawPath);
      const source = fileByPath.get(path);

      if (!source) {
        return;
      }

      extractImportSpecifiers(path, content).forEach((specifier) => {
        const targetPath =
          resolveRelativeImport(path, specifier, pathSet) ??
          resolveNamedImport(specifier, normalizedFiles);

        if (!targetPath || targetPath === source.path) {
          return;
        }

        addRelationship(relationships, {
          sourcePath: source.path,
          targetPath,
          type: "imports",
          confidence: "strong",
          reason: `direct import: ${specifier}`,
          ...getGroup(featureByPath.get(source.path) ?? null, source.domain),
        });
      });
    });
  }

  for (let index = 0; index < normalizedFiles.length; index += 1) {
    const source = normalizedFiles[index];

    for (let targetIndex = index + 1; targetIndex < normalizedFiles.length; targetIndex += 1) {
      const target = normalizedFiles[targetIndex];
      const sourceFeature = featureByPath.get(source.path) ?? null;
      const targetFeature = featureByPath.get(target.path) ?? null;
      const sameFeature = Boolean(sourceFeature && sourceFeature === targetFeature);
      const sameDomain = Boolean(source.domain && source.domain === target.domain);

      if (!sameFeature && !sameDomain) {
        continue;
      }

      const frameworkFlowType = getFrameworkFlowType(source, target, detectedFrameworks);
      if (frameworkFlowType) {
        addBidirectionalRelationship(
          relationships,
          source,
          target,
          frameworkFlowType,
          "moderate",
          sameDomain
            ? `same ${source.domain} domain with complementary framework roles`
            : "same feature with complementary framework roles",
          sourceFeature ?? targetFeature,
        );
        continue;
      }

      const roleType = getRoleRelationshipType(source.role, target.role);
      if (sameFeature && roleType) {
        addBidirectionalRelationship(
          relationships,
          source,
          target,
          roleType,
          "moderate",
          `same ${sourceFeature} feature with complementary roles`,
          sourceFeature,
        );
        continue;
      }

      if (sameFeature && isComplementaryRolePair(source.role, target.role)) {
        addBidirectionalRelationship(
          relationships,
          source,
          target,
          "same_feature",
          "moderate",
          `same ${sourceFeature} feature area`,
          sourceFeature,
        );
        continue;
      }

      if (
        sameFeature &&
        source.role !== target.role &&
        isMeaningfulRelationshipRole(source.role) &&
        isMeaningfulRelationshipRole(target.role)
      ) {
        addBidirectionalRelationship(
          relationships,
          source,
          target,
          "same_feature",
          "weak",
          `same ${sourceFeature} feature area`,
          sourceFeature,
        );
        continue;
      }

      if (sameDomain && isComplementaryRolePair(source.role, target.role)) {
        addBidirectionalRelationship(
          relationships,
          source,
          target,
          "same_domain",
          "weak",
          `same ${source.domain} domain/persona`,
          sourceFeature ?? targetFeature,
        );
      }
    }
  }

  return limitRelationshipsPerSource(sortRelationships(relationships));
}

export function groupRelationshipsBySource(relationships: RepoFileRelationship[]) {
  const grouped = new Map<string, RepoFileRelationship[]>();

  relationships.forEach((relationship) => {
    grouped.set(relationship.sourcePath, [
      ...(grouped.get(relationship.sourcePath) ?? []),
      relationship,
    ]);
  });

  return grouped;
}
