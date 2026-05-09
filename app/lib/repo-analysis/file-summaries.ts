import { classifyRepositoryPath } from "../repo-filter.ts";
import { getApplicationDomain } from "./domains.ts";
import {
  getFileSummaryKind,
  getFileSummaryReasons,
  getFileSummaryText,
  getImportantFileCategory,
} from "./file-classification.ts";
import {
  EXTENSION_LANGUAGE_MAP,
  getExtension,
  getStackSignals,
  normalizePath,
} from "./path-utils.ts";
import { getFileImportanceScore } from "./scoring.ts";
import type { RepoExcludedFile, RepoFileSummary, RepositoryFile } from "./types.ts";

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
): RepoFileSummary[] {
  const relevantInputFiles = files.filter(isRelevantRepositoryFile);
  const stackSignals = getStackSignals(relevantInputFiles.map((file) => file.path));
  const highlightedPathSet = new Set(highlightedPaths.map(normalizePath));
  const representativePathSet = new Set([...domainRepresentativePaths].map(normalizePath));

  return relevantInputFiles
    .map((file) => {
      const path = normalizePath(file.path);
      const category = getImportantFileCategory(path);
      const kind = getFileSummaryKind(path);
      const language = EXTENSION_LANGUAGE_MAP[getExtension(path)];
      const domain = getApplicationDomain(path);
      const importanceScore = getFileImportanceScore(path, stackSignals);
      const reasons = getFileSummaryReasons(path, category);
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
        domain,
        importanceScore,
        summary: getFileSummaryText({
          path,
          kind,
          category,
          language,
          domain,
          reasons,
        }),
        reasons,
        highlighted,
        highlightReason,
      };
    })
    .sort(
      (a, b) =>
        Number(b.highlighted) - Number(a.highlighted) ||
        b.importanceScore - a.importanceScore ||
        a.path.localeCompare(b.path),
    );
}
