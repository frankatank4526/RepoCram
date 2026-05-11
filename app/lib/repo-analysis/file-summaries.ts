import { classifyRepositoryPath } from "../repo-filter.ts";
import { getApplicationDomain } from "./domains.ts";
import { getArchitectureFileSummary } from "./file-architecture-summaries.ts";
import {
  getFileSummaryKind,
  getFileSummaryReasons,
  getImportantFileCategory,
} from "./file-classification.ts";
import { getFileRole } from "./file-roles.ts";
import {
  EXTENSION_LANGUAGE_MAP,
  getExtension,
  getStackSignals,
  normalizePath,
} from "./path-utils.ts";
import { getFileRelationships, groupRelationshipsBySource } from "./relationships.ts";
import { getFileImportanceScore } from "./scoring.ts";
import type {
  FileContentMap,
  RepoExcludedFile,
  RepoFileSummary,
  RepositoryFile,
} from "./types.ts";

// relevantFiles are intentionally broad. This layer applies the centralized
// repository filter, removes non-context artifacts, and keeps source/config/docs
// available for later ranking without deciding what should be highlighted.
export function createExcludedFileRecords(files: RepositoryFile[]) {
  return files
    .map((file): RepoExcludedFile | null => {
      const path = normalizePath(file.path);
      const classification = classifyRepositoryPath(path);

      if (classification.shouldScan) {
        return null;
      }

      return {
        path,
        size: file.size,
        reason: classification.reason ?? "excluded by repository filter",
      };
    })
    .filter((file): file is RepoExcludedFile => Boolean(file))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export function isRelevantRepositoryFile(file: RepositoryFile) {
  const path = normalizePath(file.path);
  const classification = classifyRepositoryPath(path);

  if (!classification.shouldScan) {
    return false;
  }

  const kind = getFileSummaryKind(path);

  return kind !== "asset" && kind !== "data";
}

export function createFileSummaries(
  files: RepositoryFile[],
  highlightedPaths: string[],
  domainRepresentativePaths = new Set<string>(),
  detectedFrameworks: string[] = [],
  fileContents?: FileContentMap,
): RepoFileSummary[] {
  const relevantInputFiles = files.filter(isRelevantRepositoryFile);
  const stackSignals = getStackSignals(relevantInputFiles.map((file) => file.path));
  const highlightedPathSet = new Set(highlightedPaths.map(normalizePath));
  const representativePathSet = new Set([...domainRepresentativePaths].map(normalizePath));
  const summaryInputs = relevantInputFiles
    .map((file) => {
      const path = normalizePath(file.path);
      const category = getImportantFileCategory(path);
      const kind = getFileSummaryKind(path);
      const language = EXTENSION_LANGUAGE_MAP[getExtension(path)];
      const domain = getApplicationDomain(path);
      const importanceScore = getFileImportanceScore(path, stackSignals);
      const reasons = getFileSummaryReasons(path, category);
      const role = getFileRole({
        path,
        kind,
        category,
        detectedFrameworks,
        stackSignals,
      });
      const highlighted = highlightedPathSet.has(path);
      const highlightReason: RepoFileSummary["highlightReason"] = highlighted
        ? representativePathSet.has(path)
          ? "domain_representative"
          : "ranked"
        : undefined;

      return {
        path,
        size: file.size,
        language,
        kind,
        category,
        role,
        domain,
        importanceScore,
        summary: "",
        reasons,
        relationships: [],
        highlighted,
        highlightReason,
      };
    });
  const relationships = getFileRelationships({
    files: summaryInputs,
    detectedFrameworks,
    fileContents,
  });
  const relationshipsBySource = groupRelationshipsBySource(relationships);

  return summaryInputs
    .map((file) => {
      const fileRelationships = relationshipsBySource.get(file.path) ?? [];

      return {
        ...file,
        relationships: fileRelationships,
        summary: getArchitectureFileSummary({
          path: file.path,
          kind: file.kind,
          category: file.category,
          role: file.role,
          language: file.language,
          domain: file.domain,
          reasons: file.reasons,
          detectedFrameworks,
          relationships: fileRelationships,
        }),
      };
    })
    .sort(
      (a, b) =>
        Number(b.highlighted) - Number(a.highlighted) ||
        b.importanceScore - a.importanceScore ||
        a.path.localeCompare(b.path),
    );
}
