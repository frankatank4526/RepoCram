import type {
  RepoAiContextPackage,
  RepoArchitecturalGroup,
  RepoContextChunk,
  RepoContextFileRef,
  RepoContextPriority,
  RepoFileRelationship,
  RepoFileRole,
  RepoFileSummary,
} from "./types.ts";

const DEFAULT_CONTEXT_TOKEN_LIMIT = 12_000;
const MAX_GROUP_FILES = 6;
const MAX_CONTEXT_CHUNKS = 8;
const HIGH_VALUE_ROLES = new Set<RepoFileRole>([
  "api_route",
  "controller",
  "framework_entry",
  "frontend_page",
  "service",
  "state_management",
]);

function estimateTextTokens(text: string) {
  return Math.ceil(text.length / 4);
}

function estimateFileTokens(file: RepoFileSummary) {
  const sizeEstimate = typeof file.size === "number" ? Math.ceil(file.size / 4) : 120;
  const summaryEstimate = estimateTextTokens(file.summary);
  const relationshipEstimate = file.relationships.length * 10;

  return Math.max(40, Math.min(sizeEstimate, 2_500)) + summaryEstimate + relationshipEstimate;
}

function priorityRank(priority: RepoContextPriority) {
  return {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  }[priority];
}

function getFilePriority(file: RepoFileSummary): RepoContextPriority {
  if (
    file.highlighted &&
    (file.role === "framework_entry" ||
      file.role === "api_route" ||
      file.role === "state_management")
  ) {
    return "critical";
  }

  if (file.highlighted || HIGH_VALUE_ROLES.has(file.role)) {
    return "high";
  }

  if (
    file.relationships.length > 0 ||
    file.role === "frontend_component" ||
    file.role === "shared_logic" ||
    file.role === "model" ||
    file.role === "view"
  ) {
    return "medium";
  }

  return "low";
}

function toFileRef(file: RepoFileSummary): RepoContextFileRef {
  return {
    path: file.path,
    role: file.role,
    category: file.category,
    domain: file.domain,
    highlighted: file.highlighted,
    priority: getFilePriority(file),
    estimatedTokens: estimateFileTokens(file),
    summary: file.summary,
    reasons: [...new Set([...file.reasons, file.role.replaceAll("_", " ")])].slice(0, 4),
  };
}

function getChunkPriority(group: RepoArchitecturalGroup): RepoContextPriority {
  if (
    ["auth_flow", "frontend_backend_flow", "mvc_group", "persona_workflow"].includes(group.type)
  ) {
    return group.confidence === "strong" ? "critical" : "high";
  }

  if (group.type === "state_flow" || group.type === "api_group") {
    return "high";
  }

  return "medium";
}

function getRelationshipSetForFiles(
  relationships: RepoFileRelationship[],
  paths: string[],
) {
  const pathSet = new Set(paths);

  return relationships
    .filter(
      (relationship) =>
        pathSet.has(relationship.sourcePath) && pathSet.has(relationship.targetPath),
    )
    .slice(0, 12);
}

function sortFilesForContext(files: RepoFileSummary[]) {
  return [...files].sort(
    (a, b) =>
      priorityRank(getFilePriority(b)) - priorityRank(getFilePriority(a)) ||
      Number(b.highlighted) - Number(a.highlighted) ||
      b.importanceScore - a.importanceScore ||
      a.path.localeCompare(b.path),
  );
}

function getGroupChunk({
  group,
  filesByPath,
  relationships,
}: {
  group: RepoArchitecturalGroup;
  filesByPath: Map<string, RepoFileSummary>;
  relationships: RepoFileRelationship[];
}): RepoContextChunk | null {
  const files = sortFilesForContext(
    group.files
      .map((path) => filesByPath.get(path))
      .filter((file): file is RepoFileSummary => Boolean(file)),
  ).slice(0, MAX_GROUP_FILES);

  if (files.length < 2) {
    return null;
  }

  const fileRefs = files.map(toFileRef);
  const chunkRelationships = getRelationshipSetForFiles(
    relationships,
    files.map((file) => file.path),
  );
  const relationshipTokens = chunkRelationships.length * 12;
  const estimatedTokens =
    fileRefs.reduce((sum, file) => sum + file.estimatedTokens, 0) +
    estimateTextTokens(group.summary) +
    relationshipTokens;

  return {
    id: `group:${group.id}`,
    label: group.label,
    type: "architectural_group",
    summary: group.summary,
    priority: getChunkPriority(group),
    estimatedTokens,
    files: fileRefs,
    relationships: chunkRelationships,
    architecturalGroupId: group.id,
    reasons: [
      `${group.type.replaceAll("_", " ")} group`,
      ...group.reasons,
    ].slice(0, 4),
  };
}

function getFrameworkOverviewChunk({
  files,
  detectedFrameworks,
  relationships,
}: {
  files: RepoFileSummary[];
  detectedFrameworks: string[];
  relationships: RepoFileRelationship[];
}): RepoContextChunk | null {
  const overviewFiles = sortFilesForContext(
    files.filter(
      (file) =>
        file.role === "framework_entry" ||
        (file.kind === "config" && file.importanceScore > 0) ||
        (file.kind === "documentation" && file.highlighted),
    ),
  ).slice(0, 6);

  if (overviewFiles.length === 0) {
    return null;
  }

  const fileRefs = overviewFiles.map(toFileRef);
  const chunkRelationships = getRelationshipSetForFiles(
    relationships,
    overviewFiles.map((file) => file.path),
  );
  const summary =
    detectedFrameworks.length > 0
      ? `Framework overview for ${detectedFrameworks.join(", ")} repository context.`
      : "Framework overview for repository entry points and configuration.";

  return {
    id: "framework-overview",
    label: "Framework Overview",
    type: "framework_overview",
    summary,
    priority: "high",
    estimatedTokens:
      fileRefs.reduce((sum, file) => sum + file.estimatedTokens, 0) +
      estimateTextTokens(summary) +
      chunkRelationships.length * 12,
    files: fileRefs,
    relationships: chunkRelationships,
    reasons: ["framework entry/config context", "future onboarding context"],
  };
}

function getHighlightedChunk({
  files,
  relationships,
  existingChunkPaths,
}: {
  files: RepoFileSummary[];
  relationships: RepoFileRelationship[];
  existingChunkPaths: Set<string>;
}): RepoContextChunk | null {
  const highlightedFiles = sortFilesForContext(
    files.filter((file) => file.highlighted && !existingChunkPaths.has(file.path)),
  ).slice(0, 8);

  if (highlightedFiles.length === 0) {
    return null;
  }

  const fileRefs = highlightedFiles.map(toFileRef);
  const chunkRelationships = getRelationshipSetForFiles(
    relationships,
    highlightedFiles.map((file) => file.path),
  );

  return {
    id: "highlighted-reading-list",
    label: "Highlighted Reading List",
    type: "highlighted_files",
    summary: "Core highlighted files not already covered by architectural group chunks.",
    priority: "medium",
    estimatedTokens:
      fileRefs.reduce((sum, file) => sum + file.estimatedTokens, 0) +
      estimateTextTokens("Core highlighted files not already covered by architectural group chunks.") +
      chunkRelationships.length * 12,
    files: fileRefs,
    relationships: chunkRelationships,
    reasons: ["highlighted file coverage", "fallback representative context"],
  };
}

function getTokenBudget(chunks: RepoContextChunk[]) {
  const fileTokenEstimate = chunks.reduce(
    (sum, chunk) => sum + chunk.files.reduce((fileSum, file) => fileSum + file.estimatedTokens, 0),
    0,
  );
  const summaryTokenEstimate = chunks.reduce(
    (sum, chunk) => sum + estimateTextTokens(chunk.summary),
    0,
  );
  const relationshipTokenEstimate = chunks.reduce(
    (sum, chunk) => sum + chunk.relationships.length * 12,
    0,
  );
  const estimatedTokens =
    fileTokenEstimate + summaryTokenEstimate + relationshipTokenEstimate;
  const budgetRatio = estimatedTokens / DEFAULT_CONTEXT_TOKEN_LIMIT;

  return {
    estimatedTokens,
    maxRecommendedTokens: DEFAULT_CONTEXT_TOKEN_LIMIT,
    budgetStatus:
      budgetRatio >= 1 ? "over_budget" : budgetRatio >= 0.8 ? "near_limit" : "within_budget",
    fileTokenEstimate,
    summaryTokenEstimate,
    relationshipTokenEstimate,
    strategy:
      "Build context from architectural groups first, then add framework and highlighted-file fallback chunks.",
  } as const;
}

function limitChunksToBudget(chunks: RepoContextChunk[]) {
  const sortedChunks = [...chunks].sort(
    (a, b) =>
      priorityRank(b.priority) - priorityRank(a.priority) ||
      b.files.length - a.files.length ||
      a.label.localeCompare(b.label),
  );
  const selected: RepoContextChunk[] = [];
  let tokenTotal = 0;

  for (const chunk of sortedChunks) {
    if (
      selected.length >= MAX_CONTEXT_CHUNKS ||
      (tokenTotal + chunk.estimatedTokens > DEFAULT_CONTEXT_TOKEN_LIMIT &&
        selected.length > 0)
    ) {
      continue;
    }

    selected.push(chunk);
    tokenTotal += chunk.estimatedTokens;
  }

  return selected;
}

export function prepareAiRepositoryContext({
  detectedFrameworks,
  repositorySummary,
  relevantFiles,
  highlightedFiles,
  relationships,
  architecturalGroups,
}: {
  detectedFrameworks: string[];
  repositorySummary: string;
  relevantFiles: RepoFileSummary[];
  highlightedFiles: RepoFileSummary[];
  relationships: RepoFileRelationship[];
  architecturalGroups: RepoArchitecturalGroup[];
}): RepoAiContextPackage {
  const filesByPath = new Map(relevantFiles.map((file) => [file.path, file]));
  const groupChunks = architecturalGroups
    .map((group) =>
      getGroupChunk({
        group,
        filesByPath,
        relationships,
      }),
    )
    .filter((chunk): chunk is RepoContextChunk => Boolean(chunk));
  const groupedPaths = new Set(groupChunks.flatMap((chunk) => chunk.files.map((file) => file.path)));
  const fallbackChunks = [
    getFrameworkOverviewChunk({
      files: relevantFiles,
      detectedFrameworks,
      relationships,
    }),
    getHighlightedChunk({
      files: relevantFiles,
      relationships,
      existingChunkPaths: groupedPaths,
    }),
  ].filter((chunk): chunk is RepoContextChunk => Boolean(chunk));
  const chunks = limitChunksToBudget([...groupChunks, ...fallbackChunks]);
  const selectedPaths = new Set(chunks.flatMap((chunk) => chunk.files.map((file) => file.path)));
  const highlightedContextFiles = sortFilesForContext(highlightedFiles).map(toFileRef);
  const highPriorityFiles = sortFilesForContext(
    relevantFiles.filter(
      (file) => selectedPaths.has(file.path) && priorityRank(getFilePriority(file)) >= 3,
    ),
  ).map((file) => file.path);
  const deferredFiles = sortFilesForContext(
    relevantFiles.filter((file) => !selectedPaths.has(file.path)),
  )
    .slice(0, 16)
    .map((file) => file.path);

  return {
    version: "phase3-groundwork-v1",
    detectedFrameworks,
    repositorySummary,
    tokenBudget: getTokenBudget(chunks),
    highlightedFiles: highlightedContextFiles,
    architecturalGroups,
    representativeFlows: chunks.filter(
      (chunk) =>
        chunk.type === "architectural_group" &&
        ["critical", "high"].includes(chunk.priority),
    ),
    chunks,
    prioritization: {
      highPriorityFiles,
      deferredFiles,
      reasons: [
        "prioritizes highlighted files and architectural groups",
        "keeps related files together inside context chunks",
        "defers weakly connected or low-priority files",
      ],
    },
  };
}
