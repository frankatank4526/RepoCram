import type {
  RepoAiContextPackage,
  RepoContextChunk,
  RepoContextFileRef,
  RepoContextPriority,
} from "../repo-analysis/types.ts";
import type {
  AiAnalysisCapability,
  AiContextAssemblyPurpose,
  AiContextAssemblyTrace,
  AiContextSelectedChunk,
  AiContextSelectedFile,
  AiPromptMessage,
  AiRepositoryContextPayload,
  AssembledAiRepositoryContext,
} from "./types.ts";

const DEFAULT_PROMPT_TOKEN_LIMIT = 6_000;
const DEFAULT_RESPONSE_TOKEN_RESERVE = 900;
const PROMPT_INSTRUCTION_TOKEN_ESTIMATE = 500;
const MAX_HIGHLIGHTED_FILE_REFS = 12;
const MAX_ARCHITECTURAL_GROUP_REFS = 8;

function estimateTextTokens(text: string) {
  return Math.ceil(text.length / 4);
}

function priorityRank(priority: RepoContextPriority) {
  return {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  }[priority];
}

function normalizeMatchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function chunkMatchesFocus(chunk: RepoContextChunk, focus: string | undefined) {
  if (!focus) {
    return false;
  }

  const normalizedFocus = normalizeMatchText(focus);
  const haystack = normalizeMatchText(
    [
      chunk.id,
      chunk.label,
      chunk.summary,
      chunk.architecturalGroupId ?? "",
      ...chunk.files.map((file) => `${file.path} ${file.domain ?? ""} ${file.role}`),
    ].join(" "),
  );

  return haystack.includes(normalizedFocus);
}

function getChunkScore({
  chunk,
  purpose,
  focus,
  representativeFlowIds,
}: {
  chunk: RepoContextChunk;
  purpose: AiContextAssemblyPurpose;
  focus?: string;
  representativeFlowIds: Set<string>;
}) {
  let score = priorityRank(chunk.priority) * 100;

  if (chunkMatchesFocus(chunk, focus)) {
    score += 350;
  }

  if (purpose === "repository_overview") {
    if (chunk.type === "framework_overview") {
      score += 90;
    }

    if (chunk.type === "architectural_group") {
      score += 55;
    }

    if (representativeFlowIds.has(chunk.id)) {
      score += 35;
    }
  }

  if (purpose === "flow_explanation" && chunk.type === "architectural_group") {
    score += 70;
  }

  if (chunk.type === "highlighted_files") {
    score += 15;
  }

  return score;
}

function sortFilesForPrompt(files: RepoContextFileRef[]) {
  return [...files].sort(
    (a, b) =>
      priorityRank(b.priority) - priorityRank(a.priority) ||
      Number(b.highlighted) - Number(a.highlighted) ||
      b.estimatedTokens - a.estimatedTokens ||
      a.path.localeCompare(b.path),
  );
}

function getChunkBaseTokenEstimate(chunk: RepoContextChunk) {
  return (
    estimateTextTokens(chunk.label) +
    estimateTextTokens(chunk.summary) +
    chunk.reasons.reduce((sum, reason) => sum + estimateTextTokens(reason), 0) +
    chunk.relationships.length * 12
  );
}

function getFileSelectionReason(file: RepoContextFileRef, chunk: RepoContextChunk) {
  if (file.priority === "critical") {
    return "critical highlighted architecture file";
  }

  if (file.highlighted) {
    return "highlighted by deterministic analysis";
  }

  if (chunk.type === "architectural_group") {
    return "part of selected architectural group";
  }

  if (file.priority === "high") {
    return "high-priority role in prepared context";
  }

  return "representative file in selected context chunk";
}

function selectChunkFiles({
  chunk,
  remainingTokens,
}: {
  chunk: RepoContextChunk;
  remainingTokens: number;
}) {
  const baseTokens = getChunkBaseTokenEstimate(chunk);
  const availableFileTokens = Math.max(0, remainingTokens - baseTokens);
  const selectedFiles: AiContextSelectedFile[] = [];
  let selectedFileTokens = 0;

  for (const file of sortFilesForPrompt(chunk.files)) {
    if (
      selectedFiles.length > 0 &&
      selectedFileTokens + file.estimatedTokens > availableFileTokens
    ) {
      continue;
    }

    if (file.estimatedTokens > availableFileTokens && selectedFiles.length === 0) {
      continue;
    }

    selectedFiles.push({
      ...file,
      selectionReason: getFileSelectionReason(file, chunk),
    });
    selectedFileTokens += file.estimatedTokens;
  }

  const selectedTokenEstimate = baseTokens + selectedFileTokens;

  return {
    selectedFiles,
    selectedTokenEstimate,
    trimmed:
      selectedFiles.length < chunk.files.length ||
      selectedTokenEstimate < chunk.estimatedTokens,
  };
}

function getSelectedReason({
  chunk,
  purpose,
  focus,
}: {
  chunk: RepoContextChunk;
  purpose: AiContextAssemblyPurpose;
  focus?: string;
}) {
  if (chunkMatchesFocus(chunk, focus)) {
    return `matches requested focus: ${focus}`;
  }

  if (chunk.type === "framework_overview") {
    return "framework and entry-point context for repository overview";
  }

  if (chunk.type === "architectural_group") {
    return `${chunk.priority} architectural group selected for ${purpose.replaceAll("_", " ")}`;
  }

  return "highlighted fallback context selected after grouped architecture";
}

function getSystemPrompt() {
  return [
    "You are RepoPilot's AI-assisted repository understanding layer.",
    "Use only the curated architectural context provided in the user message.",
    "Ground claims in selected chunks, file roles, frameworks, summaries, and relationships.",
    "Do not invent implementation details, business rules, external services, or code behavior that is not present in the context.",
    "Prefer concise, explainable repository understanding over speculation.",
  ].join("\n");
}

function formatFileForPrompt(file: AiContextSelectedFile) {
  const domain = file.domain ? `, domain: ${file.domain}` : "";

  return `- ${file.path} (${file.role}, ${file.priority}${domain}): ${file.summary}`;
}

function formatChunkForPrompt(chunk: AiContextSelectedChunk) {
  const files = chunk.files.map(formatFileForPrompt).join("\n");
  const trimmed = chunk.trimmed ? "\nTrim note: lower-priority files were omitted to fit budget." : "";

  return [
    `### ${chunk.label}`,
    `Type: ${chunk.type}`,
    `Priority: ${chunk.priority}`,
    `Reason selected: ${chunk.selectedReason}`,
    `Summary: ${chunk.summary}`,
    `Relationships included: ${chunk.relationshipCount}`,
    "Files:",
    files || "- No files fit within the remaining context budget.",
    trimmed,
  ].join("\n");
}

function getUserPrompt(payload: AiRepositoryContextPayload, trace: AiContextAssemblyTrace) {
  const frameworks =
    payload.detectedFrameworks.length > 0
      ? payload.detectedFrameworks.join(", ")
      : "None detected";
  const groups = payload.architecturalGroups
    .map((group) => `- ${group.label} (${group.type}, ${group.confidence}): ${group.summary}`)
    .join("\n");
  const chunks = payload.chunks.map(formatChunkForPrompt).join("\n\n");

  return [
    "Generate an AI-assisted repository overview from the curated context below.",
    "",
    "Output requirements:",
    "- Explain what the application appears to do from the available architecture context.",
    "- Identify major architectural patterns, frameworks, and frontend/backend boundaries.",
    "- Name major flows, personas, or feature areas only when grounded in selected chunks/groups.",
    "- Mention that details are based on curated scan metadata, not full source ingestion.",
    "- Keep the answer concise and avoid generic filler.",
    "",
    "Repository summary:",
    payload.repositorySummary,
    "",
    `Detected frameworks: ${frameworks}`,
    "",
    "Architectural groups in scope:",
    groups || "- No deterministic architectural groups were included.",
    "",
    "Prioritized representative context chunks:",
    chunks || "- No chunks were selected.",
    "",
    "Context trace summary:",
    `- Estimated prompt tokens: ${trace.estimatedPromptTokens}`,
    `- Selected context tokens: ${trace.selectedTokenEstimate}`,
    `- Selected chunks: ${trace.selectedChunks.map((chunk) => chunk.label).join(", ") || "none"}`,
  ].join("\n");
}

function buildPayload({
  aiContext,
  purpose,
  selectedChunks,
}: {
  aiContext: RepoAiContextPackage;
  purpose: AiContextAssemblyPurpose;
  selectedChunks: AiContextSelectedChunk[];
}): AiRepositoryContextPayload {
  const selectedGroupIds = new Set(
    selectedChunks
      .map((chunk) => chunk.architecturalGroupId)
      .filter((id): id is string => Boolean(id)),
  );
  const selectedGroupRefs = aiContext.architecturalGroups.filter((group) =>
    selectedGroupIds.has(group.id),
  );
  const fallbackGroupRefs = aiContext.architecturalGroups
    .filter((group) => !selectedGroupIds.has(group.id))
    .slice(0, Math.max(0, MAX_ARCHITECTURAL_GROUP_REFS - selectedGroupRefs.length));

  return {
    capability: "repository_overview" satisfies AiAnalysisCapability,
    purpose,
    repositorySummary: aiContext.repositorySummary,
    detectedFrameworks: aiContext.detectedFrameworks,
    architecturalGroups: [...selectedGroupRefs, ...fallbackGroupRefs]
      .slice(0, MAX_ARCHITECTURAL_GROUP_REFS)
      .map((group) => ({
        id: group.id,
        label: group.label,
        type: group.type,
        summary: group.summary,
        files: group.files,
        confidence: group.confidence,
        reasons: group.reasons,
      })),
    chunks: selectedChunks,
    highlightedFiles: aiContext.highlightedFiles.slice(0, MAX_HIGHLIGHTED_FILE_REFS),
    constraints: [
      "Context was assembled from deterministic Phase 2 metadata.",
      "Source files were not dumped wholesale into the prompt.",
      "Claims should stay grounded in selected chunks, file summaries, relationships, and groups.",
    ],
  };
}

export function assembleAiRepositoryContext({
  aiContext,
  purpose = "repository_overview",
  focus,
  maxPromptTokens = DEFAULT_PROMPT_TOKEN_LIMIT,
  responseTokenReserve = DEFAULT_RESPONSE_TOKEN_RESERVE,
}: {
  aiContext: RepoAiContextPackage;
  purpose?: AiContextAssemblyPurpose;
  focus?: string;
  maxPromptTokens?: number;
  responseTokenReserve?: number;
}): AssembledAiRepositoryContext {
  const availableContextTokens = Math.max(
    0,
    maxPromptTokens - responseTokenReserve - PROMPT_INSTRUCTION_TOKEN_ESTIMATE,
  );
  const representativeFlowIds = new Set(aiContext.representativeFlows.map((chunk) => chunk.id));
  const sortedChunks = [...aiContext.chunks].sort(
    (a, b) =>
      getChunkScore({ chunk: b, purpose, focus, representativeFlowIds }) -
        getChunkScore({ chunk: a, purpose, focus, representativeFlowIds }) ||
      a.label.localeCompare(b.label),
  );
  const selectedChunks: AiContextSelectedChunk[] = [];
  const omittedChunks: AiContextAssemblyTrace["omittedChunks"] = [];
  let selectedTokenEstimate = 0;

  for (const chunk of sortedChunks) {
    const remainingTokens = availableContextTokens - selectedTokenEstimate;

    if (remainingTokens <= 0) {
      omittedChunks.push({
        id: chunk.id,
        label: chunk.label,
        priority: chunk.priority,
        estimatedTokens: chunk.estimatedTokens,
        reason: "context budget exhausted",
      });
      continue;
    }

    const fileSelection = selectChunkFiles({ chunk, remainingTokens });

    if (fileSelection.selectedFiles.length === 0) {
      omittedChunks.push({
        id: chunk.id,
        label: chunk.label,
        priority: chunk.priority,
        estimatedTokens: chunk.estimatedTokens,
        reason: "no representative files fit remaining token budget",
      });
      continue;
    }

    selectedChunks.push({
      id: chunk.id,
      label: chunk.label,
      type: chunk.type,
      priority: chunk.priority,
      summary: chunk.summary,
      estimatedTokens: chunk.estimatedTokens,
      selectedTokenEstimate: fileSelection.selectedTokenEstimate,
      selectedReason: getSelectedReason({ chunk, purpose, focus }),
      files: fileSelection.selectedFiles,
      relationshipCount: chunk.relationships.length,
      architecturalGroupId: chunk.architecturalGroupId,
      trimmed: fileSelection.trimmed,
    });
    selectedTokenEstimate += fileSelection.selectedTokenEstimate;
  }

  const includedGroupIds = new Set(
    selectedChunks
      .map((chunk) => chunk.architecturalGroupId)
      .filter((id): id is string => Boolean(id)),
  );
  const estimatedPromptTokens =
    selectedTokenEstimate + PROMPT_INSTRUCTION_TOKEN_ESTIMATE + responseTokenReserve;
  const trace: AiContextAssemblyTrace = {
    purpose,
    focus: focus ?? null,
    maxPromptTokens,
    responseTokenReserve,
    availableContextTokens,
    estimatedPromptTokens,
    selectedTokenEstimate,
    selectedChunks,
    omittedChunks,
    includedArchitecturalGroups: aiContext.architecturalGroups
      .filter((group) => includedGroupIds.has(group.id))
      .map((group) => ({
        id: group.id,
        label: group.label,
        type: group.type,
        reason: "selected through representative architectural context chunk",
      })),
    selectedFiles: selectedChunks.flatMap((chunk) =>
      chunk.files.map((file) => ({
        path: file.path,
        chunkId: chunk.id,
        priority: file.priority,
        estimatedTokens: file.estimatedTokens,
        reason: file.selectionReason,
      })),
    ),
    budgeting: {
      strategy:
        "Select Phase 2 chunks by purpose-specific priority, then trim lower-priority files inside selected chunks to fit the prompt budget.",
      phase2EstimatedTokens: aiContext.tokenBudget.estimatedTokens,
      phase2MaxRecommendedTokens: aiContext.tokenBudget.maxRecommendedTokens,
      phase2BudgetStatus: aiContext.tokenBudget.budgetStatus,
    },
  };
  const payload = buildPayload({ aiContext, purpose, selectedChunks });
  const messages: AiPromptMessage[] = [
    { role: "system", content: getSystemPrompt() },
    { role: "user", content: getUserPrompt(payload, trace) },
  ];

  return {
    payload,
    messages,
    trace,
  };
}
