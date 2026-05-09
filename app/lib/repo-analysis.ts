import type { OneTimeScanTier, SubscriptionPlan } from "./pricing";
import { getAnalysisBudget } from "./repo-analysis/budget.ts";
import {
  isConfigFile,
  isDocumentationFile,
  isTestFile,
} from "./repo-analysis/file-classification.ts";
import {
  createExcludedFileRecords,
  createFileSummaries,
  isRelevantRepositoryFile,
} from "./repo-analysis/file-summaries.ts";
import { getHighlightedFileSelection } from "./repo-analysis/highlighting.ts";
import { getImprovementLimit, getImprovements } from "./repo-analysis/improvements.ts";
import { getMockPullRequests } from "./repo-analysis/mock-prs.ts";
import {
  EXTENSION_LANGUAGE_MAP,
  SOURCE_EXTENSIONS,
  getExtension,
  getRootDirectory,
  getSizeLabel,
  getStructureKind,
  getTopLevelFolder,
  normalizePath,
} from "./repo-analysis/path-utils.ts";
import {
  getEntryPointScore,
  sortScoredPaths,
} from "./repo-analysis/scoring.ts";
import { getSummary } from "./repo-analysis/summaries.ts";
import { buildRepositoryStructureTree } from "./repo-analysis/tree.ts";
import type {
  AnalysisBudget,
  FileContentMap,
  MockPullRequestIdea,
  RepoExcludedFile,
  RepoFileSummary,
  RepoFileSummaryKind,
  RepoImprovement,
  RepoQualityAnalysis,
  RepositoryFile,
  RepoStructureAnalysis,
  RepoStructureSummary,
} from "./repo-analysis/types.ts";

export { buildRepositoryStructureTree } from "./repo-analysis/tree.ts";
export { detectRepositoryFrameworks } from "./repo-analysis/framework-detection.ts";
export type {
  AnalysisBudget,
  FileContentMap,
  MockPullRequestIdea,
  RepoExcludedFile,
  RepoFileSummary,
  RepoFileSummaryKind,
  RepoImprovement,
  RepoQualityAnalysis,
  RepositoryFile,
  RepositoryStructureTree,
  RepoStructureAnalysis,
  RepoStructureSummary,
} from "./repo-analysis/types.ts";

// Public orchestration layer. The implementation stages live in focused modules:
// filtering -> relevance summaries -> scoring/highlighting -> representatives -> tree/output.
export function analyzeRepoStructure(files: string[]): RepoStructureSummary {
  const repositoryFiles = files
    .map((path) => ({ path: normalizePath(path) }))
    .filter((file) => Boolean(file.path));
  const normalizedFiles = repositoryFiles
    .filter(isRelevantRepositoryFile)
    .map((file) => file.path);
  const languages: Record<string, number> = {};
  const topLevelFolders = new Set<string>();
  const {
    highlightedPaths: importantFiles,
    domainRepresentativePaths,
  } = getHighlightedFileSelection(repositoryFiles);
  const relevantFiles = createFileSummaries(
    repositoryFiles,
    importantFiles,
    domainRepresentativePaths,
  );

  normalizedFiles.forEach((path) => {
    const language = EXTENSION_LANGUAGE_MAP[getExtension(path)];
    const topLevelFolder = getTopLevelFolder(path);

    if (language) {
      languages[language] = (languages[language] ?? 0) + 1;
    }

    if (topLevelFolder) {
      topLevelFolders.add(topLevelFolder);
    }
  });

  const mainLanguages = Object.entries(languages)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([language]) => language);
  const structureKind = getStructureKind(normalizedFiles);
  const sizeLabel = getSizeLabel(normalizedFiles.length);

  return {
    totalFiles: normalizedFiles.length,
    languages,
    topLevelFolders: [...topLevelFolders].sort(),
    excludedFiles: createExcludedFileRecords(repositoryFiles),
    relevantFiles,
    highlightedFiles: relevantFiles.filter((file) => file.highlighted),
    repositoryTree: buildRepositoryStructureTree({
      relevantFiles,
      highlightedFiles: relevantFiles.filter((file) => file.highlighted),
    }),
    importantFiles,
    likelyEntryPoints: sortScoredPaths(normalizedFiles, getEntryPointScore).slice(0, 8),
    summary: `${sizeLabel} ${structureKind} repository with ${normalizedFiles.length} analyzed files${
      mainLanguages.length > 0 ? `, led by ${mainLanguages.join(", ")}` : ""
    }.`,
  };
}

function getStructureAnalysis(files: RepositoryFile[]): RepoStructureAnalysis {
  const directoryCounts = new Map<string, number>();
  const analyzableFiles = files.filter(isRelevantRepositoryFile);
  const {
    highlightedPaths: importantFiles,
    domainRepresentativePaths,
  } = getHighlightedFileSelection(files);
  const relevantFiles = createFileSummaries(
    files,
    importantFiles,
    domainRepresentativePaths,
  );
  const highlightedFiles = relevantFiles.filter((file) => file.highlighted);
  let sourceFileCount = 0;
  let testFileCount = 0;
  let configFileCount = 0;
  let documentationFileCount = 0;

  analyzableFiles.forEach((file) => {
    const root = getRootDirectory(file.path);
    directoryCounts.set(root, (directoryCounts.get(root) ?? 0) + 1);

    if (SOURCE_EXTENSIONS.has(getExtension(file.path))) {
      sourceFileCount += 1;
    }

    if (isTestFile(file.path)) {
      testFileCount += 1;
    }

    if (isConfigFile(file.path)) {
      configFileCount += 1;
    }

    if (isDocumentationFile(file.path)) {
      documentationFileCount += 1;
    }
  });

  return {
    topDirectories: [...directoryCounts.entries()]
      .map(([name, fileCount]) => ({ name, fileCount }))
      .sort((a, b) => b.fileCount - a.fileCount || a.name.localeCompare(b.name))
      .slice(0, 6),
    excludedFiles: createExcludedFileRecords(files),
    relevantFiles,
    highlightedFiles,
    repositoryTree: buildRepositoryStructureTree({
      relevantFiles,
      highlightedFiles,
    }),
    importantFiles,
    sourceFileCount,
    testFileCount,
    configFileCount,
    documentationFileCount,
  };
}

export function analyzeRepositoryQuality({
  files,
  detectedLanguages,
  detectedFrameworks,
  totalEstimatedTokens,
  suggestedTier,
  plan,
}: {
  files: RepositoryFile[];
  detectedLanguages: string[];
  detectedFrameworks: string[];
  totalEstimatedTokens: number;
  suggestedTier: OneTimeScanTier;
  plan?: SubscriptionPlan;
}): RepoQualityAnalysis {
  const structure = getStructureAnalysis(files);
  const improvements = getImprovements(
    files,
    structure,
    totalEstimatedTokens,
    detectedFrameworks,
  ).slice(0, getImprovementLimit(plan));

  return {
    summary: getSummary(files, detectedLanguages, detectedFrameworks, structure),
    structure,
    improvements,
    mockPullRequests: getMockPullRequests(
      files,
      structure,
      improvements,
      detectedFrameworks,
      plan,
    ),
    analysisBudget: getAnalysisBudget(files, totalEstimatedTokens, suggestedTier),
  };
}
