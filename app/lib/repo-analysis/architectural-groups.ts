import type {
  RepoArchitecturalGroup,
  RepoArchitecturalGroupType,
  RepoFileRelationship,
  RepoFileRelationshipConfidence,
  RepoFileRelationshipType,
  RepoFileRole,
  RepoFileSummary,
} from "./types.ts";

type GroupCandidate = {
  key: string;
  relationships: RepoFileRelationship[];
  paths: Set<string>;
};

const PERSONA_KEYS = new Set(["admin", "analyst", "customer", "driver", "store"]);
const AUTH_KEYS = new Set(["account", "auth", "profile", "session", "user"]);
const MEANINGFUL_GROUP_ROLES = new Set<RepoFileRole>([
  "api_route",
  "controller",
  "frontend_component",
  "frontend_page",
  "framework_entry",
  "model",
  "repository",
  "service",
  "shared_logic",
  "state_management",
  "view",
]);

function titleCase(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
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
    imports: 10,
    framework_flow: 9,
    related_state: 8,
    related_service: 7,
    frontend_backend_flow: 6,
    related_controller: 5,
    related_model: 5,
    related_view: 5,
    same_feature: 2,
    same_domain: 1,
  }[type];
}

function getStrongestConfidence(relationships: RepoFileRelationship[]) {
  return relationships.reduce<RepoFileRelationshipConfidence>(
    (strongest, relationship) =>
      confidenceRank(relationship.confidence) > confidenceRank(strongest)
        ? relationship.confidence
        : strongest,
    "weak",
  );
}

function getGroupType({
  key,
  roles,
  relationshipTypes,
}: {
  key: string;
  roles: Set<RepoFileRole>;
  relationshipTypes: Set<RepoFileRelationshipType>;
}): RepoArchitecturalGroupType {
  const hasFrontend = roles.has("frontend_page") || roles.has("frontend_component");
  const hasBackend =
    roles.has("api_route") ||
    roles.has("controller") ||
    roles.has("service") ||
    roles.has("repository");

  if (
    roles.has("controller") &&
    (roles.has("model") || roles.has("view")) &&
    relationshipTypes.has("framework_flow")
  ) {
    return "mvc_group";
  }

  if (AUTH_KEYS.has(key) && (roles.has("state_management") || relationshipTypes.has("related_state"))) {
    return "auth_flow";
  }

  if (PERSONA_KEYS.has(key)) {
    return "persona_workflow";
  }

  if (
    hasFrontend &&
    hasBackend &&
    (relationshipTypes.has("framework_flow") ||
      relationshipTypes.has("frontend_backend_flow"))
  ) {
    return "frontend_backend_flow";
  }

  if (roles.has("state_management") || relationshipTypes.has("related_state")) {
    return "state_flow";
  }

  if (roles.has("api_route") && hasBackend) {
    return "api_group";
  }

  return "feature_flow";
}

function getGroupLabel(key: string, type: RepoArchitecturalGroupType) {
  if (type === "mvc_group") {
    return `${titleCase(key)} MVC Group`;
  }

  if (type === "auth_flow") {
    return `${titleCase(key)} Auth Flow`;
  }

  if (type === "persona_workflow") {
    return key === "store" ? "Store Management" : `${titleCase(key)} Workflow`;
  }

  if (type === "state_flow") {
    return `${titleCase(key)} State Flow`;
  }

  if (type === "api_group") {
    return `${titleCase(key)} API Group`;
  }

  return `${titleCase(key)} Flow`;
}

function getGroupSummary({
  label,
  type,
  key,
  roles,
}: {
  label: string;
  type: RepoArchitecturalGroupType;
  key: string;
  roles: Set<RepoFileRole>;
}) {
  const hasFrontend = roles.has("frontend_page") || roles.has("frontend_component");
  const hasApi = roles.has("api_route") || roles.has("controller");
  const hasService = roles.has("service") || roles.has("shared_logic");
  const hasState = roles.has("state_management");

  if (type === "auth_flow") {
    return `${label} connects account/session state with related UI or application files.`;
  }

  if (type === "persona_workflow") {
    if (hasFrontend && hasApi) {
      return `${label} connects ${key} frontend pages with backend routes or services.`;
    }

    return `${label} groups files for the ${key} persona or domain.`;
  }

  if (type === "frontend_backend_flow") {
    return `${label} connects frontend routes or components with backend API handling.`;
  }

  if (type === "mvc_group") {
    return `${label} groups controller, model, and view layers.`;
  }

  if (type === "state_flow") {
    return `${label} groups state/session logic with related feature files.`;
  }

  if (type === "api_group") {
    return `${label} groups API routes with backend service or controller logic.`;
  }

  if (hasFrontend && hasApi && hasService) {
    return `${label} combines UI, API, and service/client logic for ${key}.`;
  }

  if (hasFrontend && hasApi) {
    return `${label} connects UI and API files for ${key}.`;
  }

  if (hasService) {
    return `${label} groups service/client logic with related ${key} files.`;
  }

  if (hasState) {
    return `${label} groups state/session logic for ${key}.`;
  }

  return `${label} groups related ${key} files.`;
}

function isMeaningfulGroupFile(file: RepoFileSummary | undefined) {
  return Boolean(file && MEANINGFUL_GROUP_ROLES.has(file.role));
}

function sortGroupFiles(files: RepoFileSummary[]) {
  return files.sort(
    (a, b) =>
      Number(b.highlighted) - Number(a.highlighted) ||
      b.importanceScore - a.importanceScore ||
      a.path.localeCompare(b.path),
  );
}

function toStableId(key: string, type: RepoArchitecturalGroupType) {
  return `${type}:${key.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase()}`;
}

function getReasons({
  type,
  relationships,
  roles,
}: {
  type: RepoArchitecturalGroupType;
  relationships: RepoFileRelationship[];
  roles: Set<RepoFileRole>;
}) {
  const reasons = new Set<string>();

  reasons.add(type.replaceAll("_", " "));

  if (relationships.some((relationship) => relationship.confidence === "strong")) {
    reasons.add("direct import relationship");
  }

  if (relationships.some((relationship) => relationship.type === "framework_flow")) {
    reasons.add("framework flow relationship");
  }

  if (roles.has("state_management")) {
    reasons.add("state/session role");
  }

  if (roles.has("frontend_page") && roles.has("api_route")) {
    reasons.add("frontend/backend roles");
  }

  if (roles.has("controller") && (roles.has("model") || roles.has("view"))) {
    reasons.add("MVC roles");
  }

  return [...reasons].slice(0, 4);
}

export function getArchitecturalGroups({
  files,
  relationships,
}: {
  files: RepoFileSummary[];
  relationships: RepoFileRelationship[];
}): RepoArchitecturalGroup[] {
  const filesByPath = new Map(files.map((file) => [file.path, file]));
  const candidates = new Map<string, GroupCandidate>();

  relationships.forEach((relationship) => {
    const key = relationship.groupKey;

    if (!key) {
      return;
    }

    const sourceFile = filesByPath.get(relationship.sourcePath);
    const targetFile = filesByPath.get(relationship.targetPath);

    if (!isMeaningfulGroupFile(sourceFile) || !isMeaningfulGroupFile(targetFile)) {
      return;
    }

    const candidate = candidates.get(key) ?? {
      key,
      relationships: [],
      paths: new Set<string>(),
    };

    candidate.relationships.push(relationship);
    candidate.paths.add(relationship.sourcePath);
    candidate.paths.add(relationship.targetPath);
    candidates.set(key, candidate);
  });

  return [...candidates.values()]
    .map((candidate): RepoArchitecturalGroup | null => {
      const groupFiles = sortGroupFiles(
        [...candidate.paths]
          .map((path) => filesByPath.get(path))
          .filter((file): file is RepoFileSummary => isMeaningfulGroupFile(file)),
      ).slice(0, 8);

      if (groupFiles.length < 2) {
        return null;
      }

      const roles = new Set(groupFiles.map((file) => file.role));
      const relationshipTypes = new Set(
        candidate.relationships.map((relationship) => relationship.type),
      );
      const hasModerateOrStrong = candidate.relationships.some(
        (relationship) => relationship.confidence !== "weak",
      );

      if (!hasModerateOrStrong && groupFiles.length < 3) {
        return null;
      }

      const type = getGroupType({
        key: candidate.key,
        roles,
        relationshipTypes,
      });
      const label = getGroupLabel(candidate.key, type);

      return {
        id: toStableId(candidate.key, type),
        label,
        type,
        summary: getGroupSummary({
          label,
          type,
          key: candidate.key,
          roles,
        }),
        files: groupFiles.map((file) => file.path),
        roles: [...roles].sort(),
        relationshipTypes: [...relationshipTypes].sort(
          (a, b) => relationshipPriority(b) - relationshipPriority(a) || a.localeCompare(b),
        ),
        confidence: getStrongestConfidence(candidate.relationships),
        reasons: getReasons({
          type,
          relationships: candidate.relationships,
          roles,
        }),
      };
    })
    .filter((group): group is RepoArchitecturalGroup => Boolean(group))
    .sort(
      (a, b) =>
        confidenceRank(b.confidence) - confidenceRank(a.confidence) ||
        b.files.length - a.files.length ||
        a.label.localeCompare(b.label),
    )
    .slice(0, 8);
}
